frappe.ui.form.on('Banquet Hall', {
	refresh: function(frm) {
		// Add custom buttons
		if (!frm.doc.__islocal) {
			frm.add_custom_button(__('Check Availability'), function() {
				check_hall_availability(frm);
			});

			frm.add_custom_button(__('Calculate Rate'), function() {
				calculate_hall_rate_dialog(frm);
			});

			frm.add_custom_button(__('View Facilities'), function() {
				show_hall_facilities(frm);
			});
		}

		// Set queries
		frm.set_query('facilities', function() {
			return {
				filters: {
					is_available: 1
				}
			};
		});
	},

	is_active: function(frm) {
		if (!frm.doc.is_active) {
			frm.set_df_property('facilities', 'read_only', 1);
		} else {
			frm.set_df_property('facilities', 'read_only', 0);
		}
	}
});

function check_hall_availability(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Check Hall Availability'),
		fields: [
			{
				fieldname: 'event_date',
				label: __('Event Date'),
				fieldtype: 'Date',
				reqd: 1,
				default: frappe.datetime.get_today()
			},
			{
				fieldname: 'start_time',
				label: __('Start Time'),
				fieldtype: 'Time',
				reqd: 1
			},
			{
				fieldname: 'end_time',
				label: __('End Time'),
				fieldtype: 'Time',
				reqd: 1
			},
			{
				fieldname: 'expected_guests',
				label: __('Expected Guests'),
				fieldtype: 'Int'
			}
		],
		primary_action_label: __('Check'),
		primary_action(values) {
			frappe.call({
				method: 'get_available_halls',
				args: {
					event_date: values.event_date,
					start_time: values.start_time,
					end_time: values.end_time,
					expected_guests: values.expected_guests
				},
				callback: function(r) {
					if (r.message && r.message.length > 0) {
						show_availability_results(r.message, frm.doc.name);
					} else {
						frappe.msgprint(__('No halls available for the selected date and time'));
					}
				}
			});
			d.hide();
		}
	});

	d.show();
}

function calculate_hall_rate_dialog(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Calculate Hall Rate'),
		fields: [
			{
				fieldname: 'start_time',
				label: __('Start Time'),
				fieldtype: 'Time',
				reqd: 1
			},
			{
				fieldname: 'end_time',
				label: __('End Time'),
				fieldtype: 'Time',
				reqd: 1
			},
			{
				fieldname: 'event_date',
				label: __('Event Date'),
				fieldtype: 'Date',
				reqd: 1,
				default: frappe.datetime.get_today()
			}
		],
		primary_action_label: __('Calculate'),
		primary_action(values) {
			frappe.call({
				method: 'calculate_hall_rate',
				doc: frm.doc,
				args: {
					hall_name: frm.doc.name,
					start_time: values.start_time,
					end_time: values.end_time,
					event_date: values.event_date
				},
				callback: function(r) {
					if (r.message) {
						if (r.message.error) {
							frappe.msgprint(__('Error: {0}', [r.message.error]));
						} else {
							show_rate_calculation(r.message);
						}
					}
				}
			});
			d.hide();
		}
	});

	d.show();
}

function show_hall_facilities(frm) {
	frappe.call({
		method: 'get_hall_facilities',
		args: {
			hall_name: frm.doc.name
		},
		callback: function(r) {
			if (r.message) {
				show_facilities_dialog(r.message, frm.doc.hall_name);
			}
		}
	});
}

function show_availability_results(halls, current_hall) {
	let html = `
		<div class="availability-results">
			<h4>${__('Available Halls')}</h4>
			<table class="table table-bordered">
				<thead>
					<tr>
						<th>${__('Hall Name')}</th>
						<th>${__('Capacity')}</th>
						<th>${__('Min Hours')}</th>
						<th>${__('Status')}</th>
					</tr>
				</thead>
				<tbody>
	`;

	halls.forEach(function(hall) {
		let status = hall.name === current_hall ? 'Current Hall' : 'Available';
		let status_class = hall.name === current_hall ? 'info' : 'success';

		html += `
			<tr class="${status_class}">
				<td>${hall.hall_name}</td>
				<td>${hall.capacity}</td>
				<td>${hall.minimum_booking_hours}</td>
				<td>${status}</td>
			</tr>
		`;
	});

	html += `
				</tbody>
			</table>
		</div>
	`;

	frappe.msgprint({
		title: __('Hall Availability'),
		message: html,
		indicator: 'green'
	});
}

function show_rate_calculation(result) {
	let html = `
		<div class="rate-calculation">
			<h4>${__('Rate Calculation')}</h4>
			<table class="table table-bordered">
				<tr>
					<td><strong>${__('Duration')}</strong></td>
					<td>${result.duration_hours} hours</td>
				</tr>
				<tr>
					<td><strong>${__('Base Rate')}</strong></td>
					<td>${format_currency(result.base_rate)}</td>
				</tr>
				<tr>
					<td><strong>${__('Subtotal')}</strong></td>
					<td>${format_currency(result.subtotal)}</td>
				</tr>
				<tr>
					<td><strong>${__('Taxes')}</strong></td>
					<td>${format_currency(result.taxes)}</td>
				</tr>
				<tr class="success">
					<td><strong>${__('Total Amount')}</strong></td>
					<td><strong>${format_currency(result.total)}</strong></td>
				</tr>
			</table>
		</div>
	`;

	frappe.msgprint({
		title: __('Hall Rate Calculation'),
		message: html,
		indicator: 'blue'
	});
}

function show_facilities_dialog(facilities, hall_name) {
	let html = `
		<div class="facilities-list">
			<h4>${__('Facilities for {0}', [hall_name])}</h4>
			<table class="table table-striped">
				<thead>
					<tr>
						<th>${__('Facility')}</th>
						<th>${__('Type')}</th>
						<th>${__('Quantity')}</th>
						<th>${__('Additional Cost')}</th>
					</tr>
				</thead>
				<tbody>
	`;

	if (facilities && facilities.length > 0) {
		facilities.forEach(function(facility) {
			html += `
				<tr>
					<td>${facility.facility_name}</td>
					<td>${facility.facility_type}</td>
					<td>${facility.quantity}</td>
					<td>${format_currency(facility.additional_cost)}</td>
				</tr>
			`;
		});
	} else {
		html += `<tr><td colspan="4" class="text-center">${__('No facilities available')}</td></tr>`;
	}

	html += `
				</tbody>
			</table>
		</div>
	`;

	frappe.msgprint({
		title: __('Hall Facilities'),
		message: html,
		indicator: 'blue'
	});
}

function format_currency(amount) {
	return '$' + (amount || 0).toLocaleString();
}