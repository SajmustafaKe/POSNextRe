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

// Enhanced frontend methods with invoice assignment capability

// Simplified split order functionality

split_order() {
    // Basic validation
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
    // Prepare items data
    const items_data = this.doc.items.map((item, index) => ({
        idx: index + 1,
        item_code: item.item_code,
        item_name: item.item_name || item.item_code,
        available_qty: item.qty,
        split_qty: 0,
        rate: item.rate,
        uom: item.uom,
        selected: false
    }));

    // Store selected items for each invoice
    this.split_invoices = [{ items: [], total: 0 }]; // Start with one new invoice

    const dialog = new frappe.ui.Dialog({
        title: __('Split Order - Select Items'),
        size: 'large',
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'instructions',
                options: `
                    <div class="alert alert-info mb-3">
                        <strong>Simple Split Process:</strong>
                        <ol class="mb-0">
                            <li>Select items and enter quantities to split</li>
                            <li>Click "Next" to assign items to invoices</li>
                            <li>Click "Split Order" to complete</li>
                        </ol>
                    </div>
                `
            },
            {
                fieldtype: 'HTML',
                fieldname: 'items_table',
                options: this.get_items_selection_html(items_data)
            }
        ],
        primary_action: () => {
            this.proceed_to_invoice_assignment(dialog, items_data);
        },
        primary_action_label: __('Next: Assign to Invoices'),
        secondary_action_label: __('Cancel')
    });

    // Store references
    this.split_dialog = dialog;
    this.split_items_data = items_data;

    dialog.show();

    // Bind events after dialog shows
    setTimeout(() => {
        this.bind_item_selection_events(dialog);
    }, 100);
}

get_items_selection_html(items_data) {
    let html = `
        <div class="split-items-container">
            <table class="table table-bordered">
                <thead class="thead-light">
                    <tr>
                        <th width="5%">
                            <input type="checkbox" id="select-all" title="Select All">
                        </th>
                        <th width="30%">${__('Item')}</th>
                        <th width="20%">${__('Available Qty')}</th>
                        <th width="20%">${__('Split Qty')}</th>
                        <th width="15%">${__('Rate')}</th>
                        <th width="10%">${__('Amount')}</th>
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
                           value="0"
                           disabled>
                </td>
                <td>
                    ${format_currency(item.rate, this.doc.currency)}
                </td>
                <td>
                    <span class="split-amount" data-index="${index}">
                        ${format_currency(0, this.doc.currency)}
                    </span>
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
                        <strong>Total Amount:</strong> <span id="total-amount">${format_currency(0, this.doc.currency)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    return html;
}

bind_item_selection_events(dialog) {
    const wrapper = dialog.$wrapper;

    // Select all functionality
    wrapper.find('#select-all').on('change', (e) => {
        const checked = $(e.target).is(':checked');
        wrapper.find('.item-select').each((i, checkbox) => {
            $(checkbox).prop('checked', checked).trigger('change');
        });
    });

    // Individual item selection
    wrapper.find('.item-select').on('change', (e) => {
        const checkbox = $(e.target);
        const index = checkbox.data('index');
        const checked = checkbox.is(':checked');
        const qty_input = wrapper.find(`.split-qty[data-index="${index}"]`);
        
        this.split_items_data[index].selected = checked;
        
        if (checked) {
            // Enable quantity input and set to max
            qty_input.prop('disabled', false);
            const max_qty = parseFloat(qty_input.attr('max'));
            qty_input.val(max_qty);
            this.split_items_data[index].split_qty = max_qty;
            this.update_split_amount(index, max_qty, this.split_items_data[index].rate);
        } else {
            // Disable quantity input and clear
            qty_input.prop('disabled', true).val(0);
            this.split_items_data[index].split_qty = 0;
            this.update_split_amount(index, 0, this.split_items_data[index].rate);
        }
        
        this.update_selection_summary();
    });

    // Quantity input changes
    wrapper.find('.split-qty').on('input change', (e) => {
        const input = $(e.target);
        const index = input.data('index');
        let qty = parseFloat(input.val()) || 0;
        const max_qty = parseFloat(input.attr('max'));
        
        // Validate quantity
        if (qty > max_qty) {
            qty = max_qty;
            input.val(qty);
        }
        if (qty < 0) {
            qty = 0;
            input.val(qty);
        }
        
        // Update data
        this.split_items_data[index].split_qty = qty;
        
        // Update checkbox if quantity becomes 0
        if (qty === 0) {
            wrapper.find(`.item-select[data-index="${index}"]`).prop('checked', false);
            this.split_items_data[index].selected = false;
        }
        
        this.update_split_amount(index, qty, this.split_items_data[index].rate);
        this.update_selection_summary();
    });
}

update_split_amount(index, qty, rate) {
    const amount = qty * rate;
    this.split_dialog.$wrapper.find(`.split-amount[data-index="${index}"]`)
        .text(format_currency(amount, this.doc.currency));
}

update_selection_summary() {
    const selected_items = this.split_items_data.filter(item => item.selected && item.split_qty > 0);
    const total_amount = selected_items.reduce((sum, item) => sum + (item.split_qty * item.rate), 0);
    
    this.split_dialog.$wrapper.find('#selected-count').text(selected_items.length);
    this.split_dialog.$wrapper.find('#total-amount').text(format_currency(total_amount, this.doc.currency));
}

proceed_to_invoice_assignment(dialog, items_data) {
    // Get selected items
    const selected_items = items_data.filter(item => item.selected && item.split_qty > 0);
    
    if (selected_items.length === 0) {
        frappe.show_alert({
            message: __("Please select at least one item to split."),
            indicator: 'orange'
        });
        return;
    }

    dialog.hide();
    this.show_invoice_assignment_dialog(selected_items);
}

show_invoice_assignment_dialog(selected_items) {
    const dialog = new frappe.ui.Dialog({
        title: __('Assign Items to Invoices'),
        size: 'large',
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'assignment_area',
                options: this.get_invoice_assignment_html(selected_items)
            }
        ],
        primary_action: () => {
            this.execute_split_order(dialog, selected_items);
        },
        primary_action_label: __('Split Order'),
        secondary_action: () => {
            dialog.hide();
            this.show_split_dialog(); // Go back to item selection
        },
        secondary_action_label: __('Back')
    });

    this.assignment_dialog = dialog;
    dialog.show();

    // Bind events
    setTimeout(() => {
        this.bind_assignment_events(dialog, selected_items);
    }, 100);
}

get_invoice_assignment_html(selected_items) {
    let html = `
        <div class="invoice-assignment-container">
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5>Selected Items</h5>
                            <small class="text-muted">Click an item to assign it to an invoice</small>
                        </div>
                        <div class="card-body">
                            <div id="available-items">
    `;

    selected_items.forEach((item, index) => {
        const amount = item.split_qty * item.rate;
        html += `
            <div class="item-card p-3 mb-2 border rounded cursor-pointer" data-index="${index}" style="cursor: pointer;">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${item.item_code}</strong><br>
                        <small class="text-muted">${item.item_name}</small><br>
                        <span class="badge badge-info">${item.split_qty} ${item.uom}</span>
                    </div>
                    <div class="text-right">
                        <strong>${format_currency(amount, this.doc.currency)}</strong>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <button type="button" class="btn btn-primary btn-sm" id="add-invoice">
                            <i class="fa fa-plus"></i> Add New Invoice
                        </button>
                    </div>
                    <div id="invoices-container">
                        <!-- Invoices will be added here -->
                    </div>
                </div>
            </div>
        </div>
    `;

    return html;
}

bind_assignment_events(dialog, selected_items) {
    const wrapper = dialog.$wrapper;
    
    // Add first invoice automatically
    this.add_new_invoice_container(wrapper, 1);

    // Add new invoice button
    wrapper.find('#add-invoice').on('click', () => {
        const invoice_count = wrapper.find('.invoice-container').length + 1;
        this.add_new_invoice_container(wrapper, invoice_count);
    });

    // Item selection for assignment
    wrapper.find('.item-card').on('click', (e) => {
        const item_card = $(e.currentTarget);
        const selected_invoice = wrapper.find('.invoice-container.selected');
        
        if (selected_invoice.length === 0) {
            frappe.show_alert({
                message: __("Please select an invoice first"),
                indicator: 'orange'
            });
            return;
        }

        // Move item to selected invoice
        const invoice_items = selected_invoice.find('.invoice-items');
        item_card.removeClass('border').addClass('border-success bg-light');
        item_card.appendTo(invoice_items);
        
        // Update invoice total
        this.update_invoice_total(selected_invoice, selected_items);
    });
}

add_new_invoice_container(wrapper, invoice_number) {
    const invoice_html = `
        <div class="invoice-container card mb-3" data-invoice="${invoice_number}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h6>Invoice ${invoice_number}</h6>
                <div>
                    <span class="invoice-total badge badge-secondary">$0.00</span>
                    <button type="button" class="btn btn-outline-danger btn-sm ml-2 remove-invoice">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="invoice-items min-height-100" style="min-height: 100px; border: 2px dashed #ddd; border-radius: 4px; padding: 10px;">
                    <small class="text-muted">Click items on the left to add them here</small>
                </div>
            </div>
        </div>
    `;

    const invoices_container = wrapper.find('#invoices-container');
    invoices_container.append(invoice_html);

    // Bind events for new invoice
    const new_invoice = invoices_container.find('.invoice-container').last();
    
    // Select invoice on click
    new_invoice.on('click', () => {
        wrapper.find('.invoice-container').removeClass('selected border-primary');
        new_invoice.addClass('selected border-primary');
    });

    // Remove invoice
    new_invoice.find('.remove-invoice').on('click', (e) => {
        e.stopPropagation();
        if (invoices_container.find('.invoice-container').length > 1) {
            // Move items back to available items
            new_invoice.find('.item-card').each((i, item) => {
                $(item).removeClass('border-success bg-light').addClass('border');
                $(item).appendTo(wrapper.find('#available-items'));
            });
            new_invoice.remove();
        } else {
            frappe.show_alert({
                message: __("At least one invoice is required"),
                indicator: 'orange'
            });
        }
    });

    // Auto-select the first invoice
    if (invoice_number === 1) {
        new_invoice.addClass('selected border-primary');
    }
}

update_invoice_total(invoice_container, selected_items) {
    let total = 0;
    invoice_container.find('.item-card').each((i, item_element) => {
        const index = $(item_element).data('index');
        const item = selected_items[index];
        total += item.split_qty * item.rate;
    });
    
    invoice_container.find('.invoice-total').text(format_currency(total, this.doc.currency));
}

execute_split_order(dialog, selected_items) {
    const wrapper = dialog.$wrapper;
    const invoice_groups = {};

    // Collect items for each invoice
    wrapper.find('.invoice-container').each((i, invoice_element) => {
        const invoice_num = $(invoice_element).data('invoice');
        const items = [];
        
        $(invoice_element).find('.item-card').each((j, item_element) => {
            const index = $(item_element).data('index');
            const item = selected_items[index];
            items.push({
                item_code: item.item_code,
                split_qty: item.split_qty
            });
        });
        
        if (items.length > 0) {
            invoice_groups[invoice_num.toString()] = items;
        }
    });

    // Validate that all items are assigned
    const total_assigned = Object.values(invoice_groups).reduce((sum, items) => sum + items.length, 0);
    if (total_assigned !== selected_items.length) {
        frappe.show_alert({
            message: __("Please assign all selected items to invoices"),
            indicator: 'orange'
        });
        return;
    }

    // Show confirmation
    const invoice_count = Object.keys(invoice_groups).length;
    const total_amount = selected_items.reduce((sum, item) => sum + (item.split_qty * item.rate), 0);

    frappe.confirm(
        __(`This will create ${invoice_count} new invoice(s) with ${selected_items.length} items (${format_currency(total_amount, this.doc.currency)}). Continue?`),
        () => {
            this.process_split_order(invoice_groups);
            dialog.hide();
        }
    );
}

process_split_order(invoice_groups) {
    frappe.dom.freeze(__('Splitting order...'));
    
    frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.split_pos_invoice",
        args: {
            original_invoice: this.doc.name,
            invoice_groups: invoice_groups
        },
        callback: (r) => {
            frappe.dom.unfreeze();
            
            if (!r.exc && r.message && r.message.success) {
                const result = r.message;
                
                // Show success message
                frappe.show_alert({
                    message: __(`Successfully created ${result.new_invoices.length} new invoice(s)!`),
                    indicator: 'green'
                });

                // Refresh the page to show new invoices
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
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
