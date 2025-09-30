frappe.ui.form.on('Hotel Room Package', {
	refresh: function(frm) {
		// Add custom buttons
		if (!frm.doc.__islocal) {
			frm.add_custom_button(__('Create Item'), function() {
				frappe.call({
					method: 'create_package_item',
					doc: frm.doc,
					callback: function(r) {
						if (r.message) {
							frm.set_value('item', r.message);
							frm.refresh_field('item');
							frappe.msgprint(__('Item created successfully'));
						}
					}
				});
			});

			frm.add_custom_button(__('Test Pricing'), function() {
				show_pricing_test_dialog(frm);
			});
		}

		// Set filters for child tables
		frm.set_query('item', 'amenities', function() {
			return {
				filters: {
					is_stock_item: 1
				}
			};
		});
	},

	hotel_room_type: function(frm) {
		if (frm.doc.hotel_room_type) {
			// Auto-set max occupancy from room type
			frappe.db.get_value('Room Type', frm.doc.hotel_room_type, 'max_occupancy', function(r) {
				if (r && r.max_occupancy && !frm.doc.max_occupancy) {
					frm.set_value('max_occupancy', r.max_occupancy);
				}
			});
		}
	},

	base_rate: function(frm) {
		// Update item rate if item exists
		if (frm.doc.item && frm.doc.base_rate) {
			frappe.db.set_value('Item', frm.doc.item, 'standard_rate', frm.doc.base_rate);
		}
	}
});

function show_pricing_test_dialog(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Test Package Pricing'),
		fields: [
			{
				fieldname: 'check_in_date',
				label: __('Check-in Date'),
				fieldtype: 'Date',
				reqd: 1,
				default: frappe.datetime.get_today()
			},
			{
				fieldname: 'check_out_date',
				label: __('Check-out Date'),
				fieldtype: 'Date',
				reqd: 1,
				default: frappe.datetime.add_days(frappe.datetime.get_today(), 1)
			},
			{
				fieldname: 'occupancy',
				label: __('Occupancy'),
				fieldtype: 'Int',
				default: 1,
				reqd: 1
			}
		],
		primary_action_label: __('Calculate'),
		primary_action(values) {
			frappe.call({
				method: 'get_package_rate',
				args: {
					package_name: frm.doc.name,
					check_in_date: values.check_in_date,
					check_out_date: values.check_out_date,
					occupancy: values.occupancy
				},
				callback: function(r) {
					if (r.message) {
						if (r.message.error) {
							frappe.msgprint(__('Error: {0}', [r.message.error]));
						} else {
							show_pricing_result(r.message);
						}
					}
				}
			});
			d.hide();
		}
	});

	d.show();
}

function show_pricing_result(result) {
	let html = `
		<div class="pricing-result">
			<h4>${__('Pricing Calculation')}</h4>
			<table class="table table-bordered">
				<tr>
					<td><strong>${__('Base Rate per Night')}</strong></td>
					<td>${result.currency} ${result.base_rate}</td>
				</tr>
				<tr>
					<td><strong>${__('Number of Nights')}</strong></td>
					<td>${result.nights}</td>
				</tr>
				<tr>
					<td><strong>${__('Package Total')}</strong></td>
					<td>${result.currency} ${result.package_total}</td>
				</tr>
				<tr>
					<td><strong>${__('Amenity Total')}</strong></td>
					<td>${result.currency} ${result.amenity_total}</td>
				</tr>
				<tr class="info">
					<td><strong>${__('Grand Total')}</strong></td>
					<td><strong>${result.currency} ${result.total_rate}</strong></td>
				</tr>
			</table>
		</div>
	`;

	frappe.msgprint({
		title: __('Package Pricing'),
		message: html,
		indicator: 'green'
	});
}

// Child table events
frappe.ui.form.on('Hotel Room Package Amenity', {
	item: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.item) {
			frappe.db.get_value('Item', row.item, 'item_name', function(r) {
				if (r && r.item_name) {
					frappe.model.set_value(cdt, cdn, 'item_name', r.item_name);
				}
			});

			// Auto-set rate from item if not set
			if (!row.rate) {
				frappe.db.get_value('Item', row.item, 'standard_rate', function(r) {
					if (r && r.standard_rate) {
						frappe.model.set_value(cdt, cdn, 'rate', r.standard_rate);
					}
				});
			}
		}
	}
});