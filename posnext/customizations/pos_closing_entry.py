import frappe
from frappe.utils import get_datetime, flt
from collections import defaultdict

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

    if not invoices:
        return {
            "invoices": [],
            "payments": {}
        }

    # Fetch all payments from Sales Invoice Payment table
    invoice_names = [inv["name"] for inv in invoices]
    payments = frappe.get_all(
        "Sales Invoice Payment",
        filters={"parent": ["in", invoice_names]},
        fields=["parent", "mode_of_payment", "amount"]
    )

    # Fetch all Payment Entries with "Receive" type, submitted, for these invoices
    payment_entries = frappe.get_all(
        "Payment Entry Reference",
        filters={
            "reference_doctype": "Sales Invoice",
            "reference_name": ["in", invoice_names]
        },
        fields=["parent", "allocated_amount"]
    )

    # Get all Payment Entry docs with payment_type "Receive" and docstatus 1
    pe_names = list(set([pe["parent"] for pe in payment_entries]))
    pe_docs = []
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

    # Only include payment entries with payment_type "Receive"
    # Avoid double-counting by tracking what we've already added
    existing = set((p["parent"], p["mode_of_payment"], float(p["amount"])) for p in payments)
    
    for pe_ref in payment_entries:
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

    # Since we don't have company/territory info, we'll skip the internal transfers
    # that require company and territory filters from the original function

    return {
        "invoices": invoices,
        "payments": dict(mode_of_payment_totals)
    }