/* eslint-disable no-unused-vars */
frappe.provide('posnext.PointOfSale');
posnext.PointOfSale.Payment = class {
	constructor({ events, wrapper }) {
		this.wrapper = wrapper;
		this.events = events;
		this.split_payments = []; // Store multiple payment methods
		this.is_split_mode = false; // Track if we're in split payment mode
		this.allow_overpayment = true; // Allow overpayment in split mode
		this.auto_set_amount = false; // Disable auto-setting amount to grand total
		
		// Enhanced payment persistence for POSNext edit order flow
		this.payment_backup_key = null; // Store backup key for this session
		this.original_payment_data = null; // Store original payment data

		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.initialize_numpad();
		this.bind_events();
		this.attach_shortcuts();
		
		// Initialize payment backup system for POSNext edit order flow
		this.initialize_payment_backup_system();
	}

	// Initialize payment backup system for handling POSNext edit order flow
	initialize_payment_backup_system() {
		const doc = this.events.get_frm().doc;
		if (doc && doc.name) {
			this.payment_backup_key = `pos_payments_backup_${doc.name}`;
			
			// Try to restore from backup first
			this.restore_payments_from_backup();
		}
	}

	// Backup payments to session storage for POSNext edit order persistence
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
			status: doc.status || 'Draft'
		};
		
		// Backup current payments from document
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
		
		// Store in memory (not sessionStorage due to Claude restrictions)
		if (!window.pos_payment_backups) {
			window.pos_payment_backups = {};
		}
		window.pos_payment_backups[this.payment_backup_key] = backup_data;
		
		console.log('💾 Backed up payments for:', doc.name, backup_data);
	}

	// Restore payments from backup
	restore_payments_from_backup() {
		if (!this.payment_backup_key) return false;
		
		// Check memory backup
		if (window.pos_payment_backups && window.pos_payment_backups[this.payment_backup_key]) {
			const backup_data = window.pos_payment_backups[this.payment_backup_key];
			const current_doc = this.events.get_frm().doc;
			
			console.log('🔄 Restoring payments from backup:', backup_data);
			
			let total_restored = 0;
			
			// Restore split payments
			if (backup_data.split_payments && backup_data.split_payments.length > 0) {
				this.split_payments = [...backup_data.split_payments];
				
				// Calculate total from split payments
				total_restored = this.split_payments.reduce((sum, payment) => sum + payment.amount, 0);
				
				console.log('✅ Restored split payments:', this.split_payments);
			}
			
			// Restore split mode state
			if (backup_data.is_split_mode) {
				this.is_split_mode = backup_data.is_split_mode;
				console.log('✅ Restored split mode state:', this.is_split_mode);
			}
			
			// Store original payment data for later use
			if (backup_data.payments && backup_data.payments.length > 0) {
				this.original_payment_data = backup_data.payments;
				
				// If no split payments but have original payments, calculate total from original
				if (total_restored === 0) {
					total_restored = backup_data.payments.reduce((sum, payment) => sum + payment.amount, 0);
				}
				
				console.log('✅ Stored original payment data:', this.original_payment_data);
			}
			
			// Apply payments to document if we have payment data
			if (total_restored > 0) {
				// Update document paid amount
				frappe.model.set_value(current_doc.doctype, current_doc.name, 'paid_amount', total_restored);
				
				// Calculate outstanding
				const grand_total = current_doc.grand_total || current_doc.rounded_total || 0;
				const outstanding = grand_total - total_restored;
				frappe.model.set_value(current_doc.doctype, current_doc.name, 'outstanding_amount', Math.max(0, outstanding));
				
				// Set status
				let status = 'Draft';
				if (total_restored >= grand_total) {
					status = 'Paid';
				} else if (total_restored > 0) {
					status = 'Partly Paid';
				}
				frappe.model.set_value(current_doc.doctype, current_doc.name, 'status', status);
				
				// Apply individual payment amounts to payment records
				if (backup_data.payments) {
					backup_data.payments.forEach(backup_payment => {
						const current_payment = current_doc.payments.find(p => 
							p.mode_of_payment === backup_payment.mode_of_payment
						);
						
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
				
				console.log(`💰 Applied backup totals - Paid: ${total_restored}, Outstanding: ${outstanding}, Status: ${status}`);
				
				// Force UI refresh
				setTimeout(() => {
					this.update_totals_section(current_doc);
					this.render_payment_mode_dom();
				}, 200);
			}
			
			// Show user notification
			if (this.split_payments.length > 0 || this.original_payment_data) {
				frappe.show_alert({
					message: __("Payment data restored from previous session (Total: {0})", [format_currency(total_restored, current_doc.currency)]),
					indicator: "green"
				});
				return true;
			}
		}
		
		return false;
	}

	// Clear payment backup when invoice is completed
	clear_payment_backup() {
		if (!this.payment_backup_key) return;
		
		if (window.pos_payment_backups && window.pos_payment_backups[this.payment_backup_key]) {
			delete window.pos_payment_backups[this.payment_backup_key];
			console.log('🗑️ Cleared payment backup for:', this.payment_backup_key);
		}
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
	}

	make_invoice_fields_control() {
		// Removed - additional information section no longer exists
		return;
	}

	initialize_numpad() {
		// Removed - numpad no longer exists
		this.numpad_value = '';
	}

	on_numpad_clicked($btn) {
		// Removed - numpad no longer exists
		return;
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

			// Clear payment backup when order is completed
			me.clear_payment_backup();
			
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

		// Add event listeners for document updates
		frappe.ui.form.on('POS Invoice', 'status', (frm) => {
			// Refresh payments display when status changes (like when partial payment is saved)
			if (this && this.refresh_payments_display) {
				setTimeout(() => {
					this.refresh_payments_display();
				}, 500); // Small delay to ensure document is fully updated
			}
		});

		// Also trigger refresh when the document is reloaded
		frappe.ui.form.on('POS Invoice', 'refresh', (frm) => {
			if (this && this.refresh_payments_display) {
				setTimeout(() => {
					this.refresh_payments_display();
				}, 1000); // Longer delay for document refresh
			}
		});
	}

	toggle_split_payment_mode(enable) {
		this.is_split_mode = enable;
		
		console.log(`Toggling split payment mode: ${enable}`);
		
		if (enable) {
			this.$split_container.show();
			
			// First render the split payment modes
			this.render_split_payment_modes();
			
			// Then load existing payments (with backup support)
			this.load_existing_payments();
			
			// If no payments were loaded but there are payments in the document, try to sync
			if (this.split_payments.length === 0) {
				this.sync_document_payments_to_split();
			}
			
			console.log(`Split mode enabled. Loaded ${this.split_payments.length} payments.`);
		} else {
			this.$split_container.hide();
			this.clear_split_payments();
			this.render_payment_mode_dom(); // Restore original payment modes
			console.log('Split mode disabled.');
		}
		
		// Backup the current state
		this.backup_payments_to_session();
	}

	// Enhanced debugging and payment detection for edited orders
	check_for_existing_payments() {
		const doc = this.events.get_frm().doc;
		
		console.log('=== EDIT ORDER FLOW DEBUGGING ===');
		console.log('Document details:', {
			name: doc.name,
			original_name: doc.__original_name || 'Not set',
			is_local: doc.__islocal,
			is_new: doc.name && doc.name.startsWith('new-'),
			docstatus: doc.docstatus,
			status: doc.status,
			creation: doc.creation,
			modified: doc.modified
		});
		
		// Check if this looks like an edited existing order (ERPNext Bug Fix)
		// ERPNext has a known issue where editing existing POS invoices clears payment data
		// We need to detect both 'new-' prefixed AND existing invoice names that have been edited
		const is_edited_order = (
			(doc.name.startsWith('new-') && (doc.creation || doc.modified || doc.status !== 'Draft')) ||
			(!doc.name.startsWith('new-') && doc.creation && doc.docstatus === 0 && !doc.__islocal)
		);
		
		if (is_edited_order) {
			console.log('🔍 This appears to be an EDITED existing order (possibly affected by ERPNext payment clearing bug)!');
			console.log('Looking for payment indicators...');
			
			// For edited orders, be more aggressive in looking for payment signs
			let has_payment_indicators = false;
			let reasons = [];
			
			// Check 1: Any payment amounts > 0
			if (doc.payments && Array.isArray(doc.payments)) {
				doc.payments.forEach(payment => {
					if (payment.amount && payment.amount > 0) {
						has_payment_indicators = true;
						reasons.push(`Payment: ${payment.mode_of_payment} = ${payment.amount}`);
					}
				});
			}
			
			// Check 2: Paid amount > 0
			if (doc.paid_amount && doc.paid_amount > 0) {
				has_payment_indicators = true;
				reasons.push(`Paid amount: ${doc.paid_amount}`);
			}
			
			// Check 3: Status indicates payment
			if (doc.status && ['Partly Paid', 'Paid'].includes(doc.status)) {
				has_payment_indicators = true;
				reasons.push(`Status: ${doc.status}`);
			}
			
			// Check 4: Outstanding amount calculation
			if (doc.outstanding_amount && doc.grand_total && doc.outstanding_amount < doc.grand_total) {
				has_payment_indicators = true;
				const paid = doc.grand_total - doc.outstanding_amount;
				reasons.push(`Outstanding suggests payment: ${paid}`);
			}
			
			// Check 5: Creation/modification date suggests it's not truly new
			if (doc.creation || doc.modified) {
				has_payment_indicators = true;
				reasons.push('Has creation/modified date');
			}
			
			// Check 6: ERPNext Bug Detection - existing invoice name with cleared payments
			if (!doc.name.startsWith('new-') && doc.creation && doc.docstatus === 0) {
				console.log('🐛 DETECTED: ERPNext payment clearing bug - existing invoice loaded for editing');
				has_payment_indicators = true;
				reasons.push('ERPNext payment clearing bug detected');
				
				// Try to fetch original payment data from server
				this.fetch_original_payment_data(doc.name);
			}
			
			console.log('Payment indicators found:', has_payment_indicators);
			console.log('Reasons:', reasons);
			
			if (has_payment_indicators && !this.is_split_mode) {
				console.log('🎯 Enabling split mode for edited order');
				this.$component.find('#split-payment-checkbox').prop('checked', true);
				this.toggle_split_payment_mode(true);
				
				frappe.show_alert({
					message: __("Split payment mode enabled for edited order: {0}", [reasons.join(', ')]),
					indicator: "blue"
				});
				return;
			}
		}
		
		// Continue with normal logic for truly new orders
		console.log('📝 Processing as normal order...');
		
		// Standard check for existing payments
		let has_existing_payments = false;
		let total_existing_amount = 0;
		
		// Check 1: payments array for amounts > 0
		if (doc.payments && Array.isArray(doc.payments)) {
			doc.payments.forEach(payment => {
				if (payment.amount && payment.amount > 0) {
					has_existing_payments = true;
					total_existing_amount += payment.amount;
					console.log(`Found payment: ${payment.mode_of_payment} = ${payment.amount}`);
				}
			});
		}
		
		// Check 2: paid_amount field (fallback check)
		if (!has_existing_payments && doc.paid_amount && doc.paid_amount > 0) {
			has_existing_payments = true;
			total_existing_amount = doc.paid_amount;
			console.log(`Found paid_amount: ${doc.paid_amount}`);
		}
		
		// Check 3: payment controls (last resort)
		if (!has_existing_payments && doc.payments) {
			doc.payments.forEach(payment => {
				const mode = payment.mode_of_payment.replace(/ +/g, "_").toLowerCase();
				const control = this[`${mode}_control`];
				if (control && control.get_value() > 0) {
					has_existing_payments = true;
					total_existing_amount += control.get_value();
					console.log(`Found control value: ${payment.mode_of_payment} = ${control.get_value()}`);
				}
			});
		}
		
		console.log(`Has existing payments: ${has_existing_payments}, Total: ${total_existing_amount}`);
		
		if (has_existing_payments && !this.is_split_mode) {
			// Automatically enable split payment mode
			this.$component.find('#split-payment-checkbox').prop('checked', true);
			this.toggle_split_payment_mode(true);
			
			frappe.show_alert({
				message: __("Split payment mode enabled automatically (Found payments: {0})", [format_currency(total_existing_amount, doc.currency)]),
				indicator: "blue"
			});
		}
	}

	// New method to fetch original payment data for invoices affected by ERPNext payment clearing bug
	fetch_original_payment_data(invoice_name) {
		console.log('🔄 Fetching original payment data for:', invoice_name);
		
		// Fetch the original document from server to get payment data
		frappe.db.get_doc('POS Invoice', invoice_name).then(original_doc => {
			console.log('📄 Original document fetched:', original_doc);
			
			if (original_doc && original_doc.payments) {
				let found_payments = false;
				let total_amount = 0;
				
				original_doc.payments.forEach(payment => {
					if (payment.amount && payment.amount > 0) {
						found_payments = true;
						total_amount += payment.amount;
						console.log(`💰 Found original payment: ${payment.mode_of_payment} = ${payment.amount}`);
					}
				});
				
				if (found_payments) {
					console.log('✅ Original payments detected - storing for restoration');
					// Store original payment data for later restoration
					this.original_payment_data = original_doc.payments;
					
					// Apply the payments to current document immediately
					this.apply_original_payments_to_document(original_doc);
					
					// Show user notification about detected payments
					frappe.show_alert({
						message: __("Original payments detected and restored! Total: {0}", [format_currency(total_amount, original_doc.currency)]),
						indicator: "green"
					});
					
					// Enable split mode and load original payments
					if (!this.is_split_mode) {
						this.$component.find('#split-payment-checkbox').prop('checked', true);
						this.toggle_split_payment_mode(true);
					}
				}
			}
		}).catch(error => {
			console.error('❌ Error fetching original payment data:', error);
		});
	}

	// Apply original payments to current document and update UI
	apply_original_payments_to_document(original_doc) {
		const current_doc = this.events.get_frm().doc;
		
		console.log('🔄 Applying original payments to current document...');
		
		if (!original_doc.payments || !current_doc.payments) {
			console.error('❌ Missing payments array in documents');
			return;
		}
		
		let total_paid = 0;
		
		// Apply each payment amount to corresponding payment method
		original_doc.payments.forEach(original_payment => {
			if (original_payment.amount && original_payment.amount > 0) {
				// Find matching payment method in current document
				const current_payment = current_doc.payments.find(p => 
					p.mode_of_payment === original_payment.mode_of_payment
				);
				
				if (current_payment) {
					// Set the amount
					frappe.model.set_value(current_payment.doctype, current_payment.name, 'amount', original_payment.amount);
					
					// Copy other fields
					if (original_payment.reference_no) {
						frappe.model.set_value(current_payment.doctype, current_payment.name, 'reference_no', original_payment.reference_no);
					}
					if (original_payment.remarks) {
						frappe.model.set_value(current_payment.doctype, current_payment.name, 'remarks', original_payment.remarks);
					}
					
					total_paid += original_payment.amount;
					console.log(`✅ Applied payment: ${original_payment.mode_of_payment} = ${original_payment.amount}`);
				}
			}
		});
		
		// Update document totals
		if (total_paid > 0) {
			frappe.model.set_value(current_doc.doctype, current_doc.name, 'paid_amount', total_paid);
			
			// Calculate outstanding amount
			const grand_total = current_doc.grand_total || current_doc.rounded_total || 0;
			const outstanding = grand_total - total_paid;
			frappe.model.set_value(current_doc.doctype, current_doc.name, 'outstanding_amount', Math.max(0, outstanding));
			
			// Set status based on payment
			let status = 'Draft';
			if (total_paid >= grand_total) {
				status = 'Paid';
			} else if (total_paid > 0) {
				status = 'Partly Paid';
			}
			frappe.model.set_value(current_doc.doctype, current_doc.name, 'status', status);
			
			console.log(`💰 Updated totals - Paid: ${total_paid}, Outstanding: ${outstanding}, Status: ${status}`);
			
			// Force UI refresh
			setTimeout(() => {
				this.update_totals_section(current_doc);
				this.render_payment_mode_dom();
			}, 200);
		}
	}

	// Enhanced load_existing_payments method for edited orders
	load_existing_payments() {
		const doc = this.events.get_frm().doc;
		
		console.log('=== LOADING PAYMENTS FOR EDITED ORDER ===');
		console.log('Document name:', doc.name);
		console.log('Is edited order:', doc.name.startsWith('new-') && (doc.creation || doc.status !== 'Draft'));
		console.log('Is ERPNext bug case:', !doc.name.startsWith('new-') && doc.creation && doc.docstatus === 0);
		
		// Clear existing split payments
		this.split_payments = [];
		
		// First try to load from original payment data if available (ERPNext bug fix)
		if (this.original_payment_data && Array.isArray(this.original_payment_data)) {
			console.log('🔄 Loading from original payment data (ERPNext bug fix)');
			
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
						notes: payment.remarks || 'Restored from original',
						is_existing: true
					};
					
					this.split_payments.push(existing_payment);
					console.log('✅ Restored original payment:', existing_payment);
				}
			});
		}
		
		// If we still have no payments, try loading from current document
		if (this.split_payments.length === 0) {
			if (!doc.payments || !Array.isArray(doc.payments)) {
				console.log('No payments array found');
				return;
			}
			
			// For edited orders, also check for historical payment data
			// that might be stored in remarks or other fields
			if (doc.name.startsWith('new-') && doc.remarks) {
				console.log('Checking remarks for split payment history:', doc.remarks);
				
				// Look for split payment summary in remarks
				if (doc.remarks.includes('Split Payment:')) {
					console.log('Found split payment history in remarks!');
					this.parse_split_payment_from_remarks(doc.remarks);
				}
			}
			
			// Process current payments array
			doc.payments.forEach((payment, index) => {
				console.log(`Processing payment ${index}:`, {
					mode: payment.mode_of_payment,
					amount: payment.amount,
					reference: payment.reference_no,
					remarks: payment.remarks
				});
				
				if (payment.amount && payment.amount > 0) {
					const mode = payment.mode_of_payment.replace(/ +/g, "_").toLowerCase();
					
					// Try to parse split details from payment remarks
					let split_details = [];
					if (payment.remarks) {
						try {
							split_details = JSON.parse(payment.remarks);
							console.log('Parsed split details:', split_details);
						} catch (e) {
							// Not JSON, treat as single payment
							split_details = [{
								amount: payment.amount,
								reference: payment.reference_no || '',
								notes: payment.remarks || '',
								display_name: payment.mode_of_payment
							}];
						}
					} else {
						// No remarks, single payment
						split_details = [{
							amount: payment.amount,
							reference: payment.reference_no || '',
							notes: '',
							display_name: payment.mode_of_payment
						}];
					}
					
					// Add each split detail as a separate entry
					split_details.forEach((detail, detail_index) => {
						if (detail.amount && detail.amount > 0) {
							const split_id = `${mode}_existing_${index}_${detail_index}`;
							const existing_payment = {
								id: split_id,
								mode: mode,
								mode_of_payment: payment.mode_of_payment,
								display_name: detail.display_name || payment.mode_of_payment,
								amount: detail.amount,
								type: payment.type || 'Cash',
								reference_number: detail.reference || payment.reference_no || '',
								notes: detail.notes || payment.remarks || '',
								is_existing: true
							};
							
							this.split_payments.push(existing_payment);
							console.log('Added existing payment:', existing_payment);
						}
					});
				}
			});
			
			// If still no payments found but document suggests payments exist
			if (this.split_payments.length === 0 && (doc.paid_amount > 0 || doc.status === 'Partly Paid')) {
				console.log('Creating fallback payment from document state...');
				this.create_fallback_payment_from_document(doc);
			}
		}
		
		// Renumber and update display
		this.renumber_same_payment_methods();
		this.render_split_payments_list();
		this.update_split_summary();
		this.show_payment_status();
		
		console.log('Final loaded split payments:', this.split_payments);
		
		// Show success message if payments were restored
		if (this.split_payments.length > 0 && this.original_payment_data) {
			frappe.show_alert({
				message: __("Payments restored successfully! ({0} payment(s) found)", [this.split_payments.length]),
				indicator: "green"
			});
		}
	}

	// Helper method to parse split payment data from remarks
	parse_split_payment_from_remarks(remarks) {
		try {
			// Extract split payment section from remarks
			const split_section = remarks.split('Split Payment:')[1];
			if (!split_section) return;
			
			// Parse payment entries (format: "Method: Amount (Ref: xxx) - notes | ...")
			const payment_entries = split_section.split(' | ');
			
			payment_entries.forEach((entry, index) => {
				const parts = entry.trim().match(/(.+?):\s*([^(]+)(?:\(Ref:\s*([^)]*)\))?(?:\s*-\s*(.+))?/);
				if (parts) {
					const [, display_name, amount_str, reference, notes] = parts;
					const amount = parseFloat(amount_str.replace(/[^0-9.-]/g, ''));
					
					if (amount > 0) {
						const mode = display_name.replace(/ +/g, "_").toLowerCase();
						const split_payment = {
							id: `remarks_${mode}_${index}`,
							mode: mode,
							mode_of_payment: display_name.replace(/ #\d+$/, ''), // Remove numbering
							display_name: display_name,
							amount: amount,
							type: 'Cash', // Default
							reference_number: reference || '',
							notes: notes || '',
							is_existing: true
						};
						
						this.split_payments.push(split_payment);
						console.log('Parsed from remarks:', split_payment);
					}
				}
			});
		} catch (error) {
			console.error('Error parsing split payment from remarks:', error);
		}
	}

	// Helper method to create fallback payment
	create_fallback_payment_from_document(doc) {
		if (doc.payments && doc.payments.length > 0) {
			// Use the first available payment method
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
			console.log('Created fallback payment:', fallback_payment);
		}
	}

	// New method to sync document payments to split display
	sync_document_payments_to_split() {
		const doc = this.events.get_frm().doc;
		
		console.log('Syncing document payments to split display...');
		
		// Clear current split payments
		this.split_payments = [];
		
		// Load from document payments
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
					console.log('Synced payment:', existing_payment);
				}
			});
		}
		
		// Renumber and update display
		this.renumber_same_payment_methods();
		this.render_split_payments_list();
		this.update_split_summary();
		this.show_payment_status();
		
		console.log('Sync complete. Split payments:', this.split_payments);
	}

	// Add this method to force refresh payments when document is updated
	refresh_payments_display() {
		const doc = this.events.get_frm().doc;
		
		console.log('Refreshing payments display...');
		console.log('Current document state:', {
			name: doc.name,
			status: doc.status,
			paid_amount: doc.paid_amount,
			payments: doc.payments,
			is_split_mode: this.is_split_mode
		});
		
		if (this.is_split_mode) {
			// Reload payments in split mode
			this.sync_document_payments_to_split();
		} else {
			// Check if we should enable split mode
			this.check_for_existing_payments();
		}
		
		// Always update totals
		this.update_totals_section(doc);
	}

	render_split_payment_modes() {
		const doc = this.events.get_frm().doc;
		const payments = doc.payments;

		// Render payment modes with "Add to Split" buttons - ensure ALL payment methods are shown
		this.$payment_modes.html(`${
			payments.map((p, i) => {
				const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
				const payment_type = p.type;
				const amount = p.amount > 0 ? format_currency(p.amount, doc.currency) : '';

				return (`
					<div class="payment-mode-wrapper">
						<div class="mode-of-payment" data-mode="${mode}" data-payment-type="${payment_type}">
							<div class="payment-mode-header">
								<span class="payment-mode-name">${p.mode_of_payment}</span>
								${amount ? `<span class="payment-mode-amount">${amount}</span>` : ''}
							</div>
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
			
			// Set current value if exists
			if (p.amount > 0) {
				this[`${mode}_control`].set_value(p.amount);
			}
		});

		// Add loyalty points payment mode if applicable
		this.render_loyalty_points_payment_mode();
		
		// Add some CSS to ensure proper display of payment modes in split mode
		if (!$('#split-payment-modes-styles').length) {
			$('head').append(`
				<style id="split-payment-modes-styles">
					.payment-mode-wrapper {
						margin-bottom: 10px;
						width: 100%;
					}
					
					.payment-mode-header {
						display: flex;
						justify-content: space-between;
						align-items: center;
						margin-bottom: 5px;
					}
					
					.payment-mode-name {
						font-weight: bold;
						color: #333;
					}
					
					.payment-mode-amount {
						color: #28a745;
						font-weight: bold;
						font-size: 14px;
					}
					
					.mode-of-payment {
						border: 1px solid #ddd;
						border-radius: 6px;
						padding: 10px;
						background-color: #f8f9fa;
						margin-bottom: 8px;
					}
					
					.mode-of-payment:hover {
						background-color: #e9ecef;
						border-color: #adb5bd;
					}
					
					.payment-mode-split-active {
						border-color: #007bff !important;
						background-color: #e7f3ff !important;
					}
					
					.add-to-split-btn {
						width: 100%;
						margin-top: 8px;
					}
					
					.mode-of-payment-control {
						margin: 8px 0;
					}
				</style>
			`);
		}
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
		
		// Backup after adding payment
		this.backup_payments_to_session();
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
		
		// Backup after removing payment
		this.backup_payments_to_session();
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
			
			// Backup after editing payment
			this.backup_payments_to_session();
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
			
			// Hide payment UI first
			this.toggle_component(false);
			
			// Navigate to recent orders using events (reverse of previous_screen)
			if (this.events.open_recent_orders) {
				this.events.open_recent_orders();
			} else {
				// Fallback message
				frappe.msgprint({
					title: __('Partial Payment Saved'),
					message: __('Partial payment saved successfully. Please check Recent Orders to view the saved order.'),
					indicator: 'green'
				});
			}
			
		}).catch((error) => {
			console.error('Error saving partial payment:', error);
			frappe.show_alert({
				message: __("Error saving partial payment"),
				indicator: "red"
			});
		});
	}

	open_recent_orders_view() {
		// Use the same pattern as previous_screen but in reverse
		// Instead of: this.recent_order_list.toggle_component(false) → show main screen
		// We do: hide main screen → this.recent_order_list.toggle_component(true)
		
		if (this.events.show_recent_orders) {
			// Custom event following the previous_screen pattern
			this.events.show_recent_orders();
		} else {
			// Fallback message
			frappe.msgprint({
				title: __('Partial Payment Saved'),
				message: __('Partial payment saved successfully. Please check Recent Orders to view the saved order.'),
				indicator: 'green'
			});
		}
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
			
			// Auto-setting is now disabled for both modes
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
		// Auto-setting is now disabled - this method is kept for compatibility
		// but no longer automatically sets amounts
		return;
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
		this.update_totals_section();
		
		// Enhanced payment section rendering for POSNext edit order flow
		setTimeout(() => {
			// First check if we have restored data
			if (this.split_payments.length > 0 || this.original_payment_data) {
				console.log('🔄 Processing restored payment data...');
				
				// If we have split payments already, enable split mode
				if (this.split_payments.length > 0 && !this.is_split_mode) {
					this.$component.find('#split-payment-checkbox').prop('checked', true);
					this.toggle_split_payment_mode(true);
					return; // Exit early since toggle_split_payment_mode will handle the rest
				}
				
				// If we have original payment data but no split payments, process it
				if (this.original_payment_data && this.split_payments.length === 0) {
					this.process_original_payment_data();
					return;
				}
			}
			
			// Standard payment detection if no restored data
			this.check_for_existing_payments();
			
			// Additional check: if we enabled split mode, make sure payments are loaded
			if (this.is_split_mode) {
				this.sync_document_payments_to_split();
			}
		}, 100);
		
		this.focus_on_default_mop();
	}

	// Process original payment data into split payments
	process_original_payment_data() {
		if (!this.original_payment_data || !Array.isArray(this.original_payment_data)) return;
		
		console.log('🔄 Processing original payment data into split payments...');
		
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
				console.log('✅ Created split payment from backup:', split_payment);
				
				// Apply to document payment as well
				const current_payment = current_doc.payments.find(p => 
					p.mode_of_payment === payment.mode_of_payment
				);
				
				if (current_payment) {
					frappe.model.set_value(current_payment.doctype, current_payment.name, 'amount', payment.amount);
					if (payment.reference_no) {
						frappe.model.set_value(current_payment.doctype, current_payment.name, 'reference_no', payment.reference_no);
					}
					if (payment.remarks) {
						frappe.model.set_value(current_payment.doctype, current_payment.name, 'remarks', payment.remarks);
					}
				}
			}
		});
		
		if (this.split_payments.length > 0) {
			// Update document totals
			frappe.model.set_value(current_doc.doctype, current_doc.name, 'paid_amount', total_paid);
			
			// Calculate outstanding amount
			const grand_total = current_doc.grand_total || current_doc.rounded_total || 0;
			const outstanding = grand_total - total_paid;
			frappe.model.set_value(current_doc.doctype, current_doc.name, 'outstanding_amount', Math.max(0, outstanding));
			
			// Set status based on payment
			let status = 'Draft';
			if (total_paid >= grand_total) {
				status = 'Paid';
			} else if (total_paid > 0) {
				status = 'Partly Paid';
			}
			frappe.model.set_value(current_doc.doctype, current_doc.name, 'status', status);
			
			console.log(`💰 Updated document totals - Paid: ${total_paid}, Outstanding: ${outstanding}, Status: ${status}`);
			
			// Enable split mode
			this.$component.find('#split-payment-checkbox').prop('checked', true);
			this.toggle_split_payment_mode(true);
			
			// Force UI refresh
			setTimeout(() => {
				this.update_totals_section(current_doc);
				this.render_payment_mode_dom();
			}, 300);
			
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
	}

	checkout() {
		this.events.toggle_other_sections(true);
		this.toggle_component(true);

		// Enhanced checkout for POSNext edit order flow
		this.handle_posnext_checkout_flow();
		
		this.render_payment_section();
		this.after_render();
	}

	// Handle POSNext specific checkout flow with payment persistence
	handle_posnext_checkout_flow() {
		const doc = this.events.get_frm().doc;
		
		console.log('🛒 POSNext Checkout Flow Started');
		console.log('Document:', doc.name, 'Status:', doc.status);
		
		// First, try to restore from backup
		const restored = this.restore_payments_from_backup();
		
		if (restored) {
			console.log('✅ Payment data restored from backup');
			
			// If we restored split mode, set the checkbox
			if (this.is_split_mode) {
				setTimeout(() => {
					this.$component.find('#split-payment-checkbox').prop('checked', true);
				}, 100);
			}
		} else {
			console.log('🔍 No backup found, proceeding with normal detection');
		}
		
		// Always backup current state for next time
		setTimeout(() => {
			this.backup_payments_to_session();
		}, 500);
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