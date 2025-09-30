frappe.ui.form.on('Housekeeping Task', {
	refresh: function(frm) {
		set_indicators(frm);
		add_custom_buttons(frm);
		set_field_properties(frm);
	},

	status: function(frm) {
		set_field_properties(frm);
	},

	assigned_to: function(frm) {
		if (frm.doc.assigned_to && frm.doc.status === 'Pending') {
			frm.set_value('status', 'Assigned');
		}
	}
});

function set_indicators(frm) {
	if (frm.doc.status === 'Pending') {
		frm.page.set_indicator(__('Pending'), 'orange');
	} else if (frm.doc.status === 'Assigned') {
		frm.page.set_indicator(__('Assigned'), 'blue');
	} else if (frm.doc.status === 'In Progress') {
		frm.page.set_indicator(__('In Progress'), 'yellow');
	} else if (frm.doc.status === 'Completed') {
		frm.page.set_indicator(__('Completed'), 'green');
	} else if (frm.doc.status === 'Cancelled') {
		frm.page.set_indicator(__('Cancelled'), 'red');
	}
}

function add_custom_buttons(frm) {
	if (frm.doc.status === 'Assigned' && !frm.doc.started_at) {
		frm.add_custom_button(__('Start Task'), function() {
			start_housekeeping_task(frm);
		}, __('Actions'));
	}

	if (frm.doc.status === 'In Progress') {
		frm.add_custom_button(__('Complete Task'), function() {
			complete_housekeeping_task(frm);
		}, __('Actions'));
	}

	if (frm.doc.status === 'Completed' && frm.doc.quality_check && !frm.doc.qc_passed) {
		frm.add_custom_button(__('Quality Check'), function() {
			quality_check_task(frm);
		}, __('Actions'));
	}

	frm.add_custom_button(__('View Room'), function() {
		frappe.set_route('Form', 'Hotel Room', frm.doc.room);
	}, __('View'));
}

function set_field_properties(frm) {
	// Set readonly fields based on status
	if (frm.doc.status === 'Completed') {
		frm.set_df_property('room', 'read_only', 1);
		frm.set_df_property('task_type', 'read_only', 1);
		frm.set_df_property('scheduled_date', 'read_only', 1);
		frm.set_df_property('task_description', 'read_only', 1);
	}

	// Show QC fields only if quality check is required
	frm.toggle_display('qc_passed', frm.doc.quality_check);
	frm.toggle_display('qc_notes', frm.doc.quality_check);
}

function start_housekeeping_task(frm) {
	frappe.confirm(__('Are you sure you want to start this housekeeping task?'), function() {
		frappe.call({
			method: 'posnext.posnext.doctype.housekeeping_task.housekeeping_task.start_task',
			args: {
				task_name: frm.doc.name
			},
			callback: function(r) {
				frm.reload_doc();
			}
		});
	});
}

function complete_housekeeping_task(frm) {
	let dialog = new frappe.ui.Dialog({
		title: __('Complete Housekeeping Task'),
		fields: [
			{
				fieldname: 'supplies_used',
				fieldtype: 'Text',
				label: __('Supplies Used'),
				default: frm.doc.supplies_used
			},
			{
				fieldname: 'issues_found',
				fieldtype: 'Text',
				label: __('Issues Found'),
				default: frm.doc.issues_found
			},
			{
				fieldname: 'follow_up_required',
				fieldtype: 'Check',
				label: __('Follow-up Required'),
				default: frm.doc.follow_up_required
			},
			{
				fieldname: 'room_status_after',
				fieldtype: 'Select',
				label: __('Room Status After'),
				options: 'Clean\nDirty\nOut of Order\nMaintenance',
				default: frm.doc.room_status_after || 'Clean'
			}
		],
		primary_action_label: __('Complete Task'),
		primary_action: function(values) {
			frappe.call({
				method: 'posnext.posnext.doctype.housekeeping_task.housekeeping_task.complete_task',
				args: {
					task_name: frm.doc.name
				},
				callback: function(r) {
					// Update additional fields
					frappe.model.set_value(frm.doctype, frm.docname, 'supplies_used', values.supplies_used);
					frappe.model.set_value(frm.doctype, frm.docname, 'issues_found', values.issues_found);
					frappe.model.set_value(frm.doctype, frm.docname, 'follow_up_required', values.follow_up_required);
					frappe.model.set_value(frm.doctype, frm.docname, 'room_status_after', values.room_status_after);
					frm.save();
					dialog.hide();
				}
			});
		}
	});

	dialog.show();
}

function quality_check_task(frm) {
	let dialog = new frappe.ui.Dialog({
		title: __('Quality Check'),
		fields: [
			{
				fieldname: 'qc_passed',
				fieldtype: 'Check',
				label: __('QC Passed'),
				default: frm.doc.qc_passed
			},
			{
				fieldname: 'qc_notes',
				fieldtype: 'Text',
				label: __('QC Notes'),
				default: frm.doc.qc_notes
			}
		],
		primary_action_label: __('Submit QC'),
		primary_action: function(values) {
			frappe.model.set_value(frm.doctype, frm.docname, 'qc_passed', values.qc_passed);
			frappe.model.set_value(frm.doctype, frm.docname, 'qc_notes', values.qc_notes);
			frm.save();
			dialog.hide();
		}
	});

	dialog.show();
}