frappe.provide('posnext.PointOfSale');
var view = "List"
import onScan from "onscan.js";

posnext.PointOfSale.ItemSelector = class {
	// eslint-disable-next-line no-unused-vars
	constructor({ frm, wrapper, events, pos_profile, settings,currency,init_item_cart,reload_status }) {
		this.wrapper = wrapper;
		this.events = events;
		this.currency = currency;
		this.pos_profile = pos_profile;
		this.hide_images = settings.hide_images;
		this.reload_status = reload_status
		this.auto_add_item = settings.auto_add_item_to_cart;
		if(settings.custom_default_view){
			view = settings.custom_default_view
		}
		if(settings.custom_show_only_list_view){
			view = "List"
		}
		if(settings.custom_show_only_card_view){
			view = "Card"
		}
		this.custom_show_item_code = settings.custom_show_item_code
		this.show_only_list_view = settings.custom_show_only_list_view
		this.show_only_card_view = settings.custom_show_only_card_view
		this.inti_component();
	}

	inti_component() {

		this.prepare_dom();
		this.make_search_bar();
		this.load_items_data();
		this.bind_events();
		this.attach_shortcuts();
	}

	prepare_dom() {
		if(view === "Card" && !this.show_only_list_view){

			this.wrapper.append(
				`<section class="items-selector" id="card-view-section">
					<div class="filter-section">
						<div class="label" style="grid-column: span 2 / span 2">${__('All Items')}</div>
						<div class="list-view"><a class="list-span">List</a></div>
						<div class="card-view"><a class="card-span">Card</a></div>
						<div class="pos-profile" style="grid-column: span 2 / span 2"></div>
						<div class="search-field" style="grid-column: span 2 / span 2"></div>
						<div class="item-group-field"></div>
					</div>
					<div class="items-container"></div>
				</section>`
			);

			this.$component = this.wrapper.find('.items-selector');
			this.$items_container = this.$component.find('.items-container');
		} else if(view === "List" && !this.show_only_card_view) {

			this.wrapper.append(
				`<section class="customer-cart-container items-selector" id="list-view-section" style="grid-column: span 6 / span 6;overflow-y:hidden">
					<div class="filter-section">
						<div class="label" style="grid-column: span 2 / span 2">${__('All Items')}</div>
						<div class="list-view"><a class="list-span">List</a></div>
						<div class="card-view"><a class="card-span">Card</a></div>
						<div class="pos-profile" style="grid-column: span 2 / span 2"></div>
						<div class="search-field" style="grid-column: span 2 / span 2"></div>
						<div class="item-group-field"></div>
					</div>
					<div class="cart-container"></div>
				</section>`
			);

			this.$component = this.wrapper.find('.customer-cart-container');
			this.$items_container = this.$component.find('.cart-container');
		}

		this.$list_view = this.$component.find('.list-view');
		this.$card_view = this.$component.find('.card-view');
		if(view === "List" && !this.show_only_list_view){
			this.$list_view.find('.list-span').css({"display": "inline-block","background-color": "#3498db","color": "white","padding": "5px 10px", "border-radius": "20px", "font-size": "14px","font-weight": "bold", "text-transform": "uppercase","letter-spacing": "1px","cursor": "pointer", "transition": "background-color 0.3s ease"});
			this.$card_view.find('.card-span').css({"display":  "","background-color": "","color": "","padding": "", "border-radius": "", "font-size": "","font-weight": "", "text-transform": "","letter-spacing": "","cursor": "", "transition": ""});
		} else if(view === "Card" && !this.show_only_card_view){
			this.$card_view.find('.card-span').css({"display": "inline-block","background-color": "#3498db","color": "white","padding": "5px 10px", "border-radius": "20px", "font-size": "14px","font-weight": "bold", "text-transform": "uppercase","letter-spacing": "1px","cursor": "pointer", "transition": "background-color 0.3s ease"});
			this.$list_view.find('.list-span').css({"display":  "","background-color": "","color": "","padding": "", "border-radius": "", "font-size": "","font-weight": "", "text-transform": "","letter-spacing": "","cursor": "", "transition": ""});
		} else {
			this.$list_view.find('.list-span').css({"display": "none"});
			this.$card_view.find('.card-span').css({"display":  "none"});

		}
		if(!this.show_only_card_view && !this.show_only_list_view){
			this.click_functions()
		}
	}
	click_functions(){
		this.$list_view.on('click', 'a', () => {

			this.$list_view.find('.list-span').css({"display": "inline-block","background-color": "#3498db","color": "white","padding": "5px 10px", "border-radius": "20px", "font-size": "14px","font-weight": "bold", "text-transform": "uppercase","letter-spacing": "1px","cursor": "pointer", "transition": "background-color 0.3s ease"});
			this.$card_view.find('.card-span').css({"display": "","background-color": "","color": "","padding": "", "border-radius": "", "font-size": "","font-weight": "", "text-transform": "","letter-spacing": "","cursor": "", "transition": ""});
			view = "List"
			if(document.getElementById("card-view-section")) document.getElementById("card-view-section").remove()
			if(document.getElementById("list-view-section")) document.getElementById("list-view-section").remove()
			if(document.getElementById("customer-cart-container2")) document.getElementById("customer-cart-container2").remove()
			if(document.getElementById("item-details-container")) document.getElementById("item-details-container").remove()

			this.inti_component()
			this.events.init_item_details()
			this.events.init_item_cart()
			this.events.change_items(this.events.get_frm())


		});
		this.$card_view.on('click', 'a', () => {
			this.$card_view.find('.card-span').css({"display": "inline-block","background-color": "#3498db","color": "white","padding": "5px 10px", "border-radius": "20px", "font-size": "14px","font-weight": "bold", "text-transform": "uppercase","letter-spacing": "1px","cursor": "pointer", "transition": "background-color 0.3s ease"});
			this.$list_view.find('.list-span').css({"display": "","background-color": "","color": "","padding": "", "border-radius": "", "font-size": "","font-weight": "", "text-transform": "","letter-spacing": "","cursor": "", "transition": ""});
			view = "Card"
			if(document.getElementById("card-view-section")) document.getElementById("card-view-section").remove()
			if(document.getElementById("list-view-section")) document.getElementById("list-view-section").remove()
			if(document.getElementById("customer-cart-container2")) document.getElementById("customer-cart-container2").remove()
			if(document.getElementById("item-details-container")) document.getElementById("item-details-container").remove()

			this.inti_component()
			this.events.init_item_details()
			this.events.init_item_cart()
			this.events.change_items(this.events.get_frm())

		});
	}
	async load_items_data() {
		if (!this.item_group) {
			const res = await frappe.db.get_value("Item Group", {lft: 1, is_group: 1}, "name");
			this.parent_item_group = res.message.name;
		}
		if (!this.price_list) {
			const res = await frappe.db.get_value("POS Profile", this.pos_profile, "selling_price_list");
			this.price_list = res.message.selling_price_list;
		}

		this.get_items({}).then(({message}) => {
			this.render_item_list(message.items);
		});
	}

	get_items({start = 0, page_length = 40, search_term=''}) {
		const doc = this.events.get_frm().doc;
		const price_list = (doc && doc.selling_price_list) || this.price_list;
		let { item_group, pos_profile } = this;

		!item_group && (item_group = this.parent_item_group);

		return frappe.call({
			method: "erpnext.selling.page.point_of_sale.point_of_sale.get_items",
			freeze: true,
			args: { start, page_length, price_list, item_group, search_term, pos_profile },
		});
	}


	render_item_list(items) {
		var  me  = this
		if(view === "List"){
		this.$items_container.html('');
			this.$items_container.append(
				`<div class="abs-cart-container" style="overflow-y:hidden">
					<div class="cart-header">
					${get_item_code_header()}
						<div style="flex: 1">${__('Rate')}</div>
						<div style="flex: 1">${__('Available Qty')}</div>
						<div class="qty-header">${__('UOM')}</div>
					</div>
					<div class="cart-items-section" style="overflow-y:hidden"></div>
				</div>`)

			function get_item_code_header() {

				if(me.custom_show_item_code){
					return `<div style="flex: 2">${__('Item')}</div>
						<div style="flex: 1">${__('Item Code')}</div>`
				} else {
					return `<div style="flex: 3">${__('Item')}</div>`
				}
            }
			this.make_cart_items_section();
			items.forEach(item => {

				this.render_cart_item(item);

				// this.$items_container.append(item_html);
			});
		} else {
			items.forEach(item => {
                var item_html = this.get_item_html(item);
                this.$items_container.append(item_html);
        	})
		}

		// this.$cart_container = this.$component.find('.cart-container');


	}
	make_cart_items_section() {
		this.$cart_header = this.$component.find('.cart-header');
		this.$cart_items_wrapper = this.$component.find('.cart-items-section');

	}
	get_cart_item({ name }) {
		const item_selector = `.cart-item-wrapper[data-row-name="${escape(name)}"]`;
		return this.$cart_items_wrapper.find(item_selector);
	}
	get_cart_item1({ item_code }) {
		const item_selector = `.cart-item-wrapper[data-row-name="${escape(item_code)}"]`;
		return this.$cart_items_wrapper.find(item_selector);
	}
	render_cart_item(item_data) {

		const me = this;
		const currency = me.events.get_frm().currency || me.currency;
		this.$cart_items_wrapper.append(
			`<div class="cart-item-wrapper item-wrapper" 
			data-item-code="${escape(item_data.item_code)}" 
			data-serial-no="${escape(item_data.serial_no)}"
			data-batch-no="${escape(item_data.batch_no)}" 
			data-uom="${escape(item_data.uom)}"
			data-rate="${escape(item_data.price_list_rate || 0)}"
			title="${item_data.item_name}"
			data-row-name="${escape(item_data.item_code)}"></div>
			<div class="seperator"></div>`
		)
		var $item_to_update = this.get_cart_item1(item_data);

		$item_to_update.html(
			`${get_item_image_html()}
			${get_item_name()}
				<div class="item-name" >
					${item_data.item_name}
				</div>
				${get_description_html()}
			</div>
			${get_item_code()}
			${get_rate_discount_html()}`
		)
			function get_item_name() {
			if(me.custom_show_item_code){
				return `<div class="item-name-desc" style="flex: 3">`
			} else {
				return `<div class="item-name-desc" style="flex: 4">`
			}
        }
        function get_item_code() {
			if(me.custom_show_item_code){
				return `<div class="item-code-desc" style="flex: 1">
					<div class="item-code" >
						${item_data.item_code}
					</div>
				</div>`
			} else {
				return ``
			}
        }
		set_dynamic_rate_header_width();

		function set_dynamic_rate_header_width() {
			const rate_cols = Array.from(me.$cart_items_wrapper.find(".item-rate-amount"));
			me.$cart_header.find(".rate-amount-header").css("width", "");
			me.$cart_items_wrapper.find(".item-rate-amount").css("width", "");
			var max_width = rate_cols.reduce((max_width, elm) => {
				if ($(elm).width() > max_width)
					max_width = $(elm).width();
				return max_width;
			}, 0);

			max_width += 1;
			if (max_width == 1) max_width = "";

			me.$cart_header.find(".rate-amount-header").css("width", max_width);
			me.$cart_items_wrapper.find(".item-rate-amount").css("width", max_width);
		}

		function get_rate_discount_html() {
			if (item_data.rate && item_data.amount && item_data.rate !== item_data.amount) {
				return `
					<div class="item-qty-rate" style="flex: 5">
						<div class="item-rate-amount" style="flex: 1">
							<div class="item-rate" style="text-align: center">${format_currency(item_data.price_list_rate, currency)}</div>
						</div>
						<div class="item-qty" style="flex: 1;display:block;text-align: center"><span> ${item_data.actual_qty || 0}</span></div>
						<div class="item-qty" style="margin: 0"><span> ${item_data.uom}</span></div>
						
					</div>`
			} else {
				return `
					<div class="item-qty-rate" style="flex: 5">
						<div class="item-rate-amount" style="flex: 1">
							<div class="item-rate" style="text-align: center">${format_currency(item_data.price_list_rate, currency)}</div>
						</div>
						<div class="item-qty" style="flex: 1;display:block;text-align: center"><span> ${item_data.actual_qty || 0}</span></div>
						<div class="item-qty" style="margin: 0"><span> ${item_data.uom}</span></div>
						
					</div>`
			}
		}

		function get_description_html() {
			if (item_data.description) {
				if (item_data.description.indexOf('<div>') != -1) {
					try {
						item_data.description = $(item_data.description).text();
					} catch (error) {
						item_data.description = item_data.description.replace(/<div>/g, ' ').replace(/<\/div>/g, ' ').replace(/ +/g, ' ');
					}
				}
				item_data.description = frappe.ellipsis(item_data.description, 45);
				return `<div class="item-desc">${item_data.description}</div>`;
			}
			return ``;
		}

		function get_item_image_html() {
			const { image, item_name } = item_data;
			if (!me.hide_images && image) {
				return `
					<div class="item-image">
						<img
							onerror="cur_pos.cart.handle_broken_image(this)"
							src="${image}" alt="${frappe.get_abbr(item_name)}"">
					</div>`;
			} else {
				return `<div class="item-image item-abbr">${frappe.get_abbr(item_name)}</div>`;
			}
		}
	}
	get_item_html(item) {
		const me = this;
		item.currency = item.currency  || me.currency
		// eslint-disable-next-line no-unused-vars
		const { item_image, serial_no, batch_no, barcode, actual_qty, uom, price_list_rate } = item;
		const precision = flt(price_list_rate, 2) % 1 != 0 ? 2 : 0;
		let indicator_color;
		let qty_to_display = actual_qty;

		if (item.is_stock_item) {
			indicator_color = (actual_qty > 10 ? "green" : actual_qty <= 0 ? "red" : "orange");

			if (Math.round(qty_to_display) > 999) {
				qty_to_display = Math.round(qty_to_display)/1000;
				qty_to_display = qty_to_display.toFixed(1) + 'K';
			}
		} else {
			indicator_color = '';
			qty_to_display = '';
		}

		function get_item_image_html() {
			if (!me.hide_images && item_image) {
				return `<div class="item-qty-pill">
							<span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
						</div>
						<div class="flex items-center justify-center h-32 border-b-grey text-6xl text-grey-100">
							<img
								onerror="cur_pos.item_selector.handle_broken_image(this)"
								class="h-full item-img" src="${item_image}"
								alt="${frappe.get_abbr(item.item_name)}"
							>
						</div>`;
			} else {
				return `<div class="item-qty-pill">
							<span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
						</div>
						<div class="item-display abbr">${frappe.get_abbr(item.item_name)}</div>`;
			}
		}

		return (
			`<div class="item-wrapper"
				data-item-code="${escape(item.item_code)}" data-serial-no="${escape(serial_no)}"
				data-batch-no="${escape(batch_no)}" data-uom="${escape(uom)}"
				data-rate="${escape(price_list_rate || 0)}"
				title="${item.item_name}">

				${get_item_image_html()}

				<div class="item-detail">
					<div class="item-name">
						${frappe.ellipsis(item.item_name, 18)}
					</div>
					<div class="item-rate">${format_currency(price_list_rate, item.currency, precision) || 0} / ${uom}</div>
				</div>
			</div>`
		);
	}

	handle_broken_image($img) {
		const item_abbr = $($img).attr('alt');
		$($img).parent().replaceWith(`<div class="item-display abbr">${item_abbr}</div>`);
	}

	make_search_bar() {
		const me = this;
		const doc = me.events.get_frm().doc;
		this.$component.find('.search-field').html('');
		this.$component.find('.pos-profile').html('');
		this.$component.find('.item-group-field').html('');
		this.pos_profile_field = frappe.ui.form.make_control({
			df: {
				label: __('POS Profile'),
				fieldtype: 'Link',
				options: 'POS Profile',
				placeholder: __('POS Profile'),
                onchange: function () {

					if(me.reload_status && me.pos_profile !== this.value){
						frappe.pages['posnext'].refresh(window.wrapper,window.onScan,this.value)
					}

					// console.log("ON ON CHANGE")
					// console.log(this.pos_profile_field)
					// var value = this.pos_profile_field.get_value()
					// if(value !== me.pos_profile){
					// 	this.events.check_opening_entry()
					// }
					// window.wrapper.please_refresh = true
					// frappe.pages['posnext'].refresh_data(window.wrapper)
					// console.log("HEEEERE")
                }
			},
			parent: this.$component.find('.pos-profile'),
			render_input: false,
		});
		this.search_field = frappe.ui.form.make_control({
			df: {
				label: __('Search'),
				fieldtype: 'Data',
				placeholder: __('Search by item code, serial number or barcode')
			},
			parent: this.$component.find('.search-field'),
			render_input: true,
		});
		this.item_group_field = frappe.ui.form.make_control({
			df: {
				label: __('Item Group'),
				fieldtype: 'Link',
				options: 'Item Group',
				placeholder: __('Select item group'),
				onchange: function() {
					me.item_group = this.value;
					!me.item_group && (me.item_group = me.parent_item_group);
					me.filter_items();
				},
				get_query: function () {
					//const doc = me.events.get_frm().doc;
					return {
						query: 'erpnext.selling.page.point_of_sale.point_of_sale.item_group_query',
						filters: {
							pos_profile: doc ? doc.pos_profile : ''
						}
					};
				},
			},
			parent: this.$component.find('.item-group-field'),
			render_input: true,
		});
		this.pos_profile_field.set_value(me.pos_profile)
		this.pos_profile_field.refresh()
		this.pos_profile_field.toggle_label(false);
		this.search_field.toggle_label(false);
		this.item_group_field.toggle_label(false);

		this.attach_clear_btn();
	}

	attach_clear_btn() {
		this.search_field.$wrapper.find('.control-input').append(
			`<span class="link-btn" style="top: 2px;">
				<a class="btn-open no-decoration" title="${__("Clear")}">
					${frappe.utils.icon('close', 'sm')}
				</a>
			</span>`
		);

		this.$clear_search_btn = this.search_field.$wrapper.find('.link-btn');

		this.$clear_search_btn.on('click', 'a', () => {
			this.set_search_value('');
			this.search_field.set_focus();
		});
	}

	set_search_value(value) {
		$(this.search_field.$input[0]).val(value).trigger("input");
	}

	bind_events() {
		const me = this;
			window.onScan = onScan;

			onScan.decodeKeyEvent = function (oEvent) {
				var iCode = this._getNormalizedKeyNum(oEvent);
				switch (true) {
					case iCode >= 48 && iCode <= 90: // numbers and letters
					case iCode >= 106 && iCode <= 111: // operations on numeric keypad (+, -, etc.)
					case (iCode >= 160 && iCode <= 164) || iCode == 170: // ^ ! # $ *
					case iCode >= 186 && iCode <= 194: // (; = , - . / `)
					case iCode >= 219 && iCode <= 222: // ([ \ ] ')
					case iCode == 32: // spacebar
						if (oEvent.key !== undefined && oEvent.key !== '') {
							return oEvent.key;
						}

						var sDecoded = String.fromCharCode(iCode);
						switch (oEvent.shiftKey) {
							case false: sDecoded = sDecoded.toLowerCase(); break;
							case true: sDecoded = sDecoded.toUpperCase(); break;
						}
						return sDecoded;
					case iCode >= 96 && iCode <= 105: // numbers on numeric keypad
						return 0 + (iCode - 96);
				}
				return '';
			};

			onScan.attachTo(document, {
				onScan: (sScancode) => {
					if (this.search_field && this.$component.is(':visible')) {
						this.search_field.set_focus();
						this.set_search_value(sScancode);
						this.barcode_scanned = true;
					}
				}
			});
		
		this.$component.on('click', '.item-wrapper', function() {
			const $item = $(this);
			const item_code = unescape($item.attr('data-item-code'));
			let batch_no = unescape($item.attr('data-batch-no'));
			let serial_no = unescape($item.attr('data-serial-no'));
			let uom = unescape($item.attr('data-uom'));
			let rate = unescape($item.attr('data-rate'));

			// escape(undefined) returns "un	defined" then unescape returns "undefined"
			batch_no = batch_no === "undefined" ? undefined : batch_no;
			serial_no = serial_no === "undefined" ? undefined : serial_no;
			uom = uom === "undefined" ? undefined : uom;
			rate = rate === "undefined" ? undefined : rate;
			me.events.item_selected({
				field: 'qty',
				value: "+1",
				item: { item_code, batch_no, serial_no, uom, rate }
			});
			me.search_field.set_focus();
		});

		this.search_field.$input.on('input', (e) => {
			clearTimeout(this.last_search);
			this.last_search = setTimeout(() => {
				const search_term = e.target.value;
				this.filter_items({ search_term });
			}, 300);

			this.$clear_search_btn.toggle(
				Boolean(this.search_field.$input.val())
			);
		});

		this.search_field.$input.on('focus', () => {
			this.$clear_search_btn.toggle(
				Boolean(this.search_field.$input.val())
			);
		});
	}

	attach_shortcuts() {
		const ctrl_label = frappe.utils.is_mac() ? '⌘' : 'Ctrl';
		this.search_field.parent.attr("title", `${ctrl_label}+I`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+i",
			action: () => this.search_field.set_focus(),
			condition: () => this.$component.is(':visible'),
			description: __("Focus on search input"),
			ignore_inputs: true,
			page: cur_page.page.page
		});
		this.item_group_field.parent.attr("title", `${ctrl_label}+G`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+g",
			action: () => this.item_group_field.set_focus(),
			condition: () => this.$component.is(':visible'),
			description: __("Focus on Item Group filter"),
			ignore_inputs: true,
			page: cur_page.page.page
		});

		// for selecting the last filtered item on search
		frappe.ui.keys.on("enter", () => {
			const selector_is_visible = this.$component.is(':visible');
			if (!selector_is_visible || this.search_field.get_value() === "") return;

			if (this.items.length == 1) {
				this.$items_container.find(".item-wrapper").click();
				frappe.utils.play_sound("submit");
				this.set_search_value('');
			} else if (this.items.length == 0 && this.barcode_scanned) {
				// only show alert of barcode is scanned and enter is pressed
				frappe.show_alert({
					message: __("No items found. Scan barcode again."),
					indicator: 'orange'
				});
				frappe.utils.play_sound("error");
				this.barcode_scanned = false;
				this.set_search_value('');
			}
		});
	}

	filter_items({ search_term='' }={}) {
		if (search_term) {
			search_term = search_term.toLowerCase();

			// memoize
			this.search_index = this.search_index || {};
			if (this.search_index[search_term]) {
				const items = this.search_index[search_term];
				this.items = items;
				this.render_item_list(items);
				this.auto_add_item && this.items.length == 1 && this.add_filtered_item_to_cart();
				return;
			}
		}

		this.get_items({ search_term })
			.then(({ message }) => {
				// eslint-disable-next-line no-unused-vars
				const { items, serial_no, batch_no, barcode } = message;
				if (search_term && !barcode) {
					this.search_index[search_term] = items;
				}
				this.items = items;
				this.render_item_list(items);
				this.auto_add_item && this.items.length == 1 && this.add_filtered_item_to_cart();
			});
	}

	add_filtered_item_to_cart() {
		this.$items_container.find(".item-wrapper").click();
		this.set_search_value('');
	}

	resize_selector(minimize) {
		minimize ?
			this.$component.find('.filter-section').css('grid-template-columns', 'repeat(1, minmax(0, 1fr))') :
			this.$component.find('.filter-section').css('grid-template-columns', 'repeat(12, minmax(0, 1fr))');

		minimize ?
			this.$component.find('.search-field').css('margin', 'var(--margin-sm) 0px') :
			this.$component.find('.search-field').css('margin', '0px var(--margin-sm)');

		minimize ?
			this.$component.css('grid-column', 'span 2 / span 2') :
			this.$component.css('grid-column', 'span 6 / span 6');

		minimize ?
			this.$items_container.css('grid-template-columns', 'repeat(1, minmax(0, 1fr))') :
			this.$items_container.css('grid-template-columns', 'repeat(4, minmax(0, 1fr))');
	}

	toggle_component(show) {
		this.set_search_value('');
		this.$component.css('display', show ? 'flex': 'none');
	}
};
