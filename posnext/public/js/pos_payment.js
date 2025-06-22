/* eslint-disable no-unused-vars */
frappe.provide('posnext.PointOfSale');
posnext.PointOfSale.Payment = class {
    constructor({ events, wrapper }) {
        this.wrapper = wrapper;
        this.events = events;
        this.split_payments = [];
        this.is_split_mode = false;
        this.allow_overpayment = true;
        this.auto_set_amount = false;
        this.payment_backup_key = null;
        this.original_payment_data = null;
        this._current_invoice_name = null;
        this._payment_detection_done = false;
        this._payments_loaded_for_invoice = null;
        this.init_component();
    }

    init_component() {
        this.prepare_dom();
        this.initialize_numpad();
        this.bind_events();
        this.attach_shortcuts();
        this.initialize_payment_backup_system();
    }

    initialize_payment_backup_system() {
        const doc = this.events.get_frm().doc;
        if (doc && doc.name) {
            if (this._current_invoice_name && this._current_invoice_name !== doc.name) {
                this.clear_invoice_switch_data();
            }
            this._current_invoice_name = doc.name;
            this.payment_backup_key = `pos_payments_backup_${doc.name}`;
            this.restore_payments_from_backup();
        }
    }

    clear_invoice_switch_data() {
        this.split_payments = [];
        this.is_split_mode = false;
        this._payment_detection_done = false;
        this._payments_loaded_for_invoice = null;
        this.original_payment_data = null;

        if (this.$component) {
            this.$component.find('.payment-status-partial').remove();
            this.$component.find('#split-payment-checkbox').prop('checked', false);
            this.$split_container.hide();
            this.remove_split_buttons_from_payment_modes();
            this.render_payment_mode_dom();
        }

        const doc = this.events.get_frm().doc;
        if (doc.payments) {
            doc.payments.forEach(p => {
                const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
                if (this[`${mode}_control`]) {
                    this[`${mode}_control`] = null;
                }
            });
        }

        this.update_totals_section(doc);
    }

    check_and_toggle_split_mode() {
        const total = this.get_split_total();
        if (total === 0 && this.is_split_mode && this.split_payments.length === 0) {
            this.$component.find('#split-payment-checkbox').prop('checked', false);
            this.toggle_split_payment_mode(false);
        }
    }

    clear_all_payments() {
        const doc = this.events.get_frm().doc;
        this.split_payments = [];
        if (doc.payments) {
            doc.payments.forEach(payment => {
                frappe.model.set_value(payment.doctype, payment.name, 'amount', 0);
                frappe.model.set_value(payment.doctype, payment.name, 'reference_no', '');
                frappe.model.set_value(payment.doctype, payment.name, 'remarks', '');
            });
        }

        frappe.model.set_value(doc.doctype, doc.name, 'paid_amount', 0);
        frappe.model.set_value(doc.doctype, doc.name, 'outstanding_amount', doc.grand_total || doc.rounded_total || 0);
        frappe.model.set_value(doc.doctype, doc.name, 'status', 'Draft');
        frappe.model.set_value(doc.doctype, doc.name, 'change_amount', 0);

        this.clear_payment_backup();
        if (this.is_split_mode) {
            this.render_split_payments_list();
            this.update_split_summary();
            this.check_and_toggle_split_mode();
        } else {
            this.render_payment_mode_dom();
        }
        this.update_totals_section(doc);
        this.$component.find('.payment-status-partial').remove();
    }

    backup_payments_to_session() {
        if (!this.payment_backup_key) return;
        const doc = this.events.get_frm().doc;
        if (!doc || !doc.name) return;

        const backup_data = {
            invoice_name: doc.name,
            backup_time: new Date().toISOString(),
            payments: [],
            split_payments: [...this.split_payments],
            is_split_mode: this.is_split_mode,
            paid_amount: doc.paid_amount || 0,
            status: doc.status || 'Draft',
            document_version: doc.modified || doc.creation
        };

        if (doc.payments && Array.isArray(doc.payments)) {
            doc.payments.forEach(payment => {
                if (payment.amount && payment.amount > 0) {
                    backup_data.payments.push({
                        mode_of_payment: payment.mode_of_payment,
                        amount: payment.amount,
                        type: payment.type || 'Cash',
                        reference_no: payment.reference_no || '',
                        remarks: payment.remarks || ''
                    });
                }
            });
        }

        if (!window.pos_payment_backups) window.pos_payment_backups = {};
        window.pos_payment_backups[this.payment_backup_key] = backup_data;
    }

    restore_payments_from_backup() {
        if (!this.payment_backup_key) return false;
        if (window.pos_payment_backups && window.pos_payment_backups[this.payment_backup_key]) {
            const backup_data = window.pos_payment_backups[this.payment_backup_key];
            const current_doc = this.events.get_frm().doc;

            if (backup_data.invoice_name !== current_doc.name) return false;
            const backup_version = backup_data.document_version;
            const current_version = current_doc.modified || current_doc.creation;
            if (backup_version && current_version && backup_version !== current_version) return false;

            const has_current_payments = current_doc.payments && current_doc.payments.some(p => p.amount && p.amount > 0);
            if (has_current_payments) return false;

            let total_restored = 0;
            if (backup_data.split_payments && backup_data.split_payments.length > 0) {
                this.split_payments = [...backup_data.split_payments];
                total_restored = this.split_payments.reduce((sum, payment) => sum + payment.amount, 0);
            }

            if (backup_data.is_split_mode) this.is_split_mode = backup_data.is_split_mode;
            if (backup_data.payments && backup_data.payments.length > 0) {
                this.original_payment_data = backup_data.payments;
                if (total_restored === 0) {
                    total_restored = backup_data.payments.reduce((sum, payment) => sum + payment.amount, 0);
                }
            }

            if (total_restored > 0) {
                frappe.model.set_value(current_doc.doctype, current_doc.name, 'paid_amount', total_restored);
                const grand_total = current_doc.grand_total || current_doc.rounded_total || 0;
                const outstanding = grand_total - total_restored;
                frappe.model.set_value(current_doc.doctype, current_doc.name, 'outstanding_amount', Math.max(0, outstanding));

                let status = 'Draft';
                if (total_restored >= grand_total) status = 'Paid';
                else if (total_restored > 0) status = 'Partly Paid';
                frappe.model.set_value(current_doc.doctype, current_doc.name, 'status', status);

                if (backup_data.payments) {
                    backup_data.payments.forEach(backup_payment => {
                        const current_payment = current_doc.payments.find(p => p.mode_of_payment === backup_payment.mode_of_payment);
                        if (current_payment) {
                            frappe.model.set_value(current_payment.doctype, current_payment.name, 'amount', backup_payment.amount);
                            if (backup_payment.reference_no) {
                                frappe.model.set_value(current_payment.doctype, current_payment.name, 'reference_no', backup_payment.reference_no);
                            }
                            if (backup_payment.remarks) {
                                frappe.model.set_value(current_payment.doctype, current_payment.name, 'remarks', backup_payment.remarks);
                            }
                        }
                    });
                }

                setTimeout(() => {
                    this.update_totals_section(current_doc);
                    if (this.is_split_mode) {
                        this.$component.find('#split-payment-checkbox').prop('checked', true);
                        this.toggle_split_payment_mode(true);
                    } else {
                        this.render_payment_mode_dom();
                    }
                }, 100);

                frappe.show_alert({
                    message: __("Payment data restored from previous session (Total: {0})", [format_currency(total_restored, current_doc.currency)]),
                    indicator: "green"
                });
                return true;
            }
        }
        return false;
    }

    restore_from_backup_if_needed() {
        if (!this.payment_backup_key) return false;
        if (window.pos_payment_backups && window.pos_payment_backups[this.payment_backup_key]) {
            const backup_data = window.pos_payment_backups[this.payment_backup_key];
            const current_doc = this.events.get_frm().doc;

            if (backup_data.invoice_name !== current_doc.name) return false;
            const backup_version = backup_data.document_version;
            const current_version = current_doc.modified || current_doc.creation;
            if (backup_version && current_version && backup_version !== current_version) return false;

            const current_paid_amount = current_doc.paid_amount || 0;
            const backup_paid_amount = backup_data.paid_amount || 0;
            if (current_paid_amount > backup_paid_amount) return false;

            if (backup_data.split_payments && backup_data.split_payments.length > 0) {
                this.split_payments = [...backup_data.split_payments];
                this.split_payments.forEach(payment => { payment.is_existing = true; });
                return true;
            }

            if (backup_data.is_split_mode) this.is_split_mode = backup_data.is_split_mode;
        }
        return false;
    }

    clear_payment_backup() {
        if (!this.payment_backup_key) return;
        if (window.pos_payment_backups && window.pos_payment_backups[this.payment_backup_key]) {
            delete window.pos_payment_backups[this.payment_backup_key];
        }
    }

    prepare_dom() {
        this.wrapper.append(
            `<section class="payment-container">
                <div class="section-label payment-section">
                    ${__('Payment Method')}
                    <div class="payment-actions">
                        <button class="btn btn-sm btn-secondary clear-payments-btn" title="${__('Clear All Payments')}">
                            <i class="fa fa-trash"></i> ${__('Clear')}
                        </button>
                        <div class="split-payment-toggle">
                            <label class="switch">
                                <input type="checkbox" id="split-payment-checkbox">
                                <span class="slider round"></span>
                            </label>
                            <span class="split-label">${__('Split Payment')}</span>
                        </div>
                    </div>
                </div>
                <div class="payment-modes"></div>
                <div class="split-payments-container" style="display: none;">
                    <div class="section-label">${__('Split Payments')}</div>
                    <div class="split-payments-list"></div>
                    <div class="split-payment-summary">
                        <div class="split-total">
                            <span>${__('Total Allocated')}: </span>
                            <span class="split-total-amount">0.00</span>
                        </div>
                        <div class="split-remaining">
                            <span>${__('Remaining')}: </span>
                            <span class="split-remaining-amount">0.00</span>
                        </div>
                        <div class="split-change" style="display: none;">
                            <span>${__('Change')}: </span>
                            <span class="split-change-amount">0.00</span>
                        </div>
                    </div>
                    <div class="split-payment-actions">
                        <button class="btn btn-sm btn-warning save-partial-payment-btn">
                            ${__('Save Partial Payment')}
                        </button>
                    </div>
                </div>
                <div class="totals-section">
                    <div class="totals"></div>
                </div>
                <div class="submit-order-btn">${__("Complete Order")}</div>
            </section>`
        );

        if (!$('#split-payment-styles').length) {
            $('head').append(`
                <style id="split-payment-styles">
                    .payment-section { display: flex; justify-content: space-between; align-items: center; }
                    .payment-actions { display: flex; align-items: center; gap: 15px; margin-left: auto; }
                    .clear-payments-btn { background-color: #6c757d; border-color: #6c757d; color: white; padding: 4px 8px; font-size: 12px; }
                    .clear-payments-btn:hover { background-color: #5a6268; border-color: #545b62; }
                    .split-payment-toggle { display: flex; align-items: center; gap: 10px; }
                    .switch { position: relative; display: inline-block; width: 50px; height: 24px; }
                    .switch input { opacity: 0; width: 0; height: 0; }
                    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; }
                    .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
                    input:checked + .slider { background-color: #2196F3; }
                    input:checked + .slider:before { transform: translateX(26px); }
                    .split-payments-container { border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 10px 0; background-color: #f9f9f9; }
                    .split-payment-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 8px; background-color: white; }
                    .split-payment-info { flex: 1; display: flex; flex-direction: column; }
                    .split-payment-method { font-weight: bold; color: #333; margin-bottom: 4px; }
                    .split-payment-details { display: flex; gap: 8px; flex-wrap: wrap; }
                    .split-reference-input, .split-notes-input { border: 1px solid #ddd; border-radius: 3px; padding: 2px 6px; }
                    .split-payment-actions { display: flex; align-items: center; gap: 8px; }
                    .split-payment-amount { color: #2196F3; font-weight: bold; font-size: 14px; }
                    .split-payment-edit, .split-payment-remove { padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
                    .split-payment-edit { background: #17a2b8; color: white; }
                    .split-payment-remove { background: #dc3545; color: white; }
                    .split-payment-summary { margin-top: 15px; padding-top: 15px; border-top: 2px solid #2196F3; font-weight: bold; }
                    .split-total, .split-remaining, .split-change { display: flex; justify-content: space-between; margin: 5px 0; }
                    .split-remaining-amount { color: #ff6b6b; }
                    .split-total-amount { color: #4CAF50; }
                    .split-change-amount { color: #2196F3; }
                    .payment-mode-split-active { border: 2px solid #2196F3 !important; background-color: #e3f2fd !important; }
                    .add-to-split-btn { margin-top: 5px; width: 100%; }
                    .split-payment-actions { margin-top: 15px; text-align: center; }
                    .save-partial-payment-btn { background-color: #ffc107; border-color: #ffc107; color: #212529; }
                    .save-partial-payment-btn:hover { background-color: #e0a800; border-color: #d39e00; }
                    .payment-status-partial { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 8px; margin: 10px 0; color: #856404; }
                    .existing-payment-badge { background: #28a745; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 5px; }
                </style>
            `);
        }

        this.$component = this.wrapper.find('.payment-container');
        this.$payment_modes = this.wrapper.find('.payment-modes');
        this.$split_container = this.wrapper.find('.split-payments-container');
        this.$split_list = this.wrapper.find('.split-payments-list');
        this.$totals_section = this.wrapper.find('.totals-section');
        this.$totals = this.wrapper.find('.totals');
    }

    initialize_numpad() {
        this.numpad_value = '';
    }

    bind_events() {
        const me = this;

        this.$component.on('click', '.clear-payments-btn', function() {
            me.clear_all_payments();
        });

        this.$component.on('change', '#split-payment-checkbox', function() {
            me.toggle_split_payment_mode($(this).is(':checked'));
        });

        // Use event delegation for payment mode clicks
        this.$payment_modes.on('click', '.mode-of-payment', function(e) {
            const mode_clicked = $(this);
            if ($(e.target).hasClass('add-to-split-btn') || $(e.target).closest('.add-to-split-btn').length) return;
            if (!$(e.target).is(mode_clicked)) return;

            const mode = mode_clicked.attr('data-mode');
            if (me.is_split_mode) {
                me.handle_split_payment_selection(mode_clicked, mode);
            } else {
                me.handle_regular_payment_selection(mode_clicked, mode);
            }
        });

        // Fixed event handler for add to split button (ported from second code)
 this.$payment_modes.on('click', '.add-to-split-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const mode = $(this).attr('data-mode') || $(this).closest('.mode-of-payment').attr('data-mode');
            if (!mode) {
                frappe.show_alert({ message: __("Payment mode not specified"), indicator: "red" });
                return;
            }
            if (!me[`${mode}_control`]) {
                // Attempt to re-render payment modes as a fallback
                me.render_payment_mode_dom();
                if (!me[`${mode}_control`]) {
                    frappe.show_alert({ message: __("Payment control not found for mode: {0}", [mode]), indicator: "red" });
                    return;
                }
            }
            const amount = flt(me[`${mode}_control`].get_value()) || 0;
            if (amount <= 0) {
                frappe.show_alert({ message: __("Please enter an amount greater than 0"), indicator: "orange" });
                if (me[`${mode}_control`].$input) me[`${mode}_control`].$input.focus();
                return;
            }
            me.add_split_payment(mode, amount);
        });

        this.$component.on('click', '.split-payment-remove', function() {
            const index = $(this).data('index');
            me.remove_split_payment(index);
        });

        this.$component.on('click', '.split-payment-edit', function() {
            const index = $(this).data('index');
            me.edit_split_payment(index);
        });

        this.$component.on('blur', '.split-reference-input', function() {
            const index = $(this).data('index');
            const value = $(this).val();
            if (me.split_payments[index]) {
                me.split_payments[index].reference_number = value;
                me.backup_payments_to_session();
            }
        });

        this.$component.on('blur', '.split-notes-input', function() {
            const index = $(this).data('index');
            const value = $(this).val();
            if (me.split_payments[index]) {
                me.split_payments[index].notes = value;
                me.backup_payments_to_session();
            }
        });

        this.$component.on('click', '.save-partial-payment-btn', function() {
            if (me.split_payments.length === 0) {
                frappe.show_alert({ message: __("Please add at least one payment method"), indicator: "orange" });
                return;
            }
            me.save_partial_payment();
        });

        frappe.ui.form.on('POS Invoice', 'contact_mobile', (frm) => {
            const contact = frm.doc.contact_mobile;
            const request_button = $(this.request_for_payment_field?.$input[0]);
            if (contact) request_button.removeClass('btn-default').addClass('btn-primary');
            else request_button.removeClass('btn-primary').addClass('btn-default');
        });

        frappe.ui.form.on('POS Invoice', 'coupon_code', (frm) => {
            if (frm.doc.coupon_code && !frm.applying_pos_coupon_code) {
                if (!frm.doc.ignore_pricing_rule) {
                    frm.applying_pos_coupon_code = true;
                    frappe.run_serially([
                        () => frm.doc.ignore_pricing_rule=1,
                        () => frm.trigger('ignore_pricing_rule'),
                        () => frm.doc.ignore_pricing_rule=0,
                        () => frm.trigger('apply_pricing_rule'),
                        () => frm.save(),
                        () => this.update_totals_section(frm.doc),
                        () => (frm.applying_pos_coupon_code = false)
                    ]);
                } else if (frm.doc.ignore_pricing_rule) {
                    frappe.show_alert({ message: __("Ignore Pricing Rule is enabled. Cannot apply coupon code."), indicator: "orange" });
                }
            }
        });

        this.setup_listener_for_payments();

        this.$payment_modes.on('click', '.shortcut', function() {
            const value = $(this).attr('data-value');
            me.selected_mode.set_value(value);
        });

        this.$component.on('click', '.submit-order-btn', () => {
            const doc = this.events.get_frm().doc;
            const items = doc.items;
            const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;

            if (!items.length) {
                frappe.show_alert({ message: __("You cannot submit empty order."), indicator: "orange" });
                frappe.utils.play_sound("error");
                return;
            }

            if (me.is_split_mode) {
                const split_total = me.get_split_total();
                if (split_total < grand_total) {
                    const remaining = grand_total - split_total;
                    frappe.show_alert({ message: __("Payment incomplete. Remaining amount: {0}. Use 'Save Partial Payment' or add more payments.", [format_currency(remaining, doc.currency)]), indicator: "orange" });
                    frappe.utils.play_sound("error");
                    return;
                }
                me.apply_split_payments_to_doc();
                if (split_total > grand_total) {
                    const change_amount = split_total - grand_total;
                    frappe.model.set_value(doc.doctype, doc.name, 'change_amount', change_amount);
                }
            } else {
                const paid_amount = doc.paid_amount;
                if (paid_amount == 0) {
                    frappe.show_alert({ message: __("You cannot submit the order without payment."), indicator: "orange" });
                    frappe.utils.play_sound("error");
                    return;
                }
            }

            me.clear_payment_backup();
            this.events.submit_invoice();
        });

        frappe.ui.form.on('POS Invoice', 'paid_amount', (frm) => {
            this.update_totals_section(frm.doc);
            const is_cash_shortcuts_invisible = !this.$payment_modes.find('.cash-shortcuts').is(':visible');
            this.attach_cash_shortcuts(frm.doc);
            !is_cash_shortcuts_invisible && this.$payment_modes.find('.cash-shortcuts').css('display', 'grid');
            if (!this.is_split_mode) this.render_payment_mode_dom();
        });

        frappe.ui.form.on('POS Invoice', 'loyalty_amount', (frm) => {
            const formatted_currency = format_currency(frm.doc.loyalty_amount, frm.doc.currency);
            this.$payment_modes.find(`.loyalty-amount-amount`).html(formatted_currency);
        });

        frappe.ui.form.on("Sales Invoice Payment", "amount", (frm, cdt, cdn) => {
            const default_mop = locals[cdt][cdn];
            const mode = default_mop.mode_of_payment.replace(/ +/g, "_").toLowerCase();
            if (this[`${mode}_control`] && this[`${mode}_control`].get_value() != default_mop.amount) {
                this[`${mode}_control`].set_value(default_mop.amount);
            }
        });

        frappe.ui.form.on('POS Invoice', 'status', (frm) => {
            setTimeout(() => { this.refresh_payments_display(); }, 100);
        });

        frappe.ui.form.on('POS Invoice', 'refresh', (frm) => {
            setTimeout(() => {
                if (this._current_invoice_name !== frm.doc.name) {
                    this.clear_invoice_switch_data();
                }
                this.refresh_payments_display();
            }, 200);
        });
    }

    toggle_split_payment_mode(enable) {
        this.is_split_mode = enable;
        if (enable) {
            this.$split_container.show();
            this.add_split_buttons_to_payment_modes();
            this.load_existing_payments();
            if (this.split_payments.length === 0) this.sync_document_payments_to_split();
        } else {
            this.$split_container.hide();
            this.clear_split_payments();
            this.remove_split_buttons_from_payment_modes();
        }
        this.backup_payments_to_session();
    }

    add_split_buttons_to_payment_modes() {
        this.$payment_modes.find('.mode-of-payment').each(function() {
            const $mode = $(this);
            const mode = $mode.attr('data-mode');
            if (!$mode.find('.add-to-split-btn').length) {
                $mode.append(`<button class="add-to-split-btn btn btn-sm btn-primary" data-mode="${mode}">${__('Add to Split')}</button>`);
            }
        });
    }

    remove_split_buttons_from_payment_modes() {
        this.$payment_modes.find('.add-to-split-btn').remove();
    }

    check_for_existing_payments() {
        const doc = this.events.get_frm().doc;
        let has_existing_payments = false;
        let total_existing_amount = 0;

        if (doc.payments && Array.isArray(doc.payments)) {
            doc.payments.forEach(payment => {
                if (payment.amount && payment.amount > 0) {
                    has_existing_payments = true;
                    total_existing_amount += payment.amount;
                }
            });
        }

        if (!has_existing_payments && doc.paid_amount && doc.paid_amount > 0) {
            has_existing_payments = true;
            total_existing_amount = doc.paid_amount;
        }

        if (!has_existing_payments && doc.status && ['Partly Paid', 'Paid'].includes(doc.status)) {
            has_existing_payments = true;
            if (doc.outstanding_amount && doc.grand_total) {
                total_existing_amount = doc.grand_total - doc.outstanding_amount;
            }
        }

        const is_edited_order = (
            (doc.name.startsWith('new-') && (doc.creation || doc.modified || doc.status !== 'Draft')) ||
            (!doc.name.startsWith('new-') && doc.creation && doc.docstatus === 0 && !doc.__islocal)
        );

        if (is_edited_order && !has_existing_payments) {
            if (!doc.name.startsWith('new-') && doc.creation && doc.docstatus === 0) {
                this.fetch_original_payment_data(doc.name);
            }
        }

        if (has_existing_payments && !this.is_split_mode) {
            this.$component.find('#split-payment-checkbox').prop('checked', true);
            this.toggle_split_payment_mode(true);
        }
    }

    fetch_original_payment_data(invoice_name) {
        const current_doc = this.events.get_frm().doc;
        const has_current_payments = current_doc.payments && current_doc.payments.some(p => p.amount && p.amount > 0);
        if (has_current_payments) return;

        frappe.db.get_doc('POS Invoice', invoice_name).then(original_doc => {
            if (original_doc && original_doc.payments) {
                let found_payments = false;
                let total_amount = 0;
                original_doc.payments.forEach(payment => {
                    if (payment.amount && payment.amount > 0) {
                        found_payments = true;
                        total_amount += payment.amount;
                    }
                });

                if (found_payments) {
                    this.original_payment_data = original_doc.payments;
                    this.apply_original_payments_to_document(original_doc);
                    if (!this.is_split_mode) {
                        this.$component.find('#split-payment-checkbox').prop('checked', true);
                        this.toggle_split_payment_mode(true);
                    }
                    frappe.show_alert({
                        message: __("Original payments detected and restored! Total: {0}", [format_currency(total_amount, original_doc.currency)]),
                        indicator: "green"
                    });
                }
            }
        }).catch(() => {});
    }

    apply_original_payments_to_document(original_doc) {
        const current_doc = this.events.get_frm().doc;
        if (!original_doc.payments || !current_doc.payments) return;
        let total_paid = 0;

        original_doc.payments.forEach(original_payment => {
            if (original_payment.amount && original_payment.amount > 0) {
                const current_payment = current_doc.payments.find(p => p.mode_of_payment === original_payment.mode_of_payment);
                if (current_payment) {
                    frappe.model.set_value(current_payment.doctype, current_payment.name, 'amount', original_payment.amount);
                    if (original_payment.reference_no) {
                        frappe.model.set_value(current_payment.doctype, current_payment.name, 'reference_no', original_payment.reference_no);
                    }
                    if (original_payment.remarks) {
                        frappe.model.set_value(current_payment.doctype, current_payment.name, 'remarks', original_payment.remarks);
                    }
                    total_paid += original_payment.amount;
                }
            }
        });

        if (total_paid > 0) {
            frappe.model.set_value(current_doc.doctype, current_doc.name, 'paid_amount', total_paid);
            const grand_total = current_doc.grand_total || current_doc.rounded_total || 0;
            const outstanding = grand_total - total_paid;
            frappe.model.set_value(current_doc.doctype, current_doc.name, 'outstanding_amount', Math.max(0, outstanding));

            let status = 'Draft';
            if (total_paid >= grand_total) status = 'Paid';
            else if (total_paid > 0) status = 'Partly Paid';
            frappe.model.set_value(current_doc.doctype, current_doc.name, 'status', status);

            setTimeout(() => { this.update_totals_section(current_doc); }, 100);
        }
    }

    load_existing_payments() {
        const doc = this.events.get_frm().doc;
        if (this._payments_loaded_for_invoice === doc.name) return;
        this._payments_loaded_for_invoice = doc.name;
        this.split_payments = [];
        let total_loaded = 0;

        if (doc.payments && Array.isArray(doc.payments)) {
            doc.payments.forEach((payment, index) => {
                if (payment.amount && payment.amount > 0) {
                    const mode = payment.mode_of_payment.replace(/ +/g, "_").toLowerCase();
                    let split_details = [];
                    if (payment.remarks) {
                        try {
                            split_details = JSON.parse(payment.remarks);
                            if (!Array.isArray(split_details)) split_details = [];
                        } catch (e) {
                            split_details = [];
                        }
                    }

                    if (split_details.length === 0) {
                        split_details = [{
                            amount: payment.amount,
                            reference: payment.reference_no || '',
                            notes: payment.remarks || '',
                            display_name: payment.mode_of_payment
                        }];
                    }

                    split_details.forEach((detail, detailIndex) => {
                        const existing_payment = {
                            id: `${mode}_current_${index}_${detailIndex}`,
                            mode: mode,
                            mode_of_payment: payment.mode_of_payment,
                            display_name: detail.display_name || payment.mode_of_payment,
                            amount: detail.amount || payment.amount,
                            type: payment.type || 'Cash',
                            reference_number: detail.reference || payment.reference_no || '',
                            notes: detail.notes || '',
                            is_existing: true
                        };
                        this.split_payments.push(existing_payment);
                        total_loaded += existing_payment.amount;
                    });
                }
            });
        }

        if (this.split_payments.length === 0) {
            const backup_loaded = this.restore_from_backup_if_needed();
            if (backup_loaded) total_loaded = this.get_split_total();
        }

        if (this.split_payments.length === 0 && this.original_payment_data && Array.isArray(this.original_payment_data)) {
            this.original_payment_data.forEach((payment, index) => {
                if (payment.amount && payment.amount > 0) {
                    const mode = payment.mode_of_payment.replace(/ +/g, "_").toLowerCase();
                    const existing_payment = {
                        id: `${mode}_original_${index}`,
                        mode: mode,
                        mode_of_payment: payment.mode_of_payment,
                        display_name: payment.mode_of_payment,
                        amount: payment.amount,
                        type: payment.type || 'Cash',
                        reference_number: payment.reference_no || '',
                        notes: payment.remarks || 'From original',
                        is_existing: true
                    };
                    this.split_payments.push(existing_payment);
                    total_loaded += existing_payment.amount;
                }
            });
        }

        if (this.split_payments.length === 0 && (doc.paid_amount > 0 || doc.status === 'Partly Paid')) {
            this.create_fallback_payment_from_document(doc);
            if (this.split_payments.length > 0) total_loaded = this.get_split_total();
        }

        this.renumber_same_payment_methods();
        this.render_split_payments_list();
        this.update_split_summary();
        this.show_payment_status();

        if (this.split_payments.length > 0) {
            frappe.show_alert({
                message: __("Payments restored successfully! ({0} payment(s) found)", [this.split_payments.length]),
                indicator: "green"
            });
            this.backup_payments_to_session();
        }
    }

    create_fallback_payment_from_document(doc) {
        if (doc.payments && doc.payments.length > 0) {
            const first_payment = doc.payments.find(p => p.default) || doc.payments[0];
            const mode = first_payment.mode_of_payment.replace(/ +/g, "_").toLowerCase();
            const fallback_payment = {
                id: `fallback_${mode}_0`,
                mode: mode,
                mode_of_payment: first_payment.mode_of_payment,
                display_name: first_payment.mode_of_payment + ' (Auto-detected)',
                amount: doc.paid_amount,
                type: first_payment.type || 'Cash',
                reference_number: '',
                notes: 'Auto-detected from edited order',
                is_existing: true
            };
            this.split_payments.push(fallback_payment);
        }
    }

    sync_document_payments_to_split() {
        const doc = this.events.get_frm().doc;
        this.split_payments = [];
        if (doc.payments && Array.isArray(doc.payments)) {
            doc.payments.forEach((payment, index) => {
                if (payment.amount && payment.amount > 0) {
                    const mode = payment.mode_of_payment.replace(/ +/g, "_").toLowerCase();
                    const existing_payment = {
                        id: `${mode}_sync_${index}`,
                        mode: mode,
                        mode_of_payment: payment.mode_of_payment,
                        display_name: payment.mode_of_payment,
                        amount: payment.amount,
                        type: payment.type || 'Cash',
                        reference_number: payment.reference_no || '',
                        notes: payment.remarks || '',
                        is_existing: true
                    };
                    this.split_payments.push(existing_payment);
                }
            });
        }
        this.renumber_same_payment_methods();
        this.render_split_payments_list();
        this.update_split_summary();
        this.show_payment_status();
    }

    refresh_payments_display() {
        const doc = this.events.get_frm().doc;
        if (this.is_split_mode) {
            this.add_split_buttons_to_payment_modes();
            this.sync_document_payments_to_split();
        } else {
            this.check_for_existing_payments();
            this.render_payment_mode_dom();
        }
        this.update_totals_section(doc);
    }

    add_split_payment(mode, amount) {
        const doc = this.events.get_frm().doc;
        const payment_method = doc.payments.find(p => p.mode_of_payment.replace(/ +/g, "_").toLowerCase() === mode);
        if (!payment_method) {
            frappe.show_alert({ message: __("Invalid payment method selected"), indicator: "red" });
            return;
        }
        const split_id = `${mode}_${frappe.utils.get_random(8)}`;
        const same_method_count = this.split_payments.filter(p => p.mode === mode).length;
        const reference = same_method_count > 0 ? ` #${same_method_count + 1}` : '';
        const new_payment = {
            id: split_id,
            mode: mode,
            mode_of_payment: payment_method.mode_of_payment,
            display_name: payment_method.mode_of_payment + reference,
            amount: flt(amount),
            type: payment_method.type || 'Cash',
            reference_number: '',
            notes: '',
            is_existing: false
        };
        this.split_payments.push(new_payment);
        if (this[`${mode}_control`]) this[`${mode}_control`].set_value(0);
        this.render_split_payments_list();
        this.update_split_summary();
        this.backup_payments_to_session();
        frappe.show_alert({
            message: __("Payment added: {0} ({1})", [payment_method.mode_of_payment, format_currency(amount, doc.currency)]),
            indicator: "green"
        });
    }
    remove_split_payment(index) {
        this.split_payments.splice(index, 1);
        this.renumber_same_payment_methods();
        this.render_split_payments_list();
        this.update_split_summary();
        this.backup_payments_to_session();
        this.check_and_toggle_split_mode();
    }

    edit_split_payment(index) {
        const payment = this.split_payments[index];
        if (!payment) return;
        const doc = this.events.get_frm().doc;
        frappe.prompt([
            { label: __('Amount'), fieldname: 'amount', fieldtype: 'Currency', default: payment.amount, reqd: 1 },
            { label: __('Reference Number'), fieldname: 'reference_number', fieldtype: 'Data', default: payment.reference_number },
            { label: __('Notes'), fieldname: 'notes', fieldtype: 'Small Text', default: payment.notes }
        ], (values) => {
            if (values.amount <= 0) {
                frappe.show_alert({ message: __("Amount must be greater than 0"), indicator: "red" });
                return;
            }
            this.split_payments[index].amount = values.amount;
            this.split_payments[index].reference_number = values.reference_number || '';
            this.split_payments[index].notes = values.notes || '';
            this.render_split_payments_list();
            this.update_split_summary();
            this.backup_payments_to_session();
        }, __('Edit Split Payment'), __('Update'));
    }

    renumber_same_payment_methods() {
        const method_counts = {};
        this.split_payments.forEach(payment => {
            if (!method_counts[payment.mode]) method_counts[payment.mode] = 0;
            method_counts[payment.mode]++;
            const reference = method_counts[payment.mode] > 1 ? ` #${method_counts[payment.mode]}` : '';
            payment.display_name = payment.mode_of_payment + reference;
        });
    }

    render_split_payments_list() {
        const doc = this.events.get_frm().doc;
        const currency = doc.currency;
        if (this.split_payments.length === 0) {
            this.$split_list.html(`<div class="text-muted text-center">${__('No split payments added yet')}</div>`);
            return;
        }

        const html = this.split_payments.map((payment, index) => {
            const existing_badge = payment.is_existing ? `<span class="existing-payment-badge">${__('Paid')}</span>` : '';
            return `
                <div class="split-payment-item" data-split-id="${payment.id}">
                    <div class="split-payment-info">
                        <span class="split-payment-method">${payment.display_name}${existing_badge}</span>
                        <div class="split-payment-details">
                            <input type="text" class="split-reference-input" placeholder="${__('Reference #')}" value="${payment.reference_number}" data-index="${index}" style="width: 100px; font-size: 11px; margin-top: 2px;">
                            <input type="text" class="split-notes-input" placeholder="${__('Notes')}" value="${payment.notes}" data-index="${index}" style="width: 120px; font-size: 11px; margin-top: 2px;">
                        </div>
                    </div>
                    <div class="split-payment-actions">
                        <span class="split-payment-amount">${format_currency(payment.amount, currency)}</span>
                        <button class="split-payment-edit btn btn-xs btn-secondary" data-index="${index}" title="${__('Edit Amount')}"><i class="fa fa-edit"></i></button>
                        <button class="split-payment-remove btn btn-xs btn-danger" data-index="${index}" title="${__('Remove')}"><i class="fa fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        this.$split_list.html(html);
    }

    update_split_summary() {
        const doc = this.events.get_frm().doc;
        const currency = doc.currency;
        const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
        const split_total = this.get_split_total();
        const remaining = grand_total - split_total;
        const change = split_total > grand_total ? split_total - grand_total : 0;

        this.$component.find('.split-total-amount').text(format_currency(split_total, currency));
        this.$component.find('.split-remaining-amount').text(format_currency(Math.max(0, remaining), currency));
        if (change > 0) {
            this.$component.find('.split-change').show();
            this.$component.find('.split-change-amount').text(format_currency(change, currency));
        } else {
            this.$component.find('.split-change').hide();
        }
        this.$component.find('.save-partial-payment-btn').prop('disabled', !this.split_payments.length);
    }

    get_split_total() {
        return this.split_payments.reduce((total, payment) => total + payment.amount, 0);
    }

    save_partial_payment() {
        const doc = this.events.get_frm().doc;
        if (this.split_payments.length === 0) {
            frappe.show_alert({ message: __("Please add at least one payment method"), indicator: "orange" });
            return;
        }

        this.apply_split_payments_to_doc();
        frappe.model.set_value(doc.doctype, doc.name, 'status', 'Partly Paid');
        this.events.get_frm().save().then(() => {
            frappe.show_alert({ message: __("Partial payment saved successfully"), indicator: "green" });
            this.clear_payment_backup();
            this.toggle_component(false);
            if (this.events.open_recent_orders) this.events.open_recent_orders();
            else frappe.msgprint({ title: __('Partial Payment Saved'), message: __('Partial payment saved successfully. Please check Recent Orders to view the saved order.'), indicator: 'green' });
        }).catch(() => {
            frappe.show_alert({ message: __("Error saving partial payment"), indicator: "red" });
        });
    }

    apply_split_payments_to_doc() {
        const doc = this.events.get_frm().doc;
        doc.payments.forEach(payment => {
            frappe.model.set_value(payment.doctype, payment.name, 'amount', 0);
        });

        const grouped_payments = {};
        this.split_payments.forEach(split_payment => {
            if (!grouped_payments[split_payment.mode]) {
                grouped_payments[split_payment.mode] = { total_amount: 0, details: [] };
            }
            grouped_payments[split_payment.mode].total_amount += split_payment.amount;
            grouped_payments[split_payment.mode].details.push({
                amount: split_payment.amount,
                reference: split_payment.reference_number,
                notes: split_payment.notes,
                display_name: split_payment.display_name
            });
        });

        Object.keys(grouped_payments).forEach(mode => {
            const payment_record = doc.payments.find(p => p.mode_of_payment.replace(/ +/g, "_").toLowerCase() === mode);
            if (payment_record) {
                frappe.model.set_value(payment_record.doctype, payment_record.name, 'amount', grouped_payments[mode].total_amount);
                const split_details = JSON.stringify(grouped_payments[mode].details);
                frappe.model.set_value(payment_record.doctype, payment_record.name, 'remarks', split_details);
            }
        });

        this.store_split_payment_summary(doc);
    }

    store_split_payment_summary(doc) {
        const split_summary = this.split_payments.map(payment => ({
            method: payment.mode_of_payment,
            display_name: payment.display_name,
            amount: payment.amount,
            reference: payment.reference_number,
            notes: payment.notes
        }));

        const summary_text = split_summary.map(s => `${s.display_name}: ${format_currency(s.amount, doc.currency)}${s.reference ? ` (Ref: ${s.reference})` : ''}${s.notes ? ` - ${s.notes}` : ''}`).join(' | ');
        const existing_remarks = doc.remarks || '';
        const split_remarks = `Split Payment: ${summary_text}`;
        frappe.model.set_value(doc.doctype, doc.name, 'remarks', existing_remarks ? `${existing_remarks}\n${split_remarks}` : split_remarks);
    }

    show_payment_status() {
        const doc = this.events.get_frm().doc;
        const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
        const paid_amount = doc.paid_amount;
        const remaining = grand_total - paid_amount;

        this.$component.find('.payment-status-partial').remove();
        if (remaining > 0) {
            const status_html = `
                <div class="payment-status-partial">
                    <strong>${__('Status: Partly Paid')}</strong>
                    ${__('Paid')}: ${format_currency(paid_amount, doc.currency)}
                    ${__('Remaining')}: ${format_currency(remaining, doc.currency)}
                </div>
            `;
            this.$split_container.prepend(status_html);
        }
    }

    clear_split_payments() {
        this.split_payments = [];
        this.render_split_payments_list();
        this.update_split_summary();
        this.$component.find('.payment-status-partial').remove();
    }

    handle_regular_payment_selection(mode_clicked, mode) {
        const me = this;
        const scrollLeft = mode_clicked.offset().left - me.$payment_modes.offset().left + me.$payment_modes.scrollLeft();
        me.$payment_modes.animate({ scrollLeft });
        $('.mode-of-payment-control').css('display', 'none');
        $('.cash-shortcuts').css('display', 'none');
        me.$payment_modes.find('.pay-amount').css('display', 'inline');
        me.$payment_modes.find('.loyalty-amount-name').css('display', 'none');
        $('.mode-of-payment').removeClass('border-primary');

        if (mode_clicked.hasClass('border-primary')) {
            mode_clicked.removeClass('border-primary');
            me.selected_mode = '';
        } else {
            mode_clicked.addClass('border-primary');
            mode_clicked.find('.mode-of-payment-control').css('display', 'flex');
            mode_clicked.find('.cash-shortcuts').css('display', 'grid');
            me.$payment_modes.find(`.${mode}-amount`).css('display', 'none');
            me.$payment_modes.find(`.${mode}-name`).css('display', 'inline');
            me.selected_mode = me[`${mode}_control`];
            me.selected_mode && me.selected_mode.$input.get(0).focus();
        }
    }

    handle_split_payment_selection(mode_clicked, mode) {
        $('.mode-of-payment').removeClass('payment-mode-split-active');
        mode_clicked.addClass('payment-mode-split-active');
        $('.mode-of-payment-control').css('display', 'none');
        mode_clicked.find('.mode-of-payment-control').css('display', 'flex');
        this.selected_mode = this[`${mode}_control`];
        this.selected_mode && this.selected_mode.$input.get(0).focus();
    }

    setup_listener_for_payments() {
        frappe.realtime.on("process_phone_payment", (data) => {
            const doc = this.events.get_frm().doc;
            const { response, amount, success, failure_message } = data;
            let message, title;

            if (success) {
                title = __("Payment Received");
                const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
                if (amount >= grand_total) {
                    frappe.dom.unfreeze();
                    message = __("Payment of {0} received successfully.", [format_currency(amount, doc.currency, 0)]);
                    this.events.submit_invoice();
                    cur_frm.reload_doc();
                } else {
                    message = __("Payment of {0} received successfully. Waiting for other requests to complete...", [format_currency(amount, doc.currency, 0)]);
                }
            } else if (failure_message) {
                message = failure_message;
                title = __("Payment Failed");
            }
            frappe.msgprint({ "message": message, "title": title });
        });
    }

    attach_shortcuts() {
        const ctrl_label = frappe.utils.is_mac() ? '⌘' : 'Ctrl';
        this.$component.find('.submit-order-btn').attr("title", `${ctrl_label}+Enter`);
        frappe.ui.keys.on("ctrl+enter", () => {
            const payment_is_visible = this.$component.is(":visible");
            const active_mode = this.$payment_modes.find(".border-primary");
            if (payment_is_visible && active_mode.length && !this.is_split_mode) {
                this.$component.find('.submit-order-btn').click();
            }
        });

        frappe.ui.keys.add_shortcut({
            shortcut: "tab",
            action: () => {
                const payment_is_visible = this.$component.is(":visible");
                let active_mode = this.$payment_modes.find(".border-primary");
                active_mode = active_mode.length ? active_mode.attr("data-mode") : undefined;
                if (!active_mode) return;

                const mode_of_payments = Array.from(this.$payment_modes.find(".mode-of-payment")).map(m => $(m).attr("data-mode"));
                const mode_index = mode_of_payments.indexOf(active_mode);
                const next_mode_index = (mode_index + 1) % mode_of_payments.length;
                const next_mode_to_be_clicked = this.$payment_modes.find(`.mode-of-payment[data-mode="${mode_of_payments[next_mode_index]}"]`);
                if (payment_is_visible && mode_index != next_mode_index) next_mode_to_be_clicked.click();
            },
            condition: () => this.$component.is(':visible') && this.$payment_modes.find(".border-primary").length,
            description: __("Switch Between Payment Modes"),
            ignore_inputs: true,
            page: cur_page.page.page
        });
    }

    render_payment_section() {
        if (this._current_invoice_name !== this.events.get_frm().doc.name) {
            this.clear_invoice_switch_data();
        }
        this.render_payment_mode_dom();
        this.update_totals_section();

        setTimeout(() => {
            if (this.is_split_mode && this.split_payments.length > 0) return;
            if (!this._payment_detection_done) {
                this._payment_detection_done = true;
                if (this.split_payments.length > 0 || this.original_payment_data) {
                    if (this.split_payments.length > 0 && !this.is_split_mode) {
                        this.$component.find('#split-payment-checkbox').prop('checked', true);
                        this.toggle_split_payment_mode(true);
                        return;
                    }
                    if (this.original_payment_data && this.split_payments.length === 0) {
                        this.process_original_payment_data();
                        return;
                    }
                }
                this.check_for_existing_payments();
                if (this.is_split_mode && this.split_payments.length === 0) this.sync_document_payments_to_split();
            }
        }, 50);

        this.focus_on_default_mop();
    }

    process_original_payment_data() {
        if (!this.original_payment_data || !Array.isArray(this.original_payment_data)) return;
        const current_doc = this.events.get_frm().doc;
        this.split_payments = [];
        let total_paid = 0;

        this.original_payment_data.forEach((payment, index) => {
            if (payment.amount && payment.amount > 0) {
                const mode = payment.mode_of_payment.replace(/ +/g, "_").toLowerCase();
                const split_payment = {
                    id: `${mode}_restored_${index}`,
                    mode: mode,
                    mode_of_payment: payment.mode_of_payment,
                    display_name: payment.mode_of_payment,
                    amount: payment.amount,
                    type: payment.type || 'Cash',
                    reference_number: payment.reference_no || '',
                    notes: payment.remarks || 'Restored from backup',
                    is_existing: true
                };
                this.split_payments.push(split_payment);
                total_paid += payment.amount;

                const current_payment = current_doc.payments.find(p => p.mode_of_payment === payment.mode_of_payment);
                if (current_payment) {
                    frappe.model.set_value(current_payment.doctype, current_payment.name, 'amount', payment.amount);
                    if (payment.reference_no) frappe.model.set_value(current_payment.doctype, current_payment.name, 'reference_no', payment.reference_no);
                    if (payment.remarks) frappe.model.set_value(current_payment.doctype, current_payment.name, 'remarks', payment.remarks);
                }
            }
        });

        if (this.split_payments.length > 0) {
            frappe.model.set_value(current_doc.doctype, current_doc.name, 'paid_amount', total_paid);
            const grand_total = current_doc.grand_total || current_doc.rounded_total || 0;
            const outstanding = grand_total - total_paid;
            frappe.model.set_value(current_doc.doctype, current_doc.name, 'outstanding_amount', Math.max(0, outstanding));

            let status = 'Draft';
            if (total_paid >= grand_total) status = 'Paid';
            else if (total_paid > 0) status = 'Partly Paid';
            frappe.model.set_value(current_doc.doctype, current_doc.name, 'status', status);

            this.$component.find('#split-payment-checkbox').prop('checked', true);
            this.toggle_split_payment_mode(true);
            setTimeout(() => { this.update_totals_section(current_doc); }, 100);
            frappe.show_alert({
                message: __("Payments restored from backup ({0} payment(s), Total: {1})", [this.split_payments.length, format_currency(total_paid, current_doc.currency)]),
                indicator: "green"
            });
        }
    }

    after_render() {
        const frm = this.events.get_frm();
        frm.script_manager.trigger("after_payment_render", frm.doc.doctype, frm.doc.docname);
    }

    edit_cart() {
        this.events.toggle_other_sections(false);
        this.toggle_component(false);
        this._payment_detection_done = false;
    }

    checkout() {
        this.events.toggle_other_sections(true);
        this.toggle_component(true);
        this.handle_posnext_checkout_flow();
        this.render_payment_section();
        this.after_render();
    }

    handle_posnext_checkout_flow() {
        const doc = this.events.get_frm().doc;
        if (this._current_invoice_name !== doc.name) {
            this.clear_invoice_switch_data();
        }
        setTimeout(() => { this.backup_payments_to_session(); }, 200);
    }

    toggle_remarks_control() {
        if (this.$remarks.find('.frappe-control').length) {
            this.$remarks.html('+ Add Remark');
        } else {
            this.$remarks.html('');
            this[`remark_control`] = frappe.ui.form.make_control({
                df: { label: __('Remark'), fieldtype: 'Data', onchange: function() {} },
                parent: this.$totals_section.find(`.remarks`),
                render_input: true,
            });
            this[`remark_control`].set_value('');
        }
    }

    render_payment_mode_dom() {
        const doc = this.events.get_frm().doc;
        const payments = doc.payments || []; // Fallback to empty array if undefined
        const currency = doc.currency;

        // Only recreate DOM if it doesn't exist or needs updating
        if (!this.$payment_modes.find('.mode-of-payment').length || payments.length !== this.$payment_modes.find('.mode-of-payment').length) {
            this.$payment_modes.html(
                payments.map((p, i) => {
                    const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
                    const payment_type = p.type;
                    const amount = p.amount > 0 ? format_currency(p.amount, currency) : '';
                    return `
                        <div class="payment-mode-wrapper">
                            <div class="mode-of-payment" data-mode="${mode}" data-payment-type="${payment_type}">
                                <div class="payment-mode-header">
                                    <span class="payment-mode-title">${p.mode_of_payment}</span>
                                    <div class="${mode}-amount pay-amount">${amount}</div>
                                </div>
                                <div class="${mode} mode-of-payment-control" style="width: 100%;"></div>
                            </div>
                        </div>
                    `;
                }).join('')
            );

            // Ensure improved CSS is added only once
            if (!$('#payment-mode-improved-styles').length) {
                $('head').append(`
                    <style id="payment-mode-improved-styles">
                        .payment-modes { display: flex; flex-wrap: wrap; gap: 10px; padding: 10px; }
                        .payment-mode-wrapper { flex: 1; min-width: 200px; max-width: 300px; }
                        .mode-of-payment { border: 2px solid #e0e0e0; border-radius: 8px; padding: 12px; cursor: pointer; transition: all 0.2s ease; background: white; min-height: 60px; }
                        .mode-of-payment:hover { border-color: #2196F3; box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2); }
                        .mode-of-payment.border-primary { border-color: #2196F3; background-color: #f8fafe; box-shadow: 0 2px 12px rgba(33, 150, 243, 0.3); }
                        .payment-mode-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                        .payment-mode-title { font-weight: 600; color: #333; font-size: 14px; }
                        .pay-amount { font-weight: bold; color: #2196F3; font-size: 13px; }
                        .mode-of-payment-control { margin-top: 8px; }
                        .cash-shortcuts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
                        .shortcut { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; text-align: center; cursor: pointer; font-size: 12px; transition: all 0.2s ease; }
                        .shortcut:hover { background: #e3f2fd; border-color: #2196F3; color: #2196F3; }
                    </style>
                `);
            }
        }

        // Create payment controls for all modes
        payments.forEach(p => {
            const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
            const controlContainer = this.$payment_modes.find(`.${mode}.mode-of-payment-control`);

            // Skip if container not found (log for debugging)
            if (!controlContainer.length) {
                frappe.show_alert({
                    message: __("Control container not found for mode: {0}", [p.mode_of_payment]),
                    indicator: "orange"
                });
                return;
            }

            // Create control if it doesn't exist
            if (!this[`${mode}_control`]) {
                this[`${mode}_control`] = frappe.ui.form.make_control({
                    df: {
                        label: p.mode_of_payment,
                        fieldtype: 'Currency',
                        placeholder: __('Enter {0} amount.', [p.mode_of_payment]),
                        onchange: () => {
                            const current_value = frappe.model.get_value(p.doctype, p.name, 'amount');
                            if (current_value != this[`${mode}_control`].value) {
                                frappe.model.set_value(p.doctype, p.name, 'amount', flt(this[`${mode}_control`].value)).then(() => this.update_totals_section());
                                const formatted_currency = format_currency(this[`${mode}_control`].value, currency);
                                this.$payment_modes.find(`.${mode}-amount`).html(formatted_currency);
                            }
                        }
                    },
                    parent: controlContainer,
                    render_input: true
                });
                this[`${mode}_control`].toggle_label(false);
            }

            // Set value if control exists
            if (this[`${mode}_control`]) {
                this[`${mode}_control`].set_value(p.amount);
            } else {
                frappe.show_alert({
                    message: __("Failed to create control for mode: {0}", [p.mode_of_payment]),
                    indicator: "red"
                });
            }
        });

        this.render_loyalty_points_payment_mode();
        this.attach_cash_shortcuts(doc);

        // Re-add split buttons if in split mode
        if (this.is_split_mode) {
            this.add_split_buttons_to_payment_modes();
        }
    }

    focus_on_default_mop() {
        const doc = this.events.get_frm().doc;
        const payments = doc.payments;
        if (this.is_split_mode) return;
        payments.forEach(p => {
            const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
            if (p.default) {
                setTimeout(() => { this.$payment_modes.find(`.${mode}.mode-of-payment-control`).parent().click(); }, 100);
            }
        });
    }

    attach_cash_shortcuts(doc) {
        const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
        const currency = doc.currency;
        const shortcuts = this.get_cash_shortcuts(flt(grand_total));

        this.$payment_modes.find('.cash-shortcuts').remove();
        let shortcuts_html = shortcuts.map(s => `<div class="shortcut" data-value="${s}">${format_currency(s, currency, 0)}</div>`).join('');
        this.$payment_modes.find('[data-payment-type="Cash"]').find('.mode-of-payment-control').after(`<div class="cash-shortcuts">${shortcuts_html}</div>`);
    }

    get_cash_shortcuts(grand_total) {
        let steps = [1, 5, 10];
        const digits = String(Math.round(grand_total)).length;
        steps = steps.map(x => x * (10 ** (digits - 2)));
        const get_nearest = (amount, x) => {
            let nearest_x = Math.ceil((amount / x)) * x;
            return nearest_x === amount ? nearest_x + x : nearest_x;
        };
        return steps.reduce((finalArr, x) => {
            let nearest_x = get_nearest(grand_total, x);
            nearest_x = finalArr.indexOf(nearest_x) != -1 ? nearest_x + x : nearest_x;
            return [...finalArr, nearest_x];
        }, []);
    }

    render_loyalty_points_payment_mode() {
        const me = this;
        const doc = this.events.get_frm().doc;
        const { loyalty_program, loyalty_points, conversion_factor } = this.events.get_customer_details();
        this.$payment_modes.find(`.mode-of-payment[data-mode="loyalty-amount"]`).parent().remove();
        if (!loyalty_program) return;

        let description, read_only, max_redeemable_amount;
        if (!loyalty_points) {
            description = __("You don't have enough points to redeem.");
            read_only = true;
        } else {
            max_redeemable_amount = flt(flt(loyalty_points) * flt(conversion_factor), precision("loyalty_amount", doc));
            description = __("You can redeem upto {0}.", [format_currency(max_redeemable_amount)]);
            read_only = false;
        }

        const amount = doc.loyalty_amount > 0 ? format_currency(doc.loyalty_amount, doc.currency) : '';
        this.$payment_modes.append(
            `<div class="payment-mode-wrapper">
                <div class="mode-of-payment loyalty-card" data-mode="loyalty-amount" data-payment-type="loyalty-amount">
                    Redeem Loyalty Points
                    <div class="loyalty-amount-amount pay-amount">${amount}</div>
                    <div class="loyalty-amount-name">${loyalty_program}</div>
                    <div class="loyalty-amount mode-of-payment-control"></div>
                </div>
            </div>`
        );

        this['loyalty-amount_control'] = frappe.ui.form.make_control({
            df: {
                label: __("Redeem Loyalty Points"),
                fieldtype: 'Currency',
                placeholder: __("Enter amount to be redeemed."),
                options: 'company:currency',
                read_only,
                onchange: async function() {
                    if (!loyalty_points) return;
                    if (this.value > max_redeemable_amount) {
                        frappe.show_alert({ message: __("You cannot redeem more than {0}.", [format_currency(max_redeemable_amount)]), indicator: "red" });
                        frappe.utils.play_sound("submit");
                        me['loyalty-amount_control'].set_value(0);
                        return;
                    }
                    const redeem_loyalty_points = this.value > 0 ? 1 : 0;
                    await frappe.model.set_value(doc.doctype, doc.name, 'redeem_loyalty_points', redeem_loyalty_points);
                    frappe.model.set_value(doc.doctype, doc.name, 'loyalty_points', parseInt(this.value / conversion_factor));
                },
                description
            },
            parent: this.$payment_modes.find(`.loyalty-amount.mode-of-payment-control`),
            render_input: true,
        });
        this['loyalty-amount_control'].toggle_label(false);
    }

    render_add_payment_method_dom() {
        const docstatus = this.events.get_frm().doc.docstatus;
        if (docstatus === 0) {
            this.$payment_modes.append(
                `<div class="w-full pr-2">
                    <div class="add-mode-of-payment w-half text-grey mb-4 no-select pointer">+ Add Payment Method</div>
                </div>`
            );
        }
    }

    update_totals_section(doc) {
        if (!doc) doc = this.events.get_frm().doc;
        const paid_amount = doc.paid_amount;
        const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
        const remaining = grand_total - doc.paid_amount;
        const change = doc.change_amount || remaining <= 0 ? -1 * remaining : undefined;
        const currency = doc.currency;
        const label = change ? __('Change') : __('To Be Paid');

        this.$totals.html(
            `<div class="col">
                <div class="total-label">${__('Grand Total')}</div>
                <div class="value">${format_currency(grand_total, currency)}</div>
            </div>
            <div class="seperator-y"></div>
            <div class="col">
                <div class="total-label">${__('Paid Amount')}</div>
                <div class="value">${format_currency(paid_amount, currency)}</div>
            </div>
            <div class="seperator-y"></div>
            <div class="col">
                <div class="total-label">${label}</div>
                <div class="value">${format_currency(change || remaining, currency)}</div>
            </div>`
        );
    }

    toggle_component(show) {
        show ? this.$component.css('display', 'flex') : this.$component.css('display', 'none');
    }
};