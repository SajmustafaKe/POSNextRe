import frappe
from frappe.utils import getdate
from collections import defaultdict

@frappe.whitelist()
def get_payment_summary(posting_date):
    posting_date = getdate(posting_date)
    
    entries = frappe.get_all(
        "POS Closing Entry",
        filters={
            "docstatus": 1,
            "posting_date": posting_date
        },
        fields=["name", "user"]
    )

    summary = defaultdict(lambda: defaultdict(float))  # {user: {mode_of_payment: total}}

    for entry in entries:
        payments = frappe.get_all(
            "POS Closing Payment Entry",
            filters={"parent": entry.name},
            fields=["mode_of_payment", "closing_amount"]
        )

        for p in payments:
            summary[entry.user][p.mode_of_payment] += float(p.closing_amount or 0)

    return summary  # will return dict[user][mode] = total

