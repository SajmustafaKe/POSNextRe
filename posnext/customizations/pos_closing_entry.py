from collections import defaultdict
from frappe.utils import get_datetime
import frappe

@frappe.whitelist()
def get_pos_invoices_by_submitter(user, period_start_date, period_end_date):
    start = get_datetime(period_start_date)
    end = get_datetime(period_end_date)

    # Fetch Sales Invoices for the user within the period
    invoices = frappe.get_all(
        "Sales Invoice",
        filters={
            "docstatus": 1,
            "is_pos": 1,
            "modified_by": user,
            "posting_date": ["between", [start.date(), end.date()]]
        },
        fields=[
            "name",
            "net_total",
            "grand_total",
            "posting_date",
            "customer",
            "is_return",
            "return_against"
        ]
    )

    # Initialize payments list
    payments = []

    # If no invoices, fetch Payment Entries with no linked invoices
    if not invoices:
        payment_entries = frappe.get_all(
            "Payment Entry",
            filters={
                "payment_type": "Receive",
                "docstatus": 1,
                "modified_by": user,
                "posting_date": ["between", [start.date(), end.date()]],
                "posting_time": ["between", [start.time(), end.time()]] if start.date() == end.date() else [">=", start.time()]
            },
            fields=["name", "mode_of_payment", "paid_amount as amount"]
        )

        if payment_entries:
            # Get Payment Entry References
            pe_names = [pe["name"] for pe in payment_entries]
            payment_references = frappe.get_all(
                "Payment Entry Reference",
                filters={"parent": ["in", pe_names]},
                fields=["parent", "reference_name"]
            )
            pe_with_refs = set(pr["parent"] for pr in payment_references)

            # Include Payment Entries with no linked invoices
            for pe in payment_entries:
                if pe["name"] not in pe_with_refs:
                    payments.append({
                        "parent": pe["name"],
                        "mode_of_payment": pe["mode_of_payment"],
                        "amount": pe["amount"]
                    })

        # Process payment data
        mode_of_payment_totals = defaultdict(float)
        for payment in payments:
            mode_of_payment_totals[payment["mode_of_payment"]] += payment["amount"]

        return {
            "invoices": [],
            "payments": dict(mode_of_payment_totals)
        }

    # Fetch payments from Sales Invoice Payment for invoices in the period
    invoice_names = [inv["name"] for inv in invoices]
    payments.extend(
        frappe.get_all(
            "Sales Invoice Payment",
            filters={"parent": ["in", invoice_names]},
            fields=["parent", "mode_of_payment", "amount"]
        )
    )

    # Fetch all Payment Entries of type Receive for the user
    payment_entries = frappe.get_all(
        "Payment Entry",
        filters={
            "payment_type": "Receive",
            "docstatus": 1,
            "modified_by": user,
            "posting_date": ["between", [start.date(), end.date()]],
            "posting_time": ["between", [start.time(), end.time()]] if start.date() == end.date() else [">=", start.time()]
        },
        fields=["name", "mode_of_payment", "paid_amount as amount"]
    )

    if payment_entries:
        pe_names = [pe["name"] for pe in payment_entries]
        # Fetch Payment Entry References
        payment_references = frappe.get_all(
            "Payment Entry Reference",
            filters={
                "parent": ["in", pe_names],
                "reference_doctype": "Sales Invoice"
            },
            fields=["parent", "reference_name"]
        )

        # Get all referenced invoices with their posting dates
        if payment_references:
            ref_invoice_names = list(set(pr["reference_name"] for pr in payment_references))
            ref_invoices = frappe.get_all(
                "Sales Invoice",
                filters={
                    "docstatus": 1,
                    "name": ["in", ref_invoice_names]
                },
                fields=["name", "posting_date"]
            )

            # Identify invoices outside the period
            outside_invoice_names = set(
                inv["name"] for inv in ref_invoices
                if inv["posting_date"] < start.date() or inv["posting_date"] > end.date()
            )

            # Map Payment Entries to their referenced invoices
            pe_to_invoices = defaultdict(set)
            for pr in payment_references:
                pe_to_invoices[pr["parent"]].add(pr["reference_name"])

            # Include Payment Entries with no linked invoices or linked to invoices outside the period
            pe_with_refs = set(pr["parent"] for pr in payment_references)
            for pe in payment_entries:
                if pe["name"] not in pe_with_refs or pe_to_invoices[pe["name"]].issubset(outside_invoice_names):
                    payments.append({
                        "parent": pe["name"],
                        "mode_of_payment": pe["mode_of_payment"],
                        "amount": pe["amount"]
                    })

    # Fetch Payment Entry References for invoices in the period to include their modes of payment
    payment_entry_refs = frappe.get_all(
        "Payment Entry Reference",
        filters={
            "reference_doctype": "Sales Invoice",
            "reference_name": ["in", invoice_names]
        },
        fields=["parent", "allocated_amount"]
    )

    # Get Payment Entry modes of payment
    pe_names = list(set(ref["parent"] for ref in payment_entry_refs))
    pe_mode_map = {}
    if pe_names:
        pe_docs = frappe.get_all(
            "Payment Entry",
            filters={
                "name": ["in", pe_names],
                "payment_type": "Receive",
                "docstatus": 1
            },
            fields=["name", "mode_of_payment"]
        )
        pe_mode_map = {pe["name"]: pe["mode_of_payment"] for pe in pe_docs}

    # Avoid double-counting payments
    existing = set((p["parent"], p["mode_of_payment"], float(p["amount"])) for p in payments)
    for pe_ref in payment_entry_refs:
        mode = pe_mode_map.get(pe_ref["parent"])
        if mode:
            key = (pe_ref["parent"], mode, float(pe_ref["allocated_amount"]))
            if key not in existing:
                payments.append({
                    "parent": pe_ref["parent"],
                    "mode_of_payment": mode,
                    "amount": pe_ref["allocated_amount"]
                })

    # Process payment data
    mode_of_payment_totals = defaultdict(float)
    for payment in payments:
        mode_of_payment_totals[payment["mode_of_payment"]] += payment["amount"]

    return {
        "invoices": invoices,
        "payments": dict(mode_of_payment_totals)
    }