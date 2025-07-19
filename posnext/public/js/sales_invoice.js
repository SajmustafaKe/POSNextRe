frappe.ui.form.on('Sales Invoice', {
    company() {
        erpnext.accounts.dimensions.update_dimension(this.frm, this.frm.doctype);
        this.frm.set_value("set_warehouse", "");
        this.frm.set_value("taxes_and_charges", "");
    },

    // Add the request_for_payment function from POS Invoice
    request_for_payment: function (frm) {
        if (!frm.doc.contact_mobile) {
            frappe.throw(__("Please enter mobile number first."));
        }
        frm.dirty();
        frm.save().then(() => {
            frappe.dom.freeze(__("Waiting for payment..."));
            frappe
                .call({
                    method: "create_payment_request",
                    doc: frm.doc,
                })
                .fail(() => {
                    frappe.dom.unfreeze();
                    frappe.msgprint(__("Payment request failed"));
                })
                .then(({ message }) => {
                    const payment_request_name = message.name;
                    setTimeout(() => {
                        frappe.db
                            .get_value("Payment Request", payment_request_name, ["status", "grand_total"])
                            .then(({ message }) => {
                                if (message.status != "Paid") {
                                    frappe.dom.unfreeze();
                                    frappe.msgprint({
                                        message: __(
                                            "Payment Request took too long to respond. Please try requesting for payment again."
                                        ),
                                        title: __("Request Timeout"),
                                    });
                                } else if (frappe.dom.freeze_count != 0) {
                                    frappe.dom.unfreeze();
                                    cur_frm.reload_doc();
                                    
                                    // Note: cur_pos.payment.events.submit_invoice() won't work in Sales Invoice
                                    // You might need to modify this part based on your Sales Invoice workflow
                                    
                                    frappe.show_alert({
                                        message: __("Payment of {0} received successfully.", [
                                            format_currency(message.grand_total, frm.doc.currency, 0),
                                        ]),
                                        indicator: "green",
                                    });
                                }
                            });
                    }, 60000);
                });
        });
    }
});