frappe.pages['restaurant-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Restaurant Dashboard'),
		single_column: true
	});

	// Add custom CSS for modern styling
	frappe.dom.add_style(`
		.restaurant-dashboard {
			padding: 20px;
			background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
			min-height: 100vh;
		}
		.dashboard-cards {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
			gap: 20px;
			margin-bottom: 30px;
		}
		.dashboard-card {
			background: white;
			border-radius: 15px;
			padding: 25px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.1);
			transition: transform 0.3s ease, box-shadow 0.3s ease;
			border-left: 5px solid #ff9a9e;
		}
		.dashboard-card:hover {
			transform: translateY(-5px);
			box-shadow: 0 15px 40px rgba(0,0,0,0.15);
		}
		.card-title {
			font-size: 18px;
			font-weight: 600;
			color: #333;
			margin-bottom: 15px;
			display: flex;
			align-items: center;
		}
		.card-title i {
			margin-right: 10px;
			color: #ff9a9e;
		}
		.metric-value {
			font-size: 32px;
			font-weight: bold;
			color: #ff9a9e;
			margin-bottom: 5px;
		}
		.metric-label {
			color: #666;
			font-size: 14px;
		}
		.quick-actions {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 15px;
			margin-bottom: 30px;
		}
		.action-btn {
			background: white;
			border: 2px solid #ff9a9e;
			border-radius: 10px;
			padding: 15px;
			text-align: center;
			cursor: pointer;
			transition: all 0.3s ease;
			text-decoration: none;
			display: block;
			color: #ff9a9e;
			font-weight: 600;
		}
		.action-btn:hover {
			background: #ff9a9e;
			color: white;
			transform: translateY(-2px);
			box-shadow: 0 5px 15px rgba(255, 154, 158, 0.3);
		}
		.table-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
			gap: 15px;
			margin-bottom: 30px;
		}
		.table-card {
			background: white;
			border-radius: 10px;
			padding: 15px;
			text-align: center;
			box-shadow: 0 5px 15px rgba(0,0,0,0.1);
			transition: all 0.3s ease;
		}
		.table-card.available {
			border-left: 4px solid #28a745;
		}
		.table-card.occupied {
			border-left: 4px solid #dc3545;
		}
		.table-card.reserved {
			border-left: 4px solid #ffc107;
		}
		.table-card:hover {
			transform: translateY(-2px);
			box-shadow: 0 8px 25px rgba(0,0,0,0.15);
		}
		.table-name {
			font-weight: bold;
			margin-bottom: 5px;
		}
		.table-capacity {
			font-size: 12px;
			color: #666;
		}
		.reservations-list {
			background: white;
			border-radius: 15px;
			padding: 25px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.1);
		}
		.reservation-item {
			padding: 10px 0;
			border-bottom: 1px solid #eee;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
		.reservation-item:last-child {
			border-bottom: none;
		}
		.reservation-time {
			font-weight: bold;
			color: #ff9a9e;
		}
		.reservation-details {
			flex: 1;
			margin-left: 15px;
		}
		.status-badge {
			padding: 3px 8px;
			border-radius: 12px;
			font-size: 12px;
			font-weight: 600;
		}
		.status-confirmed { background: #d4edda; color: #155724; }
		.status-arrived { background: #fff3cd; color: #856404; }
		.status-seated { background: #d1ecf1; color: #0c5460; }
	`);

	wrapper.innerHTML = `
		<div class="restaurant-dashboard">
			<div class="quick-actions">
				<a href="#posnext" class="action-btn">
					<i class="fa fa-cutlery"></i><br>
					New Order
				</a>
				<a href="#List/Restaurant%20Reservation" class="action-btn">
					<i class="fa fa-calendar"></i><br>
					Reservations
				</a>
				<a href="#List/Table" class="action-btn">
					<i class="fa fa-table"></i><br>
					Table Management
				</a>
				<a href="#List/KOT" class="action-btn">
					<i class="fa fa-list-alt"></i><br>
					Kitchen Orders
				</a>
				<a href="#List/Menu%20Item" class="action-btn">
					<i class="fa fa-book"></i><br>
					Menu Management
				</a>
				<a href="#List/POS%20Invoice" class="action-btn">
					<i class="fa fa-file-text-o"></i><br>
					Billing
				</a>
			</div>

			<div class="dashboard-cards">
				<div class="dashboard-card">
					<div class="card-title">
						<i class="fa fa-table"></i>
						Table Status
					</div>
					<div id="table-stats">
						<div class="metric-value">Loading...</div>
						<div class="metric-label">Total Tables</div>
					</div>
				</div>

				<div class="dashboard-card">
					<div class="card-title">
						<i class="fa fa-calendar-check-o"></i>
						Today's Reservations
					</div>
					<div id="reservation-stats">
						<div class="metric-value">Loading...</div>
						<div class="metric-label">Confirmed Reservations</div>
					</div>
				</div>

				<div class="dashboard-card">
					<div class="card-title">
						<i class="fa fa-users"></i>
						Current Occupancy
					</div>
					<div id="occupancy-stats">
						<div class="metric-value">Loading...</div>
						<div class="metric-label">Guests Seated</div>
					</div>
				</div>

				<div class="dashboard-card">
					<div class="card-title">
						<i class="fa fa-dollar"></i>
						Today's Revenue
					</div>
					<div id="revenue-stats">
						<div class="metric-value">Loading...</div>
						<div class="metric-label">Total Revenue</div>
					</div>
				</div>
			</div>

			<div class="table-grid" id="table-grid">
				<!-- Tables will be loaded here -->
			</div>

			<div class="reservations-list">
				<h3 style="margin-bottom: 20px; color: #333;">
					<i class="fa fa-clock-o"></i> Today's Reservations
				</h3>
				<div id="reservations-list">
					<div class="reservation-item">
						<span>Loading reservations...</span>
					</div>
				</div>
			</div>
		</div>
	`;

	// Load dashboard data
	load_restaurant_dashboard_data(wrapper);
};

function load_restaurant_dashboard_data(wrapper) {
	// Load table statistics
	frappe.call({
		method: 'posnext.posnext.page.restaurant_dashboard.restaurant_dashboard.get_table_stats',
		callback: function(r) {
			if (r.message) {
				let stats = r.message;
				$(wrapper).find('#table-stats').html(`
					<div class="metric-value">${stats.total_tables}</div>
					<div class="metric-label">Total Tables</div>
					<div style="margin-top: 10px; font-size: 12px;">
						<span style="color: #28a745;">${stats.available} Available</span> |
						<span style="color: #dc3545;">${stats.occupied} Occupied</span> |
						<span style="color: #ffc107;">${stats.reserved} Reserved</span>
					</div>
				`);
			}
		}
	});

	// Load reservation statistics
	frappe.call({
		method: 'posnext.posnext.page.restaurant_dashboard.restaurant_dashboard.get_reservation_stats',
		callback: function(r) {
			if (r.message) {
				let stats = r.message;
				$(wrapper).find('#reservation-stats').html(`
					<div class="metric-value">${stats.today_reservations}</div>
					<div class="metric-label">Confirmed Reservations</div>
					<div style="margin-top: 10px; font-size: 12px;">
						${stats.upcoming_reservations} upcoming today
					</div>
				`);
			}
		}
	});

	// Load occupancy statistics
	frappe.call({
		method: 'posnext.posnext.page.restaurant_dashboard.restaurant_dashboard.get_occupancy_stats',
		callback: function(r) {
			if (r.message) {
				let stats = r.message;
				$(wrapper).find('#occupancy-stats').html(`
					<div class="metric-value">${stats.current_guests}</div>
					<div class="metric-label">Guests Seated</div>
					<div style="margin-top: 10px; font-size: 12px;">
						${stats.table_utilization}% table utilization
					</div>
				`);
			}
		}
	});

	// Load revenue statistics
	frappe.call({
		method: 'posnext.posnext.page.restaurant_dashboard.restaurant_dashboard.get_revenue_stats',
		callback: function(r) {
			if (r.message) {
				let stats = r.message;
				$(wrapper).find('#revenue-stats').html(`
					<div class="metric-value">$${stats.today_revenue}</div>
					<div class="metric-label">Today's Revenue</div>
					<div style="margin-top: 10px; font-size: 12px;">
						$${stats.month_revenue} this month
					</div>
				`);
			}
		}
	});

	// Load table grid
	frappe.call({
		method: 'posnext.posnext.page.restaurant_dashboard.restaurant_dashboard.get_table_grid',
		callback: function(r) {
			if (r.message) {
				let tables = r.message;
				let table_html = tables.map(table => `
					<div class="table-card ${table.status.toLowerCase()}" onclick="open_table('${table.name}')">
						<div class="table-name">${table.table_name}</div>
						<div class="table-capacity">${table.seating_capacity} seats</div>
						<div style="margin-top: 5px; font-size: 11px; color: #666;">${table.status}</div>
					</div>
				`).join('');

				$(wrapper).find('#table-grid').html(table_html);
			}
		}
	});

	// Load today's reservations
	frappe.call({
		method: 'posnext.posnext.page.restaurant_dashboard.restaurant_dashboard.get_today_reservations',
		callback: function(r) {
			if (r.message) {
				let reservations = r.message;
				let reservation_html = reservations.map(res => `
					<div class="reservation-item">
						<div class="reservation-time">${res.reservation_time}</div>
						<div class="reservation-details">
							<strong>${res.customer_name}</strong> - Party of ${res.party_size}
							${res.assigned_table ? `<br>Table: ${res.assigned_table}` : ''}
						</div>
						<span class="status-badge status-${res.status.toLowerCase().replace(' ', '')}">${res.status}</span>
					</div>
				`).join('');

				$(wrapper).find('#reservations-list').html(reservation_html || '<div class="reservation-item"><span>No reservations for today</span></div>');
			}
		}
	});
}

function open_table(table_name) {
	// Open table details or quick actions
	frappe.set_route('Form', 'Table', table_name);
}