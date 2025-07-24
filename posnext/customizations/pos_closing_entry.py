import frappe
from frappe.utils import get_datetime, flt
from collections import defaultdict

@frappe.whitelist()
def get_pos_invoices_by_submitter(user, period_start_date, period_end_date, pos_opening_entry=None):
    start = get_datetime(period_start_date)
    end = get_datetime(period_end_date)
    
    # Base filters
    filters = {
        "docstatus": 1,
        "is_pos": 1,
        "posting_date": ["between", [start.date(), end.date()]]
    }
    
    # CRITICAL FIX: Filter by POS Opening Entry to avoid previous sessions
    if pos_opening_entry:
        filters["pos_opening_entry"] = pos_opening_entry
    
    # Fetch Sales Invoices for the specific POS session
    invoices = frappe.get_all(
        "Sales Invoice",
        filters=filters,
        fields=[
            "name",
            "net_total", 
            "grand_total",
            "posting_date",
            "customer",
            "is_return",
            "return_against",
            "pos_opening_entry"  # Added for verification
        ],
        order_by="posting_date desc"
    )

    payments_summary = defaultdict(float)

    if invoices:
        invoice_names = [inv["name"] for inv in invoices]

        # Get all payments for these invoices
        payments = frappe.get_all(
            "Sales Invoice Payment",
            filters={"parent": ["in", invoice_names]},
            fields=["mode_of_payment", "amount", "parent"]
        )

        # Sum up payments by mode of payment
        for payment in payments:
            mode_of_payment = payment.get("mode_of_payment")
            amount = flt(payment.get("amount", 0))
            if mode_of_payment:
                payments_summary[mode_of_payment] += amount

    # Debug logging
    frappe.logger().info(f"POS Opening Entry: {pos_opening_entry}")
    frappe.logger().info(f"Found {len(invoices)} invoices for user {user}")
    frappe.logger().info(f"Payment summary: {dict(payments_summary)}")

    return {
        "invoices": invoices,
        "payments": dict(payments_summary)
    }