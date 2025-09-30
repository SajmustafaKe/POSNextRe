frappe.pages['advanced-reporting-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Advanced Reporting Dashboard'),
		single_column: true
	});

	// Add custom CSS for modern analytics dashboard
	frappe.dom.add_style(`
		.analytics-dashboard {
			padding: 20px;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
		}
		.dashboard-filters {
			background: white;
			border-radius: 15px;
			padding: 20px;
			margin-bottom: 20px;
			box-shadow: 0 5px 15px rgba(0,0,0,0.1);
		}
		.kpi-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: 20px;
			margin-bottom: 30px;
		}
		.kpi-card {
			background: white;
			border-radius: 15px;
			padding: 25px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.1);
			transition: transform 0.3s ease;
			text-align: center;
		}
		.kpi-card:hover {
			transform: translateY(-5px);
		}
		.kpi-value {
			font-size: 36px;
			font-weight: bold;
			color: #667eea;
			margin-bottom: 5px;
		}
		.kpi-label {
			color: #666;
			font-size: 14px;
			text-transform: uppercase;
			font-weight: 600;
		}
		.kpi-change {
			font-size: 12px;
			margin-top: 5px;
		}
		.kpi-change.positive {
			color: #28a745;
		}
		.kpi-change.negative {
			color: #dc3545;
		}
		.chart-container {
			background: white;
			border-radius: 15px;
			padding: 25px;
			margin-bottom: 20px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.1);
		}
		.chart-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20px;
		}
		.chart-title {
			font-size: 18px;
			font-weight: 600;
			color: #333;
		}
		.chart-controls {
			display: flex;
			gap: 10px;
		}
		.chart-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
			gap: 20px;
		}
		.table-container {
			background: white;
			border-radius: 15px;
			padding: 25px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.1);
		}
		.table-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20px;
		}
		.table-title {
			font-size: 18px;
			font-weight: 600;
			color: #333;
		}
		.export-btn {
			background: #667eea;
			color: white;
			border: none;
			padding: 8px 16px;
			border-radius: 6px;
			cursor: pointer;
		}
		.metric-selector {
			display: flex;
			gap: 10px;
			margin-bottom: 20px;
			flex-wrap: wrap;
		}
		.metric-btn {
			padding: 8px 16px;
			border: 2px solid #667eea;
			background: white;
			color: #667eea;
			border-radius: 6px;
			cursor: pointer;
			transition: all 0.3s ease;
		}
		.metric-btn.active {
			background: #667eea;
			color: white;
		}
	`);

	// Initialize dashboard
	page.main = $(`<div class="analytics-dashboard"></div>`).appendTo(page.body);
	setup_dashboard_filters(page);
	setup_kpi_section(page);
	setup_charts_section(page);
	setup_reports_section(page);

	// Load initial data
	load_dashboard_data(page);
};

function setup_dashboard_filters(page) {
	let filters_html = `
		<div class="dashboard-filters">
			<h4 style="margin-bottom: 15px; color: #333;">${__('Filters & Date Range')}</h4>
			<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
				<div>
					<label>${__('From Date')}</label>
					<input type="date" id="from_date" class="form-control" value="${frappe.datetime.add_months(frappe.datetime.get_today(), -1)}">
				</div>
				<div>
					<label>${__('To Date')}</label>
					<input type="date" id="to_date" class="form-control" value="${frappe.datetime.get_today()}">
				</div>
				<div>
					<label>${__('Hotel Branch')}</label>
					<select id="branch" class="form-control">
						<option value="">${__('All Branches')}</option>
					</select>
				</div>
				<div>
					<label>${__('Report Type')}</label>
					<select id="report_type" class="form-control">
						<option value="summary">${__('Summary')}</option>
						<option value="detailed">${__('Detailed')}</option>
					</select>
				</div>
			</div>
			<div style="margin-top: 15px;">
				<button id="apply_filters" class="btn btn-primary">${__('Apply Filters')}</button>
				<button id="export_report" class="btn btn-secondary" style="margin-left: 10px;">${__('Export Report')}</button>
			</div>
		</div>
	`;

	page.main.append(filters_html);

	// Bind filter events
	page.main.find('#apply_filters').on('click', function() {
		load_dashboard_data(page);
	});

	page.main.find('#export_report').on('click', function() {
		export_dashboard_report(page);
	});
}

function setup_kpi_section(page) {
	let kpi_html = `
		<div class="kpi-grid" id="kpi_section">
			<div class="kpi-card">
				<div class="kpi-value" id="total_revenue">-</div>
				<div class="kpi-label">${__('Total Revenue')}</div>
				<div class="kpi-change positive" id="revenue_change">+12.5%</div>
			</div>
			<div class="kpi-card">
				<div class="kpi-value" id="occupancy_rate">-</div>
				<div class="kpi-label">${__('Occupancy Rate')}</div>
				<div class="kpi-change positive" id="occupancy_change">+5.2%</div>
			</div>
			<div class="kpi-card">
				<div class="kpi-value" id="avg_daily_rate">-</div>
				<div class="kpi-label">${__('Avg Daily Rate')}</div>
				<div class="kpi-change negative" id="adr_change">-2.1%</div>
			</div>
			<div class="kpi-card">
				<div class="kpi-value" id="total_bookings">-</div>
				<div class="kpi-label">${__('Total Bookings')}</div>
				<div class="kpi-change positive" id="bookings_change">+8.7%</div>
			</div>
			<div class="kpi-card">
				<div class="kpi-value" id="guest_satisfaction">-</div>
				<div class="kpi-label">${__('Guest Satisfaction')}</div>
				<div class="kpi-change positive" id="satisfaction_change">+3.4%</div>
			</div>
			<div class="kpi-card">
				<div class="kpi-value" id="loyalty_points">-</div>
				<div class="kpi-label">${__('Loyalty Points Issued')}</div>
				<div class="kpi-change positive" id="loyalty_change">+15.3%</div>
			</div>
		</div>
	`;

	page.main.append(kpi_html);
}

function setup_charts_section(page) {
	let charts_html = `
		<div class="chart-grid">
			<div class="chart-container">
				<div class="chart-header">
					<div class="chart-title">${__('Revenue Trend')}</div>
					<div class="chart-controls">
						<select id="revenue_period" class="form-control form-control-sm">
							<option value="daily">${__('Daily')}</option>
							<option value="weekly">${__('Weekly')}</option>
							<option value="monthly" selected>${__('Monthly')}</option>
						</select>
					</div>
				</div>
				<div id="revenue_chart" style="height: 300px;"></div>
			</div>
			<div class="chart-container">
				<div class="chart-header">
					<div class="chart-title">${__('Room Type Performance')}</div>
					<div class="chart-controls">
						<select id="room_type_metric" class="form-control form-control-sm">
							<option value="revenue">${__('Revenue')}</option>
							<option value="occupancy">${__('Occupancy')}</option>
							<option value="bookings">${__('Bookings')}</option>
						</select>
					</div>
				</div>
				<div id="room_type_chart" style="height: 300px;"></div>
			</div>
			<div class="chart-container">
				<div class="chart-header">
					<div class="chart-title">${__('Guest Source Analysis')}</div>
				</div>
				<div id="guest_source_chart" style="height: 300px;"></div>
			</div>
			<div class="chart-container">
				<div class="chart-header">
					<div class="chart-title">${__('Event Revenue')}</div>
				</div>
				<div id="event_revenue_chart" style="height: 300px;"></div>
			</div>
		</div>
	`;

	page.main.append(charts_html);

	// Bind chart control events
	page.main.find('#revenue_period').on('change', function() {
		load_revenue_chart(page);
	});

	page.main.find('#room_type_metric').on('change', function() {
		load_room_type_chart(page);
	});
}

function setup_reports_section(page) {
	let reports_html = `
		<div class="metric-selector">
			<button class="metric-btn active" data-report="occupancy">${__('Occupancy Report')}</button>
			<button class="metric-btn" data-report="revenue">${__('Revenue Report')}</button>
			<button class="metric-btn" data-report="guest">${__('Guest Analytics')}</button>
			<button class="metric-btn" data-report="loyalty">${__('Loyalty Program')}</button>
			<button class="metric-btn" data-report="events">${__('Events Report')}</button>
			<button class="metric-btn" data-report="maintenance">${__('Maintenance Report')}</button>
		</div>
		<div class="table-container">
			<div class="table-header">
				<div class="table-title" id="report_title">${__('Occupancy Report')}</div>
				<button class="export-btn" id="export_table">${__('Export')}</button>
			</div>
			<div id="report_table_container">
				<table class="table table-striped" id="report_table">
					<thead>
						<tr>
							<th>${__('Date')}</th>
							<th>${__('Room Type')}</th>
							<th>${__('Total Rooms')}</th>
							<th>${__('Occupied')}</th>
							<th>${__('Occupancy %')}</th>
							<th>${__('Revenue')}</th>
						</tr>
					</thead>
					<tbody id="report_table_body">
						<tr>
							<td colspan="6" style="text-align: center; padding: 40px;">${__('Loading data...')}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	`;

	page.main.append(reports_html);

	// Bind report selector events
	page.main.find('.metric-btn').on('click', function() {
		page.main.find('.metric-btn').removeClass('active');
		$(this).addClass('active');
		let report_type = $(this).data('report');
		load_report_table(page, report_type);
	});

	page.main.find('#export_table').on('click', function() {
		export_table_data(page);
	});
}

function load_dashboard_data(page) {
	// Load KPI data
	load_kpi_data(page);

	// Load charts
	load_revenue_chart(page);
	load_room_type_chart(page);
	load_guest_source_chart(page);
	load_event_revenue_chart(page);

	// Load default report
	load_report_table(page, 'occupancy');
}

function load_kpi_data(page) {
	let filters = get_dashboard_filters(page);

	frappe.call({
		method: 'posnext.posnext.page.advanced_reporting_dashboard.advanced_reporting_dashboard.get_kpi_data',
		args: filters,
		callback: function(r) {
			if (r.message) {
				let data = r.message;
				page.main.find('#total_revenue').text(format_currency(data.total_revenue));
				page.main.find('#occupancy_rate').text(data.occupancy_rate + '%');
				page.main.find('#avg_daily_rate').text(format_currency(data.avg_daily_rate));
				page.main.find('#total_bookings').text(data.total_bookings);
				page.main.find('#guest_satisfaction').text(data.guest_satisfaction + '/5');
				page.main.find('#loyalty_points').text(data.loyalty_points_issued);

				// Update change indicators
				update_kpi_changes(page, data);
			}
		}
	});
}

function load_revenue_chart(page) {
	let filters = get_dashboard_filters(page);
	filters.period = page.main.find('#revenue_period').val();

	frappe.call({
		method: 'posnext.posnext.page.advanced_reporting_dashboard.advanced_reporting_dashboard.get_revenue_chart_data',
		args: filters,
		callback: function(r) {
			if (r.message) {
				render_revenue_chart(page, r.message);
			}
		}
	});
}

function load_room_type_chart(page) {
	let filters = get_dashboard_filters(page);
	filters.metric = page.main.find('#room_type_metric').val();

	frappe.call({
		method: 'posnext.posnext.page.advanced_reporting_dashboard.advanced_reporting_dashboard.get_room_type_chart_data',
		args: filters,
		callback: function(r) {
			if (r.message) {
				render_room_type_chart(page, r.message, filters.metric);
			}
		}
	});
}

function load_guest_source_chart(page) {
	let filters = get_dashboard_filters(page);

	frappe.call({
		method: 'posnext.posnext.page.advanced_reporting_dashboard.advanced_reporting_dashboard.get_guest_source_chart_data',
		args: filters,
		callback: function(r) {
			if (r.message) {
				render_guest_source_chart(page, r.message);
			}
		}
	});
}

function load_event_revenue_chart(page) {
	let filters = get_dashboard_filters(page);

	frappe.call({
		method: 'posnext.posnext.page.advanced_reporting_dashboard.advanced_reporting_dashboard.get_event_revenue_chart_data',
		args: filters,
		callback: function(r) {
			if (r.message) {
				render_event_revenue_chart(page, r.message);
			}
		}
	});
}

function load_report_table(page, report_type) {
	let filters = get_dashboard_filters(page);
	filters.report_type = report_type;

	// Update report title
	let titles = {
		'occupancy': __('Occupancy Report'),
		'revenue': __('Revenue Report'),
		'guest': __('Guest Analytics'),
		'loyalty': __('Loyalty Program Report'),
		'events': __('Events Report'),
		'maintenance': __('Maintenance Report')
	};
	page.main.find('#report_title').text(titles[report_type]);

	frappe.call({
		method: 'posnext.posnext.page.advanced_reporting_dashboard.advanced_reporting_dashboard.get_report_data',
		args: filters,
		callback: function(r) {
			if (r.message) {
				render_report_table(page, r.message, report_type);
			}
		}
	});
}

function get_dashboard_filters(page) {
	return {
		from_date: page.main.find('#from_date').val(),
		to_date: page.main.find('#to_date').val(),
		branch: page.main.find('#branch').val(),
		report_type: page.main.find('#report_type').val()
	};
}

function format_currency(amount) {
	return '$' + (amount || 0).toLocaleString();
}

function update_kpi_changes(page, data) {
	// This would typically compare with previous period data
	// For now, showing static changes
}

function render_revenue_chart(page, data) {
	// Use frappe.chart or similar charting library
	if (window.Chart) {
		let ctx = page.main.find('#revenue_chart')[0].getContext('2d');
		new Chart(ctx, {
			type: 'line',
			data: {
				labels: data.labels,
				datasets: [{
					label: __('Revenue'),
					data: data.values,
					borderColor: '#667eea',
					backgroundColor: 'rgba(102, 126, 234, 0.1)',
					tension: 0.4
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback: function(value) {
								return format_currency(value);
							}
						}
					}
				}
			}
		});
	}
}

function render_room_type_chart(page, data, metric) {
	if (window.Chart) {
		let ctx = page.main.find('#room_type_chart')[0].getContext('2d');
		new Chart(ctx, {
			type: 'bar',
			data: {
				labels: data.labels,
				datasets: [{
					label: metric.charAt(0).toUpperCase() + metric.slice(1),
					data: data.values,
					backgroundColor: '#667eea',
					borderColor: '#5a67d8',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						beginAtZero: true
					}
				}
			}
		});
	}
}

function render_guest_source_chart(page, data) {
	if (window.Chart) {
		let ctx = page.main.find('#guest_source_chart')[0].getContext('2d');
		new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: data.labels,
				datasets: [{
					data: data.values,
					backgroundColor: [
						'#667eea',
						'#764ba2',
						'#f093fb',
						'#f5576c',
						'#4facfe',
						'#00f2fe'
					]
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false
			}
		});
	}
}

function render_event_revenue_chart(page, data) {
	if (window.Chart) {
		let ctx = page.main.find('#event_revenue_chart')[0].getContext('2d');
		new Chart(ctx, {
			type: 'bar',
			data: {
				labels: data.labels,
				datasets: [{
					label: __('Revenue'),
					data: data.values,
					backgroundColor: '#28a745',
					borderColor: '#218838',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback: function(value) {
								return format_currency(value);
							}
						}
					}
				}
			}
		});
	}
}

function render_report_table(page, data, report_type) {
	let tbody = page.main.find('#report_table_body');
	tbody.empty();

	if (!data || data.length === 0) {
		tbody.append(`<tr><td colspan="6" style="text-align: center; padding: 40px;">${__('No data available')}</td></tr>`);
		return;
	}

	data.forEach(function(row) {
		let tr = $('<tr>');

		if (report_type === 'occupancy') {
			tr.append(`<td>${row.date}</td>`);
			tr.append(`<td>${row.room_type}</td>`);
			tr.append(`<td>${row.total_rooms}</td>`);
			tr.append(`<td>${row.occupied}</td>`);
			tr.append(`<td>${row.occupancy_percent}%</td>`);
			tr.append(`<td>${format_currency(row.revenue)}</td>`);
		} else if (report_type === 'revenue') {
			tr.append(`<td>${row.date}</td>`);
			tr.append(`<td>${row.category}</td>`);
			tr.append(`<td>${row.transactions}</td>`);
			tr.append(`<td>${format_currency(row.amount)}</td>`);
			tr.append(`<td>${row.percentage}%</td>`);
			tr.append(`<td>-</td>`);
		}
		// Add more report types as needed

		tbody.append(tr);
	});
}

function export_dashboard_report(page) {
	let filters = get_dashboard_filters(page);

	frappe.call({
		method: 'posnext.posnext.page.advanced_reporting_dashboard.advanced_reporting_dashboard.export_dashboard_data',
		args: filters,
		callback: function(r) {
			if (r.message) {
				window.open(r.message);
			}
		}
	});
}

function export_table_data(page) {
	let report_type = page.main.find('.metric-btn.active').data('report');
	let filters = get_dashboard_filters(page);
	filters.report_type = report_type;

	frappe.call({
		method: 'posnext.posnext.page.advanced_reporting_dashboard.advanced_reporting_dashboard.export_table_data',
		args: filters,
		callback: function(r) {
			if (r.message) {
				window.open(r.message);
			}
		}
	});
}