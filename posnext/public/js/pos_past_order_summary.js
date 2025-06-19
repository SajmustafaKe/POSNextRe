frappe.provide('posnext.PointOfSale');
posnext.PointOfSale.PastOrderSummary = class {
	constructor({ wrapper, pos_profile, events }) {
		this.wrapper = wrapper;
		this.pos_profile = pos_profile;
		this.events = events;
		
		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.init_email_print_dialog();
		this.bind_events();
		this.attach_shortcuts();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="past-order-summary">
				<div class="no-summary-placeholder">
					${__('Select an invoice to load summary data')}
				</div>
				<div class="invoice-summary-wrapper" >
					<div class="abs-container" >
						<div class="upper-section"></div>
						<div class="label">${__('Items')}</div>
						<div class="items-container summary-container"></div>
						<div class="label">${__('Totals')}</div>
						<div class="totals-container summary-container"></div>
						<div class="label">${__('Payments')}</div>
						<div class="payments-container summary-container"></div>
						<div class="summary-btns"></div>
					</div>
				</div>
			</section>`
		);

		this.$component = this.wrapper.find('.past-order-summary');
		this.$summary_wrapper = this.$component.find('.invoice-summary-wrapper');
		this.$summary_container = this.$component.find('.abs-container');
		this.$upper_section = this.$summary_container.find('.upper-section');
		this.$items_container = this.$summary_container.find('.items-container');
		this.$totals_container = this.$summary_container.find('.totals-container');
		this.$payment_container = this.$summary_container.find('.payments-container');
		this.$summary_btns = this.$summary_container.find('.summary-btns');
	}

	init_email_print_dialog() {
		const email_dialog = new frappe.ui.Dialog({
			title: 'Email Receipt',
			fields: [
				{fieldname: 'email_id', fieldtype: 'Data', options: 'Email', label: 'Email ID', reqd: 1},
				{fieldname:'content', fieldtype:'Small Text', label:'Message (if any)'}
			],
			primary_action: () => {
				this.send_email();
			},
			primary_action_label: __('Send'),
		});
		this.email_dialog = email_dialog;

		const print_dialog = new frappe.ui.Dialog({
			title: 'Print Receipt',
			fields: [
				{fieldname: 'print', fieldtype: 'Data', label: 'Print Preview'}
			],
			primary_action: () => {
				this.print_receipt();
			},
			primary_action_label: __('Print'),
		});
		this.print_dialog = print_dialog;

		const print_order_dialog = new frappe.ui.Dialog({
			title: 'Print-Order',
			fields: [
				{fieldname: 'print', fieldtype: 'Data', label: 'Print Preview'}
			],
			primary_action: () => {
				this.print_order();
			},
			primary_action_label: __('Print'),
		});
		this.print_order_dialog = print_order_dialog;
	}

	get_upper_section_html(doc) {
		const { status } = doc;
		let indicator_color = '';

		in_list(['Paid', 'Consolidated'], status) && (indicator_color = 'green');
		status === 'Draft' && (indicator_color = 'red');
		status === 'Return' && (indicator_color = 'grey');

		return `<div class="left-section">
					<div class="customer-name">${doc.customer}</div>
					<div class="customer-email">${this.customer_email}</div>
					<div class="cashier">${__('Sold by')}: ${doc.created_by_name}</div>
				</div>
				<div class="right-section">
					<div class="paid-amount">${format_currency(doc.paid_amount, doc.currency)}</div>
					<div class="invoice-name">${doc.name}</div>
					<span class="indicator-pill whitespace-nowrap ${indicator_color}"><span>${doc.status}</span></span>
				</div>`;
	}

	get_item_html(doc, item_data) {
		return `<div class="item-row-wrapper">
					<div class="item-name">${item_data.item_name}</div>
					<div class="item-qty">${item_data.qty || 0} ${item_data.uom}</div>
					<div class="item-rate-disc">${get_rate_discount_html()}</div>
				</div>`;

		function get_rate_discount_html() {
			if (item_data.rate && item_data.price_list_rate && item_data.rate !== item_data.price_list_rate) {
				return `<span class="item-disc">(${item_data.discount_percentage}% off)</span>
						<div class="item-rate">${format_currency(item_data.rate, doc.currency)}</div>`;
			} else {
				return `<div class="item-rate">${format_currency(item_data.price_list_rate || item_data.rate, doc.currency)}</div>`;
			}
		}
	}

	get_discount_html(doc) {
		if (doc.discount_amount) {
			return `<div class="summary-row-wrapper">
						<div>Discount (${doc.additional_discount_percentage} %)</div>
						<div>${format_currency(doc.discount_amount, doc.currency)}</div>
					</div>`;
		} else {
			return ``;
		}
	}

	get_net_total_html(doc) {
		return `<div class="summary-row-wrapper">
					<div>${__('Net Total')}</div>
					<div>${format_currency(doc.net_total, doc.currency)}</div>
				</div>`;
	}

	get_taxes_html(doc) {
		if (!doc.taxes.length) return '';

		let taxes_html = doc.taxes.map(t => {
			const description = /[0-9]+/.test(t.description) ? t.description : ((t.rate != 0) ? `${t.description} @ ${t.rate}%`: t.description);
			return `
				<div class="tax-row">
					<div class="tax-label">${description}</div>
					<div class="tax-value">${format_currency(t.tax_amount_after_discount_amount, doc.currency)}</div>
				</div>
			`;
		}).join('');

		return `<div class="taxes-wrapper">${taxes_html}</div>`;
	}

	get_grand_total_html(doc) {
		return `<div class="summary-row-wrapper grand-total">
					<div>${__('Grand Total')}</div>
					<div>${format_currency(doc.grand_total, doc.currency)}</div>
				</div>`;
	}

	get_payment_html(doc, payment) {
		return `<div class="summary-row-wrapper payments">
					<div>${__(payment.mode_of_payment)}</div>
					<div>${format_currency(payment.amount, doc.currency)}</div>
				</div>`;
	}

	bind_events() {
		this.$summary_container.on('click', '.return-btn', () => {
			this.events.process_return(this.doc.name);
			this.toggle_component(false);
			this.$component.find('.no-summary-placeholder').css('display', 'flex');
			this.$summary_wrapper.css('display', 'none');
		});

		this.$summary_container.on('click', '.edit-btn', () => {
			this.events.edit_order(this.doc.name);
			this.toggle_component(false);
			this.$component.find('.no-summary-placeholder').css('display', 'flex');
			this.$summary_wrapper.css('display', 'none');
		});

		this.$summary_container.on('click', '.delete-btn', () => {
			this.events.delete_order(this.doc.name);
			this.show_summary_placeholder();
		});

		this.$summary_container.on('click', '.send-btn', () => {
			var field_names = this.pos_profile.custom_whatsapp_field_names.map(x => this.doc[x.field_names.toString()]);
			var message = "https://wa.me/" +  this.doc.customer +"?text="
			message += formatString(this.pos_profile.custom_whatsapp_message, field_names);
			
			frappe.call({
				method: "posnext.posnext.page.posnext.point_of_sale.generate_pdf_and_save",
				args: {
					docname: this.doc.name,
					doctype: this.doc.doctype,
					print_format: this.pos_profile.print_format
				},
				freeze: true,
				freeze_message: "Creating file then send to whatsapp thru link....",
				callback: function (r) {
					message += "Please Find your invoice here \n "+window.origin+r.message.file_url
					window.open(message)
				}
			})
		});
		
		function formatString(str, args) {
			return str.replace(/{(\d+)}/g, function(match, number) {
				return typeof args[number] !== 'undefined'
					? args[number]
					: match;
			});
		}

		this.$summary_container.on('click', '.new-btn', () => {
			this.events.new_order();
			this.toggle_component(false);
			this.$component.find('.no-summary-placeholder').css('display', 'flex');
			this.$summary_wrapper.css('display', 'none');
		});

		this.$summary_container.on('click', '.email-btn', () => {
			this.email_dialog.fields_dict.email_id.set_value(this.customer_email);
			this.email_dialog.show();
		});

		this.$summary_container.on('click', '.print-order-btn', () => {
			this.print_order();
		});
        
        this.$summary_container.on('click', '.split-order-btn', () => {
			this.split_order();
		});

		this.$summary_container.on('click', '.print-btn', () => {
			this.print_receipt();
		});
	}

	print_receipt() {
		const frm = this.events.get_frm();
		const print_format = frm.pos_print_format;
		const doctype = this.doc.doctype;
		const docname = this.doc.name;
		const letterhead = this.doc.letter_head || __("No Letterhead");
		const lang_code = this.doc.language || frappe.boot.lang;
		
		frappe.db.get_value("Print Settings", "Print Settings", "enable_raw_printing")
			.then(({ message }) => {
				if (message && message.enable_raw_printing === "1") {
					this._print_via_qz(doctype, docname, print_format, letterhead, lang_code);
				} else {
					frappe.utils.print(
						doctype,
						docname,
						print_format,
						letterhead,
						lang_code
					);
				}
			});
	}

	split_order() {
		if (!this.doc || !this.doc.items || this.doc.items.length === 0) {
			frappe.show_alert({
				message: __("No items available to split."),
				indicator: 'red'
			});
			return;
		}

		if (this.doc.docstatus !== 0) {
			frappe.show_alert({
				message: __("Cannot split submitted invoices."),
				indicator: 'red'
			});
			return;
		}

		this.show_simple_split_dialog();
	}

	show_simple_split_dialog() {
		const items_data = this.doc.items.map((item, index) => ({
			idx: index + 1,
			item_code: item.item_code,
			item_name: item.item_name || item.item_code,
			available_qty: item.qty,
			split_qty: 0,
			rate: item.rate,
			uom: item.uom,
			invoice_number: 1,
			selected: false
		}));

		const dialog = new frappe.ui.Dialog({
			title: __('Split Order'),
			size: 'large',
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'instructions',
					options: `
						<div class="alert alert-info mb-3">
							<strong>How to split:</strong>
							<ol class="mb-0">
								<li>Check items you want to move to new invoices</li>
								<li>Enter quantities to split</li>
								<li>Choose which invoice each item goes to</li>
								<li>Click "Split Order" to complete</li>
							</ol>
						</div>
					`
				},
				{
					fieldtype: 'Int',
					fieldname: 'number_of_invoices',
					label: __('Number of New Invoices'),
					default: 1,
					reqd: 1,
					description: __('How many new invoices to create (1-5)'),
					change: () => {
						const count = dialog.get_value('number_of_invoices');
						if (count >= 1 && count <= 5) {
							this.update_split_table(dialog, items_data, count);
						}
					}
				},
				{
					fieldtype: 'HTML',
					fieldname: 'split_table',
					options: this.get_split_table_html(items_data, 1)
				}
			],
			primary_action: () => {
				this.execute_simple_split(dialog, items_data);
			},
			primary_action_label: __('Split Order'),
			secondary_action_label: __('Cancel')
		});

		this.split_dialog = dialog;
		this.split_items_data = items_data;

		dialog.show();

		setTimeout(() => {
			this.bind_split_events(dialog);
		}, 100);
	}

	get_split_table_html(items_data, invoice_count) {
		let invoice_options = '';
		for (let i = 1; i <= invoice_count; i++) {
			invoice_options += `<option value="${i}">Invoice ${i}</option>`;
		}

		let html = `
			<div class="split-table-container">
				<table class="table table-bordered">
					<thead class="thead-light">
						<tr>
							<th width="5%">
								<input type="checkbox" id="select-all" title="Select All">
							</th>
							<th width="25%">${__('Item')}</th>
							<th width="15%">${__('Available Qty')}</th>
							<th width="15%">${__('Split Qty')}</th>
							<th width="15%">${__('Rate')}</th>
							<th width="15%">${__('Amount')}</th>
							<th width="10%">${__('Invoice')}</th>
						</tr>
					</thead>
					<tbody>
		`;

		items_data.forEach((item, index) => {
			html += `
				<tr data-index="${index}">
					<td>
						<input type="checkbox" class="item-select" data-index="${index}">
					</td>
					<td>
						<div><strong>${item.item_code}</strong></div>
						<small class="text-muted">${item.item_name}</small>
					</td>
					<td>
						<span class="badge badge-secondary">${item.available_qty} ${item.uom}</span>
					</td>
					<td>
						<input type="number" 
							   class="form-control split-qty" 
							   data-index="${index}"
							   min="0" 
							   max="${item.available_qty}" 
							   step="0.01"
							   value="0">
					</td>
					<td>
						${format_currency(item.rate, this.doc.currency)}
					</td>
					<td>
						<span class="split-amount" data-index="${index}">
							${format_currency(0, this.doc.currency)}
						</span>
					</td>
					<td>
						<select class="form-control invoice-select" data-index="${index}">
							${invoice_options}
						</select>
					</td>
				</tr>
			`;
		});

		html += `
					</tbody>
				</table>
				<div class="row mt-3">
					<div class="col-md-6">
						<div class="alert alert-light">
							<strong>Selected Items:</strong> <span id="selected-count">0</span>
						</div>
					</div>
					<div class="col-md-6">
						<div class="alert alert-light">
							<strong>Total Split Amount:</strong> <span id="total-amount">${format_currency(0, this.doc.currency)}</span>
						</div>
					</div>
				</div>
			</div>
		`;

		return html;
	}

	update_split_table(dialog, items_data, invoice_count) {
		if (invoice_count < 1 || invoice_count > 5) {
			frappe.show_alert({
				message: __("Number of invoices must be between 1 and 5"),
				indicator: 'orange'
			});
			return;
		}

		const new_html = this.get_split_table_html(items_data, invoice_count);
		dialog.fields_dict.split_table.$wrapper.html(new_html);

		this.restore_selections(dialog, items_data);

		setTimeout(() => {
			this.bind_split_events(dialog);
		}, 100);
	}

	restore_selections(dialog, items_data) {
		const wrapper = dialog.$wrapper;
		
		items_data.forEach((item, index) => {
			const row = wrapper.find(`tr[data-index="${index}"]`);
			
			row.find('.item-select').prop('checked', item.selected);
			row.find('.split-qty').val(item.split_qty);
			row.find('.invoice-select').val(item.invoice_number);
			
			this.update_split_amount(index, item.split_qty, item.rate);
		});

		this.update_summary();
	}

	bind_split_events(dialog) {
		const wrapper = dialog.$wrapper;

		wrapper.find('#select-all').on('change', (e) => {
			const checked = $(e.target).is(':checked');
			wrapper.find('.item-select').prop('checked', checked);
			
			wrapper.find('.split-qty').each((i, input) => {
				const index = $(input).data('index');
				const max_qty = parseFloat($(input).attr('max'));
				const qty = checked ? max_qty : 0;
				
				$(input).val(qty);
				this.split_items_data[index].selected = checked;
				this.split_items_data[index].split_qty = qty;
				this.update_split_amount(index, qty, this.split_items_data[index].rate);
			});
			
			this.update_summary();
		});

		wrapper.find('.item-select').on('change', (e) => {
			const checkbox = $(e.target);
			const index = checkbox.data('index');
			const checked = checkbox.is(':checked');
			const qty_input = wrapper.find(`.split-qty[data-index="${index}"]`);
			
			this.split_items_data[index].selected = checked;
			
			if (checked) {
				const max_qty = parseFloat(qty_input.attr('max'));
				qty_input.val(max_qty);
				this.split_items_data[index].split_qty = max_qty;
				this.update_split_amount(index, max_qty, this.split_items_data[index].rate);
			} else {
				qty_input.val(0);
				this.split_items_data[index].split_qty = 0;
				this.update_split_amount(index, 0, this.split_items_data[index].rate);
			}
			
			this.update_summary();
		});

		wrapper.find('.split-qty').on('input change', (e) => {
			const input = $(e.target);
			const index = input.data('index');
			let qty = parseFloat(input.val()) || 0;
			const max_qty = parseFloat(input.attr('max'));
			
			if (qty > max_qty) {
				qty = max_qty;
				input.val(qty);
			}
			if (qty < 0) {
				qty = 0;
				input.val(qty);
			}
			
			const checkbox = wrapper.find(`.item-select[data-index="${index}"]`);
			checkbox.prop('checked', qty > 0);
			
			this.split_items_data[index].split_qty = qty;
			this.split_items_data[index].selected = qty > 0;
			
			this.update_split_amount(index, qty, this.split_items_data[index].rate);
			this.update_summary();
		});

		wrapper.find('.invoice-select').on('change', (e) => {
			const select = $(e.target);
			const index = select.data('index');
			const invoice_num = parseInt(select.val());
			
			this.split_items_data[index].invoice_number = invoice_num;
		});
	}

	update_split_amount(index, qty, rate) {
		const amount = qty * rate;
		this.split_dialog.$wrapper.find(`.split-amount[data-index="${index}"]`)
			.text(format_currency(amount, this.doc.currency));
	}

	update_summary() {
		const selected_items = this.split_items_data.filter(item => item.selected && item.split_qty > 0);
		const total_amount = selected_items.reduce((sum, item) => sum + (item.split_qty * item.rate), 0);
		
		this.split_dialog.$wrapper.find('#selected-count').text(selected_items.length);
		this.split_dialog.$wrapper.find('#total-amount').text(format_currency(total_amount, this.doc.currency));
	}

	execute_simple_split(dialog, items_data) {
		const selected_items = items_data.filter(item => item.selected && item.split_qty > 0);
		
		if (selected_items.length === 0) {
			frappe.show_alert({
				message: __("Please select at least one item to split."),
				indicator: 'orange'
			});
			return;
		}

		const invoice_groups = {};
		selected_items.forEach(item => {
			const invoice_key = item.invoice_number.toString();
			if (!invoice_groups[invoice_key]) {
				invoice_groups[invoice_key] = [];
			}
			invoice_groups[invoice_key].push({
				item_code: item.item_code,
				split_qty: item.split_qty
			});
		});

		const payment_distribution = this.calculate_payment_distribution(selected_items, invoice_groups);

		const invoice_count = Object.keys(invoice_groups).length;
		const total_items = selected_items.length;
		const total_amount = selected_items.reduce((sum, item) => sum + (item.split_qty * item.rate), 0);

		frappe.confirm(
			__(`This will create ${invoice_count} new invoice(s) with ${total_items} items (${format_currency(total_amount, this.doc.currency)}). Continue?`),
			() => {
				this.process_split_order(invoice_groups, payment_distribution);
				dialog.hide();
			}
		);
	}

	calculate_payment_distribution(selected_items, invoice_groups) {
		const total_split_amount = selected_items.reduce((sum, item) => sum + (item.split_qty * item.rate), 0);
		const original_total_paid = this.doc.paid_amount || 0;
		
		const payment_distribution = {};
		
		Object.keys(invoice_groups).forEach(invoice_key => {
			const group_items = invoice_groups[invoice_key];
			const group_amount = group_items.reduce((sum, group_item) => {
				const item_data = selected_items.find(item => item.item_code === group_item.item_code);
				return sum + (group_item.split_qty * item_data.rate);
			}, 0);
			
			const payment_ratio = group_amount / total_split_amount;
			const allocated_payment = original_total_paid * payment_ratio;
			
			payment_distribution[invoice_key] = {
				amount: group_amount,
				payment_amount: allocated_payment,
				payment_ratio: payment_ratio
			};
		});
		
		return payment_distribution;
	}

	process_split_order(invoice_groups, payment_distribution) {
		frappe.dom.freeze(__('Splitting order...'));
		
		frappe.call({
			method: "posnext.posnext.page.posnext.point_of_sale.split_pos_invoice",
			args: {
				original_invoice: this.doc.name,
				invoice_groups: invoice_groups,
				payment_distribution: payment_distribution,
				distribute_evenly: false
			},
			callback: (r) => {
				frappe.dom.unfreeze();
				
				if (!r.exc && r.message && r.message.success) {
					const result = r.message;
					
					this.show_split_success(result);

					setTimeout(() => {
						this.open_past_orders_list();
					}, 2000);
					
				} else {
					frappe.show_alert({
						message: __("Failed to split order: ") + (r.message || r.exc),
						indicator: 'red'
					});
				}
			},
			error: (r) => {
				frappe.dom.unfreeze();
				frappe.show_alert({
					message: __("Error occurred while splitting order."),
					indicator: 'red'
				});
			}
		});
	}

	open_past_orders_list() {
		if (this.events && this.events.show_recent_orders) {
			this.events.show_recent_orders();
            posnext.PointOfSale.PastOrderList.current_instance.refresh_list();
		}
		
		// Direct access to POSPastOrderList instance
		setTimeout(() => {
			if (posnext.PointOfSale.PastOrderList.current_instance && 
				posnext.PointOfSale.PastOrderList.refresh_list.current_instance) {
				posnext.PointOfSale.PastOrderList.current_instance.refresh_list();
			}
		}, 300);
		
		setTimeout(() => {
			this.toggle_component(true);
			this.$component.find('.no-summary-placeholder').css('display', 'flex');
			this.$summary_wrapper.css('display', 'none');
			
			const original_placeholder = this.$component.find('.no-summary-placeholder').html();
			this.$component.find('.no-summary-placeholder').html(
				`<div style="text-align: center;">
					<div style="margin-bottom: 10px;">
						<i class="fa fa-check-circle text-success" style="font-size: 24px;"></i>
					</div>
					<div style="font-weight: bold; color: #28a745;">Split completed successfully!</div>
					<div style="margin-top: 8px; color: #6c757d;">Select an invoice to view details</div>
				</div>`
			);
			
			setTimeout(() => {
				this.$component.find('.no-summary-placeholder').html(original_placeholder);
			}, 5000);
			
		}, 800);
	}

	show_split_success(result) {
		let message = `<div class="text-center">
			<div class="mb-3">
				<i class="fa fa-check-circle text-success" style="font-size: 48px;"></i>
			</div>
			<h4>Order Split Successfully!</h4>
			<p class="mb-3">Created ${result.new_invoices.length} new invoice(s):</p>
			<ul class="list-unstyled">`;

		result.new_invoices.forEach(invoice => {
			message += `<li><strong>${invoice.name}</strong> - ${format_currency(invoice.grand_total, this.doc.currency)}</li>`;
		});

		message += `</ul></div>`;

		const success_dialog = new frappe.ui.Dialog({
			title: __('Split Complete'),
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'success_message',
					options: message
				}
			],
			primary_action: () => {
				success_dialog.hide();
				this.open_past_orders_list();
			},
			primary_action_label: __('View Orders'),
			secondary_action: () => {
				success_dialog.hide();
			},
			secondary_action_label: __('Close')
		});

		success_dialog.show();
	}

	print_order() {
		const doctype = this.doc.doctype;
		const docname = this.doc.name;
		const print_format = "Captain Order";
		const letterhead = this.doc.letter_head || __("No Letterhead");
		const lang_code = this.doc.language || frappe.boot.lang;

		const _print_via_qz = (doctype, docname, print_format, letterhead, lang_code) => {
			const print_format_printer_map = _get_print_format_printer_map();
			const mapped_printer = _get_mapped_printer(print_format_printer_map, doctype, print_format);

			if (mapped_printer.length === 1) {
				_print_with_mapped_printer(doctype, docname, print_format, letterhead, lang_code, mapped_printer[0]);
			} else if (_is_raw_printing(print_format)) {
				frappe.show_alert({
					message: __("Printer mapping not set."),
					subtitle: __("Please set a printer mapping for this print format in the Printer Settings"),
					indicator: "warning"
				}, 14);
				_printer_setting_dialog(doctype, print_format);
			} else {
				_render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code);
			}
		};

		const _print_with_mapped_printer = (doctype, docname, print_format, letterhead, lang_code, printer_map) => {
			if (_is_raw_printing(print_format)) {
				_get_raw_commands(doctype, docname, print_format, lang_code, (out) => {
					if (out.message === "No new items to print") {
						frappe.show_alert({
							message: __("No new items to print for this captain order."),
							indicator: "info"
						}, 10);
						return;
					}
					frappe.ui.form.qz_connect()
						.then(() => {
							let config = qz.configs.create(printer_map.printer);
							let data = [out.raw_commands];
							return qz.print(config, data);
						})
						.then(frappe.ui.form.qz_success)
						.catch((err) => {
							frappe.ui.form.qz_fail(err);
							frappe.show_alert({
								message: __("Failed to print: " + (err.message || err)),
								indicator: 'red'
							});
							frappe.utils.play_sound("error");
						});
				});
			} else {
				frappe.show_alert({
					message: __('PDF printing via "Raw Print" is not supported.'),
					subtitle: __("Please remove the printer mapping in Printer Settings and try again."),
					indicator: "info"
				}, 14);
				_render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code);
			}
		};

		const _get_raw_commands = (doctype, docname, print_format, lang_code, callback) => {
			const items_to_print = this.doc.items.map(item => ({
				item_code: item.item_code,
				item_name: item.item_name || item.item_code,
				qty: item.qty,
				uom: item.uom,
				rate: item.rate,
				name: item.name
			}));
			
			frappe.call({
				method: "posnext.posnext.page.posnext.point_of_sale.print_captain_order",
				args: {
					invoice_name: docname,
					current_items: items_to_print,
					print_format: print_format,
					_lang: lang_code
				},
				callback: (r) => {
					if (!r.exc && r.message && r.message.success) {
						if (r.message.new_items_count === 0) {
							callback({ message: "No new items to print" });
							return;
						}
						
						if (!r.message.data || !r.message.data.items || r.message.data.items.length === 0) {
							callback({ message: "No new items to print" });
							return;
						}
						
						_render_print_format(r.message.data, print_format, (raw_commands) => {
							callback({ raw_commands: raw_commands, message: r.message.message });
						});
					} else {
						frappe.show_alert({
							message: __("Failed to generate print data: " + (r.message?.error || "Unknown error")),
							indicator: 'red'
						});
						frappe.utils.play_sound("error");
					}
				}
			});
		};

		const _render_print_format = (doc_data, print_format, callback) => {
			if (!doc_data || !doc_data.items || !doc_data.items.length) {
				callback("");
				return;
			}

			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Print Format",
					name: print_format
				},
				callback: (r) => {
					if (!r.exc && r.message) {
						const print_format_doc = r.message;
						if (print_format_doc.raw_printing !== 1) {
							frappe.show_alert({
								message: __("Print format is not set for raw printing."),
								indicator: 'red'
							});
							frappe.utils.play_sound("error");
							return;
						}

						const template = print_format_doc.raw_commands || '';
						if (!template) {
							frappe.show_alert({
								message: __("No raw commands defined in the print format."),
								indicator: 'red'
							});
							frappe.utils.play_sound("error");
							return;
						}

						try {
							const context = { doc: doc_data };
							const raw_commands = frappe.render_template(template, context);
							callback(raw_commands);
						} catch (error) {
							frappe.show_alert({
								message: __("Error rendering print format: " + (error.message || error)),
								indicator: 'red'
							});
							frappe.utils.play_sound("error");
							callback("");
						}
					} else {
						frappe.show_alert({
							message: __("Failed to fetch print format."),
							indicator: 'red'
						});
						frappe.utils.play_sound("error");
						callback("");
					}
				}
			});
		};

		const _is_raw_printing = (format) => {
			let print_format = {};
			if (locals["Print Format"] && locals["Print Format"][format]) {
				print_format = locals["Print Format"][format];
			}
			return print_format.raw_printing === 1;
		};

		const _get_print_format_printer_map = () => {
			try {
				return JSON.parse(localStorage.print_format_printer_map || "{}");
			} catch (e) {
				return {};
			}
		};

		const _get_mapped_printer = (print_format_printer_map, doctype, print_format) => {
			if (print_format_printer_map[doctype]) {
				return print_format_printer_map[doctype].filter(
					(printer_map) => printer_map.print_format === print_format
				);
			}
			return [];
		};

		const _render_pdf_or_regular_print = (doctype, docname, print_format, letterhead, lang_code) => {
			frappe.utils.print(
				doctype,
				docname,
				print_format,
				letterhead,
				lang_code
			);
		};

		const _printer_setting_dialog = (doctype, current_print_format) => {
			let print_format_printer_map = _get_print_format_printer_map();
			let data = print_format_printer_map[doctype] || [];

			frappe.ui.form.qz_get_printer_list().then((printer_list) => {
				if (!(printer_list && printer_list.length)) {
					frappe.throw(__("No Printer is Available."));
					return;
				}

				const dialog = new frappe.ui.Dialog({
					title: __("Printer Settings"),
					fields: [
						{ fieldtype: "Section Break" },
						{
							fieldname: "printer_mapping",
							fieldtype: "Table",
							label: __("Printer Mapping"),
							in_place_edit: true,
							data: data,
							get_data: () => data,
							fields: [
								{
									fieldtype: "Select",
									fieldname: "print_format",
									default: 0,
									options: frappe.meta.get_print_formats(doctype),
									read_only: 0,
									in_list_view: 1,
									label: __("Print Format")
								},
								{
									fieldtype: "Select",
									fieldname: "printer",
									default: 0,
									options: printer_list,
									read_only: 0,
									in_list_view: 1,
									label: __("Printer")
								}
							]
						}
					],
					primary_action: () => {
						let printer_mapping = dialog.get_values()["printer_mapping"];
						if (printer_mapping && printer_mapping.length) {
							let print_format_list = printer_mapping.map((a) => a.print_format);
							let has_duplicate = print_format_list.some(
								(item, idx) => print_format_list.indexOf(item) != idx
							);
							if (has_duplicate) {
								frappe.throw(__("Cannot have multiple printers mapped to a single print format."));
								return;
							}
						} else {
							printer_mapping = [];
						}

						let saved_print_format_printer_map = _get_print_format_printer_map();
						saved_print_format_printer_map[doctype] = printer_mapping;
						localStorage.print_format_printer_map = JSON.stringify(saved_print_format_printer_map);

						dialog.hide();

						_print_via_qz(doctype, docname, current_print_format, letterhead, lang_code);
					},
					primary_action_label: __("Save")
				});

				dialog.show();
			});
		};

		if (!this.doc.items.length) {
			frappe.show_alert({
				message: __("No items in the invoice to print."),
				indicator: 'red'
			});
			return frappe.utils.play_sound("error");
		}

		frappe.dom.freeze();
		frappe.db.get_value("Print Settings", "Print Settings", "enable_raw_printing")
			.then(({ message }) => {
				frappe.dom.unfreeze();
				if (message && message.enable_raw_printing === "1") {
					_print_via_qz(doctype, docname, print_format, letterhead, lang_code);
				} else {
					_render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code);
				}
			})
			.catch(() => {
				frappe.dom.unfreeze();
				frappe.show_alert({
					message: __("Failed to check Print Settings."),
					indicator: 'red'
				});
				frappe.utils.play_sound("error");
			});
	}

	_print_via_qz(doctype, docname, print_format, letterhead, lang_code) {
		const print_format_printer_map = this._get_print_format_printer_map();
		const mapped_printer = this._get_mapped_printer(print_format_printer_map, doctype, print_format);
		
		if (mapped_printer.length === 1) {
			this._print_with_mapped_printer(doctype, docname, print_format, letterhead, lang_code, mapped_printer[0]);
		} else if (this._is_raw_printing(print_format)) {
			frappe.show_alert({
				message: __("Printer mapping not set."),
				subtitle: __("Please set a printer mapping for this print format in the Printer Settings"),
				indicator: "warning"
			}, 14);
			this._printer_setting_dialog(doctype, print_format);
		} else {
			this._render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code);
		}
	}

	_print_with_mapped_printer(doctype, docname, print_format, letterhead, lang_code, printer_map) {
		if (this._is_raw_printing(print_format)) {
			this._get_raw_commands(doctype, docname, print_format, lang_code, (out) => {
				frappe.ui.form.qz_connect()
					.then(() => {
						let config = qz.configs.create(printer_map.printer);
						let data = [out.raw_commands];
						return qz.print(config, data);
					})
					.then(frappe.ui.form.qz_success)
					.catch((err) => {
						frappe.ui.form.qz_fail(err);
					});
			});
		} else {
			frappe.show_alert({
				message: __('PDF printing via "Raw Print" is not supported.'),
				subtitle: __("Please remove the printer mapping in Printer Settings and try again."),
				indicator: "info"
			}, 14);
			this._render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code);
		}
	}

	_get_raw_commands(doctype, docname, print_format, lang_code, callback) {
		frappe.call({
			method: "frappe.www.printview.get_rendered_raw_commands",
			args: {
				doc: frappe.get_doc(doctype, docname),
				print_format: print_format,
				_lang: lang_code
			},
			callback: (r) => {
				if (!r.exc) {
					callback(r.message);
				}
			}
		});
	}

	_is_raw_printing(format) {
		let print_format = {};
		if (locals["Print Format"] && locals["Print Format"][format]) {
			print_format = locals["Print Format"][format];
		}
		return print_format.raw_printing === 1;
	}

	_get_print_format_printer_map() {
		try {
			return JSON.parse(localStorage.print_format_printer_map || "{}");
		} catch (e) {
			return {};
		}
	}

	_get_mapped_printer(print_format_printer_map, doctype, print_format) {
		if (print_format_printer_map[doctype]) {
			return print_format_printer_map[doctype].filter(
				(printer_map) => printer_map.print_format === print_format
			);
		}
		return [];
	}

	_render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code) {
		frappe.utils.print(
			doctype,
			docname,
			print_format,
			letterhead,
			lang_code
		);
	}

	_printer_setting_dialog(doctype, current_print_format) {
		let print_format_printer_map = this._get_print_format_printer_map();
		let data = print_format_printer_map[doctype] || [];
		
		frappe.ui.form.qz_get_printer_list().then((printer_list) => {
			if (!(printer_list && printer_list.length)) {
				frappe.throw(__("No Printer is Available."));
				return;
			}
			
			const dialog = new frappe.ui.Dialog({
				title: __("Printer Settings"),
				fields: [
					{
						fieldtype: "Section Break"
					},
					{
						fieldname: "printer_mapping",
						fieldtype: "Table",
						label: __("Printer Mapping"),
						in_place_edit: true,
						data: data,
						get_data: () => {
							return data;
						},
						fields: [
							{
								fieldtype: "Select",
								fieldname: "print_format",
								default: 0,
								options: frappe.meta.get_print_formats(doctype),
								read_only: 0,
								in_list_view: 1,
								label: __("Print Format")
							},
							{
								fieldtype: "Select",
								fieldname: "printer",
								default: 0,
								options: printer_list,
								read_only: 0,
								in_list_view: 1,
								label: __("Printer")
							}
						]
					}
				],
				primary_action: () => {
					let printer_mapping = dialog.get_values()["printer_mapping"];
					if (printer_mapping && printer_mapping.length) {
						let print_format_list = printer_mapping.map((a) => a.print_format);
						let has_duplicate = print_format_list.some(
							(item, idx) => print_format_list.indexOf(item) != idx
						);
						if (has_duplicate) {
							frappe.throw(__("Cannot have multiple printers mapped to a single print format."));
							return;
						}
					} else {
						printer_mapping = [];
					}
					
					let saved_print_format_printer_map = this._get_print_format_printer_map();
					saved_print_format_printer_map[doctype] = printer_mapping;
					localStorage.print_format_printer_map = JSON.stringify(saved_print_format_printer_map);
					
					dialog.hide();
					
					this._print_via_qz(doctype, this.doc.name, current_print_format, this.doc.letter_head, this.doc.language || frappe.boot.lang);
				},
				primary_action_label: __("Save")
			});
			
			dialog.show();
		});
	}

	attach_shortcuts() {
		const ctrl_label = frappe.utils.is_mac() ? '⌘' : 'Ctrl';
		this.$summary_container.find('.print-btn').attr("title", `${ctrl_label}+P`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+p",
			action: () => this.$summary_container.find('.print-btn').click(),
			condition: () => this.$component.is(':visible') && this.$summary_container.find('.print-btn').is(":visible"),
			description: __("Print Receipt"),
			page: cur_page.page.page
		});
		this.$summary_container.find('.print-order-btn').attr("title", `${ctrl_label}+O`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+o",
			action: () => this.$summary_container.find('.print-order-btn').click(),
			condition: () => this.$component.is(':visible') && this.$summary_container.find('.print-order-btn').is(":visible"),
			description: __("Print-Order"),
			page: cur_page.page.page
		});
		this.$summary_container.find('.new-btn').attr("title", `${ctrl_label}+Enter`);
		frappe.ui.keys.on("ctrl+enter", () => {
			const summary_is_visible = this.$component.is(":visible");
			if (summary_is_visible && this.$summary_container.find('.new-btn').is(":visible")) {
				this.$summary_container.find('.new-btn').click();
			}
		});
		this.$summary_container.find('.edit-btn').attr("title", `${ctrl_label}+E`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+e",
			action: () => this.$summary_container.find('.edit-btn').click(),
			condition: () => this.$component.is(':visible') && this.$summary_container.find('.edit-btn').is(":visible"),
			description: __("Edit Receipt"),
			page: cur_page.page.page
		});
	}

	send_email() {
		const frm = this.events.get_frm();
		const recipients = this.email_dialog.get_values().email_id;
		const content = this.email_dialog.get_values().content;
		const doc = this.doc || frm.doc;
		const print_format = frm.pos_print_format;

		frappe.call({
			method: "frappe.core.doctype.communication.email.make",
			args: {
				recipients: recipients,
				subject: __(frm.meta.name) + ': ' + doc.name,
				content: content ? content : __(frm.meta.name) + ': ' + doc.name,
				doctype: doc.doctype,
				name: doc.name,
				send_email: 1,
				print_format,
				sender_full_name: frappe.user.full_name(),
				_lang: doc.language
			},
			callback: r => {
				if (!r.exc) {
					frappe.utils.play_sound("email");
					if (r.message["emails_not_sent_to"]) {
						frappe.msgprint(__(
							"Email not sent to {0} (unsubscribed / disabled)",
							[ frappe.utils.escape_html(r.message["emails_not_sent_to"]) ]
						));
					} else {
						frappe.show_alert({
							message: __('Email sent successfully.'),
							indicator: 'green'
						});
					}
					this.email_dialog.hide();
				} else {
					frappe.msgprint(__("There were errors while sending email. Please try again."));
				}
			}
		});
	}

	add_summary_btns(map) {
		this.$summary_btns.html('');
		map.forEach(m => {
			if (m.condition) {
				m.visible_btns.forEach(b => {
					const class_name = b.split(' ')[0].toLowerCase();
					const btn = __(b);
					this.$summary_btns.append(
						`<div class="summary-btn btn btn-default ${class_name}-btn">${btn}</div>`
					);
				});
			}
		});
		this.$summary_btns.children().last().removeClass('mr-4');
	}

	toggle_summary_placeholder(show) {
		if (show) {
			this.$summary_wrapper.css('display', 'none');
			this.$component.find('.no-summary-placeholder').css('display', 'flex');
		} else {
			this.$summary_wrapper.css('display', 'flex');
			this.$component.find('.no-summary-placeholder').css('display', 'none');
		}
	}

	get_condition_btn_map(after_submission) {
		if (after_submission )
			return [{ condition: true, visible_btns: ['Print Receipt', 'New Order'] }];

		const hasWaiterRole = frappe.user_roles.includes('Waiter');
		
		const draftButtons = hasWaiterRole 
			? ['Print Receipt','Edit Order','Print-Order'] 
			: ['Print Receipt','Edit Order','Print-Order','Split-Order'];

		const submitButtons = hasWaiterRole
			? ['Print Receipt'] 
			: ['Print Receipt', 'Return'];

		return [
			{ condition: this.doc.docstatus === 0, visible_btns: draftButtons },
			{ condition: !this.doc.is_return && this.doc.docstatus === 1, visible_btns: submitButtons},
			{ condition: this.doc.is_return && this.doc.docstatus === 1, visible_btns: ['Print Receipt']}
		];
	}

	load_summary_of(doc, after_submission=false) {
		after_submission ?
			this.$component.css('grid-column', 'span 10 / span 10') :
			this.$component.css('grid-column', 'span 6 / span 6');

		this.toggle_summary_placeholder(false);

		this.doc = doc;

		this.attach_document_info(doc);

		this.attach_items_info(doc);

		this.attach_totals_info(doc);

		this.attach_payments_info(doc);

		const condition_btns_map = this.get_condition_btn_map(after_submission);

		this.add_summary_btns(condition_btns_map);
		this.$summary_wrapper.css("width",after_submission ? "35%" : "60%")

		if (after_submission && this.print_receipt_on_order_complete) {
			this.print_receipt();
		}
	}

	attach_document_info(doc) {
		frappe.db.get_value('Customer', this.doc.customer, 'email_id').then(({ message }) => {
			this.customer_email = message.email_id || '';
			const upper_section_dom = this.get_upper_section_html(doc);
			this.$upper_section.html(upper_section_dom);
		});
	}

	attach_items_info(doc) {
		this.$items_container.html('');
		doc.items.forEach(item => {
			const item_dom = this.get_item_html(doc, item);
			this.$items_container.append(item_dom);
			this.set_dynamic_rate_header_width();
		});
	}

	set_dynamic_rate_header_width() {
		const rate_cols = Array.from(this.$items_container.find(".item-rate-disc"));
		this.$items_container.find(".item-rate-disc").css("width", "");
		let max_width = rate_cols.reduce((max_width, elm) => {
			if ($(elm).width() > max_width)
				max_width = $(elm).width();
			return max_width;
		}, 0);

		max_width += 1;
		if (max_width == 1) max_width = "";

		this.$items_container.find(".item-rate-disc").css("width", max_width);
	}

	attach_payments_info(doc) {
		this.$payment_container.html('');
		doc.payments.forEach(p => {
			if (p.amount) {
				const payment_dom = this.get_payment_html(doc, p);
				this.$payment_container.append(payment_dom);
			}
		});
		if (doc.redeem_loyalty_points && doc.loyalty_amount) {
			const payment_dom = this.get_payment_html(doc, {
				mode_of_payment: 'Loyalty Points',
				amount: doc.loyalty_amount,
			});
			this.$payment_container.append(payment_dom);
		}
	}

	attach_totals_info(doc) {
		this.$totals_container.html('');

		const net_total_dom = this.get_net_total_html(doc);
		const taxes_dom = this.get_taxes_html(doc);
		const discount_dom = this.get_discount_html(doc);
		const grand_total_dom = this.get_grand_total_html(doc);
		this.$totals_container.append(net_total_dom);
		this.$totals_container.append(taxes_dom);
		this.$totals_container.append(discount_dom);
		this.$totals_container.append(grand_total_dom);
	}

	toggle_component(show) {
		show ? this.$component.css('display', 'flex') : this.$component.css('display', 'none');
	}

	show_summary_placeholder() {
		this.toggle_summary_placeholder(true);
	}
};