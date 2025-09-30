frappe.ui.form.on('Event Booking Service', {
	refresh: function(frm) {
		// Add any custom logic for the child table
	},

	quantity: function(frm, cdt, cdn) {
		calculate_amount(frm, cdt, cdn);
	},

	rate: function(frm, cdt, cdn) {
		calculate_amount(frm, cdt, cdn);
	}
});

function calculate_amount(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	row.amount = (row.quantity || 0) * (row.rate || 0);
	frm.refresh_field('services_required');
}