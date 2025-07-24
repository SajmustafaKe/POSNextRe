function calculate_total_taxes(frm) {
    const total_grand = flt(frm.doc.custom_grand_totals);
    const total_net = flt(frm.doc.custom_net_totals);
    const total_taxes = total_grand - total_net;
    frm.set_value("custom_total_taxes", total_taxes);
}

function load_invoices_and_payments(frm) {
    if (!frm.doc.user || !frm.doc.period_start_date || !frm.doc.period_end_date) {
        return;
    }

    frappe.call({
        method: "posnext.customizations.pos_closing_entry.get_pos_invoices_by_submitter",
        args: {
            user: frm.doc.user,
            period_start_date: frm.doc.period_start_date,
            period_end_date: frm.doc.period_end_date,
            pos_opening_entry: frm.doc.pos_opening_entry  // CRITICAL: Pass POS Opening Entry
        },
        callback: function (r) {
            const { invoices = [], payments = {} } = r.message || {};

            // Handle invoices
            if (invoices.length > 0) {
                frm.clear_table("custom_sales_transactions");

                let total_grand = 0;
                let total_net = 0;

                invoices.forEach(row => {
                    const child = frm.add_child("custom_sales_transactions");
                    child.pos_invoice = row.name;
                    child.net_total = row.net_total;
                    child.grand_total = row.grand_total;
                    child.posting_date = row.posting_date;
                    child.customer = row.customer;
                    child.is_return = row.is_return;
                    child.return_against = row.return_against;

                    total_grand += flt(row.grand_total);
                    total_net += flt(row.net_total);
                });

                frm.set_value("custom_grand_totals", total_grand);
                frm.set_value("custom_net_totals", total_net);
                calculate_total_taxes(frm);
                frm.refresh_field("custom_sales_transactions");
            } else {
                // Clear tables if no invoices found
                frm.clear_table("custom_sales_transactions");
                frm.refresh_field("custom_sales_transactions");
                frm.set_value("custom_grand_totals", 0);
                frm.set_value("custom_net_totals", 0);
                frm.set_value("custom_total_taxes", 0);
                
                frappe.msgprint(__('No POS invoices found for the selected user and date range.'));
            }

            // Handle payments - Update existing payment reconciliation table
            if (frm.doc.custom_payment_reconc && frm.doc.custom_payment_reconc.length > 0) {
                frm.doc.custom_payment_reconc.forEach(row => {
                    const mop = row.mode_of_payment;
                    // Set expected amount from payments data
                    row.expected_amount = flt(payments[mop] || 0);
                    // Calculate difference: closing - (expected + opening)
                    row.difference = flt(row.closing_amount) - (flt(row.expected_amount) + flt(row.opening_amount));
                });
                frm.refresh_field("custom_payment_reconc");
                
                // Show message if payment table exists
                frappe.show_alert({
                    message: __('Payment reconciliation updated with expected amounts'),
                    indicator: 'green'
                });
            }
        }
    });
}

frappe.ui.form.on('POS Closing Entry', {
    refresh: function(frm) {
        // Debug info
        console.log('POS Closing Entry loaded');
        console.log('Payment reconciliation rows:', frm.doc.custom_payment_reconc?.length || 0);
    },

    user: function (frm) {
        if (!frm.doc.user) {
            // Clear all tables when user is removed
            frm.clear_table("custom_sales_transactions");
            frm.refresh_field("custom_sales_transactions");

            frm.clear_table("custom_payment_reconc");
            frm.refresh_field("custom_payment_reconc");

            frm.clear_table("pos_transactions");
            frm.refresh_field("pos_transactions");

            frm.set_value("custom_grand_totals", 0);
            frm.set_value("custom_net_totals", 0);
            frm.set_value("custom_total_taxes", 0);
            return;
        }

        // Load invoices and payments if all required fields are present
        load_invoices_and_payments(frm);
    },

    pos_opening_entry: function (frm) {
        if (!frm.doc.pos_opening_entry) {
            frm.clear_table("custom_payment_reconc");
            frm.refresh_field("custom_payment_reconc");
            
            // Also clear other tables
            frm.clear_table("custom_sales_transactions");
            frm.refresh_field("custom_sales_transactions");
            frm.clear_table("pos_transactions");
            frm.refresh_field("pos_transactions");
            
            return;
        }

        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "POS Opening Entry",
                name: frm.doc.pos_opening_entry
            },
            callback: function (res) {
                if (res.message) {
                    const balances = res.message.balance_details || [];

                    // Clear and populate payment reconciliation table
                    frm.clear_table("custom_payment_reconc");
                    frm.clear_table("pos_transactions");

                    balances.forEach(balance => {
                        const row = frm.add_child("custom_payment_reconc");
                        row.mode_of_payment = balance.mode_of_payment;
                        row.opening_amount = flt(balance.opening_amount);
                        row.expected_amount = 0;
                        row.closing_amount = 0;
                        row.difference = 0;
                    });

                    frm.refresh_field("custom_payment_reconc");
                    
                    // Show success message
                    frappe.show_alert({
                        message: __('Payment reconciliation table created with {0} modes of payment', [balances.length]),
                        indicator: 'blue'
                    });

                    // Now load invoices and payments if user is already selected
                    if (frm.doc.user) {
                        setTimeout(() => {
                            load_invoices_and_payments(frm);
                        }, 500); // Small delay to ensure table is ready
                    }
                }
            }
        });
    },

    period_start_date: function (frm) {
        load_invoices_and_payments(frm);
    },

    period_end_date: function (frm) {
        load_invoices_and_payments(frm);
    },

    validate: function (frm) {
        calculate_total_taxes(frm);
        frm.clear_table("pos_transactions");
    }
});

frappe.ui.form.on('POS Closing Payment Entry', {
    closing_amount: function (frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        row.difference = flt(row.closing_amount) - (flt(row.expected_amount) + flt(row.opening_amount));
        frm.refresh_field('custom_payment_reconc');
    }
});