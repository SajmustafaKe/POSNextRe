frappe.provide('posnext.PointOfSale');
posnext.PointOfSale.PastOrderSummary = class {
	constructor({ wrapper, pos_profile,events }) {
		this.wrapper = wrapper;
		this.pos_profile = pos_profile;
		this.events = events;
		//this.print_receipt_on_order_complete = settings.print_receipt_on_order_complete;
		
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
			// if tax rate is 0, don't print it.
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
			// this.events.delete_order(this.doc.name);
			// this.show_summary_placeholder();
		console.log(this.pos_profile)
		var field_names = this.pos_profile.custom_whatsapp_field_names.map(x => this.doc[x.field_names.toString()]);
			console.log(field_names)
			console.log(field_names.join(","))
			var message = "https://wa.me/" +  this.doc.customer +"?text="
			message += formatString(this.pos_profile.custom_whatsapp_message, field_names);
			console.log(message)
			// message += "Hello, here is the file you requested."
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
			// this.toggle_component(false);
			// this.$component.find('.no-summary-placeholder').removeClass('d-none');
			// this.$summary_wrapper.addClass('d-none');
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
    
    // Check if QZ printing is enabled in Print Settings
    frappe.db.get_value("Print Settings", "Print Settings", "enable_raw_printing")
        .then(({ message }) => {
            if (message && message.enable_raw_printing === "1") {
                // Use QZ Tray for direct printing
                this._print_via_qz(doctype, docname, print_format, letterhead, lang_code);
            } else {
                // Fallback to regular print dialog
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

// Add this method to replace the empty split_order() method in your class

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

    this.show_split_dialog();
}

show_split_dialog() {
    // Prepare items data for the dialog
    const items_data = this.doc.items.map((item, index) => ({
        idx: index + 1,
        item_code: item.item_code,
        item_name: item.item_name || item.item_code,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount,
        uom: item.uom,
        original_qty: item.qty,
        remaining_qty: item.qty,
        split_qty: 0,
        item_row_name: item.name,
        selected: false
    }));

    // Create the split dialog
    const split_dialog = new frappe.ui.Dialog({
        title: __('Split Order - Select Items'),
        size: 'large',
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'instructions',
                options: `
                    <div class="alert alert-info">
                        <strong>Instructions:</strong>
                        <ul>
                            <li>Select items you want to move to new invoices</li>
                            <li>Enter the quantity to split for each item</li>
                            <li>You can create multiple new invoices by grouping items</li>
                            <li>Remaining quantities will stay in the original invoice</li>
                        </ul>
                    </div>
                `
            },
            {
                fieldtype: 'Section Break'
            },
            {
                fieldtype: 'HTML',
                fieldname: 'split_items_html',
                options: this.get_split_items_html(items_data)
            },
            {
                fieldtype: 'Section Break'
            },
            {
                fieldtype: 'Data',
                fieldname: 'new_invoice_count',
                label: __('Number of New Invoices'),
                default: '1',
                description: __('How many new invoices to create from selected items')
            }
        ],
        primary_action: () => {
            this.process_split_order(split_dialog, items_data);
        },
        primary_action_label: __('Split Order'),
        secondary_action: () => {
            split_dialog.hide();
        },
        secondary_action_label: __('Cancel')
    });

    this.split_dialog = split_dialog;
    this.split_items_data = items_data;
    split_dialog.show();

    // Bind events after dialog is shown
    setTimeout(() => {
        this.bind_split_dialog_events();
    }, 100);
}

get_split_items_html(items_data) {
    let html = `
        <div class="split-items-container">
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th width="5%">
                            <input type="checkbox" id="select-all-items" title="Select All">
                        </th>
                        <th width="25%">${__('Item')}</th>
                        <th width="15%">${__('Original Qty')}</th>
                        <th width="15%">${__('Split Qty')}</th>
                        <th width="15%">${__('Remaining Qty')}</th>
                        <th width="10%">${__('Rate')}</th>
                        <th width="15%">${__('Split Amount')}</th>
                    </tr>
                </thead>
                <tbody>
    `;

    items_data.forEach((item, index) => {
        html += `
            <tr data-item-index="${index}">
                <td>
                    <input type="checkbox" class="item-checkbox" data-item-index="${index}">
                </td>
                <td>
                    <div><strong>${item.item_code}</strong></div>
                    <div class="text-muted small">${item.item_name}</div>
                </td>
                <td>
                    <span class="original-qty">${item.original_qty} ${item.uom}</span>
                </td>
                <td>
                    <input type="number" 
                           class="form-control split-qty-input" 
                           data-item-index="${index}"
                           min="0" 
                           max="${item.original_qty}" 
                           step="0.01"
                           value="0">
                </td>
                <td>
                    <span class="remaining-qty">${item.remaining_qty} ${item.uom}</span>
                </td>
                <td>
                    <span class="item-rate">${format_currency(item.rate, this.doc.currency)}</span>
                </td>
                <td>
                    <span class="split-amount">${format_currency(0, this.doc.currency)}</span>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div class="split-summary mt-3">
                <div class="row">
                    <div class="col-md-6">
                        <strong>Selected Items: <span id="selected-count">0</span></strong>
                    </div>
                    <div class="col-md-6 text-right">
                        <strong>Total Split Amount: <span id="total-split-amount">${format_currency(0, this.doc.currency)}</span></strong>
                    </div>
                </div>
            </div>
        </div>
    `;

    return html;
}

bind_split_dialog_events() {
    const dialog_wrapper = this.split_dialog.$wrapper;

    // Select all checkbox
    dialog_wrapper.find('#select-all-items').on('change', (e) => {
        const is_checked = $(e.target).is(':checked');
        dialog_wrapper.find('.item-checkbox').prop('checked', is_checked);
        
        // Update split quantities
        dialog_wrapper.find('.split-qty-input').each((i, input) => {
            const item_index = $(input).data('item-index');
            const max_qty = parseFloat($(input).attr('max'));
            $(input).val(is_checked ? max_qty : 0);
            this.update_item_split_data(item_index, is_checked ? max_qty : 0);
        });
        
        this.update_split_summary();
    });

    // Individual item checkboxes
    dialog_wrapper.find('.item-checkbox').on('change', (e) => {
        const checkbox = $(e.target);
        const item_index = checkbox.data('item-index');
        const is_checked = checkbox.is(':checked');
        const qty_input = dialog_wrapper.find(`.split-qty-input[data-item-index="${item_index}"]`);
        
        if (is_checked) {
            const max_qty = parseFloat(qty_input.attr('max'));
            qty_input.val(max_qty);
            this.update_item_split_data(item_index, max_qty);
        } else {
            qty_input.val(0);
            this.update_item_split_data(item_index, 0);
        }
        
        this.update_split_summary();
    });

    // Quantity input changes
    dialog_wrapper.find('.split-qty-input').on('input change', (e) => {
        const input = $(e.target);
        const item_index = input.data('item-index');
        let split_qty = parseFloat(input.val()) || 0;
        const max_qty = parseFloat(input.attr('max'));
        
        // Validate quantity
        if (split_qty > max_qty) {
            split_qty = max_qty;
            input.val(split_qty);
        }
        if (split_qty < 0) {
            split_qty = 0;
            input.val(split_qty);
        }
        
        // Update checkbox state
        const checkbox = dialog_wrapper.find(`.item-checkbox[data-item-index="${item_index}"]`);
        checkbox.prop('checked', split_qty > 0);
        
        this.update_item_split_data(item_index, split_qty);
        this.update_split_summary();
    });
}

update_item_split_data(item_index, split_qty) {
    const item = this.split_items_data[item_index];
    item.split_qty = split_qty;
    item.remaining_qty = item.original_qty - split_qty;
    item.selected = split_qty > 0;
    
    const dialog_wrapper = this.split_dialog.$wrapper;
    const row = dialog_wrapper.find(`tr[data-item-index="${item_index}"]`);
    
    // Update remaining quantity display
    row.find('.remaining-qty').text(`${item.remaining_qty} ${item.uom}`);
    
    // Update split amount
    const split_amount = split_qty * item.rate;
    row.find('.split-amount').text(format_currency(split_amount, this.doc.currency));
}

update_split_summary() {
    const dialog_wrapper = this.split_dialog.$wrapper;
    const selected_items = this.split_items_data.filter(item => item.selected);
    const total_split_amount = selected_items.reduce((total, item) => 
        total + (item.split_qty * item.rate), 0);
    
    dialog_wrapper.find('#selected-count').text(selected_items.length);
    dialog_wrapper.find('#total-split-amount').text(format_currency(total_split_amount, this.doc.currency));
}

process_split_order(dialog, items_data) {
    const selected_items = items_data.filter(item => item.selected && item.split_qty > 0);
    
    if (selected_items.length === 0) {
        frappe.show_alert({
            message: __("Please select at least one item to split."),
            indicator: 'orange'
        });
        return;
    }
    
    const new_invoice_count = parseInt(dialog.get_value('new_invoice_count')) || 1;
    
    if (new_invoice_count < 1) {
        frappe.show_alert({
            message: __("Number of new invoices must be at least 1."),
            indicator: 'orange'
        });
        return;
    }
    
    // Show confirmation
    frappe.confirm(
        __(`This will create ${new_invoice_count} new invoice(s) with the selected items and update the original invoice. Continue?`),
        () => {
            this.execute_split_order(selected_items, new_invoice_count);
            dialog.hide();
        }
    );
}

execute_split_order(selected_items, new_invoice_count) {
    frappe.dom.freeze(__('Splitting order...'));
    
    // Prepare data for the split operation
    const split_data = {
        original_invoice: this.doc.name,
        selected_items: selected_items.map(item => ({
            item_code: item.item_code,
            split_qty: item.split_qty,
            rate: item.rate,
            item_row_name: item.item_row_name
        })),
        new_invoice_count: new_invoice_count,
        distribute_evenly: new_invoice_count > 1
    };
    
    frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.split_pos_invoice",
        args: split_data,
        callback: (r) => {
            frappe.dom.unfreeze();
            
            if (!r.exc && r.message) {
                const result = r.message;
                
                frappe.show_alert({
                    message: __(`Successfully created ${result.new_invoices.length} new invoice(s). Original invoice updated.`),
                    indicator: 'green'
                });
                
                // Show summary of created invoices
                this.show_split_result_dialog(result);
                
                // Refresh the current view
                this.events.refresh_fields();
                
                // Hide the summary and show placeholder
                this.show_summary_placeholder();
                
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

show_split_result_dialog(result) {
    let html = `
        <div class="split-result-summary">
            <h5>Split Order Results</h5>
            <div class="alert alert-success">
                <strong>Successfully split the order!</strong>
            </div>
            
            <h6>Original Invoice: ${result.original_invoice}</h6>
            <p>Updated with remaining items</p>
            
            <h6>New Invoices Created:</h6>
            <ul>
    `;
    
    result.new_invoices.forEach((invoice, index) => {
        html += `<li><strong>${invoice.name}</strong> - ${invoice.items.length} items - ${format_currency(invoice.grand_total, this.doc.currency)}</li>`;
    });
    
    html += `
            </ul>
            <div class="mt-3">
                <small class="text-muted">All invoices are in draft status and can be modified before submission.</small>
            </div>
        </div>
    `;
    
    const result_dialog = new frappe.ui.Dialog({
        title: __('Split Order Complete'),
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'result_html',
                options: html
            }
        ],
        primary_action: () => {
            result_dialog.hide();
        },
        primary_action_label: __('Close')
    });
    
    result_dialog.show();
}

show_summary_placeholder() {
    this.$summary_wrapper.css('display', 'none');
    this.$component.find('.no-summary-placeholder').css('display', 'flex');
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
                        console.log("Sending raw commands to QZ printer:", out.raw_commands);
                        return qz.print(config, data);
                    })
                    .then(frappe.ui.form.qz_success)
                    .catch((err) => {
                        frappe.ui.form.qz_fail(err);
                        console.error("QZ printing error:", err);
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
        // Send all current items - let Python calculate what's new
        const items_to_print = this.doc.items.map(item => ({
            item_code: item.item_code,
            item_name: item.item_name || item.item_code,
            qty: item.qty,
            uom: item.uom,
            rate: item.rate,
            name: item.name
        }));
        
        console.log("Items to print:", items_to_print);
        
        frappe.call({
            method: "posnext.posnext.page.posnext.point_of_sale.print_captain_order",
            args: {
                invoice_name: docname,
                current_items: items_to_print,
                print_format: print_format,
                _lang: lang_code
                // Removed force_print parameter completely
            },
            callback: (r) => {
                console.log("Print captain order response:", r.message);
                if (!r.exc && r.message && r.message.success) {
                    // Check if there are actually new items to print
                    if (r.message.new_items_count === 0) {
                        callback({ message: "No new items to print" });
                        return;
                    }
                    
                    // Check if data is empty or has no items
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
            console.log("Skipping render: doc_data has no items");
            callback(""); // Return empty commands
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

                    console.log("Print format template:", template);
                    console.log("Items to render:", doc_data.items); // Debug log for items
                    try {
                        const context = { doc: doc_data };
                        const raw_commands = frappe.render_template(template, context);
                        console.log("Rendered raw commands:", raw_commands);
                        callback(raw_commands);
                    } catch (error) {
                        console.error("Template rendering error:", error);
                        frappe.show_alert({
                            message: __("Error rendering print format: " + (error.message || error)),
                            indicator: 'red'
                        });
                        frappe.utils.play_sound("error");
                        callback(""); // Return empty commands
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

    // Main logic
    if (!this.doc.items.length) {
        frappe.show_alert({
            message: __("No items in the invoice to print."),
            indicator: 'red'
        });
        return frappe.utils.play_sound("error");
    }

    console.log("Print Order button clicked");
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
// Add these helper methods at the appropriate location in your class (not inside another method)
_print_via_qz(doctype, docname, print_format, letterhead, lang_code) {
    // First check if we have a mapped printer for this print format
    const print_format_printer_map = this._get_print_format_printer_map();
    const mapped_printer = this._get_mapped_printer(print_format_printer_map, doctype, print_format);
    
    if (mapped_printer.length === 1) {
        // Printer is already mapped in localStorage
        this._print_with_mapped_printer(doctype, docname, print_format, letterhead, lang_code, mapped_printer[0]);
    } else if (this._is_raw_printing(print_format)) {
        // Printer not mapped but current format is raw printing
        frappe.show_alert({
            message: __("Printer mapping not set."),
            subtitle: __("Please set a printer mapping for this print format in the Printer Settings"),
            indicator: "warning"
        }, 14);
        this._printer_setting_dialog(doctype, print_format);
    } else {
        // Regular printing via dialog
        this._render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code);
    }
}

_print_with_mapped_printer(doctype, docname, print_format, letterhead, lang_code, printer_map) {
    if (this._is_raw_printing(print_format)) {
        // Get raw commands and send to printer
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
        // Fallback to regular print
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
    // Fallback to regular print method
    frappe.utils.print(
        doctype,
        docname,
        print_format,
        letterhead,
        lang_code
    );
}

_printer_setting_dialog(doctype, current_print_format) {
    // Dialog for Printer Settings similar to the one in print.js
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
                
                // Try printing again with the new settings
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
		if (after_submission)
			return [{ condition: true, visible_btns: ['Print Receipt', 'New Order'] }];

		return [
			{ condition: this.doc.docstatus === 0, visible_btns: ['Print Receipt','Edit Order','Print-Order','Split-Order'] },
			{ condition: !this.doc.is_return && this.doc.docstatus === 1, visible_btns: ['Print Receipt', 'Return']},
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
};
