frappe.ui.form.on('Hotel Room Package Pricing Rule', {
	condition_type: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		// Clear condition value when condition type changes
		if (row.condition_type) {
			frappe.model.set_value(cdt, cdn, 'condition_value', '');
		}
	},

	adjustment_type: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		// Clear adjustment value when adjustment type changes
		if (row.adjustment_type) {
			frappe.model.set_value(cdt, cdn, 'adjustment_value', 0);
		}
	}
});