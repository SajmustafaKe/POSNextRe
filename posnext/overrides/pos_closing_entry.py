import frappe
from frappe.utils import flt, get_datetime
@frappe.whitelist()
def get_pos_invoices(start, end, pos_profile, user):
    print("HEEEEEEEEEEEEEEEEERE")
    data = frappe.db.sql(
        """
    select
        name, timestamp(posting_date, posting_time) as "timestamp"
    from
        `tabSales Invoice`
    where
        owner = %s and docstatus = 1 and pos_profile = %s
    """,
        (user, pos_profile),
        as_dict=1,
    )

    data = list(filter(lambda d: get_datetime(start) <= get_datetime(d.timestamp) <= get_datetime(end), data))
    # need to get taxes and payments so can't avoid get_doc
    data = [frappe.get_doc("Sales Invoice", d.name).as_dict() for d in data]
    return data


from erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry import POSClosingEntry
from posnext.overrides.pos_invoice_merge_log import (
	consolidate_pos_invoices,
	unconsolidate_pos_invoices,
)
class PosnextPOSClosingEntry(POSClosingEntry):
    def on_submit(self):
        consolidate_pos_invoices(closing_entry=self)

    def on_cancel(self):
        unconsolidate_pos_invoices(closing_entry=self)

    @frappe.whitelist()
    def retry(self):
        consolidate_pos_invoices(closing_entry=self)

    def validate_pos_invoices(self):
        invalid_rows = []
        for d in self.pos_transactions:
            invalid_row = {"idx": d.idx}
            pos_invoice = frappe.db.get_values(
                "Sales Invoice",
                d.pos_invoice,
                ["pos_profile", "docstatus", "owner"],
                as_dict=1,
            )[0]
            # if pos_invoice.consolidated_invoice:
            #     invalid_row.setdefault("msg", []).append(
            #         _("Sales Invoice is {}").format(frappe.bold("already consolidated"))
            #     )
            #     invalid_rows.append(invalid_row)
            #     continue
            if pos_invoice.pos_profile != self.pos_profile:
                invalid_row.setdefault("msg", []).append(
                    _("Sales Profile doesn't matches {}").format(frappe.bold(self.pos_profile))
                )
            if pos_invoice.docstatus != 1:
                invalid_row.setdefault("msg", []).append(
                    _("Sales Invoice is not {}").format(frappe.bold("submitted"))
                )
            if pos_invoice.owner != self.user:
                invalid_row.setdefault("msg", []).append(
                    _("Sales Invoice isn't created by user {}").format(frappe.bold(self.owner))
                )

            if invalid_row.get("msg"):
                invalid_rows.append(invalid_row)

        if not invalid_rows:
            return

        error_list = []
        for row in invalid_rows:
            for msg in row.get("msg"):
                error_list.append(_("Row #{}: {}").format(row.get("idx"), msg))

        frappe.throw(error_list, title=_("Invalid Sales Invoices"), as_list=True)