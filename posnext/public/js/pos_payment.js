/* eslint-disable no-unused-vars */
frappe.provide('posnext.PointOfSale');
posnext.PointOfSale.Payment = class {
	constructor({ events, wrapper }) {
		this.wrapper = wrapper;
		this.events = events;

		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.initialize_numpad();
		this.bind_events();
		this.attach_shortcuts();

	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="payment-container">
				<div class="section-label payment-section">${__('Payment Method')}</div>
				<div class="payment-modes"></div>
				<div class="fields-numpad-container">
					<div class="fields-section">
						<div class="section-label">${__('Additional Information')}</div>
						<div class="invoice-fields"></div>
					</div>
					<div class="number-pad"></div>
				</div>
				<div class="totals-section">
					<div class="totals"></div>
				</div>
				<div class="submit-order-btn">${__("Complete Order")}</div>
			</section>`
		);
		this.$component = this.wrapper.find('.payment-container');
		this.$payment_modes = this.$component.find('.payment-modes');
		this.$totals_section = this.$component.find('.totals-section');
		this.$totals = this.$component.find('.totals');
		this.$numpad = this.$component.find('.number-pad');
		this.$invoice_fields_section = this.$component.find('.fields-section');
	}

	make_invoice_fields_control() {
		frappe.db.get_doc("POS Settings", undefined).then((doc) => {
			const fields = doc.invoice_fields;
			if (!fields.length) return;

			this.$invoice_fields = this.$invoice_fields_section.find('.invoice-fields');
			this.$invoice_fields.html('');
			const frm = this.events.get_frm();

			fields.forEach(df => {
				this.$invoice_fields.append(
					`<div class="invoice_detail_field ${df.fieldname}-field" data-fieldname="${df.fieldname}"></div>`
				);
				let df_events = {
					onchange: function() {
						frm.set_value(this.df.fieldname, this.get_value());
					}
				};
				if (df.fieldtype == "Button") {
					df_events = {
						click: function() {
							if (frm.script_manager.has_handlers(df.fieldname, frm.doc.doctype)) {
								frm.script_manager.trigger(df.fieldname, frm.doc.doctype, frm.doc.docname);
							}
						}
					};
				}

				this[`${df.fieldname}_field`] = frappe.ui.form.make_control({
					df: {
						...df,
						...df_events
					},
					parent: this.$invoice_fields.find(`.${df.fieldname}-field`),
					render_input: true,
				});
				this[`${df.fieldname}_field`].set_value(frm.doc[df.fieldname]);
			});
		});
	}

	initialize_numpad() {
		const me = this;
		this.number_pad = new posnext.PointOfSale.NumberPad({
			wrapper: this.$numpad,
			events: {
				numpad_event: function($btn) {
					me.on_numpad_clicked($btn);
				}
			},
			cols: 3,
			keys: [
				[ 1, 2, 3 ],
				[ 4, 5, 6 ],
				[ 7, 8, 9 ],
				[ '.', 0, 'Delete' ]
			],
		});

		this.numpad_value = '';
	}

	on_numpad_clicked($btn) {
		const button_value = $btn.attr('data-button-value');

		highlight_numpad_btn($btn);
		this.numpad_value = button_value === 'delete' ? this.numpad_value.slice(0, -1) : this.numpad_value + button_value;
		this.selected_mode.$input.get(0).focus();
		this.selected_mode.set_value(this.numpad_value);

		function highlight_numpad_btn($btn) {
			$btn.addClass('shadow-base-inner bg-selected');
			setTimeout(() => {
				$btn.removeClass('shadow-base-inner bg-selected');
			}, 100);
		}
	}

	bind_events() {
		const me = this;

		this.$payment_modes.on('click', '.mode-of-payment', function(e) {
			const mode_clicked = $(this);
			// if clicked element doesn't have .mode-of-payment class then return
			if (!$(e.target).is(mode_clicked)) return;

			const scrollLeft = mode_clicked.offset().left - me.$payment_modes.offset().left + me.$payment_modes.scrollLeft();
			me.$payment_modes.animate({ scrollLeft });

			const mode = mode_clicked.attr('data-mode');

			// hide all control fields and shortcuts
			$(`.mode-of-payment-control`).css('display', 'none');
			$(`.cash-shortcuts`).css('display', 'none');
			me.$payment_modes.find(`.pay-amount`).css('display', 'inline');
			me.$payment_modes.find(`.loyalty-amount-name`).css('display', 'none');

			// remove highlight from all mode-of-payments
			$('.mode-of-payment').removeClass('border-primary');

			if (mode_clicked.hasClass('border-primary')) {
				// clicked one is selected then unselect it
				mode_clicked.removeClass('border-primary');
				me.selected_mode = '';
			} else {
				// clicked one is not selected then select it
				mode_clicked.addClass('border-primary');
				mode_clicked.find('.mode-of-payment-control').css('display', 'flex');
				mode_clicked.find('.cash-shortcuts').css('display', 'grid');
				me.$payment_modes.find(`.${mode}-amount`).css('display', 'none');
				me.$payment_modes.find(`.${mode}-name`).css('display', 'inline');

				me.selected_mode = me[`${mode}_control`];
				me.selected_mode && me.selected_mode.$input.get(0).focus();
				me.auto_set_remaining_amount();
			}
		});

		// Add Apply Mpesa Payment button click event
		this.$payment_modes.on('click', '.apply-mpesa-payment', function(e) {
			e.stopPropagation();
			me.show_mpesa_payment_popup();
		});

		frappe.ui.form.on('POS Invoice', 'contact_mobile', (frm) => {
			const contact = frm.doc.contact_mobile;
			const request_button = $(this.request_for_payment_field?.$input[0]);
			if (contact) {
				request_button.removeClass('btn-default').addClass('btn-primary');
			} else {
				request_button.removeClass('btn-primary').addClass('btn-default');
			}
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
					frappe.show_alert({
						message: __("Ignore Pricing Rule is enabled. Cannot apply coupon code."),
						indicator: "orange"
					});
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
			const paid_amount = doc.paid_amount;
			const items = doc.items;

			if (paid_amount == 0 || !items.length) {
				const message = items.length ? __("You cannot submit the order without payment.") : __("You cannot submit empty order.");
				frappe.show_alert({ message, indicator: "orange" });
				frappe.utils.play_sound("error");
				return;
			}

			this.events.submit_invoice();
		});

		frappe.ui.form.on('POS Invoice', 'paid_amount', (frm) => {
			this.update_totals_section(frm.doc);

			// need to re calculate cash shortcuts after discount is applied
			const is_cash_shortcuts_invisible = !this.$payment_modes.find('.cash-shortcuts').is(':visible');
			this.attach_cash_shortcuts(frm.doc);
			!is_cash_shortcuts_invisible && this.$payment_modes.find('.cash-shortcuts').css('display', 'grid');
			this.render_payment_mode_dom();
		});

		frappe.ui.form.on('POS Invoice', 'loyalty_amount', (frm) => {
			const formatted_currency = format_currency(frm.doc.loyalty_amount, frm.doc.currency);
			this.$payment_modes.find(`.loyalty-amount-amount`).html(formatted_currency);
		});

		frappe.ui.form.on("Sales Invoice Payment", "amount", (frm, cdt, cdn) => {
			// for setting correct amount after loyalty points are redeemed
			const default_mop = locals[cdt][cdn];
			const mode = default_mop.mode_of_payment.replace(/ +/g, "_").toLowerCase();
			if (this[`${mode}_control`] && this[`${mode}_control`].get_value() != default_mop.amount) {
				this[`${mode}_control`].set_value(default_mop.amount);
			}
		});
	}

show_mpesa_payment_popup() {
    const me = this;
    const doc = this.events.get_frm().doc;
    const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
    const remaining_to_pay = grand_total - doc.paid_amount;

    // Fetch available Mpesa payments
    frappe.call({
        method: 'posnext.posnext.page.posnext.point_of_sale.get_available_mpesa_payments',
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                me.create_partial_mpesa_dialog(r.message, doc, remaining_to_pay);
            } else {
                frappe.msgprint({
                    title: __('No Available Payments'),
                    message: __('No Mpesa payments with available amounts found.'),
                    indicator: 'orange'
                });
            }
        }
    });
}	

create_partial_mpesa_dialog(payments, doc, remaining_to_pay) {
    const me = this;
    
    // Create table rows for payments
    const payment_rows = payments.map(payment => {
        const formatted_amount = format_currency(payment.transamount, doc.currency);
        const available_amount = format_currency(payment.available_amount, doc.currency);
        const formatted_time = frappe.datetime.str_to_user(payment.transtime);
        const status_color = payment.payment_status === 'Unapplied' ? '#28a745' : 
                           payment.payment_status === 'Partly Applied' ? '#ffc107' : '#6c757d';
        
        return `
            <tr data-payment-id="${payment.name}" data-available="${payment.available_amount}">
                <td style="text-align: center;">
                    <input type="checkbox" class="payment-checkbox" />
                </td>
                <td>${payment.full_name || ''}</td>
                <td>${payment.transid || ''}</td>
                <td style="text-align: right;">${formatted_amount}</td>
                <td style="text-align: right; font-weight: bold;">${available_amount}</td>
                <td>
                    <span style="color: ${status_color}; font-size: 12px; font-weight: bold;">
                        ${__(payment.payment_status)}
                    </span>
                </td>
                <td style="text-align: center;">
                    <input type="number" class="form-control amount-input" 
                           style="width: 100px; font-size: 12px;" 
                           min="0" max="${payment.available_amount}" 
                           step="0.01" placeholder="Amount" disabled />
                </td>
                <td>${formatted_time}</td>
            </tr>
        `;
    }).join('');

    const dialog_html = `
        <div class="mpesa-payment-dialog">
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
                    <strong>${__('Remaining to Pay')}: ${format_currency(remaining_to_pay, doc.currency)}</strong>
                    <span id="selected-total" style="color: #28a745; font-weight: bold;">
                        ${__('Selected')}: ${format_currency(0, doc.currency)}
                    </span>
                </div>
            </div>

            <div style="max-height: 500px; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px;">
                <table class="table table-striped" style="margin: 0;">
                    <thead style="background-color: #f8f9fa; position: sticky; top: 0;">
                        <tr>
                            <th style="text-align: center; width: 50px;">${__('Select')}</th>
                            <th>${__('Name')}</th>
                            <th>${__('Trans ID')}</th>
                            <th style="text-align: right;">${__('Original')}</th>
                            <th style="text-align: right;">${__('Available')}</th>
                            <th>${__('Status')}</th>
                            <th style="text-align: center;">${__('Apply Amount')}</th>
                            <th>${__('Time')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payment_rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const dialog = new frappe.ui.Dialog({
        title: __('Apply Partial Mpesa Payments'),
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'payment_selection',
                options: dialog_html
            }
        ],
        size: 'extra-large',
        primary_action_label: __('Apply Selected Payments'),
        primary_action: function() {
            me.apply_partial_mpesa_payments(dialog, doc);
        },
        secondary_action_label: __('Cancel')
    });

    dialog.show();

    // Add event listeners
    setTimeout(() => {
        const dialog_wrapper = dialog.$wrapper;
        
        // Handle checkbox changes
        dialog_wrapper.find('.payment-checkbox').on('change', function() {
            const row = $(this).closest('tr');
            const amount_input = row.find('.amount-input');
            const available_amount = parseFloat(row.data('available'));
            
            if ($(this).is(':checked')) {
                amount_input.prop('disabled', false);
                // Auto-fill with available amount or remaining amount, whichever is smaller
                const auto_amount = Math.min(available_amount, remaining_to_pay);
                amount_input.val(auto_amount);
            } else {
                amount_input.prop('disabled', true).val('');
            }
            
            me.update_partial_payment_total(dialog_wrapper, doc.currency);
        });

        // Handle amount input changes
        dialog_wrapper.find('.amount-input').on('input', function() {
            me.update_partial_payment_total(dialog_wrapper, doc.currency);
        });
    }, 100);
}

// New method to update total for partial payments
update_partial_payment_total(dialog_wrapper, currency) {
    let total = 0;
    dialog_wrapper.find('.payment-checkbox:checked').each(function() {
        const row = $(this).closest('tr');
        const amount_input = row.find('.amount-input');
        const amount = parseFloat(amount_input.val()) || 0;
        total += amount;
    });
    
    dialog_wrapper.find('#selected-total').html(
        `${__('Selected')}: ${format_currency(total, currency)}`
    );
}	

	update_selected_total(dialog_wrapper, currency) {
		let total = 0;
		dialog_wrapper.find('.payment-checkbox:checked').each(function() {
			total += flt($(this).data('amount'));
		});
		
		dialog_wrapper.find('#selected-total').html(
			`${__('Selected')}: ${format_currency(total, currency)}`
		);
	}

	update_select_all_state(dialog_wrapper) {
		const total_checkboxes = dialog_wrapper.find('.payment-checkbox').length;
		const checked_checkboxes = dialog_wrapper.find('.payment-checkbox:checked').length;
		
		const select_all = dialog_wrapper.find('#select-all-payments');
		if (checked_checkboxes === 0) {
			select_all.prop('indeterminate', false).prop('checked', false);
		} else if (checked_checkboxes === total_checkboxes) {
			select_all.prop('indeterminate', false).prop('checked', true);
		} else {
			select_all.prop('indeterminate', true);
		}
	}

apply_partial_mpesa_payments(dialog, doc) {
    const me = this;
    const selected_payments = [];
    let total_amount = 0;
    let has_error = false;

    dialog.$wrapper.find('.payment-checkbox:checked').each(function() {
        const row = $(this).closest('tr');
        const payment_id = row.data('payment-id');
        const available_amount = parseFloat(row.data('available'));
        const amount_input = row.find('.amount-input');
        const apply_amount = parseFloat(amount_input.val()) || 0;
        
        if (apply_amount <= 0) {
            frappe.msgprint({
                title: __('Invalid Amount'),
                message: __('Please enter a valid amount for all selected payments.'),
                indicator: 'red'
            });
            has_error = true;
            return false;
        }
        
        if (apply_amount > available_amount) {
            frappe.msgprint({
                title: __('Amount Exceeds Available'),
                message: __('Applied amount cannot exceed available amount for payment {0}', [payment_id]),
                indicator: 'red'
            });
            has_error = true;
            return false;
        }
        
        selected_payments.push({
            id: payment_id,
            amount: apply_amount
        });
        total_amount += apply_amount;
    });

    if (has_error || selected_payments.length === 0) {
        if (selected_payments.length === 0) {
            frappe.msgprint({
                title: __('No Selection'),
                message: __('Please select at least one payment to apply.'),
                indicator: 'orange'
            });
        }
        return;
    }

    // Show confirmation
    frappe.confirm(
        __('Apply {0} selected payments totaling {1}?', [
            selected_payments.length,
            format_currency(total_amount, doc.currency)
        ]),
        function() {
            me.process_partial_mpesa_payments(selected_payments, doc, total_amount);
            dialog.hide();
        }
    );
}

process_partial_mpesa_payments(selected_payments, doc, total_amount) {
    const me = this;
    
    frappe.show_alert({
        message: __('Processing partial Mpesa payments...'),
        indicator: 'blue'
    });

    frappe.call({
        method: 'posnext.point_of_sale.apply_partial_mpesa_payments',
        args: {
            payments_data: selected_payments,
            invoice_name: doc.name
        },
        callback: function(r) {
            if (r.message && r.message.success) {
                // Update the mpesa-tenacity payment amount
                const mpesa_control = me['mpesa-tenacity_control'];
                if (mpesa_control) {
                    const current_value = parseFloat(mpesa_control.get_value()) || 0;
                    mpesa_control.set_value(current_value + total_amount);
                }

                frappe.show_alert({
                    message: r.message.message,
                    indicator: 'green'
                });

                // Trigger update of totals
                me.update_totals_section(doc);
            } else {
                frappe.msgprint({
                    title: __('Error'),
                    message: r.message.message || __('Failed to apply payments. Please try again.'),
                    indicator: 'red'
                });
            }
        },
        error: function(error) {
            console.error('Error applying partial payments:', error);
            frappe.msgprint({
                title: __('Error'),
                message: __('Failed to apply payments. Please try again.'),
                indicator: 'red'
            });
        }
    });
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

	auto_set_remaining_amount() {
		const doc = this.events.get_frm().doc;
		const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
		const remaining_amount = grand_total - doc.paid_amount;
		const current_value = this.selected_mode ? this.selected_mode.get_value() : undefined;
		if (!current_value && remaining_amount > 0 && this.selected_mode) {
			this.selected_mode.set_value(remaining_amount);
		}
	}

	attach_shortcuts() {
		const ctrl_label = frappe.utils.is_mac() ? '⌘' : 'Ctrl';
		this.$component.find('.submit-order-btn').attr("title", `${ctrl_label}+Enter`);
		frappe.ui.keys.on("ctrl+enter", () => {
			const payment_is_visible = this.$component.is(":visible");
			const active_mode = this.$payment_modes.find(".border-primary");
			if (payment_is_visible && active_mode.length) {
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

				if (payment_is_visible && mode_index != next_mode_index) {
					next_mode_to_be_clicked.click();
				}
			},
			condition: () => this.$component.is(':visible') && this.$payment_modes.find(".border-primary").length,
			description: __("Switch Between Payment Modes"),
			ignore_inputs: true,
			page: cur_page.page.page
		});
	}

	toggle_numpad() {
		// pass
	}

	render_payment_section() {
		this.render_payment_mode_dom();
		this.make_invoice_fields_control();
		this.update_totals_section();
		this.focus_on_default_mop();
	}

	after_render() {
		const frm = this.events.get_frm();
		frm.script_manager.trigger("after_payment_render", frm.doc.doctype, frm.doc.docname);
	}

	edit_cart() {
		this.events.toggle_other_sections(false);
		this.toggle_component(false);
	}

	checkout() {
		this.events.toggle_other_sections(true);
		this.toggle_component(true);

		this.render_payment_section();
		this.after_render();
	}

	toggle_remarks_control() {
		if (this.$remarks.find('.frappe-control').length) {
			this.$remarks.html('+ Add Remark');
		} else {
			this.$remarks.html('');
			this[`remark_control`] = frappe.ui.form.make_control({
				df: {
					label: __('Remark'),
					fieldtype: 'Data',
					onchange: function() {}
				},
				parent: this.$totals_section.find(`.remarks`),
				render_input: true,
			});
			this[`remark_control`].set_value('');
		}
	}

	render_payment_mode_dom() {
		const doc = this.events.get_frm().doc;
		const payments = doc.payments;
		const currency = doc.currency;

		this.$payment_modes.html(`${
			payments.map((p, i) => {
				const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
				const payment_type = p.type;
				const margin = i % 2 === 0 ? 'pr-2' : 'pl-2';
				const amount = p.amount > 0 ? format_currency(p.amount, currency) : '';

				// Add special button for mpesa-paybill mode
				const mpesa_button = mode === 'mpesa-tenacity' ? 
					`<div class="apply-mpesa-payment" style="
						background: #28a745; 
						color: white; 
						padding: 4px 8px; 
						border-radius: 4px; 
						font-size: 11px; 
						cursor: pointer; 
						margin-top: 4px;
						text-align: center;
						user-select: none;
					">${__('Apply Mpesa Payment')}</div>` : '';

				return (`
					<div class="payment-mode-wrapper">
						<div class="mode-of-payment" data-mode="${mode}" data-payment-type="${payment_type}">
							${p.mode_of_payment}
							<div class="${mode}-amount pay-amount">${amount}</div>
							<div class="${mode} mode-of-payment-control"></div>
							${mpesa_button}
						</div>
					</div>
				`);
			}).join('')
		}`);

		payments.forEach(p => {
			const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
			const me = this;
			this[`${mode}_control`] = frappe.ui.form.make_control({
				df: {
					label: p.mode_of_payment,
					fieldtype: 'Currency',
					placeholder: __('Enter {0} amount.', [p.mode_of_payment]),
					onchange: function() {
						const current_value = frappe.model.get_value(p.doctype, p.name, 'amount');
						if (current_value != this.value) {
							frappe.model
								.set_value(p.doctype, p.name, 'amount', flt(this.value))
								.then(() => me.update_totals_section())

							const formatted_currency = format_currency(this.value, currency);
							me.$payment_modes.find(`.${mode}-amount`).html(formatted_currency);
						}
					}
				},
				parent: this.$payment_modes.find(`.${mode}.mode-of-payment-control`),
				render_input: true,
			});
			this[`${mode}_control`].toggle_label(false);
			this[`${mode}_control`].set_value(p.amount);
		});

		this.render_loyalty_points_payment_mode();

		this.attach_cash_shortcuts(doc);
	}

	focus_on_default_mop() {
		const doc = this.events.get_frm().doc;
		const payments = doc.payments;
		payments.forEach(p => {
			const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
			if (p.default) {
				setTimeout(() => {
					this.$payment_modes.find(`.${mode}.mode-of-payment-control`).parent().click();
				}, 500);
			}
		});
	}

	attach_cash_shortcuts(doc) {
		const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
		const currency = doc.currency;

		const shortcuts = this.get_cash_shortcuts(flt(grand_total));

		this.$payment_modes.find('.cash-shortcuts').remove();
		let shortcuts_html = shortcuts.map(s => {
			return `<div class="shortcut" data-value="${s}">${format_currency(s, currency, 0)}</div>`;
		}).join('');

		this.$payment_modes.find('[data-payment-type="Cash"]').find('.mode-of-payment-control')
			.after(`<div class="cash-shortcuts">${shortcuts_html}</div>`);
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

		const margin = this.$payment_modes.children().length % 2 === 0 ? 'pr-2' : 'pl-2';
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
						frappe.show_alert({
							message: __("You cannot redeem more than {0}.", [format_currency(max_redeemable_amount)]),
							indicator: "red"
						});
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

		// this.render_add_payment_method_dom();
	}

	render_add_payment_method_dom() {
		const docstatus = this.events.get_frm().doc.docstatus;
		if (docstatus === 0)
			this.$payment_modes.append(
				`<div class="w-full pr-2">
					<div class="add-mode-of-payment w-half text-grey mb-4 no-select pointer">+ Add Payment Method</div>
				</div>`
			);
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