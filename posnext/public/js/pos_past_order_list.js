frappe.provide('posnext.PointOfSale');
var invoicess = []
posnext.PointOfSale.PastOrderList = class {
	constructor({ wrapper, events }) {
		this.wrapper = wrapper;
		this.events = events;
		this.selected_invoices = new Set(); // Track selected invoices

		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.make_filter_section();
		this.bind_events();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="past-order-list">
				<div class="filter-section">
					<div class="label back" style="font-size: 13px ">
						<a>
							<svg class="es-line" style="width: 13px;height: 13px">
								<use class="" href="#es-line-left-chevron"></use></svg> Back
						</a>
					</div>
					<br>
					<div class="label">${__('Recent Orders')}</div>
					<div class="search-field"></div>
					<div class="status-field"></div>
				</div>
				<div class="invoices-container"></div>
				<div class="merge-section" style="display: none; padding: 15px; border-top: 1px solid #d1d8dd; background-color: #f8f9fa;">
					<div class="selected-count" style="margin-bottom: 10px; font-size: 12px; color: #6c757d;">
						<span class="count">0</span> invoices selected
					</div>
					<button class="btn btn-primary btn-sm merge-btn" disabled>
						<svg style="width: 14px; height: 14px; margin-right: 5px;" viewBox="0 0 24 24" fill="currentColor">
							<path d="M17,20.5V19H7V20.5L3,16.5L7,12.5V14H17V12.5L21,16.5L17,20.5M7,3.5V5H17V3.5L21,7.5L17,11.5V10H7V11.5L3,7.5L7,3.5Z"/>
						</svg>
						${__('Merge Selected Invoices')}
					</button>
				</div>
			</section>`
		);

		this.$component = this.wrapper.find('.past-order-list');
		this.$invoices_container = this.$component.find('.invoices-container');
		this.$merge_section = this.$component.find('.merge-section');
		this.$merge_btn = this.$component.find('.merge-btn');
		this.$selected_count = this.$component.find('.selected-count .count');
	}

	bind_events() {
		this.search_field.$input.on('input', (e) => {
			clearTimeout(this.last_search);
			this.last_search = setTimeout(() => {
				const search_term = e.target.value;
				this.refresh_list(search_term, this.status_field.get_value());
			}, 300);
		});

		const me = this;
		
		// Handle invoice click (only if not clicking checkbox)
		this.$invoices_container.on('click', '.invoice-wrapper', function(e) {
			if (!$(e.target).closest('.invoice-checkbox-container').length) {
				const invoice_name = unescape($(this).attr('data-invoice-name'));
				me.events.open_invoice_data(invoice_name);
			}
		});

		// Handle checkbox changes
		this.$invoices_container.on('change', '.invoice-checkbox', function(e) {
			e.stopPropagation();
			const invoice_name = unescape($(this).closest('.invoice-wrapper').attr('data-invoice-name'));
			
			if ($(this).is(':checked')) {
				me.selected_invoices.add(invoice_name);
			} else {
				me.selected_invoices.delete(invoice_name);
			}
			
			me.update_merge_section();
		});

		// Handle merge button click
		this.$merge_btn.on('click', function() {
			me.merge_selected_invoices();
		});

		this.$component.on('click', '.back', function() {
			me.events.previous_screen()
		});
	}

	make_filter_section() {
		const me = this;
		this.search_field = frappe.ui.form.make_control({
			df: {
				label: __('Search'),
				fieldtype: 'Data',
				placeholder: __('Search by invoice id or customer name')
			},
			parent: this.$component.find('.search-field'),
			render_input: true,
		});
		this.status_field = frappe.ui.form.make_control({
			df: {
				label: __('Invoice Status'),
				fieldtype: 'Select',
				options: `Draft\nPaid\nConsolidated\nReturn`,
				placeholder: __('Filter by invoice status'),
				onchange: function() {
					if (me.$component.is(':visible')) me.refresh_list();
				}
			},
			parent: this.$component.find('.status-field'),
			render_input: true,
		});
		this.search_field.toggle_label(false);
		this.status_field.toggle_label(false);
		this.status_field.set_value('Draft');
	}

	refresh_list() {
		frappe.dom.freeze();
		this.events.reset_summary();
		const search_term = this.search_field.get_value();
		const status = this.status_field.get_value();

		// Clear selected invoices when refreshing
		this.selected_invoices.clear();
		this.update_merge_section();

		this.$invoices_container.html('');

		return frappe.call({
			method: "erpnext.selling.page.point_of_sale.point_of_sale.get_past_order_list",
			freeze: true,
			args: { search_term, status },
			callback: (response) => {
				frappe.dom.unfreeze();
				invoicess = response.message
				response.message.forEach(invoice => {
					const invoice_html = this.get_invoice_html(invoice);
					this.$invoices_container.append(invoice_html);
				});
			}
		});
	}

	get_invoice_html(invoice) {
		const posting_datetime = moment(invoice.posting_date+" "+invoice.posting_time).format("Do MMMM, h:mma");
		return (
			`<div class="invoice-wrapper" data-invoice-name="${escape(invoice.name)}" style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #d1d8dd; cursor: pointer;">
				<div class="invoice-checkbox-container" style="margin-right: 10px; display: flex; align-items: center;">
					<input type="checkbox" class="invoice-checkbox" style="margin: 0;">
				</div>
				<div style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
					<div class="invoice-name-date">
						<div class="invoice-name" style="font-weight: 600; margin-bottom: 4px;">${invoice.name}</div>
						<div class="invoice-date" style="font-size: 12px; color: #6c757d; display: flex; align-items: center;">
							<svg class="mr-2" width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
								<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
							</svg>
							${frappe.ellipsis(invoice.customer, 20)}
						</div>
					</div>
					<div class="invoice-total-status" style="text-align: right;">
						<div class="invoice-total" style="font-weight: 600; margin-bottom: 4px;">${format_currency(invoice.grand_total, invoice.currency, 0) || 0}</div>
						<div class="invoice-date" style="font-size: 12px; color: #6c757d;">${posting_datetime}</div>
					</div>
				</div>
			</div>`
		);
	}

	update_merge_section() {
		const count = this.selected_invoices.size;
		this.$selected_count.text(count);
		
		if (count >= 2) {
			this.$merge_section.show();
			this.$merge_btn.prop('disabled', false);
		} else if (count === 1) {
			this.$merge_section.show();
			this.$merge_btn.prop('disabled', true);
		} else {
			this.$merge_section.hide();
		}
	}

	merge_selected_invoices() {
		if (this.selected_invoices.size < 2) {
			frappe.msgprint(__('Please select at least 2 invoices to merge.'));
			return;
		}

		const selected_names = Array.from(this.selected_invoices);
		const selected_invoices_data = invoicess.filter(inv => selected_names.includes(inv.name));

		// Validate that all selected invoices have the same customer
		const customers = [...new Set(selected_invoices_data.map(inv => inv.customer))];
		if (customers.length > 1) {
			frappe.msgprint(__('Cannot merge invoices with different customers. Please select invoices from the same customer.'));
			return;
		}

		// Show confirmation dialog
		frappe.confirm(
			__('Are you sure you want to merge {0} selected invoices? This action cannot be undone.', [selected_names.length]),
			() => {
				this.perform_merge(selected_names, selected_invoices_data[0].customer);
			}
		);
	}

	perform_merge(invoice_names, customer) {
		frappe.dom.freeze(__('Merging invoices...'));

		frappe.call({
			method: "erpnext.selling.page.point_of_sale.point_of_sale.merge_invoices",
			args: {
				invoice_names: invoice_names,
				customer: customer
			},
			callback: (response) => {
				frappe.dom.unfreeze();
				if (response.message && response.message.success) {
					frappe.show_alert({
						message: __('Invoices merged successfully. New invoice: {0}', [response.message.new_invoice]),
						indicator: 'green'
					});
					
					// Clear selections and refresh list
					this.selected_invoices.clear();
					this.refresh_list();
					
					// Optionally open the new merged invoice
					if (response.message.new_invoice) {
						setTimeout(() => {
							this.events.open_invoice_data(response.message.new_invoice);
						}, 1000);
					}
				} else {
					frappe.msgprint(__('Error merging invoices: {0}', [response.message.error || 'Unknown error']));
				}
			},
			error: (error) => {
				frappe.dom.unfreeze();
				frappe.msgprint(__('Error merging invoices. Please try again.'));
				console.error('Merge error:', error);
			}
		});
	}

	toggle_component(show) {
		frappe.run_serially([
			() => {
				if (show) {
					this.$component.css('display', 'flex');
					this.refresh_list();
				} else {
					this.$component.css('display', 'none');
					// Clear selections when hiding component
					this.selected_invoices.clear();
					this.update_merge_section();
				}
			},
			() => {
				if (show && invoicess && invoicess.length > 0) {
					this.events.open_invoice_data(invoicess[0].name);
				}
			}
		]);
	}
};