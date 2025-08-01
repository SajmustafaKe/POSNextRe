import frappe
from frappe.utils import get_datetime
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

    # Collect expected amounts by Mode of Payment
    payments_summary = defaultdict(float)

    invoice_names = [inv["name"] for inv in invoices]

    if invoice_names:
        payments = frappe.get_all(
            "Sales Invoice Payment",
            filters={"parent": ["in", invoice_names]},
            fields=["mode_of_payment", "amount"]
        )

        for payment in payments:
            payments_summary[payment.mode_of_payment] += float(payment.amount or 0)

    return {
        "invoices": invoices,
        "payments": dict(payments_summary)
    }