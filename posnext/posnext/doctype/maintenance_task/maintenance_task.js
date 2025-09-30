frappe.ui.form.on('Maintenance Task', {
	refresh: function(frm) {
		set_indicators(frm);
		add_custom_buttons(frm);
		set_field_properties(frm);
	},

	status: function(frm) {
		set_field_properties(frm);
	},

	assigned_to: function(frm) {
		if (frm.doc.assigned_to && frm.doc.status === 'Open') {
			frm.set_value('status', 'Assigned');
		}
	}
});

function set_indicators(frm) {
	if (frm.doc.status === 'Open') {
		frm.page.set_indicator(__('Open'), 'red');
	} else if (frm.doc.status === 'Assigned') {
		frm.page.set_indicator(__('Assigned'), 'blue');
	} else if (frm.doc.status === 'In Progress') {
		frm.page.set_indicator(__('In Progress'), 'yellow');
	} else if (frm.doc.status === 'Waiting for Parts') {
		frm.page.set_indicator(__('Waiting for Parts'), 'orange');
	} else if (frm.doc.status === 'Completed') {
		frm.page.set_indicator(__('Completed'), 'green');
	} else if (frm.doc.status === 'Closed') {
		frm.page.set_indicator(__('Closed'), 'grey');
	}

	if (frm.doc.priority === 'Critical') {
		frm.page.set_indicator(__('Critical'), 'red');
	} else if (frm.doc.priority === 'High') {
		frm.page.set_indicator(__('High Priority'), 'orange');
	}
}

function add_custom_buttons(frm) {
	if (frm.doc.status === 'Assigned' && !frm.doc.started_at) {
		frm.add_custom_button(__('Start Task'), function() {
			start_maintenance_task(frm);
		}, __('Actions'));
	}

	if (frm.doc.status === 'In Progress') {
		frm.add_custom_button(__('Complete Task'), function() {
			complete_maintenance_task(frm);
		}, __('Actions'));
	}

	if (frm.doc.status === 'Completed' && !frm.doc.satisfaction_rating) {
		frm.add_custom_button(__('Get Customer Feedback'), function() {
			get_customer_feedback(frm);
		}, __('Actions'));
	}

	frm.add_custom_button(__('View Room'), function() {
		frappe.set_route('Form', 'Hotel Room', frm.doc.room);
	}, __('View'));
}

function set_field_properties(frm) {
	// Set readonly fields based on status
	if (frm.doc.status === 'Completed' || frm.doc.status === 'Closed') {
		frm.set_df_property('room', 'read_only', 1);
		frm.set_df_property('issue_type', 'read_only', 1);
		frm.set_df_property('issue_description', 'read_only', 1);
		frm.set_df_property('estimated_cost', 'read_only', 1);
	}

	// Show feedback fields only for guest complaints
	frm.toggle_display('customer_feedback', frm.doc.guest_complaint);
	frm.toggle_display('satisfaction_rating', frm.doc.guest_complaint);
}

function start_maintenance_task(frm) {
	frappe.confirm(__('Are you sure you want to start this maintenance task?'), function() {
		frappe.call({
			method: 'posnext.posnext.doctype.maintenance_task.maintenance_task.start_maintenance_task',
			args: {
				task_name: frm.doc.name
			},
			callback: function(r) {
				frm.reload_doc();
			}
		});
	});
}

function complete_maintenance_task(frm) {
	let dialog = new frappe.ui.Dialog({
		title: __('Complete Maintenance Task'),
		fields: [
			{
				fieldname: 'resolution_details',
				fieldtype: 'Text',
				label: __('Resolution Details'),
				reqd: 1
			},
			{
				fieldname: 'parts_used',
				fieldtype: 'Text',
				label: __('Parts Used'),
				default: frm.doc.parts_used
			},
			{
				fieldname: 'actual_cost',
				fieldtype: 'Currency',
				label: __('Actual Cost'),
				default: frm.doc.actual_cost
			},
			{
				fieldname: 'preventive_action',
				fieldtype: 'Text',
				label: __('Preventive Action'),
				default: frm.doc.preventive_action
			},
			{
				fieldname: 'follow_up_date',
				fieldtype: 'Date',
				label: __('Follow-up Date'),
				default: frm.doc.follow_up_date
			}
		],
		primary_action_label: __('Complete Task'),
		primary_action: function(values) {
			frappe.call({
				method: 'posnext.posnext.doctype.maintenance_task.maintenance_task.complete_maintenance_task',
				args: {
					task_name: frm.doc.name,
					resolution_details: values.resolution_details,
					parts_used: values.parts_used,
					actual_cost: values.actual_cost
				},
				callback: function(r) {
					// Update additional fields
					frappe.model.set_value(frm.doctype, frm.docname, 'preventive_action', values.preventive_action);
					frappe.model.set_value(frm.doctype, frm.docname, 'follow_up_date', values.follow_up_date);
					frm.save();
					dialog.hide();
				}
			});
		}
	});

	dialog.show();
}

function get_customer_feedback(frm) {
	if (!frm.doc.guest_complaint) {
		frappe.msgprint(__('This is not a guest complaint task'));
		return;
	}

	let dialog = new frappe.ui.Dialog({
		title: __('Customer Feedback'),
		fields: [
			{
				fieldname: 'satisfaction_rating',
				fieldtype: 'Rating',
				label: __('Satisfaction Rating (1-5)'),
				default: frm.doc.satisfaction_rating
			},
			{
				fieldname: 'customer_feedback',
				fieldtype: 'Text',
				label: __('Customer Feedback'),
				default: frm.doc.customer_feedback
			}
		],
		primary_action_label: __('Submit Feedback'),
		primary_action: function(values) {
			frappe.model.set_value(frm.doctype, frm.docname, 'satisfaction_rating', values.satisfaction_rating);
			frappe.model.set_value(frm.doctype, frm.docname, 'customer_feedback', values.customer_feedback);
			frm.save();
			dialog.hide();
		}
	});

	dialog.show();
}