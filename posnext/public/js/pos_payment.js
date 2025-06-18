/* eslint-disable no-unused-vars */
frappe.provide('posnext.PointOfSale');
posnext.PointOfSale.Payment = class {
	constructor({ events, wrapper }) {
		this.wrapper = wrapper;
		this.events = events;
		this.split_payments = []; // Store multiple payment methods
		this.is_split_mode = false; // Track if we're in split payment mode
		this.allow_overpayment = true; // Allow overpayment in split mode
		this.auto_set_amount = true; // Control auto-setting amount to grand total

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
				<div class="section-label payment-section">
					${__('Payment Method')}
					<div class="split-payment-toggle">
						<label class="switch">
							<input type="checkbox" id="split-payment-checkbox">
							<span class="slider round"></span>
						</label>
						<span class="split-label">${__('Split Payment')}</span>
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
		
		// Add CSS for split payment functionality
		if (!$('#split-payment-styles').length) {
			$('head').append(`
				<style id="split-payment-styles">
					.payment-section {
						display: flex;
						justify-content: space-between;
						align-items: center;
					}
					
					.split-payment-toggle {
						display: flex;
						align-items: center;
						gap: 10px;
						margin-left: auto;
					}
					
					.switch {
						position: relative;
						display: inline-block;
						width: 50px;
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
						transform: translateX(26px);
					}
					
					.split-payments-container {
						border: 1px solid #e0e0e0;
						border-radius: 8px;
						padding: 15px;
						margin: 10px 0;
						background-color: #f9f9f9;
					}
					
					.split-payment-item {
						display: flex;
						justify-content: space-between;
						align-items: flex-start;
						padding: 12px;
						border: 1px solid #e0e0e0;
						border-radius: 6px;
						margin-bottom: 8px;
						background-color: white;
					}
					
					.split-payment-info {
						flex: 1;
						display: flex;
						flex-direction: column;
					}
					
					.split-payment-method {
						font-weight: bold;
						color: #333;
						margin-bottom: 4px;
					}
					
					.split-payment-details {
						display: flex;
						gap: 8px;
						flex-wrap: wrap;
					}
					
					.split-reference-input, .split-notes-input {
						border: 1px solid #ddd;
						border-radius: 3px;
						padding: 2px 6px;
					}
					
					.split-payment-actions {
						display: flex;
						align-items: center;
						gap: 8px;
					}
					
					.split-payment-amount {
						color: #2196F3;
						font-weight: bold;
						font-size: 14px;
					}
					
					.split-payment-edit, .split-payment-remove {
						padding: 4px 8px;
						border: none;
						border-radius: 4px;
						cursor: pointer;
						font-size: 12px;
					}
					
					.split-payment-edit {
						background: #17a2b8;
						color: white;
					}
					
					.split-payment-remove {
						background: #dc3545;
						color: white;
					}
					
					.split-payment-summary {
						margin-top: 15px;
						padding-top: 15px;
						border-top: 2px solid #2196F3;
						font-weight: bold;
					}
					
					.split-total, .split-remaining, .split-change {
						display: flex;
						justify-content: space-between;
						margin: 5px 0;
					}
					
					.split-remaining-amount {
						color: #ff6b6b;
					}
					
					.split-total-amount {
						color: #4CAF50;
					}
					
					.split-change-amount {
						color: #2196F3;
					}
					
					.payment-mode-split-active {
						border: 2px solid #2196F3 !important;
						background-color: #e3f2fd !important;
					}
					
					.add-to-split-btn {
						margin-top: 5px;
						width: 100%;
					}
					
					.split-payment-actions {
						margin-top: 15px;
						text-align: center;
					}
					
					.save-partial-payment-btn {
						background-color: #ffc107;
						border-color: #ffc107;
						color: #212529;
					}
					
					.save-partial-payment-btn:hover {
						background-color: #e0a800;
						border-color: #d39e00;
					}
					
					.payment-status-partial {
						background-color: #fff3cd;
						border: 1px solid #ffeaa7;
						border-radius: 4px;
						padding: 8px;
						margin: 10px 0;
						color: #856404;
					}
				</style>
			`);
		}

		this.$component = this.wrapper.find('.payment-container');
		this.$payment_modes = this.$component.find('.payment-modes');
		this.$split_container = this.$component.find('.split-payments-container');
		this.$split_list = this.$component.find('.split-payments-list');
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

		// Split payment toggle
		this.$component.on('change', '#split-payment-checkbox', function() {
			me.toggle_split_payment_mode($(this).is(':checked'));
		});

		// Modified payment mode click handler for split payments
		this.$payment_modes.on('click', '.mode-of-payment', function(e) {
			const mode_clicked = $(this);
			if (!$(e.target).is(mode_clicked)) return;

			const mode = mode_clicked.attr('data-mode');
			
			if (me.is_split_mode) {
				me.handle_split_payment_selection(mode_clicked, mode);
			} else {
				me.handle_regular_payment_selection(mode_clicked, mode);
			}
		});

		// Add payment to split
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

		// Remove split payment
		this.$component.on('click', '.split-payment-remove', function() {
			const index = $(this).data('index');
			me.remove_split_payment(index);
		});

		// Edit split payment amount
		this.$component.on('click', '.split-payment-edit', function() {
			const index = $(this).data('index');
			me.edit_split_payment(index);
		});

		// Update reference number
		this.$component.on('blur', '.split-reference-input', function() {
			const index = $(this).data('index');
			const value = $(this).val();
			if (me.split_payments[index]) {
				me.split_payments[index].reference_number = value;
			}
		});

		// Update notes
		this.$component.on('blur', '.split-notes-input', function() {
			const index = $(this).data('index');
			const value = $(this).val();
			if (me.split_payments[index]) {
				me.split_payments[index].notes = value;
			}
		});

		// Save partial payment
		this.$component.on('click', '.save-partial-payment-btn', function() {
			if (me.split_payments.length === 0) {
				frappe.show_alert({
					message: __("Please add at least one payment method"),
					indicator: "orange"
				});
				return;
			}
			me.save_partial_payment();
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
			const items = doc.items;
			const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
			
			if (!items.length) {
				frappe.show_alert({ 
					message: __("You cannot submit empty order."), 
					indicator: "orange" 
				});
				frappe.utils.play_sound("error");
				return;
			}

			if (me.is_split_mode) {
				// In split mode, check if payment is complete
				const split_total = me.get_split_total();
				
				if (split_total < grand_total) {
					const remaining = grand_total - split_total;
					frappe.show_alert({
						message: __("Payment incomplete. Remaining amount: {0}. Use 'Save Partial Payment' or add more payments.", [format_currency(remaining, doc.currency)]),
						indicator: "orange"
					});
					frappe.utils.play_sound("error");
					return;
				}
				
				// Apply split payments and complete
				me.apply_split_payments_to_doc();
				
				// Calculate change if overpaid
				if (split_total > grand_total) {
					const change_amount = split_total - grand_total;
					frappe.model.set_value(doc.doctype, doc.name, 'change_amount', change_amount);
				}
			} else {
				// Regular mode - check paid amount
				const paid_amount = doc.paid_amount;
				
				if (paid_amount == 0) {
					frappe.show_alert({ 
						message: __("You cannot submit the order without payment."), 
						indicator: "orange" 
					});
					frappe.utils.play_sound("error");
					return;
				}
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

	toggle_split_payment_mode(enable) {
		this.is_split_mode = enable;
		this.auto_set_amount = !enable; // Disable auto-setting in split mode
		
		if (enable) {
			this.$split_container.show();
			this.load_existing_payments(); // Load existing payments into split mode
			this.render_split_payment_modes();
		} else {
			this.$split_container.hide();
			this.clear_split_payments();
			this.render_payment_mode_dom(); // Restore original payment modes
		}
	}

	load_existing_payments() {
		const doc = this.events.get_frm().doc;
		
		// Clear existing split payments
		this.split_payments = [];
		
		// Load existing payments that have amounts > 0
		doc.payments.forEach((payment, index) => {
			if (payment.amount > 0) {
				const mode = payment.mode_of_payment.replace(/ +/g, "_").toLowerCase();
				
				// Check if this payment has split details in remarks
				let split_details = [];
				try {
					if (payment.remarks) {
						split_details = JSON.parse(payment.remarks);
					}
				} catch (e) {
					// If parsing fails, treat as single payment
					split_details = [{
						amount: payment.amount,
						reference: '',
						notes: '',
						display_name: payment.mode_of_payment
					}];
				}
				
				// Add each split detail as separate payment
				if (split_details.length > 0) {
					split_details.forEach((detail, detailIndex) => {
						const split_id = `${mode}_existing_${index}_${detailIndex}`;
						this.split_payments.push({
							id: split_id,
							mode: mode,
							mode_of_payment: payment.mode_of_payment,
							display_name: detail.display_name || payment.mode_of_payment,
							amount: detail.amount,
							type: payment.type,
							reference_number: detail.reference || '',
							notes: detail.notes || '',
							is_existing: true // Mark as existing payment
						});
					});
				} else {
					// Single payment without split details
					const split_id = `${mode}_existing_${index}`;
					this.split_payments.push({
						id: split_id,
						mode: mode,
						mode_of_payment: payment.mode_of_payment,
						display_name: payment.mode_of_payment,
						amount: payment.amount,
						type: payment.type,
						reference_number: '',
						notes: '',
						is_existing: true
					});
				}
			}
		});
		
		// Renumber the loaded payments
		this.renumber_same_payment_methods();
		
		// Update the UI
		this.render_split_payments_list();
		this.update_split_summary();
		this.show_payment_status();
	}

	render_split_payment_modes() {
		const doc = this.events.get_frm().doc;
		const payments = doc.payments;

		// Render payment modes with "Add to Split" buttons
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

		// Create controls for each payment method
		payments.forEach(p => {
			const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
			
			this[`${mode}_control`] = frappe.ui.form.make_control({
				df: {
					label: p.mode_of_payment,
					fieldtype: 'Currency',
					placeholder: __('Enter {0} amount.', [p.mode_of_payment]),
					onchange: function() {
						// Update the display but don't modify the actual payment record yet
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

		// Generate unique ID for this split payment entry
		const split_id = `${mode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		// Add reference number for same payment method splits
		const same_method_count = this.split_payments.filter(p => p.mode === mode).length;
		const reference = same_method_count > 0 ? ` #${same_method_count + 1}` : '';

		// Add to split payments array
		this.split_payments.push({
			id: split_id,
			mode: mode,
			mode_of_payment: payment_method.mode_of_payment,
			display_name: payment_method.mode_of_payment + reference,
			amount: amount,
			type: payment_method.type,
			reference_number: '',
			notes: '',
			is_existing: false
		});

		// Clear the input
		if (this[`${mode}_control`]) {
			this[`${mode}_control`].set_value(0);
		}

		this.render_split_payments_list();
		this.update_split_summary();
	}

	remove_split_payment(index) {
		// Don't allow removing existing payments
		if (this.split_payments[index] && this.split_payments[index].is_existing) {
			frappe.show_alert({
				message: __("Cannot remove existing payment"),
				indicator: "orange"
			});
			return;
		}
		
		this.split_payments.splice(index, 1);
		this.renumber_same_payment_methods();
		this.render_split_payments_list();
		this.update_split_summary();
	}

	edit_split_payment(index) {
		const payment = this.split_payments[index];
		if (!payment) return;

		// Don't allow editing existing payments
		if (payment.is_existing) {
			frappe.show_alert({
				message: __("Cannot edit existing payment"),
				indicator: "orange"
			});
			return;
		}

		const doc = this.events.get_frm().doc;
		const current_amount = payment.amount;

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

			// Update the payment
			this.split_payments[index].amount = values.amount;
			this.split_payments[index].reference_number = values.reference_number || '';
			this.split_payments[index].notes = values.notes || '';

			this.render_split_payments_list();
			this.update_split_summary();
		}, __('Edit Split Payment'), __('Update'));
	}

	renumber_same_payment_methods() {
		// Group by payment method and renumber
		const method_counts = {};
		
		this.split_payments.forEach(payment => {
			if (!method_counts[payment.mode]) {
				method_counts[payment.mode] = 0;
			}
			method_counts[payment.mode]++;
			
			// Update display name with proper numbering
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
			const existing_badge = payment.is_existing ? 
				`<span class="badge badge-success" style="font-size: 10px; margin-left: 5px;">${__('Paid')}</span>` : '';
			
			return `
				<div class="split-payment-item" data-split-id="${payment.id}">
					<div class="split-payment-info">
						<span class="split-payment-method">
							${payment.display_name}${existing_badge}
						</span>
						<div class="split-payment-details">
							<input type="text" class="split-reference-input" 
								   placeholder="${__('Reference #')}" 
								   value="${payment.reference_number}"
								   data-index="${index}"
								   ${payment.is_existing ? 'readonly' : ''}
								   style="width: 100px; font-size: 11px; margin-top: 2px;">
							<input type="text" class="split-notes-input" 
								   placeholder="${__('Notes')}" 
								   value="${payment.notes}"
								   data-index="${index}"
								   ${payment.is_existing ? 'readonly' : ''}
								   style="width: 120px; font-size: 11px; margin-top: 2px;">
						</div>
					</div>
					<div class="split-payment-actions">
						<span class="split-payment-amount">${format_currency(payment.amount, currency)}</span>
						${!payment.is_existing ? `
							<button class="split-payment-edit btn btn-xs btn-secondary" data-index="${index}" title="${__('Edit Amount')}">
								<i class="fa fa-edit"></i>
							</button>
							<button class="split-payment-remove btn btn-xs btn-danger" data-index="${index}" title="${__('Remove')}">
								<i class="fa fa-trash"></i>
							</button>
						` : `
							<span class="text-muted" style="font-size: 11px;">${__('Existing Payment')}</span>
						`}
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
		
		// Show/hide change section
		if (change > 0) {
			this.$component.find('.split-change').show();
			this.$component.find('.split-change-amount').text(format_currency(change, currency));
		} else {
			this.$component.find('.split-change').hide();
		}

		// Update button states
		const has_payments = this.split_payments.length > 0;
		this.$component.find('.save-partial-payment-btn').prop('disabled', !has_payments);
	}

	get_split_total() {
		return this.split_payments.reduce((total, payment) => total + payment.amount, 0);
	}

	save_partial_payment() {
		const doc = this.events.get_frm().doc;
		
		if (this.split_payments.length === 0) {
			frappe.show_alert({
				message: __("Please add at least one payment method"),
				indicator: "orange"
			});
			return;
		}

		// Apply split payments to the document
		this.apply_split_payments_to_doc();
		
		// Set status to partly paid
		frappe.model.set_value(doc.doctype, doc.name, 'status', 'Partly Paid');
		
		// Save the document
		this.events.get_frm().save().then(() => {
			frappe.show_alert({
				message: __("Partial payment saved successfully"),
				indicator: "green"
			});
			
			// Show payment status
			this.show_payment_status();
		});
	}

	apply_split_payments_to_doc() {
		const doc = this.events.get_frm().doc;
		
		// Clear existing payment amounts
		doc.payments.forEach(payment => {
			frappe.model.set_value(payment.doctype, payment.name, 'amount', 0);
		});

		// Group split payments by payment method and sum amounts
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

		// Apply grouped amounts to payment records
		Object.keys(grouped_payments).forEach(mode => {
			const payment_record = doc.payments.find(p => 
				p.mode_of_payment.replace(/ +/g, "_").toLowerCase() === mode
			);
			
			if (payment_record) {
				frappe.model.set_value(payment_record.doctype, payment_record.name, 'amount', grouped_payments[mode].total_amount);
				
				// Store split details in the payment record for reference
				const split_details = JSON.stringify(grouped_payments[mode].details);
				frappe.model.set_value(payment_record.doctype, payment_record.name, 'remarks', split_details);
			}
		});

		// Store overall split payment info in the invoice
		this.store_split_payment_summary(doc);
	}

	store_split_payment_summary(doc) {
		// Create a summary of split payments for audit and display
		const split_summary = this.split_payments.map(payment => ({
			method: payment.mode_of_payment,
			display_name: payment.display_name,
			amount: payment.amount,
			reference: payment.reference_number,
			notes: payment.notes
		}));

		// Store in remarks
		const summary_text = split_summary.map(s => 
			`${s.display_name}: ${format_currency(s.amount, doc.currency)}${s.reference ? ` (Ref: ${s.reference})` : ''}${s.notes ? ` - ${s.notes}` : ''}`
		).join(' | ');

		// Add to remarks
		const existing_remarks = doc.remarks || '';
		const split_remarks = `Split Payment: ${summary_text}`;
		frappe.model.set_value(doc.doctype, doc.name, 'remarks', 
			existing_remarks ? `${existing_remarks}\n${split_remarks}` : split_remarks);
	}

	show_payment_status() {
		const doc = this.events.get_frm().doc;
		const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
		const paid_amount = doc.paid_amount;
		const remaining = grand_total - paid_amount;
		
		// Remove existing status display
		this.$component.find('.payment-status-partial').remove();
		
		if (remaining > 0) {
			const status_html = `
				<div class="payment-status-partial">
					<strong>${__('Status: Partly Paid')}</strong><br>
					${__('Paid')}: ${format_currency(paid_amount, doc.currency)}<br>
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
		
		// Remove payment status display
		this.$component.find('.payment-status-partial').remove();
	}

	// Handle regular (non-split) payment selection
	handle_regular_payment_selection(mode_clicked, mode) {
		const me = this;
		const scrollLeft = mode_clicked.offset().left - me.$payment_modes.offset().left + me.$payment_modes.scrollLeft();
		me.$payment_modes.animate({ scrollLeft });

		// Hide all control fields and shortcuts
		$(`.mode-of-payment-control`).css('display', 'none');
		$(`.cash-shortcuts`).css('display', 'none');
		me.$payment_modes.find(`.pay-amount`).css('display', 'inline');
		me.$payment_modes.find(`.loyalty-amount-name`).css('display', 'none');

		// Remove highlight from all mode-of-payments
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
			
			// Only auto-set remaining amount if not in split mode and auto_set_amount is enabled
			if (me.auto_set_amount) {
				me.auto_set_remaining_amount();
			}
		}
	}

	// Handle split payment mode selection
	handle_split_payment_selection(mode_clicked, mode) {
		// Simply highlight the selected payment method for adding to split
		$('.mode-of-payment').removeClass('payment-mode-split-active');
		mode_clicked.addClass('payment-mode-split-active');
		
		// Show the control for this payment method
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
		if (!current_value && remaining_amount > 0 && this.selected_mode && this.auto_set_amount) {
			this.selected_mode.set_value(remaining_amount);
		}
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
		
		// Don't auto-focus in split mode
		if (this.is_split_mode) return;
		
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