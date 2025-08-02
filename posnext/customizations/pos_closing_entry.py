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
            "creation": ["between", [start, end]]
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

    if invoices:
        # We have invoices in the period, so get their payments from Sales Invoice Payment table
        invoice_names = [inv["name"] for inv in invoices]
        invoice_payments = frappe.get_all(
            "Sales Invoice Payment",
            filters={"parent": ["in", invoice_names]},
            fields=["parent", "mode_of_payment", "amount"]
        )
        payments.extend(invoice_payments)

    # Now handle standalone Payment Entries (those not linked to any invoice OR linked only to invoices outside the period)
    payment_entries = frappe.get_all(
        "Payment Entry",
        filters={
            "payment_type": "Receive",
            "docstatus": 1,
            "modified_by": user,
            "creation": ["between", [start, end]]
        },
        fields=["name", "mode_of_payment", "paid_amount as amount"]
    )

    if payment_entries:
        pe_names = [pe["name"] for pe in payment_entries]
        
        # Get all Payment Entry References for these Payment Entries
        payment_references = frappe.get_all(
            "Payment Entry Reference",
            filters={
                "parent": ["in", pe_names],
                "reference_doctype": "Sales Invoice"
            },
            fields=["parent", "reference_name"]
        )

        # Create sets for easier lookup
        pe_with_refs = set()
        pe_to_invoices = defaultdict(set)
        
        for pr in payment_references:
            pe_with_refs.add(pr["parent"])
            pe_to_invoices[pr["parent"]].add(pr["reference_name"])

        # Create a set of invoice names that we already fetched for this period
        fetched_invoice_names = set(inv["name"] for inv in invoices)

        # Process each Payment Entry
        for pe in payment_entries:
            pe_name = pe["name"]
            
            # Include Payment Entry if:
            # 1. It has no references to any invoices, OR
            # 2. None of its referenced invoices are in our fetched invoices list
            if pe_name not in pe_with_refs:
                # No references - include it
                payments.append({
                    "parent": pe_name,
                    "mode_of_payment": pe["mode_of_payment"],
                    "amount": pe["amount"]
                })
            else:
                # Has references - check if any reference invoices are in our fetched list
                referenced_invoices = pe_to_invoices[pe_name]
                references_fetched_invoice = bool(referenced_invoices.intersection(fetched_invoice_names))
                
                if not references_fetched_invoice:
                    # No referenced invoices are in our fetched list - include it
                    payments.append({
                        "parent": pe_name,
                        "mode_of_payment": pe["mode_of_payment"],
                        "amount": pe["amount"]
                    })

    # Process payment data
    mode_of_payment_totals = defaultdict(float)
    for payment in payments:
        mode_of_payment_totals[payment["mode_of_payment"]] += payment["amount"]

    return {
        "invoices": invoices,
        "payments": dict(mode_of_payment_totals)
    }