frappe.provide('posnext.PointOfSale');

posnext.PointOfSale.PastOrderList = class {
    constructor({ wrapper, events }) {
        this.wrapper = wrapper;
        this.events = events;
        this.selected_invoices = []; // Track selected invoices

        this.init_component();
    }

    init_component() {
        this.prepare_dom();
        this.make_filter_section();
        this.bind_events();
    }

    prepare_dom() {
        this.wrapper.append(
            `<style>
                .past-order-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .invoice-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    border-bottom: 1px solid #e0e0e0;
                }
                .invoice-checkbox {
                    margin-right: 10px;
                }
                .merge-btn-container {
                    margin-top: 10px;
                    text-align: right;
                    padding: 10px;
                }
                .merge-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .seperator {
                    border-bottom: 1px solid #e0e0e0;
                }
            </style>
            <section class="past-order-list">
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
            </section>`
        );

        this.$component = this.wrapper.find('.past-order-list');
        this.$invoices_container = this.$component.find('.invoices-container');
    }

    bind_events() {
        // Handle search input
        this.search_field.$input.on('input', (e) => {
            clearTimeout(this.last_search);
            this.last_search = setTimeout(() => {
                const search_term = e.target.value;
                this.refresh_list(search_term, this.status_field.get_value());
            }, 300);
        });

        // Handle invoice click
        const me = this;
        this.$invoices_container.on('click', '.invoice-wrapper', function(e) {
            // Prevent triggering invoice selection when clicking checkbox
            if (!$(e.target).is('.invoice-checkbox')) {
                const invoice_name = unescape($(this).attr('data-invoice-name'));
                me.events.open_invoice_data(invoice_name);
            }
        });

        // Handle back button
        this.$component.on('click', '.back', function() {
            me.events.previous_screen();
        });

        // Handle checkbox changes
        this.$invoices_container.on('change', '.invoice-checkbox', (e) => {
            const invoice_name = $(e.target).data('invoice-name');
            if (e.target.checked) {
                this.selected_invoices.push(invoice_name);
            } else {
                this.selected_invoices = this.selected_invoices.filter(name => name !== invoice_name);
            }
            this.update_merge_button();
        });

        // Handle merge button click
        this.$invoices_container.on('click', '.merge-btn', () => {
            if (this.selected_invoices.length >= 2) {
                this.merge_invoices();
            }
        });
    }

    make_filter_section() {
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
                onchange: () => {
                    if (this.$component.is(':visible')) this.refresh_list();
                }
            },
            parent: this.$component.find('.status-field'),
            render_input: true,
        });
        this.search_field.toggle_label(false);
        this.status_field.toggle_label(false);
        this.status_field.set_value('Draft');
    }

    refresh_list(search_term = '', status = '') {
        frappe.dom.freeze();
        this.events.reset_summary();
        this.$invoices_container.html('');
        this.selected_invoices = []; // Reset selection on refresh

        return frappe.call({
            method: "erpnext.selling.page.point_of_sale.point_of_sale.get_past_order_list",
            freeze: true,
            args: { search_term, status },
            callback: (response) => {
                frappe.dom.unfreeze();
                response.message.forEach(invoice => {
                    const invoice_html = this.get_invoice_html(invoice);
                    this.$invoices_container.append(invoice_html);
                });
                // Append merge button at the bottom of the invoice list
                this.$invoices_container.append(
                    `<div class="merge-btn-container">
                        <button class="btn btn-primary merge-btn" disabled>${__('Merge Invoices')}</button>
                    </div>`
                );
                this.update_merge_button();
            }
        });
    }

    get_invoice_html(invoice) {
        const posting_datetime = moment(invoice.posting_date + " " + invoice.posting_time).format("Do MMMM, h:mma");
        // Disable checkbox for non-Draft invoices
        const is_draft = invoice.status === 'Draft';
        const checkbox_html = is_draft
            ? `<input type="checkbox" class="invoice-checkbox" data-invoice-name="${escape(invoice.name)}">`
            : `<input type="checkbox" class="invoice-checkbox" disabled>`;
        return (
            `<div class="invoice-wrapper" data-invoice-name="${escape(invoice.name)}">
                ${checkbox_html}
                <div class="invoice-name-date">
                    <div class="invoice-name">${invoice.name}</div>
                    <div class="invoice-date">
                        <svg class="mr-2" width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        ${frappe.ellipsis(invoice.customer, 20)}
                    </div>
                </div>
                <div class="invoice-total-status">
                    <div class="invoice-total">${format_currency(invoice.grand_total, invoice.currency, 0) || 0}</div>
                    <div class="invoice-date">${posting_datetime}</div>
                </div>
            </div>
            <div class="seperator"></div>`
        );
    }

    update_merge_button() {
        // Enable merge button only if 2 or more Draft invoices are selected
        const selected_draft_invoices = this.selected_invoices.filter(name => {
            const invoice = this.$invoices_container.find(`.invoice-wrapper[data-invoice-name="${escape(name)}"]`);
            return invoice.length && invoice.find('.invoice-checkbox').prop('disabled') === false;
        });
        this.$invoices_container.find('.merge-btn').prop('disabled', selected_draft_invoices.length < 2);
    }

    merge_invoices() {
        // Fetch selected invoices
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'POS Invoice',
                filters: { name: ['in', this.selected_invoices], status: 'Draft' },
                fields: ['name', 'customer', 'items', 'grand_total', 'currency', 'pos_profile', 'posting_date', 'posting_time']
            },
            callback: (r) => {
                if (r.message) {
                    const invoices = r.message;
                    // Double-check all invoices are Draft
                    const all_draft = invoices.every(inv => inv.status === 'Draft');
                    if (!all_draft) {
                        frappe.msgprint(__('Only Draft POS Invoices can be merged.'));
                        return;
                    }
                    // Check if all invoices have the same customer
                    const customer = invoices[0].customer;
                    const same_customer = invoices.every(inv => inv.customer === customer);
                    if (!same_customer) {
                        frappe.msgprint(__('All selected invoices must have the same customer to merge.'));
                        return;
                    }

                    // Combine items
                    let merged_items = [];
                    invoices.forEach(inv => {
                        inv.items.forEach(item => {
                            const existing_item = merged_items.find(i => 
                                i.item_code === item.item_code && 
                                i.uom === item.uom && 
                                i.rate === item.rate
                            );
                            if (existing_item) {
                                existing_item.qty += item.qty;
                            } else {
                                merged_items.push({ ...item });
                            }
                        });
                    });

                    // Create new invoice
                    frappe.call({
                        method: 'frappe.client.insert',
                        args: {
                            doc: {
                                doctype: 'POS Invoice',
                                customer: customer,
                                items: merged_items,
                                currency: invoices[0].currency,
                                pos_profile: invoices[0].pos_profile,
                                posting_date: frappe.datetime.now_date(),
                                posting_time: frappe.datetime.now_time(),
                                status: 'Draft'
                            }
                        },
                        freeze: true,
                        freeze_message: __('Merging invoices...'),
                        callback: (r) => {
                            if (r.message) {
                                frappe.show_alert({
                                    message: __('New POS Invoice created: ') + r.message.name,
                                    indicator: 'green'
                                });

                                // Cancel original invoices
                                this.cancel_invoices(this.selected_invoices);

                                // Clear selection and refresh list
                                this.selected_invoices = [];
                                this.refresh_list();
                                this.events.reset_summary();
                            }
                        },
                        error: (err) => {
                            frappe.msgprint(__('Failed to create new POS Invoice: ') + err.message);
                        }
                    });
                }
            },
            error: (err) => {
                frappe.msgprint(__('Failed to fetch invoices: ') + err.message);
            }
        });
    }

    cancel_invoices(invoice_names) {
        invoice_names.forEach(name => {
            frappe.call({
                method: 'frappe.client.cancel',
                args: {
                    doctype: 'POS Invoice',
                    name: name
                },
                callback: (r) => {
                    if (!r.exc) {
                        frappe.show_alert({
                            message: __('POS Invoice ') + name + __(' cancelled.'),
                            indicator: 'green'
                        });
                    }
                },
                error: (err) => {
                    frappe.msgprint(__('Failed to cancel POS Invoice ') + name + ': ' + err.message);
                }
            });
        });
    }

    toggle_component(show) {
        frappe.run_serially([
            () => show ? this.$component.css('display', 'flex') && this.refresh_list() : this.$component.css('display', 'none'),
            () => this.invoices[0] && this.events.open_invoice_data(this.invoices[0].name)
        ]);
    }
};