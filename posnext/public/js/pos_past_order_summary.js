frappe.provide('posnext.PointOfSale');
posnext.PointOfSale.PastOrderSummary = class {
	constructor({ wrapper, pos_profile,events }) {
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
					<div class="cashier">${__('Sold by')}: ${doc.owner}</div>
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
            if (!this.pos_profile.custom_notification_message_whatsapp) {
                frappe.show_alert({
                    message: __('WhatsApp notification is not enabled in POS Profile'),
                    indicator: 'orange'
                });
                return;
            }

            if (!this.doc.customer) {
                frappe.throw(__('Please select a customer first'));
                return;
            }

            frappe.db.get_value('Customer', this.doc.customer, 'mobile_no')
                .then(({ message }) => {
                    if (message.mobile_no) {
                        const mobile_no = message.mobile_no.replace(/[^0-9]/g, '');
                        const whatsapp_message = "https://wa.me/" + mobile_no + "?text=";
                        
                        // Get the print URL directly
                        const print_url = frappe.urllib.get_full_url(
                            '/printview?doctype=' + encodeURIComponent(this.doc.doctype) +
                            '&name=' + encodeURIComponent(this.doc.name) +
                            '&format=' + encodeURIComponent(this.pos_profile.print_format) +
                            '&no_letterhead=0' +
                            '&_lang=' + encodeURIComponent(frappe.boot.lang) +
                            '&trigger_print=1'
                        );

                        const final_message = whatsapp_message + 
                            encodeURIComponent("Please find your invoice here \n" + print_url);
                        window.open(final_message);
                    } else {
                        var field_values = this.pos_profile.custom_whatsapp_field_names.map(x => this.doc[x.field_name]);

                        var message_body = formatString(this.pos_profile.custom_whatsapp_message, field_values);

                        const print_url = frappe.urllib.get_full_url(
                            '/printview?doctype=' + encodeURIComponent(this.doc.doctype) +
                            '&name=' + encodeURIComponent(this.doc.name) +
                            '&format=' + encodeURIComponent(this.pos_profile.print_format) +
                            '&no_letterhead=0' +
                            '&_lang=' + encodeURIComponent(frappe.boot.lang) +
                            '&trigger_print=1'
                        );

                        message_body += "\n\nPlease find your invoice here:\n" + print_url;

                        var encoded_message = encodeURIComponent(message_body);

                        var phone_number = this.doc.customer;

                        var whatsapp_url = "https://wa.me/" + phone_number + "?text=" + encoded_message;

                        window.open(whatsapp_url, '_blank');
                    }
                });
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

        this.$summary_container.on('click', '.print-btn', () => {
            this.print_receipt();
        });
    }

 	print_receipt() {
    const frm = this.events.get_frm();
    const print_format = this.pos_profile.custom_sales_invoice_print_format || frm.pos_print_format;
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
			return [{ condition: true, visible_btns: ['Print Receipt', 'Email Receipt','Send Whatsapp', 'New Order'] }];

		return [
			{ condition: this.doc.docstatus === 0, visible_btns: ['Print Receipt','Edit Order', 'Delete Order','Send Whatsapp'] },
			{ condition: !this.doc.is_return && this.doc.docstatus === 1, visible_btns: ['Print Receipt', 'Email Receipt', 'Return','Send Whatsapp']},
			{ condition: this.doc.is_return && this.doc.docstatus === 1, visible_btns: ['Print Receipt', 'Email Receipt','Send Whatsapp']}
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
		this.$summary_wrapper.css("width",after_submission ? "35%" : "60%");

		if (after_submission) {
			this.print_receipt_on_order_complete();
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

	async print_receipt_on_order_complete() {
   
        const profile_name = this.pos_profile?.name || this.pos_profile;

        const { message } = await frappe.db.get_value(
            "POS Profile",
            profile_name,
            ["print_receipt_on_order_complete", "print_format"]
        );

        if (message?.print_receipt_on_order_complete) {
            setTimeout(() => this.print_receipt(), 300);
        }
   
}

	
};
