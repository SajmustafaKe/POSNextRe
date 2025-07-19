import frappe
from erpnext.accounts.doctype.sales_invoice.sales_invoice import (
    SalesInvoice,
    update_multi_mode_option
)
from frappe import _
from frappe.utils import add_days, cint, cstr, flt, formatdate, get_link_to_form, getdate, nowdate
from six import iteritems
from frappe import msgprint
from erpnext.accounts.doctype.payment_request.payment_request import make_payment_request

class PosnextSalesInvoice(SalesInvoice):
    
    @frappe.whitelist()
    def reset_mode_of_payments(self):
        if self.pos_profile:
            pos_profile = frappe.get_cached_doc("POS Profile", self.pos_profile)
            update_multi_mode_option(self, pos_profile)
            self.paid_amount = 0

    def validate_pos(self):
        if self.is_return:
            self.paid_amount = self.paid_amount if not self.is_pos else self.base_rounded_total
            self.outstanding_amount = 0
            
            for x in self.payments:
                x.amount = self.paid_amount
                x.amount = x.amount * -1 if x.amount > 0 else x.amount
            invoice_total = self.rounded_total or self.grand_total
            if flt(self.paid_amount) + flt(self.write_off_amount) - abs(flt(invoice_total)) > 1.0 / (10.0 ** (self.precision("grand_total") + 1.0)):
                frappe.throw(_("Paid amount + Write Off Amount can not be greater than Grand Total"))

    def validate_pos_paid_amount(self):
        if len(self.payments) == 0 and self.is_pos:
            custom_show_credit_sales = frappe.get_value("POS Profile", self.pos_profile, "custom_show_credit_sales")
            if not custom_show_credit_sales:
                frappe.throw(_("At least one mode of payment is required for POS invoice."))

    # Add the payment request methods from POS Invoice
    @frappe.whitelist()
    def create_payment_request(self):
        for pay in self.payments:
            if pay.type == "Phone":
                if pay.amount <= 0:
                    frappe.throw(_("Payment amount cannot be less than or equal to 0"))

                if not self.contact_mobile:
                    frappe.throw(_("Please enter the phone number first"))

                pay_req = self.get_existing_payment_request(pay)
                if not pay_req:
                    pay_req = self.get_new_payment_request(pay)
                    pay_req.submit()
                else:
                    pay_req.request_phone_payment()

                return pay_req

    def get_new_payment_request(self, mop):
        payment_gateway_account = frappe.db.get_value(
            "Payment Gateway Account",
            {
                "payment_account": mop.account,
            },
            ["name"],
        )

        args = {
            "dt": "Sales Invoice",  # Changed from "POS Invoice" to "Sales Invoice"
            "dn": self.name,
            "recipient_id": self.contact_mobile,
            "mode_of_payment": mop.mode_of_payment,
            "payment_gateway_account": payment_gateway_account,
            "payment_request_type": "Inward",
            "party_type": "Customer",
            "party": self.customer,
            "return_doc": True,
        }
        return make_payment_request(**args)

    def get_existing_payment_request(self, pay):
        payment_gateway_account = frappe.db.get_value(
            "Payment Gateway Account",
            {
                "payment_account": pay.account,
            },
            ["name"],
        )

        filters = {
            "reference_doctype": "Sales Invoice",  # Changed from "POS Invoice" to "Sales Invoice"
            "reference_name": self.name,
            "payment_gateway_account": payment_gateway_account,
            "email_to": self.contact_mobile,
        }
        pr = frappe.db.get_value("Payment Request", filters=filters)
        if pr:
            return frappe.get_doc("Payment Request", pr)