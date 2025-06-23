frappe.provide('posnext.PointOfSale');
var invoicess = [];
posnext.PointOfSale.PastOrderList = class {
    constructor({ wrapper, events }) {
        this.wrapper = wrapper;
        this.events = events;
        this.selected_invoices = new Set();
        this.can_merge_invoices = this.check_merge_permission();
        this.user_list = [];
        this._just_held_invoice = null;
        this._pending_created_by = null;
        posnext.PointOfSale.PastOrderList.current_instance = this;
        this.init_component();
    }

    init_component() {
        this.prepare_dom();
        this.make_filter_section();
        this.bind_events();
        this.load_user_list();
    }

    check_merge_permission() {
        const user_roles = frappe.user_roles || [];
        return !user_roles.includes('Waiter');
    }

    prepare_dom() {
        this.wrapper.append(
            `<section class="past-order-list">
                <div class="filter-section">
                    <div class="label back" style="font-size: 13px">
                        <a>
                            <svg class="es-line" style="width: 13px;height: 13px">
                                <use class="" href="#es-line-left-chevron"></use></svg> Back
                        </a>
                    </div>
                    <br>
                    <div class="label">${__('Recent Orders')}</div>
                    <div class="search-field"></div>
                    <div class="status-field"></div>
                    <div class="created-by-field"></div>
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
                this.refresh_list(search_term, this.status_field.get_value(), this.created_by_field.get_value());
            }, 3);
        });

        const me = this;
        
        this.$invoices_container.on('click', '.invoice-wrapper', function(e) {
            if (!$(e.target).closest('.invoice-checkbox-container').length) {
                const invoice_name = unescape($(this).attr('data-invoice-name'));
                me.events.open_invoice_data(invoice_name);
            }
        });

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

        this.$merge_btn.on('click', function() {
            me.merge_selected_invoices();
        });

        this.$component.on('click', '.back', function() {
            me.events.reset_summary();
            me.events.previous_screen();
            // Do not clear _just_held_invoice here; let ItemCart set it
        });
    }

    load_user_list() {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "User Secret Key",
                fields: ["name", "user_name"],
                filters: [["user_name", "!=", ""]],
                order_by: "modified desc"
            },
            callback: (response) => {
                if (response.message) {
                    this.user_list = response.message;
                    this.setup_created_by_field();
                    if (this._pending_created_by) {
                        console.log('Applying pending created_by:', this._pending_created_by);
                        this.created_by_field.set_value(this._pending_created_by);
                        this._pending_created_by = null;
                        this.refresh_list();
                    }
                }
            }
        });
    }

    setup_created_by_field() {
        let options = "All\n" + this.user_list.map(user => user.user_name).join('\n');
        this.created_by_field.df.options = options;
        this.created_by_field.refresh();
        
        // CRITICAL FIX: Check for pending filter after setting up options
        if (this._pending_created_by) {
            console.log('Applying pending created_by after field setup:', this._pending_created_by);
            this.created_by_field.set_value(this._pending_created_by);
            this._pending_created_by = null; // Clear after applying
            // Trigger refresh with the new filter
            setTimeout(() => {
                this.refresh_list();
            }, 10);
        } else {
            // Only get most recent creator if no pending filter
            this.get_most_recent_creator();
        }
    }

    get_most_recent_creator() {
        frappe.call({
            method: "posnext.posnext.page.posnext.point_of_sale.get_past_order_list",
            args: { 
                search_term: '', 
                status: 'Draft',
                limit: 1
            },
            callback: (response) => {
                if (response.message && response.message.length > 0 && !this._pending_created_by) {
                    const most_recent_creator = response.message[0].created_by_name;
                    if (most_recent_creator) {
                        console.log('Setting most recent creator:', most_recent_creator);
                        this.created_by_field.set_value(most_recent_creator);
                    }
                }
            }
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
                    console.log('Status field changed to:', me.status_field.get_value());
                    if (me.$component.is(':visible')) {
                        me.refresh_list(
                            me.search_field.get_value(),
                            me.status_field.get_value(),
                            me.created_by_field.get_value()
                        );
                    }
                }
            },
            parent: this.$component.find('.status-field'),
            render_input: true,
        });

        this.created_by_field = frappe.ui.form.make_control({
            df: {
                label: __('Created By'),
                fieldtype: 'Select',
                options: 'All',
                placeholder: __('Filter by creator'),
                onchange: function() {
                    console.log('Created by field changed to:', me.created_by_field.get_value());
                    if (me.$component.is(':visible')) {
                        me.refresh_list(
                            me.search_field.get_value(),
                            me.status_field.get_value(),
                            me.created_by_field.get_value()
                        );
                    }
                }
            },
            parent: this.$component.find('.created-by-field'),
            render_input: true,
        });

        this.search_field.toggle_label(false);
        this.status_field.toggle_label(false);
        this.created_by_field.toggle_label(false);
        this.status_field.set_value('Draft');
    }

set_filter_and_refresh_with_held_invoice(created_by_name, held_invoice_name = null) {
    console.log('Setting filter to:', created_by_name, 'with held invoice:', held_invoice_name);
    if (held_invoice_name) {
        this._just_held_invoice = held_invoice_name;
    }
    this._pending_created_by = created_by_name;
    return this.toggle_component(true).then(() => {
        console.log('toggle_component completed for filter set');
        if (this.user_list && this.user_list.length > 0) {
            this.created_by_field.set_value(created_by_name);
            this._pending_created_by = null;
            return this.refresh_list(held_invoice_name);
        }
        return Promise.resolve();
    }).catch(error => {
        console.error('Error in set_filter_and_refresh_with_held_invoice:', error);
        this._just_held_invoice = null;
        this._pending_created_by = null;
        frappe.show_alert({
            message: __('Failed to set filter: {0}', [error.message]),
            indicator: 'red'
        });
        throw error; // Propagate for upstream handling
    });
}

toggle_component(show) {
    return frappe.run_serially([
        () => {
            if (show) {
                console.log('Showing PastOrderList component');
                this.$component.css('display', 'flex');
                return this.refresh_list(
                    this.search_field.get_value(),
                    this.status_field.get_value(),
                    this.created_by_field.get_value()
                ).then(() => {
                    console.log('PastOrderList refreshed, ensuring visibility');
                    this.$component.css('display', 'flex'); // Re-ensure visibility
                });
            } else {
                console.log('Hiding PastOrderList component');
                this.$component.css('display', 'none');
                this.selected_invoices.clear();
                this.update_merge_section();
            }
        }
    ]);
}

refresh_list(search_term = '', status = 'Draft', created_by = '') {
    console.log('Refreshing list with:', { search_term, status, created_by, just_held_invoice: this._just_held_invoice });
    this.events.reset_summary();
    let final_created_by = created_by;
    if (this._pending_created_by) {
        console.log('Applying pending created_by filter:', this._pending_created_by);
        final_created_by = this._pending_created_by;
        this.created_by_field.set_value(this._pending_created_by);
        this._pending_created_by = null;
    }
    this.selected_invoices.clear();
    this.update_merge_section();
    this.$invoices_container.html('');
    return frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.get_past_order_list",
        args: { 
            search_term, 
            status,
            created_by: final_created_by === 'All' ? '' : final_created_by,
            _force_refresh: this._just_held_invoice ? Date.now() : undefined
        },
        callback: (response) => {
            console.log('get_past_order_list response:', response);
            this.invoices = response.message || [];
            if (!this.invoices.length) {
                console.log('No invoices found, showing placeholder');
                this.$invoices_container.html(
                    `<div class="no-invoices-placeholder" style="text-align: center; padding: 20px; color: #6c757d;">
                        ${__('No orders found for the selected filters')}
                    </div>`
                );
            } else {
                this.invoices.forEach(invoice => {
                    const invoice_html = this.get_invoice_html(invoice);
                    this.$invoices_container.append(invoice_html);
                });
            }
            this.auto_load_most_recent_summary(this.invoices);
        },
        error: (xhr, status, error) => {
            console.error('Error in get_past_order_list:', { status, error });
            this.$invoices_container.html(
                `<div class="no-invoices-placeholder" style="text-align: center; padding: 20px; color: #6c757d;">
                    ${__('Failed to load orders. Please try again.')}
                </div>`
            );
            frappe.show_alert({
                message: __('Failed to load orders: {0}', [error]),
                indicator: 'red'
            });
        }
    });
}

    auto_load_most_recent_summary(invoices) {
        if (!invoices || invoices.length === 0) {
            this.events.reset_summary();
            return;
        }
        
        const most_recent_invoice = this._just_held_invoice 
            ? invoices.find(inv => inv.name === this._just_held_invoice) || invoices[0]
            : invoices[0];
        
        if (most_recent_invoice) {
            this.events.open_invoice_data(most_recent_invoice.name);
            this.highlight_invoice_in_list(most_recent_invoice.name);
            if (this._just_held_invoice && this._just_held_invoice === most_recent_invoice.name) {
                frappe.show_alert({
                    message: __('Invoice held successfully: ') + most_recent_invoice.name,
                    indicator: 'green'
                });
            }
        }
        this._just_held_invoice = null; // Clear after processing
    }

    highlight_invoice_in_list(invoice_name) {
        this.$invoices_container.find('.invoice-wrapper').removeClass('selected');
        this.$invoices_container.find(`[data-invoice-name="${escape(invoice_name)}"]`).addClass('selected');
    }
  
    get_invoice_html(invoice) {
        const posting_datetime = moment(invoice.posting_date + " " + invoice.posting_time).format("Do MMMM, h:mma");
        
        const checkbox_html = this.can_merge_invoices ? 
            `<div class="invoice-checkbox-container" style="margin-right: 10px; display: flex; align-items: center;">
                <input type="checkbox" class="invoice-checkbox" style="margin: 0;">
            </div>` : '';
        
        const created_by_html = invoice.created_by_name ? 
            `<div class="invoice-creator" style="font-size: 11px; color: #8d99a6; margin-top: 2px;">
                <svg style="width: 10px; height: 10px; margin-right: 3px;" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                ${frappe.ellipsis(invoice.created_by_name, 15)}
            </div>` : '';
        
        return (
            `<div class="invoice-wrapper" data-invoice-name="${escape(invoice.name)}" style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #d1d8dd; cursor: pointer;">
                ${checkbox_html}
                <div style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
                    <div class="invoice-name-date">
                        <div class="invoice-name" style="font-weight: 600; margin-bottom: 4px;">${invoice.name}</div>
                        <div class="invoice-date" style="font-size: 12px; color: #6c757d; display: flex; align-items: center;">
                            <svg class="mr-2" width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                            </svg>
                            ${frappe.ellipsis(invoice.customer, 20)}
                        </div>
                        ${created_by_html}
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
        if (!this.can_merge_invoices) {
            this.$merge_section.hide();
            return;
        }

        const count = this.selected_invoices.size;
        this.$selected_count.text(count);
        
        if (count >= 2) {
            this.$merge_section.show();
            this.$merge_btn.prop('disabled', false).css('pointer-events', 'auto');
        } else if (count === 1) {
            this.$merge_section.show();
            this.$merge_btn.prop('disabled', true).css('pointer-events', 'none');
        } else {
            this.$merge_section.hide();
        }
    }

    merge_selected_invoices() {
        if (!this.can_merge_invoices) {
            frappe.msgprint(__('You do not have permission to merge invoices.'));
            return;
        }

        if (this.selected_invoices.size < 2) {
            frappe.msgprint(__('Please select at least 2 invoices to merge.'));
            return;
        }

        const selected_names = Array.from(this.selected_invoices);
        const selected_invoices_data = invoicess.filter(inv => selected_names.includes(inv.name));

        const customers = [...new Set(selected_invoices_data.map(inv => inv.customer))];
        if (customers.length > 1) {
            frappe.msgprint(__('Cannot merge invoices with different customers. Please select invoices from the same customer.'));
            return;
        }

        frappe.confirm(
            __('Are you sure you want to merge {0} selected invoices? This action cannot be undone.', [selected_names.length]),
            () => {
                this.perform_merge(selected_names, selected_invoices_data[0].customer);
            }
        );
    }

    perform_merge(invoice_names, customer) {
        frappe.call({
            method: "posnext.posnext.page.posnext.point_of_sale.merge_invoices",
            args: {
                invoice_names: invoice_names,
                customer: customer
            },
            freeze: true,
            freeze_message: __('Merging invoices...'),
            callback: (response) => {
                if (response.message && response.message.success) {
                    frappe.show_alert({
                        message: __('Invoices merged successfully. New invoice: {0}', [response.message.new_invoice]),
                        indicator: 'green'
                    });
                    this.selected_invoices.clear();
                    this.refresh_list();
                    if (response.message.new_invoice) {
                        setTimeout(() => {
                            this.events.open_invoice_data(response.message.new_invoice);
                        }, 1);
                    }
                } else {
                    frappe.msgprint(__('Error merging invoices: {0}', [response.message.error || 'Unknown error']));
                }
            },
            error: (error) => {
                console.error('Merge error:', error);
                frappe.msgprint(__('Error merging invoices. Please try again.'));
            }
        });
    }
};