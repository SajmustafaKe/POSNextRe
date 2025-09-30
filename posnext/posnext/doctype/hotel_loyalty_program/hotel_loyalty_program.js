frappe.ui.form.on('Hotel Loyalty Program', {
	refresh: function(frm) {
		// Add custom buttons
		if (!frm.doc.__islocal) {
			frm.add_custom_button(__('View Loyalty Points'), function() {
				show_loyalty_points_dialog(frm);
			});

			frm.add_custom_button(__('Test Points Calculation'), function() {
				show_points_calculation_dialog(frm);
			});
		}

		// Set filters
		frm.set_query('customer_group', function() {
			return {
				filters: {
					is_group: 0
				}
			};
		});
	},

	loyalty_program_type: function(frm) {
		// Show/hide collection rules based on program type
		if (frm.doc.loyalty_program_type === 'Multiple Tier Program') {
			frm.set_df_property('collection_rules', 'reqd', 1);
		} else {
			frm.set_df_property('collection_rules', 'reqd', 0);
		}
	}
});

function show_loyalty_points_dialog(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Loyalty Points Summary'),
		fields: [
			{
				fieldname: 'customer',
				label: __('Customer'),
				fieldtype: 'Link',
				options: 'Customer',
				reqd: 1
			}
		],
		primary_action_label: __('Get Summary'),
		primary_action(values) {
			frappe.call({
				method: 'get_customer_loyalty_summary',
				args: {
					customer: values.customer
				},
				callback: function(r) {
					if (r.message) {
						show_loyalty_summary(r.message, values.customer);
					}
				}
			});
			d.hide();
		}
	});

	d.show();
}

function show_loyalty_summary(summary, customer) {
	let html = `
		<div class="loyalty-summary">
			<h4>${__('Loyalty Summary for {0}', [customer])}</h4>
			<table class="table table-bordered">
				<tr>
					<td><strong>${__('Current Points')}</strong></td>
					<td>${summary.loyalty_points || 0}</td>
				</tr>
				<tr>
					<td><strong>${__('Total Spent')}</strong></td>
					<td>${summary.total_spent || 0}</td>
				</tr>
				<tr>
					<td><strong>${__('Current Tier')}</strong></td>
					<td>${summary.tier || 'N/A'}</td>
				</tr>
				<tr>
					<td><strong>${__('Expiry Date')}</strong></td>
					<td>${summary.expiry_date || 'N/A'}</td>
				</tr>
				<tr>
					<td><strong>${__('Applicable Programs')}</strong></td>
					<td>${summary.loyalty_programs ? summary.loyalty_programs.join(', ') : 'None'}</td>
				</tr>
			</table>
		</div>
	`;

	frappe.msgprint({
		title: __('Loyalty Summary'),
		message: html,
		indicator: 'blue'
	});
}

function show_points_calculation_dialog(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Test Points Calculation'),
		fields: [
			{
				fieldname: 'customer',
				label: __('Customer'),
				fieldtype: 'Link',
				options: 'Customer',
				reqd: 1
			},
			{
				fieldname: 'transaction_type',
				label: __('Transaction Type'),
				fieldtype: 'Select',
				options: 'stay\nrestaurant\nevent',
				default: 'stay',
				reqd: 1
			},
			{
				fieldname: 'stay_nights',
				label: __('Stay Nights'),
				fieldtype: 'Int',
				default: 1,
				depends_on: 'eval:doc.transaction_type=="stay"'
			},
			{
				fieldname: 'amount_spent',
				label: __('Amount Spent'),
				fieldtype: 'Float',
				default: 0,
				depends_on: 'eval:doc.transaction_type!="stay"'
			}
		],
		primary_action_label: __('Calculate'),
		primary_action(values) {
			let args = {
				customer: values.customer,
				transaction_type: values.transaction_type
			};

			if (values.transaction_type === 'stay') {
				args.stay_nights = values.stay_nights;
			} else {
				args.amount_spent = values.amount_spent;
			}

			frappe.call({
				method: 'calculate_hotel_loyalty_points',
				args: args,
				callback: function(r) {
					if (r.message) {
						show_calculation_result(r.message);
					}
				}
			});
			d.hide();
		}
	});

	d.show();
}

function show_calculation_result(result) {
	let html = `
		<div class="points-calculation">
			<h4>${__('Points Calculation Result')}</h4>
			<table class="table table-bordered">
				<tr>
					<td><strong>${__('Program')}</strong></td>
					<td>${result.program_name || 'N/A'}</td>
				</tr>
				<tr class="success">
					<td><strong>${__('Points Earned')}</strong></td>
					<td><strong>${result.points || 0}</strong></td>
				</tr>
			</table>
		</div>
	`;

	frappe.msgprint({
		title: __('Points Calculation'),
		message: html,
		indicator: 'green'
	});
}