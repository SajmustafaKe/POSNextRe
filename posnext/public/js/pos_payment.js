/* eslint-disable no-unused-vars */
frappe.provide('posnext.PointOfSale');
posnext.PointOfSale.Payment = class {
	constructor({ events, wrapper }) {
		this.wrapper = wrapper;
		this.events = events;
		this.split_payments = [];
		this.partial_payments = [];
		this.is_split_mode = false;
		this.is_partial_mode = false;
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
				<div class="payment-header">
					<div class="section-label payment-section">
						${__('Payment Method')}
						<div class="payment-toggles">
							<div class="split-payment-toggle">
								<label class="switch">
									<input type="checkbox" id="split-payment-checkbox">
									<span class="slider round"></span>
								</label>
								<span class="split-label">${__('Split Payment')}</span>
							</div>
							<div class="partial-payment-toggle">
								<label class="switch">
									<input type="checkbox" id="partial-payment-checkbox">
									<span class="slider round"></span>
								</label>
								<span class="partial-label">${__('Partial Payment')}</span>
							</div>
						</div>
					</div>
				</div>
				
				<div class="payment-body">
					<div class="payment-modes-container">
						<div class="payment-modes"></div>
					</div>
					
					<div class="payment-details-container">
						<div class="split-payments-container" style="display: none;">
							<div class="section-label">${__('Split Payments')}</div>
							<div class="split-payments-wrapper">
								<div class="split-payments-list"></div>
							</div>
							<div class="split-payment-summary">
								<div class="split-total">
									<span>${__('Total Allocated')}: </span>
									<span class="split-total-amount">0.00</span>
								</div>
								<div class="split-remaining">
									<span>${__('Remaining')}: </span>
									<span class="split-remaining-amount">0.00</span>
								</div>
							</div>
						</div>
						
						<div class="partial-payments-container" style="display: none;">
							<div class="section-label">${__('Partial Payments')}</div>
							<div class="partial-payments-wrapper">
								<div class="partial-payments-list"></div>
							</div>
							<div class="partial-payment-summary">
								<div class="partial-total">
									<span>${__('Total Paid')}: </span>
									<span class="partial-total-amount">0.00</span>
								</div>
								<div class="partial-outstanding">
									<span>${__('Outstanding')}: </span>
									<span class="partial-outstanding-amount">0.00</span>
								</div>
							</div>
						</div>
					</div>
					
					<div class="fields-numpad-container">
						<div class="fields-section">
							<div class="section-label">${__('Additional Information')}</div>
							<div class="invoice-fields"></div>
						</div>
						<div class="number-pad"></div>
					</div>
				</div>
				
				<div class="payment-footer">
					<div class="totals-section">
						<div class="totals"></div>
					</div>
					<div class="payment-actions">
						<div class="save-partial-btn" style="display: none;">${__("Save as Partial")}</div>
						<div class="submit-order-btn">${__("Complete Order")}</div>
					</div>
				</div>
			</section>`
		);
		
		if (!$('#enhanced-payment-styles').length) {
			$('head').append(`
				<style id="enhanced-payment-styles">
					.payment-container {
						display: flex;
						flex-direction: column;
						height: 100%;
						max-height: 100vh;
						overflow: hidden;
					}
					
					.payment-header {
						flex-shrink: 0;
						padding: 15px;
						border-bottom: 1px solid #e0e0e0;
					}
					
					.payment-section {
						display: flex;
						justify-content: space-between;
						align-items: center;
						margin: 0;
					}
					
					.payment-toggles {
						display: flex;
						gap: 20px;
						align-items: center;
					}
					
					.split-payment-toggle, .partial-payment-toggle {
						display: flex;
						align-items: center;
						gap: 8px;
					}
					
					.payment-body {
						flex: 1;
						display: flex;
						flex-direction: column;
						overflow: hidden;
						padding: 0 15px;
					}
					
					.payment-modes-container {
						flex-shrink: 0;
						margin-bottom: 15px;
					}
					
					.payment-details-container {
						flex: 1;
						overflow-y: auto;
						margin-bottom: 15px;
						min-height: 0;
					}
					
					.fields-numpad-container {
						flex-shrink: 0;
						display: flex;
						gap: 15px;
						margin-bottom: 15px;
					}
					
					.fields-section {
						flex: 1;
					}
					
					.number-pad {
						flex-shrink: 0;
						width: 200px;
					}
					
					.payment-footer {
						flex-shrink: 0;
						padding: 15px;
						border-top: 1px solid #e0e0e0;
						background-color: #f9f9f9;
					}
					
					.payment-actions {
						display: flex;
						gap: 10px;
						margin-top: 10px;
					}
					
					.save-partial-btn, .submit-order-btn {
						flex: 1;
						padding: 12px;
						text-align: center;
						border-radius: 6px;
						cursor: pointer;
						font-weight: bold;
						transition: all 0.3s ease;
					}
					
					.save-partial-btn {
						background: #17a2b8;
						color: white;
					}
					
					.save-partial-btn:hover {
						background: #138496;
					}
					
					.submit-order-btn {
						background: #28a745;
						color: white;
					}
					
					.submit-order-btn:hover {
						background: #218838;
					}
					
					.switch {
						position: relative;
						display: inline-block;
						width: 44px;
						height: 24px;
					}
					
					.switch input {
						opacity: 0;
						width: 0;
						height: 0;
					}
					
					.slider {
						position: absolute;
						cursor: pointer;
						top: 0;
						left: 0;
						right: 0;
						bottom: 0;
						background-color: #ccc;
						transition: .4s;
						border-radius: 24px;
					}
					
					.slider:before {
						position: absolute;
						content: "";
						height: 18px;
						width: 18px;
						left: 3px;
						bottom: 3px;
						background-color: white;
						transition: .4s;
						border-radius: 50%;
					}
					
					input:checked + .slider {
						background-color: #2196F3;
					}
					
					input:checked + .slider:before {
						transform: translateX(20px);
					}
					
					.split-payments-container, .partial-payments-container {
						border: 1px solid #e0e0e0;
						border-radius: 8px;
						padding: 15px;
						background-color: #f9f9f9;
						margin-bottom: 15px;
					}
					
					.split-payments-wrapper, .partial-payments-wrapper {
						max-height: 300px;
						overflow-y: auto;
						margin: 10px 0;
						border: 1px solid #ddd;
						border-radius: 4px;
						background: white;
					}
					
					.split-payment-item, .partial-payment-item {
						display: flex;
						justify-content: space-between;
						align-items: flex-start;
						padding: 12px;
						border-bottom: 1px solid #f0f0f0;
						background-color: white;
					}
					
					.split-payment-item:last-child, .partial-payment-item:last-child {
						border-bottom: none;
					}
					
					.split-payment-info, .partial-payment-info {
						flex: 1;
						display: flex;
						flex-direction: column;
					}
					
					.split-payment-method, .partial-payment-method {
						font-weight: bold;
						color: #333;
						margin-bottom: 4px;
					}
					
					.split-payment-details, .partial-payment-details {
						display: flex;
						gap: 8px;
						flex-wrap: wrap;
					}
					
					.split-reference-input, .split-notes-input,
					.partial-reference-input, .partial-notes-input,
					.partial-date-input {
						border: 1px solid #ddd;
						border-radius: 3px;
						padding: 2px 6px;
						font-size: 11px;
						margin-top: 2px;
					}
					
					.split-payment-actions, .partial-payment-actions {
						display: flex;
						align-items: center;
						gap: 8px;
						flex-shrink: 0;
					}
					
					.split-payment-amount, .partial-payment-amount {
						color: #2196F3;
						font-weight: bold;
						font-size: 14px;
					}
					
					.split-payment-edit, .split-payment-remove,
					.partial-payment-edit, .partial-payment-remove {
						padding: 4px 8px;
						border: none;
						border-radius: 4px;
						cursor: pointer;
						font-size: 12px;
					}
					
					.split-payment-edit, .partial-payment-edit {
						background: #17a2b8;
						color: white;
					}
					
					.split-payment-remove, .partial-payment-remove {
						background: #dc3545;
						color: white;
					}
					
					.split-payment-summary, .partial-payment-summary {
						margin-top: 15px;
						padding-top: 15px;
						border-top: 2px solid #2196F3;
						font-weight: bold;
					}
					
					.split-total, .split-remaining,
					.partial-total, .partial-outstanding {
						display: flex;
						justify-content: space-between;
						margin: 5px 0;
					}
					
					.split-remaining-amount, .partial-outstanding-amount {
						color: #ff6b6b;
					}
					
					.split-total-amount, .partial-total-amount {
						color: #4CAF50;
					}
					
					.payment-mode-split-active {
						border: 2px solid #2196F3 !important;
						background-color: #e3f2fd !important;
					}
					
					.add-to-split-btn, .add-to-partial-btn {
						margin-top: 5px;
						width: 100%;
						padding: 4px 8px;
						font-size: 12px;
					}
					
					.empty-payments-state {
						text-align: center;
						padding: 30px;
						color: #6c757d;
						font-style: italic;
					}
					
					@media (max-width: 768px) {
						.fields-numpad-container {
							flex-direction: column;
						}
						
						.number-pad {
							width: 100%;
						}
						
						.payment-toggles {
							flex-direction: column;
							gap: 10px;
							align-items: flex-end;
						}
					}
					
					.split-payments-wrapper::-webkit-scrollbar,
					.partial-payments-wrapper::-webkit-scrollbar {
						width: 6px;
					}
					
					.split-payments-wrapper::-webkit-scrollbar-track,
					.partial-payments-wrapper::-webkit-scrollbar-track {
						background: #f1f1f1;
						border-radius: 3px;
					}
					
					.split-payments-wrapper::-webkit-scrollbar-thumb,
					.partial-payments-wrapper::-webkit-scrollbar-thumb {
						background: #c1c1c1;
						border-radius: 3px;
					}
					
					.split-payments-wrapper::-webkit-scrollbar-thumb:hover,
					.partial-payments-wrapper::-webkit-scrollbar-thumb:hover {
						background: #a8a8a8;
					}
				</style>
			`);
		}

		this.$component = this.wrapper.find('.payment-container');
		this.$payment_modes = this.$component.find('.payment-modes');
		this.$split_container = this.$component.find('.split-payments-container');
		this.$split_list = this.$component.find('.split-payments-list');
		this.$partial_container = this.$component.find('.partial-payments-container');
		this.$partial_list = this.$component.find('.partial-payments-list');
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

		this.$component.on('change', '#split-payment-checkbox', function() {
			me.toggle_split_payment_mode($(this).is(':checked'));
		});

		this.$component.on('change', '#partial-payment-checkbox', function() {
			me.toggle_partial_payment_mode($(this).is(':checked'));
		});

		this.$payment_modes.on('click', '.mode-of-payment', function(e) {
			const mode_clicked = $(this);
			if (!$(e.target).is(mode_clicked)) return;

			const mode = mode_clicked.attr('data-mode');
			
			if (me.is_split_mode) {
				me.handle_split_payment_selection(mode_clicked, mode);
			} else if (me.is_partial_mode) {
				me.handle_partial_payment_selection(mode_clicked, mode);
			} else {
				me.handle_regular_payment_selection(mode_clicked, mode);
			}
		});

		this.$component.on('click', '.add-to-split-btn', function() {
			const mode = $(this).closest('.mode-of-payment').attr('data-mode');
			const amount = me[`${mode}_control`] ? parseFloat(me[`${mode}_control`].get_value()) || 0 : 0;
			
			if (amount > 0) {
				me.add_split_payment(mode, amount);
			} else {
				frappe.show_alert({
					message: __("Please enter an amount greater than 0"),
					indicator: "orange"
				});
			}
		});

		this.$component.on('click', '.add-to-partial-btn', function() {
			const mode = $(this).closest('.mode-of-payment').attr('data-mode');
			const amount = me[`${mode}_control`] ? parseFloat(me[`${mode}_control`].get_value()) || 0 : 0;
			
			if (amount > 0) {
				me.add_partial_payment(mode, amount);
			} else {
				frappe.show_alert({
					message: __("Please enter an amount greater than 0"),
					indicator: "orange"
				});
			}
		});

		this.$component.on('click', '.split-payment-remove', function() {
			const index = $(this).data('index');
			me.remove_split_payment(index);
		});

		this.$component.on('click', '.partial-payment-remove', function() {
			const index = $(this).data('index');
			me.remove_partial_payment(index);
		});

		this.$component.on('click', '.split-payment-edit', function() {
			const index = $(this).data('index');
			me.edit_split_payment(index);
		});

		this.$component.on('click', '.partial-payment-edit', function() {
			const index = $(this).data('index');
			me.edit_partial_payment(index);
		});

		this.$component.on('blur', '.split-reference-input', function() {
			const index = $(this).data('index');
			const value = $(this).val();
			if (me.split_payments[index]) {
				me.split_payments[index].reference_number = value;
			}
		});

		this.$component.on('blur', '.split-notes-input', function() {
			const index = $(this).data('index');
			const value = $(this).val();
			if (me.split_payments[index]) {
				me.split_payments[index].notes = value;
			}
		});

		this.$component.on('blur', '.partial-reference-input', function() {
			const index = $(this).data('index');
			const value = $(this).val();
			if (me.partial_payments[index]) {
				me.partial_payments[index].reference_number = value;
			}
		});

		this.$component.on('blur', '.partial-notes-input', function() {
			const index = $(this).data('index');
			const value = $(this).val();
			if (me.partial_payments[index]) {
				me.partial_payments[index].notes = value;
			}
		});

		this.$component.on('click', '.save-partial-btn', function() {
			me.save_as_partial_payment();
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
			
			if (me.is_split_mode) {
				if (!me.validate_split_payment()) {
					return;
				}
				me.apply_split_payments_to_doc();
			} else if (me.is_partial_mode) {
				if (!me.validate_partial_payment()) {
					return;
				}
				me.apply_partial_payments_to_doc();
			}
			
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
			const default_mop = locals[cdt][cdn];
			const mode = default_mop.mode_of_payment.replace(/ +/g, "_").toLowerCase();
			if (this[`${mode}_control`] && this[`${mode}_control`].get_value() != default_mop.amount) {
				this[`${mode}_control`].set_value(default_mop.amount);
			}
		});
	}

	toggle_split_payment_mode(enable) {
		this.is_split_mode = enable;
		
		if (enable) {
			this.$component.find('#partial-payment-checkbox').prop('checked', false);
			this.is_partial_mode = false;
			this.$partial_container.hide();
			
			this.$split_container.show();
			this.render_split_payment_modes();
		} else {
			this.$split_container.hide();
			this.clear_split_payments();
			this.render_payment_mode_dom();
		}
		
		this.update_action_buttons();
	}

	toggle_partial_payment_mode(enable) {
		this.is_partial_mode = enable;
		
		if (enable) {
			this.$component.find('#split-payment-checkbox').prop('checked', false);
			this.is_split_mode = false;
			this.$split_container.hide();
			
			this.$partial_container.show();
			this.render_partial_payment_modes();
		} else {
			this.$partial_container.hide();
			this.clear_partial_payments();
			this.render_payment_mode_dom();
		}
		
		this.update_action_buttons();
	}

	update_action_buttons() {
		const $save_partial = this.$component.find('.save-partial-btn');
		const $complete_order = this.$component.find('.submit-order-btn');
		
		if (this.is_partial_mode) {
			$save_partial.show();
			$complete_order.text(__("Complete Full Payment"));
		} else {
			$save_partial.hide();
			$complete_order.text(__("Complete Order"));
		}
	}

	render_split_payment_modes() {
		const doc = this.events.get_frm().doc;
		const payments = doc.payments;

		this.$payment_modes.html(`${
			payments.map((p, i) => {
				const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
				const payment_type = p.type;

				return (`
					<div class="payment-mode-wrapper">
						<div class="mode-of-payment" data-mode="${mode}" data-payment-type="${payment_type}">
							${p.mode_of_payment}
							<div class="${mode} mode-of-payment-control"></div>
							<button class="add-to-split-btn btn btn-sm btn-primary">
								${__('Add to Split')}
							</button>
						</div>
					</div>
				`);
			}).join('')
		}`);

		payments.forEach(p => {
			const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
			
			this[`${mode}_control`] = frappe.ui.form.make_control({
				df: {
					label: p.mode_of_payment,
					fieldtype: 'Currency',
					placeholder: __('Enter {0} amount.', [p.mode_of_payment]),
					onchange: function() {
					}
				},
				parent: this.$payment_modes.find(`.${mode}.mode-of-payment-control`),
				render_input: true,
			});
			this[`${mode}_control`].toggle_label(false);
		});
	}

	render_partial_payment_modes() {
		const doc = this.events.get_frm().doc;
		const payments = doc.payments;

		this.$payment_modes.html(`${
			payments.map((p, i) => {
				const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
				const payment_type = p.type;

				return (`
					<div class="payment-mode-wrapper">
						<div class="mode-of-payment" data-mode="${mode}" data-payment-type="${payment_type}">
							${p.mode_of_payment}
							<div class="${mode} mode-of-payment-control"></div>
							<button class="add-to-partial-btn btn btn-sm btn-info">
								${__('Record Payment')}
							</button>
						</div>
					</div>
				`);
			}).join('')
		}`);

		payments.forEach(p => {
			const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
			
			this[`${mode}_control`] = frappe.ui.form.make_control({
				df: {
					label: p.mode_of_payment,
					fieldtype: 'Currency',
					placeholder: __('Enter {0} amount.', [p.mode_of_payment]),
					onchange: function() {
					}
				},
				parent: this.$payment_modes.find(`.${mode}.mode-of-payment-control`),
				render_input: true,
			});
			this[`${mode}_control`].toggle_label(false);
		});
	}

	add_split_payment(mode, amount) {
		const doc = this.events.get_frm().doc;
		const payment_method = doc.payments.find(p => 
			p.mode_of_payment.replace(/ +/g, "_").toLowerCase() === mode
		);

		if (!payment_method) return;

		const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
		const current_split_total = this.get_split_total();
		
		if (current_split_total + amount > grand_total) {
			const remaining = grand_total - current_split_total;
			frappe.show_alert({
				message: __("Amount exceeds remaining total. Maximum you can add is {0}", [format_currency(remaining, doc.currency)]),
				indicator: "orange"
			});
			return;
		}

		const split_id = `${mode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		const same_method_count = this.split_payments.filter(p => p.mode === mode).length;
		const reference = same_method_count > 0 ? ` #${same_method_count + 1}` : '';

		this.split_payments.push({
			id: split_id,
			mode: mode,
			mode_of_payment: payment_method.mode_of_payment,
			display_name: payment_method.mode_of_payment + reference,
			amount: amount,
			type: payment_method.type,
			reference_number: '',
			notes: ''
		});

		if (this[`${mode}_control`]) {
			this[`${mode}_control`].set_value(0);
		}

		this.render_split_payments_list();
		this.update_split_summary();
	}

	add_partial_payment(mode, amount) {
		const doc = this.events.get_frm().doc;
		const payment_method = doc.payments.find(p => 
			p.mode_of_payment.replace(/ +/g, "_").toLowerCase() === mode
		);

		if (!payment_method) return;

		const partial_id = `${mode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const payment_date = frappe.datetime.now_datetime();

		this.partial_payments.push({
			id: partial_id,
			mode: mode,
			mode_of_payment: payment_method.mode_of_payment,
			amount: amount,
			payment_date: payment_date,
			reference_number: '',
			notes: '',
			recorded_by: frappe.session.user_fullname || frappe.session.user
		});

		if (this[`${mode}_control`]) {
			this[`${mode}_control`].set_value(0);
		}

		this.render_partial_payments_list();
		this.update_partial_summary();
	}

	remove_split_payment(index) {
		this.split_payments.splice(index, 1);
		this.renumber_same_payment_methods();
		this.render_split_payments_list();
		this.update_split_summary();
	}

	remove_partial_payment(index) {
		this.partial_payments.splice(index, 1);
		this.render_partial_payments_list();
		this.update_partial_summary();
	}

	edit_split_payment(index) {
		const payment = this.split_payments[index];
		if (!payment) return;

		const doc = this.events.get_frm().doc;
		const current_amount = payment.amount;
		const remaining_without_this = this.get_split_total() - current_amount;
		const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
		const max_amount = grand_total - remaining_without_this;

		frappe.prompt([{
			label: __('Amount'),
			fieldname: 'amount',
			fieldtype: 'Currency',
			default: current_amount,
			reqd: 1
		}, {
			label: __('Reference Number'),
			fieldname: 'reference_number',
			fieldtype: 'Data',
			default: payment.reference_number
		}, {
			label: __('Notes'),
			fieldname: 'notes',
			fieldtype: 'Small Text',
			default: payment.notes
		}], (values) => {
			if (values.amount <= 0) {
				frappe.show_alert({
					message: __("Amount must be greater than 0"),
					indicator: "red"
				});
				return;
			}

			if (values.amount > max_amount) {
				frappe.show_alert({
					message: __("Amount cannot exceed {0}", [format_currency(max_amount, doc.currency)]),
					indicator: "red"
				});
				return;
			}

			this.split_payments[index].amount = values.amount;
			this.split_payments[index].reference_number = values.reference_number || '';
			this.split_payments[index].notes = values.notes || '';

			this.render_split_payments_list();
			this.update_split_summary();
		}, __('Edit Split Payment'), __('Update'));
	}

	edit_partial_payment(index) {
		const payment = this.partial_payments[index];
		if (!payment) return;

		frappe.prompt([{
			label: __('Amount'),
			fieldname: 'amount',
			fieldtype: 'Currency',
			default: payment.amount,
			reqd: 1
		}, {
			label: __('Payment Date'),
			fieldname: 'payment_date',
			fieldtype: 'Datetime',
			default: payment.payment_date,
			reqd: 1
		}, {
			label: __('Reference Number'),
			fieldname: 'reference_number',
			fieldtype: 'Data',
			default: payment.reference_number
		}, {
			label: __('Notes'),
			fieldname: 'notes',
			fieldtype: 'Small Text',
			default: payment.notes
		}], (values) => {
			if (values.amount <= 0) {
				frappe.show_alert({
					message: __("Amount must be greater than 0"),
					indicator: "red"
				});
				return;
			}

			this.partial_payments[index] = {
				...payment,
				amount: values.amount,
				payment_date: values.payment_date,
				reference_number: values.reference_number || '',
				notes: values.notes || ''
			};

			this.render_partial_payments_list();
			this.update_partial_summary();
		}, __('Edit Partial Payment'), __('Update'));
	}

	renumber_same_payment_methods() {
		const method_counts = {};
		
		this.split_payments.forEach(payment => {
			if (!method_counts[payment.mode]) {
				method_counts[payment.mode] = 0;
			}
			method_counts[payment.mode]++;
			
			const reference = method_counts[payment.mode] > 1 ? ` #${method_counts[payment.mode]}` : '';
			payment.display_name = payment.mode_of_payment + reference;
		});
	}

	render_split_payments_list() {
		const doc = this.events.get_frm().doc;
		const currency = doc.currency;

		if (this.split_payments.length === 0) {
			this.$split_list.html(`<div class="empty-payments-state">${__('No split payments added yet')}</div>`);
			return;
		}

		const html = this.split_payments.map((payment, index) => {
			return `
				<div class="split-payment-item" data-split-id="${payment.id}">
					<div class="split-payment-info">
						<span class="split-payment-method">${payment.display_name}</span>
						<div class="split-payment-details">
							<input type="text" class="split-reference-input" 
								   placeholder="${__('Reference #')}" 
								   value="${payment.reference_number}"
								   data-index="${index}"
								   style="width: 100px; font-size: 11px; margin-top: 2px;">
							<input type="text" class="split-notes-input" 
								   placeholder="${__('Notes')}" 
								   value="${payment.notes}"
								   data-index="${index}"
								   style="width: 120px; font-size: 11px; margin-top: 2px;">
						</div>
					</div>
					<div class="split-payment-actions">
						<span class="split-payment-amount">${format_currency(payment.amount, currency)}</span>
						<button class="split-payment-edit btn btn-xs btn-secondary" data-index="${index}" title="${__('Edit Amount')}">
							<i class="fa fa-edit"></i>
						</button>
						<button class="split-payment-remove btn btn-xs btn-danger" data-index="${index}" title="${__('Remove')}">
							<i class="fa fa-trash"></i>
						</button>
					</div>
				</div>
			`;
		}).join('');

		this.$split_list.html(html);
	}

	render_partial_payments_list() {
		const doc = this.events.get_frm().doc;
		const currency = doc.currency;

		if (this.partial_payments.length === 0) {
			this.$partial_list.html(`<div class="empty-payments-state">${__('No partial payments recorded yet')}</div>`);
			return;
		}

		const html = this.partial_payments.map((payment, index) => {
			const payment_date = frappe.datetime.str_to_user(payment.payment_date);
			return `
				<div class="partial-payment-item" data-partial-id="${payment.id}">
					<div class="partial-payment-info">
						<span class="partial-payment-method">${payment.mode_of_payment}</span>
						<div class="partial-payment-details">
							<small class="text-muted">${payment_date} by ${payment.recorded_by}</small>
							<input type="text" class="partial-reference-input" 
								   placeholder="${__('Reference #')}" 
								   value="${payment.reference_number}"
								   data-index="${index}"
								   style="width: 100px;">
							<input type="text" class="partial-notes-input" 
								   placeholder="${__('Notes')}" 
								   value="${payment.notes}"
								   data-index="${index}"
								   style="width: 120px;">
						</div>
					</div>
					<div class="partial-payment-actions">
						<span class="partial-payment-amount">${format_currency(payment.amount, currency)}</span>
						<button class="partial-payment-edit btn btn-xs btn-secondary" data-index="${index}" title="${__('Edit Payment')}">
							<i class="fa fa-edit"></i>
						</button>
						<button class="partial-payment-remove btn btn-xs btn-danger" data-index="${index}" title="${__('Remove')}">
							<i class="fa fa-trash"></i>
						</button>
					</div>
				</div>
			`;
		}).join('');

		this.$partial_list.html(html);
	}

	update_split_summary() {
		const doc = this.events.get_frm().doc;
		const currency = doc.currency;
		const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
		
		const split_total = this.get_split_total();
		const remaining = grand_total - split_total;

		this.$component.find('.split-total-amount').text(format_currency(split_total, currency));
		this.$component.find('.split-remaining-amount').text(format_currency(remaining, currency));
	}

	update_partial_summary() {
		const doc = this.events.get_frm().doc;
		const currency = doc.currency;
		const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
		
		const partial_total = this.get_partial_total();
		const outstanding = grand_total - partial_total;

		this.$component.find('.partial-total-amount').text(format_currency(partial_total, currency));
		this.$component.find('.partial-outstanding-amount').text(format_currency(outstanding, currency));
	}

	get_split_total() {
		return this.split_payments.reduce((total, payment) => total + payment.amount, 0);
	}

	get_partial_total() {
		return this.partial_payments.reduce((total, payment) => total + payment.amount, 0);
	}

	validate_split_payment() {
		const doc = this.events.get_frm().doc;
		const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
		const split_total = this.get_split_total();

		if (this.split_payments.length === 0) {
			frappe.show_alert({
				message: __("Please add at least one payment method to split"),
				indicator: "orange"
			});
			return false;
		}

		if (Math.abs(split_total - grand_total) > 0.01) {
			frappe.show_alert({
				message: __("Split payment total ({0}) must equal grand total ({1})", 
					[format_currency(split_total, doc.currency), format_currency(grand_total, doc.currency)]),
				indicator: "orange"
			});
			return false;
		}

		return true;
	}

	validate_partial_payment() {
		if (this.partial_payments.length === 0) {
			frappe.show_alert({
				message: __("Please record at least one partial payment"),
				indicator: "orange"
			});
			return false;
		}
		return true;
	}

	apply_split_payments_to_doc() {
		const doc = this.events.get_frm().doc;
		
		doc.payments.forEach(payment => {
			frappe.model.set_value(payment.doctype, payment.name, 'amount', 0);
		});

		const grouped_payments = {};
		this.split_payments.forEach(split_payment => {
			if (!grouped_payments[split_payment.mode]) {
				grouped_payments[split_payment.mode] = {
					total_amount: 0,
					details: []
				};
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
			const payment_record = doc.payments.find(p => 
				p.mode_of_payment.replace(/ +/g, "_").toLowerCase() === mode
			);
			
			if (payment_record) {
				frappe.model.set_value(payment_record.doctype, payment_record.name, 'amount', grouped_payments[mode].total_amount);
				
				const split_details = JSON.stringify(grouped_payments[mode].details);
				frappe.model.set_value(payment_record.doctype, payment_record.name, 'remarks', split_details);
			}
		});

		this.store_split_payment_summary(doc);
	}

	apply_partial_payments_to_doc() {
		const doc = this.events.get_frm().doc;
		
		doc.payments.forEach(payment => {
			frappe.model.set_value(payment.doctype, payment.name, 'amount', 0);
		});

		const grouped_payments = {};
		this.partial_payments.forEach(partial_payment => {
			if (!grouped_payments[partial_payment.mode]) {
				grouped_payments[partial_payment.mode] = {
					total_amount: 0,
					details: []
				};
			}
			grouped_payments[partial_payment.mode].total_amount += partial_payment.amount;
			grouped_payments[partial_payment.mode].details.push({
				amount: partial_payment.amount,
				reference_number: partial_payment.reference_number,
				notes: partial_payment.notes,
				payment_date: partial_payment.payment_date,
				recorded_by: partial_payment.recorded_by
			});
		});

		Object.keys(grouped_payments).forEach(mode => {
			const payment_record = doc.payments.find(p => 
				p.mode_of_payment.replace(/ +/g, "_").toLowerCase() === mode
			);
			
			if (payment_record) {
				frappe.model.set_value(payment_record.doctype, payment_record.name, 'amount', grouped_payments[mode].total_amount);
				
				const partial_details = JSON.stringify(grouped_payments[mode].details);
				frappe.model.set_value(payment_record.doctype, payment_record.name, 'remarks', partial_details);
			}
		});
	}

	store_split_payment_summary(doc) {
		const split_summary = this.split_payments.map(payment => ({
			method: payment.mode_of_payment,
			display_name: payment.display_name,
			amount: payment.amount,
			reference: payment.reference_number,
			notes: payment.notes
		}));

		const summary_text = split_summary.map(s => 
			`${s.display_name}: ${format_currency(s.amount, doc.currency)}${s.reference ? ` (Ref: ${s.reference})` : ''}${s.notes ? ` - ${s.notes}` : ''}`
		).join(' | ');

		const existing_remarks = doc.remarks || '';
		const split_remarks = `Split Payment: ${summary_text}`;
		frappe.model.set_value(doc.doctype, doc.name, 'remarks', 
			existing_remarks ? `${existing_remarks}\n${split_remarks}` : split_remarks);
	}

	save_as_partial_payment() {
		if (!this.validate_partial_payment()) {
			return;
		}

		const doc = this.events.get_frm().doc;
		
		const partial_payment_data = {
			invoice_name: doc.name,
			partial_payments: JSON.stringify(this.partial_payments)
		};

		frappe.call({
			method: 'posnext.posnext.page.posnext.point_of_sale.save_partial_payment_invoice',
			args: partial_payment_data,
			callback: (r) => {
				if (r.message && r.message.success) {
					frappe.show_alert({
						message: __("Partial payment saved successfully"),
						indicator: "green"
					});
					
					this.events.toggle_other_sections(false);
				} else {
					frappe.show_alert({
						message: r.message?.error || __("Failed to save partial payment"),
						indicator: "red"
					});
				}
			},
			error: (r) => {
				frappe.show_alert({
					message: __("Error saving partial payment"),
					indicator: "red"
				});
			}
		});
	}

	clear_split_payments() {
		this.split_payments = [];
		this.render_split_payments_list();
		this.update_split_summary();
	}

	clear_partial_payments() {
		this.partial_payments = [];
		this.render_partial_payments_list();
		this.update_partial_summary();
	}

	handle_regular_payment_selection(mode_clicked, mode) {
		const me = this;
		const scrollLeft = mode_clicked.offset().left - me.$payment_modes.offset().left + me.$payment_modes.scrollLeft();
		me.$payment_modes.animate({ scrollLeft });

		$(`.mode-of-payment-control`).css('display', 'none');
		$(`.cash-shortcuts`).css('display', 'none');
		me.$payment_modes.find(`.pay-amount`).css('display', 'inline');
		me.$payment_modes.find(`.loyalty-amount-name`).css('display', 'none');

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
			me.auto_set_remaining_amount();
		}
	}

	handle_split_payment_selection(mode_clicked, mode) {
		$('.mode-of-payment').removeClass('payment-mode-split-active');
		mode_clicked.addClass('payment-mode-split-active');
		
		$(`.mode-of-payment-control`).css('display', 'none');
		mode_clicked.find('.mode-of-payment-control').css('display', 'flex');
		
		this.selected_mode = this[`${mode}_control`];
		this.selected_mode && this.selected_mode.$input.get(0).focus();
	}

	handle_partial_payment_selection(mode_clicked, mode) {
		$('.mode-of-payment').removeClass('payment-mode-split-active');
		mode_clicked.addClass('payment-mode-split-active');
		
		$(`.mode-of-payment-control`).css('display', 'none');
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

				return (`
					<div class="payment-mode-wrapper">
						<div class="mode-of-payment" data-mode="${mode}" data-payment-type="${payment_type}">
							${p.mode_of_payment}
							<div class="${mode}-amount pay-amount">${amount}</div>
							<div class="${mode} mode-of-payment-control"></div>
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