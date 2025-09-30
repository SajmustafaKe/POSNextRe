frappe.ui.form.on('Event Booking', {
	refresh: function(frm) {
		// Add custom buttons
		if (frm.doc.docstatus === 0) {
			frm.add_custom_button(__('Check Availability'), function() {
				check_hall_availability(frm);
			});

			frm.add_custom_button(__('Calculate Total'), function() {
				calculate_booking_total(frm);
			});
		}

		if (frm.doc.docstatus === 1) {
			frm.add_custom_button(__('View Invoice'), function() {
				if (frm.doc.sales_invoice) {
					frappe.set_route('Form', 'Sales Invoice', frm.doc.sales_invoice);
				}
			});
		}

		// Set filters
		frm.set_query('banquet_hall', function() {
			return {
				filters: {
					'is_active': 1
				}
			};
		});

		frm.set_query('customer', function() {
			return {
				filters: {
					'disabled': 0
				}
			};
		});
	},

	banquet_hall: function(frm) {
		if (frm.doc.banquet_hall) {
			load_hall_details(frm);
		}
	},

	event_date: function(frm) {
		if (frm.doc.event_date) {
			validate_event_date(frm);
		}
	},

	start_time: function(frm) {
		if (frm.doc.start_time && frm.doc.end_time) {
			calculate_duration(frm);
		}
	},

	end_time: function(frm) {
		if (frm.doc.start_time && frm.doc.end_time) {
			calculate_duration(frm);
		}
	},

	expected_guests: function(frm) {
		if (frm.doc.expected_guests && frm.doc.banquet_hall) {
			validate_capacity(frm);
		}
	}
});

function load_hall_details(frm) {
	frappe.call({
		method: 'frappe.client.get',
		args: {
			doctype: 'Banquet Hall',
			name: frm.doc.banquet_hall
		},
		callback: function(r) {
			if (r.message) {
				let hall = r.message;
				frm.set_value('hall_capacity', hall.capacity);
				frm.set_value('base_rate', hall.base_rate);

				// Load facilities
				load_hall_facilities(frm, hall.name);
			}
		}
	});
}

function load_hall_facilities(frm, hall_name) {
	frappe.call({
		method: 'posnext.posnext.doctype.banquet_hall.banquet_hall.get_hall_facilities',
		args: {
			hall_name: hall_name
		},
		callback: function(r) {
			if (r.message) {
				// Update facilities display
				let facilities_html = '<div class="row">';
				r.message.forEach(function(facility) {
					facilities_html += `
						<div class="col-md-4">
							<div class="checkbox">
								<label>
									<input type="checkbox" value="${facility.facility_name}"> ${facility.facility_name}
								</label>
							</div>
						</div>
					`;
				});
				facilities_html += '</div>';

				frm.dashboard.add_section(facilities_html, __("Available Facilities"));
			}
		}
	});
}

function check_hall_availability(frm) {
	if (!frm.doc.event_date || !frm.doc.start_time || !frm.doc.end_time) {
		frappe.msgprint(__('Please select event date, start time, and end time'));
		return;
	}

	frappe.call({
		method: 'posnext.posnext.doctype.event_booking.event_booking.get_available_halls_for_booking',
		args: {
			expected_guests: frm.doc.expected_guests,
			event_date: frm.doc.event_date,
			start_time: frm.doc.start_time,
			end_time: frm.doc.end_time
		},
		callback: function(r) {
			if (r.message && r.message.length > 0) {
				let available_halls = r.message;
				let current_hall_available = available_halls.some(hall => hall.name === frm.doc.banquet_hall);

				if (current_hall_available) {
					frappe.msgprint(__('Selected hall is available for booking'));
				} else {
					let hall_list = available_halls.map(hall => hall.hall_name).join(', ');
					frappe.msgprint(__('Selected hall is not available. Available halls: {0}', [hall_list]));
				}
			} else {
				frappe.msgprint(__('No halls available for the selected date and time'));
			}
		}
	});
}

function calculate_booking_total(frm) {
	let services = frm.doc.services_required.map(service => ({
		quantity: service.quantity,
		rate: service.rate
	}));

	frappe.call({
		method: 'posnext.posnext.doctype.event_booking.event_booking.calculate_booking_total',
		args: {
			banquet_hall: frm.doc.banquet_hall,
			start_time: frm.doc.start_time,
			end_time: frm.doc.end_time,
			event_date: frm.doc.event_date,
			services: services
		},
		callback: function(r) {
			if (r.message) {
				frm.set_value('total_amount', r.message.total);
				frm.set_value('balance_amount', r.message.total - (frm.doc.advance_amount || 0));

				frappe.msgprint(__('Total calculated: {0}', [format_currency(r.message.total)]));
			}
		}
	});
}

function validate_event_date(frm) {
	let today = frappe.datetime.get_today();
	if (frm.doc.event_date < today) {
		frappe.msgprint(__('Event date cannot be in the past'));
		frm.set_value('event_date', '');
	}
}

function calculate_duration(frm) {
	if (frm.doc.start_time && frm.doc.end_time) {
		let start = moment(frm.doc.start_time, 'HH:mm:ss');
		let end = moment(frm.doc.end_time, 'HH:mm:ss');
		let duration = moment.duration(end.diff(start));
		let hours = duration.asHours();

		frm.set_value('duration_hours', hours);
	}
}

function validate_capacity(frm) {
	if (frm.doc.expected_guests && frm.doc.hall_capacity) {
		if (frm.doc.expected_guests > frm.doc.hall_capacity) {
			frappe.msgprint(__('Expected guests exceed hall capacity'));
		}
	}
}

// Child table events
frappe.ui.form.on('Event Booking Service', {
	quantity: function(frm, cdt, cdn) {
		calculate_service_amount(frm, cdt, cdn);
	},

	rate: function(frm, cdt, cdn) {
		calculate_service_amount(frm, cdt, cdn);
	}
});

function calculate_service_amount(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	row.amount = (row.quantity || 0) * (row.rate || 0);
	frm.refresh_field('services_required');
}