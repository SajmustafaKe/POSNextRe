frappe.provide('posnext.PointOfSale');
posnext.PointOfSale.ItemDetails = class {
	constructor({ wrapper, events, settings }) {
		this.wrapper = wrapper;
		this.events = events;
		this.hide_images = settings.hide_images;
		this.allow_rate_change = settings.allow_rate_change;
		this.allow_discount_change = settings.allow_discount_change;
		this.custom_edit_rate_and_uom = settings.custom_edit_rate_and_uom;
		this.current_item = {};

		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.init_child_components();
		this.bind_events();
		this.attach_shortcuts();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="item-details-container" id="item-details-container"></section>`
		)

		this.$component = this.wrapper.find('.item-details-container');
	}

	init_child_components() {
		this.$component.html(
			`<div class="item-details-header">
				<div class="label">${__('Item Detailss')}</div>
				<div class="close-btn">
					<svg width="32" height="32" viewBox="0 0 14 14" fill="none">
						<path d="M4.93764 4.93759L7.00003 6.99998M9.06243 9.06238L7.00003 6.99998M7.00003 6.99998L4.93764 9.06238L9.06243 4.93759" stroke="#8D99A6"/>
					</svg>
				</div>
			</div>
			<div class="item-display">
				<div class="item-name-desc-price">
					<div class="item-name"></div>
					<div class="item-desc"></div>
					<div class="item-price"></div>
				</div>
				<div class="item-image"></div>
			</div>
			<div class="discount-section"></div>
			<div class="form-container"></div>
			<div class="serial-batch-container"></div>`
		)

		this.$item_name = this.$component.find('.item-name');
		this.$item_description = this.$component.find('.item-desc');
		this.$item_price = this.$component.find('.item-price');
		this.$item_image = this.$component.find('.item-image');
		this.$form_container = this.$component.find('.form-container');
		this.$dicount_section = this.$component.find('.discount-section');
		this.$serial_batch_container = this.$component.find('.serial-batch-container');
	}

	compare_with_current_item(item) {
		// returns true if `item` is currently being edited
		return item && item.name == this.current_item.name;
	}

	async toggle_item_details_section(item) {
		const current_item_changed = !this.compare_with_current_item(item);

		// if item is null or highlighted cart item is clicked twice
		const hide_item_details = !Boolean(item) || !current_item_changed;

		if ((!hide_item_details && current_item_changed) || hide_item_details) {
			// if item details is being closed OR if item details is opened but item is changed
			// in both cases, if the current item is a serialized item, then validate and remove the item
			await this.validate_serial_batch_item();
		}
		if(!this.custom_edit_rate_and_uom){
			this.events.toggle_item_selector(!hide_item_details);
			this.toggle_component(!hide_item_details);
		}


		if (item && current_item_changed) {
			this.doctype = item.doctype;
			this.item_meta = frappe.get_meta(this.doctype);
			this.name = item.name;
			this.item_row = item;
			this.currency = this.events.get_frm().doc.currency;

			this.current_item = item;

			this.render_dom(item);
			this.render_discount_dom(item);
			this.render_form(item);
			this.events.highlight_cart_item(item);
		} else {
			this.current_item = {};
		}
	}

	validate_serial_batch_item() {
		try {
			const doc = this.events.get_frm().doc;
			const item_row = doc.items.find(item => item.name === this.name);

			if (!item_row) {
				console.warn('Item row not found for validation');
				return;
			}

			const serialized = item_row.has_serial_no;
			const batched = item_row.has_batch_no;
			const no_bundle_selected = !item_row.serial_and_batch_bundle;

			if ((serialized && no_bundle_selected) || (batched && no_bundle_selected)) {
				frappe.show_alert({
					message: __("Item is removed since no serial / batch no selected."),
					indicator: 'orange'
				});
				frappe.utils.play_sound("cancel");
				return this.events.remove_item_from_cart();
			}
		} catch (error) {
			console.error('Error in validate_serial_batch_item:', error);
			frappe.show_alert({
				message: __('Error validating serial/batch item'),
				indicator: 'red'
			});
		}
	}

	render_dom(item) {
		let { item_name, description, image, price_list_rate } = item;

		function get_description_html() {
			if (description) {
				description = description.indexOf('...') === -1 && description.length > 140 ? description.substr(0, 139) + '...' : description;
				return description;
			}
			return ``;
		}

		this.$item_name.html(item_name);
		this.$item_description.html(get_description_html());
		this.$item_price.html(format_currency(price_list_rate, this.currency));
		if (!this.hide_images && image) {
			this.$item_image.html(
				`<img
					onerror="cur_pos.item_details.handle_broken_image(this)"
					class="h-full" src="${image}"
					alt="${frappe.get_abbr(item_name)}"
					style="object-fit: cover;">`
			);
		} else {
			this.$item_image.html(`<div class="item-abbr">${frappe.get_abbr(item_name)}</div>`);
		}

	}

	handle_broken_image($img) {
		const item_abbr = $($img).attr('alt');
		$($img).replaceWith(`<div class="item-abbr">${item_abbr}</div>`);
	}

	render_discount_dom(item) {
		if (item.discount_percentage) {
			this.$dicount_section.html(
				`<div class="item-rate">${format_currency(item.price_list_rate, this.currency)}</div>
				<div class="item-discount">${item.discount_percentage}% off</div>`
			)
			this.$item_price.html(format_currency(item.rate, this.currency));
		} else {
			this.$dicount_section.html(``)
		}
	}

	render_form(item) {
		const fields_to_display = this.get_form_fields(item);
		this.$form_container.html('');

		fields_to_display.forEach(async (fieldname, idx) => {
			this.$form_container.append(
				`<div class="${fieldname}-control" data-fieldname="${fieldname}"></div>`
			)

			const field_meta = this.item_meta.fields.find(df => df.fieldname === fieldname);
			fieldname === 'discount_percentage' ? (field_meta.label = __('Discount (%)')) : '';
			const me = this;

			// Enhanced UOM handling with proper async/await
			let uoms = [];
			if (fieldname === 'uom') {
				try {
					const doc = await frappe.db.get_doc("Item", me.current_item.item_code);
					uoms = doc.uoms ? doc.uoms.map(item => item.uom) : [];
				} catch (error) {
					console.warn('Failed to fetch UOMs for item:', me.current_item.item_code, error);
				}
			}

			this[`${fieldname}_control`] = frappe.ui.form.make_control({
				df: {
					...field_meta,
					onchange: function() {
						me.events.form_updated(me.current_item, fieldname, this.value);
					},
					get_query: function () {
						if (fieldname === 'uom') {
							return {
								filters: {
									name: ['in', uoms]
								}
							}
						}
						return;
					}
				},
				parent: this.$form_container.find(`.${fieldname}-control`),
				render_input: true,
			})
			this[`${fieldname}_control`].set_value(item[fieldname]);
		});

		this.make_auto_serial_selection_btn(item);
		this.bind_custom_control_change_event();
	}

	get_form_fields(item) {
		const fields = ['qty', 'uom', 'rate', 'conversion_factor', 'discount_percentage', 'warehouse', 'actual_qty', 'price_list_rate'];
		if (item.has_serial_no) fields.push('serial_no');
		if (item.has_batch_no) fields.push('batch_no');
		return fields;
	}

	make_auto_serial_selection_btn(item) {
		if (item.has_serial_no || item.has_batch_no) {
			const label = item.has_serial_no ? __('Select Serial No') : __('Select Batch No');
			this.$form_container.append(
				`<div class="btn btn-sm btn-secondary auto-fetch-btn">${label}</div>`
			);
			this.$form_container.find('.serial_no-control').find('textarea').css('height', '6rem');
		}
	}

	bind_custom_control_change_event() {
		const me = this;
		if (this.rate_control) {
			this.rate_control.df.onchange = function() {
				if (this.value || flt(this.value) === 0) {
					me.events.form_updated(me.current_item, 'rate', this.value).then(() => {
						const item_row = frappe.get_doc(me.doctype, me.name);
						const doc = me.events.get_frm().doc;
						me.$item_price.html(format_currency(item_row.rate, doc.currency));
						me.render_discount_dom(item_row);
					});
				}
			};
			this.rate_control.df.read_only = !this.allow_rate_change;
			this.rate_control.refresh();
		}

		if (this.discount_percentage_control && !this.allow_discount_change) {
			this.discount_percentage_control.df.read_only = 1;
			this.discount_percentage_control.refresh();
		}

		if (this.warehouse_control) {
			this.warehouse_control.df.reqd = 1;
			this.warehouse_control.df.onchange = function() {
				if (this.value) {
					me.events.form_updated(me.current_item, 'warehouse', this.value).then(() => {
						try {
							me.item_stock_map = me.events.get_item_stock_map();

							// Add safety checks for stock map structure
							if (!me.item_stock_map || !me.item_stock_map[me.item_row.item_code]) {
								console.warn('Stock map not available for item:', me.item_row.item_code);
								// Fetch stock data if not available
								me.events.get_available_stock(me.item_row.item_code, this.value).then(() => {
									// Trigger onchange again after stock data is fetched
									me.warehouse_control.set_value(this.value);
								});
								return;
							}

							let stock_info = me.item_stock_map[me.item_row.item_code][this.value];

							// Handle the case where stock_info is undefined/null
							if (stock_info === undefined || stock_info === null) {
								// Fetch stock data and retry
								me.events.get_available_stock(me.item_row.item_code, this.value).then(() => {
									// Trigger onchange again after stock data is fetched
									me.warehouse_control.set_value(this.value);
								});
								return;
							}

							// Handle both array and object formats for backward compatibility
							let available_qty, is_stock_item;
							if (Array.isArray(stock_info)) {
								// Handle array format: [qty, is_stock_item] or [{warehouse: qty}, is_stock_item]
								if (typeof stock_info[0] === 'object' && stock_info[0] !== null) {
									// Custom posnext format: [{warehouse: qty}, is_stock_item]
									const warehouse_qty_obj = stock_info[0];
									available_qty = warehouse_qty_obj[this.value] || warehouse_qty_obj[warehouse] || 0;
									is_stock_item = Boolean(stock_info[1]);
								} else {
									// Standard ERPNext format: [qty, is_stock_item]
									available_qty = stock_info[0];
									is_stock_item = Boolean(stock_info[1]);
								}
							} else if (typeof stock_info === 'object' && stock_info !== null) {
								// Handle object format - check multiple possible property names
								available_qty = stock_info.qty !== undefined ? stock_info.qty :
									(stock_info.actual_qty !== undefined ? stock_info.actual_qty :
									(stock_info.available_qty !== undefined ? stock_info.available_qty : 0));
								is_stock_item = Boolean(stock_info.is_stock_item || stock_info.has_stock || stock_info.stock_item);
							} else if (typeof stock_info === 'number') {
								// Handle case where stock_info is just a number (quantity)
								available_qty = stock_info;
								is_stock_item = true; // Assume it's stock item if we have a number
							} else {
								available_qty = 0;
								is_stock_item = false;
							}

							// Validate that available_qty is a proper number
							if (isNaN(available_qty) || available_qty === null || available_qty === undefined) {
								console.warn('Invalid available_qty:', available_qty, 'for stock_info:', stock_info);
								available_qty = 0;
							}

							if (available_qty === 0 && is_stock_item) {
								me.warehouse_control.set_value('');
								const bold_item_code = me.item_row.item_code.bold();
								const bold_warehouse = this.value.bold();
								frappe.throw(
									__('Item Code: {0} is not available under warehouse {1}.', [bold_item_code, bold_warehouse])
								);
							}

							// Ensure we set a valid numeric value
							const qty_to_set = typeof available_qty === 'number' ? available_qty : parseFloat(available_qty) || 0;

							if (me.actual_qty_control) {
								me.actual_qty_control.set_value(qty_to_set);
							}
						} catch (error) {
							console.error('Error updating warehouse stock info:', error);
							// Always set a safe default value to prevent [object Object] display
							if (me.actual_qty_control) {
								me.actual_qty_control.set_value(0);
							}
						}
					});
				}
			}
			this.warehouse_control.df.get_query = () => {
				return {
					filters: { company: this.events.get_frm().doc.company }
				}
			};
			this.warehouse_control.refresh();
		}

		if (this.serial_no_control) {
			this.serial_no_control.df.reqd = 1;
			this.serial_no_control.df.onchange = async function() {
				!me.current_item.batch_no && await me.auto_update_batch_no();
				me.events.form_updated(me.current_item, 'serial_no', this.value);
			}
			this.serial_no_control.refresh();
		}

		if (this.batch_no_control) {
			this.batch_no_control.df.reqd = 1;
			this.batch_no_control.df.get_query = () => {
				return {
					query: 'erpnext.controllers.queries.get_batch_no',
					filters: {
						item_code: me.item_row.item_code,
						warehouse: me.item_row.warehouse,
						posting_date: me.events.get_frm().doc.posting_date
					}
				}
			};
			this.batch_no_control.refresh();
		}

		if (this.uom_control) {
			this.uom_control.df.onchange = function() {
				me.events.form_updated(me.current_item, 'uom', this.value);

				const item_row = frappe.get_doc(me.doctype, me.name);
				me.conversion_factor_control.df.read_only = (item_row.stock_uom == this.value);
				me.conversion_factor_control.refresh();
			}
		}

		frappe.model.on("POS Invoice Item", "*", (fieldname, value, item_row) => {
			const field_control = this[`${fieldname}_control`];
			const item_row_is_being_edited = this.compare_with_current_item(item_row);

			if (item_row_is_being_edited && field_control && field_control.get_value() !== value) {
				field_control.set_value(value);
				cur_pos.update_cart_html(item_row);
			}
		});
	}

	async auto_update_batch_no() {
		if (this.serial_no_control && this.batch_no_control) {
			const selected_serial_nos = this.serial_no_control.get_value().split(`\n`).filter(s => s);
			if (!selected_serial_nos.length) return;

			try {
				// find batch nos of the selected serial no
				const serials_with_batch_no = await frappe.db.get_list("Serial No", {
					filters: { 'name': ["in", selected_serial_nos]},
					fields: ["batch_no", "name"]
				});

				if (!serials_with_batch_no || serials_with_batch_no.length === 0) {
					console.warn('No serial numbers found with batch information');
					return;
				}

				const batch_serial_map = serials_with_batch_no.reduce((acc, r) => {
					if (!acc[r.batch_no]) {
						acc[r.batch_no] = [];
					}
					acc[r.batch_no] = [...acc[r.batch_no], r.name];
					return acc;
				}, {});

				// set current item's batch no and serial no
				const batch_no = Object.keys(batch_serial_map)[0];
				const batch_serial_nos = batch_serial_map[batch_no].join(`\n`);
				// eg. 10 selected serial no. -> 5 belongs to first batch other 5 belongs to second batch
				const serial_nos_belongs_to_other_batch = selected_serial_nos.length !== batch_serial_map[batch_no].length;

				const current_batch_no = this.batch_no_control.get_value();
				if (current_batch_no != batch_no) {
					await this.batch_no_control.set_value(batch_no);
				}

				if (serial_nos_belongs_to_other_batch) {
					this.serial_no_control.set_value(batch_serial_nos);
					this.qty_control.set_value(batch_serial_map[batch_no].length);

					delete batch_serial_map[batch_no];
					this.events.clone_new_batch_item_in_frm(batch_serial_map, this.current_item);
				}
			} catch (error) {
				console.error('Error in auto_update_batch_no:', error);
				frappe.show_alert({
					message: __('Error updating batch information'),
					indicator: 'red'
				});
			}
		}
	}

	bind_events() {
		this.bind_auto_serial_fetch_event();
		this.bind_fields_to_numpad_fields();

		this.$component.on('click', '.close-btn', () => {
			this.events.close_item_details();
		});
	}

	attach_shortcuts() {
		this.wrapper.find('.close-btn').attr("title", "Esc");
		frappe.ui.keys.on("escape", () => {
			const item_details_visible = this.$component.is(":visible");
			if (item_details_visible) {
				this.events.close_item_details();
			}
		});
	}

	bind_fields_to_numpad_fields() {
		const me = this;
		this.$form_container.on('click', '.input-with-feedback', function() {
			const fieldname = $(this).attr('data-fieldname');
			if (this.last_field_focused != fieldname) {
				me.events.item_field_focused(fieldname);
				this.last_field_focused = fieldname;
			}
		});
	}

	bind_auto_serial_fetch_event() {
		this.$form_container.on('click', '.auto-fetch-btn', () => {
			try {
				frappe.require("assets/erpnext/js/utils/serial_no_batch_selector.js", () => {
					let frm = this.events.get_frm();
					let item_row = this.item_row;
					item_row.type_of_transaction = "Outward";

					new erpnext.SerialBatchPackageSelector(frm, item_row, (r) => {
						if (r) {
							try {
								frappe.model.set_value(item_row.doctype, item_row.name, {
									"serial_and_batch_bundle": r.name,
									"qty": Math.abs(r.total_qty)
								});
							} catch (error) {
								console.error('Error setting serial/batch bundle:', error);
								frappe.show_alert({
									message: __('Error setting serial/batch information'),
									indicator: 'red'
								});
							}
						}
					});
				});
			} catch (error) {
				console.error('Error in auto serial fetch:', error);
				frappe.show_alert({
					message: __('Error opening serial/batch selector'),
					indicator: 'red'
				});
			}
		})
	}

	toggle_component(show) {
		show ? this.$component.css('display', 'flex') : this.$component.css('display', 'none');
	}
}
