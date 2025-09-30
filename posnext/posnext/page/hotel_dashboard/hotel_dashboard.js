frappe.pages['hotel-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Hotel Dashboard'),
		single_column: true
	});

	// Add custom CSS for modern styling
	frappe.dom.add_style(`
		.hotel-dashboard {
			padding: 20px;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
			border-left: 5px solid #667eea;
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
			color: #667eea;
		}
		.metric-value {
			font-size: 32px;
			font-weight: bold;
			color: #667eea;
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
			border: 2px solid #667eea;
			border-radius: 10px;
			padding: 15px;
			text-align: center;
			cursor: pointer;
			transition: all 0.3s ease;
			text-decoration: none;
			display: block;
			color: #667eea;
			font-weight: 600;
		}
		.action-btn:hover {
			background: #667eea;
			color: white;
			transform: translateY(-2px);
			box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
		}
		.recent-activity {
			background: white;
			border-radius: 15px;
			padding: 25px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.1);
		}
		.activity-item {
			padding: 10px 0;
			border-bottom: 1px solid #eee;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
		.activity-item:last-child {
			border-bottom: none;
		}
		.status-badge {
			padding: 3px 8px;
			border-radius: 12px;
			font-size: 12px;
			font-weight: 600;
		}
		.status-available { background: #d4edda; color: #155724; }
		.status-occupied { background: #f8d7da; color: #721c24; }
		.status-reserved { background: #fff3cd; color: #856404; }
		.status-maintenance { background: #e2e3e5; color: #383d41; }
	`);

	wrapper.innerHTML = `
		<div class="hotel-dashboard">
			<div class="quick-actions">
				<a href="#List/Hotel%20Room" class="action-btn">
					<i class="fa fa-bed"></i><br>
					Room Management
				</a>
				<a href="#List/Hotel%20Reservation" class="action-btn">
					<i class="fa fa-calendar-check-o"></i><br>
					Reservations
				</a>
				<a href="#List/Hotel%20Guest" class="action-btn">
					<i class="fa fa-users"></i><br>
					Guest Management
				</a>
				<a href="#List/Hotel%20Folio" class="action-btn">
					<i class="fa fa-file-text-o"></i><br>
					Billing & Folios
				</a>
				<a href="#List/Housekeeping%20Task" class="action-btn">
					<i class="fa fa-broom"></i><br>
					Housekeeping
				</a>
				<a href="#posnext" class="action-btn">
					<i class="fa fa-cutlery"></i><br>
					Restaurant POS
				</a>
			</div>

			<div class="dashboard-cards">
				<div class="dashboard-card">
					<div class="card-title">
						<i class="fa fa-bed"></i>
						Room Status
					</div>
					<div id="room-stats">
						<div class="metric-value">Loading...</div>
						<div class="metric-label">Total Rooms</div>
					</div>
				</div>

				<div class="dashboard-card">
					<div class="card-title">
						<i class="fa fa-calendar-check-o"></i>
						Today's Reservations
					</div>
					<div id="reservation-stats">
						<div class="metric-value">Loading...</div>
						<div class="metric-label">Check-ins Expected</div>
					</div>
				</div>

				<div class="dashboard-card">
					<div class="card-title">
						<i class="fa fa-users"></i>
						Current Occupancy
					</div>
					<div id="occupancy-stats">
						<div class="metric-value">Loading...</div>
						<div class="metric-label">Guests Checked In</div>
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

			<div class="recent-activity">
				<h3 style="margin-bottom: 20px; color: #333;">
					<i class="fa fa-clock-o"></i> Recent Activity
				</h3>
				<div id="recent-activity-list">
					<div class="activity-item">
						<span>Loading recent activities...</span>
					</div>
				</div>
			</div>
		</div>
	`;

	// Load dashboard data
	load_dashboard_data(wrapper);
};

function load_dashboard_data(wrapper) {
	// Load room statistics
	frappe.call({
		method: 'posnext.posnext.page.hotel_dashboard.hotel_dashboard.get_room_stats',
		callback: function(r) {
			if (r.message) {
				let stats = r.message;
				$(wrapper).find('#room-stats').html(`
					<div class="metric-value">${stats.total_rooms}</div>
					<div class="metric-label">Total Rooms</div>
					<div style="margin-top: 10px; font-size: 12px;">
						<span class="status-badge status-available">${stats.available} Available</span>
						<span class="status-badge status-occupied">${stats.occupied} Occupied</span>
						<span class="status-badge status-reserved">${stats.reserved} Reserved</span>
					</div>
				`);
			}
		}
	});

	// Load reservation statistics
	frappe.call({
		method: 'posnext.posnext.page.hotel_dashboard.hotel_dashboard.get_reservation_stats',
		callback: function(r) {
			if (r.message) {
				let stats = r.message;
				$(wrapper).find('#reservation-stats').html(`
					<div class="metric-value">${stats.today_checkins}</div>
					<div class="metric-label">Check-ins Today</div>
					<div style="margin-top: 10px; font-size: 12px;">
						${stats.upcoming_checkins} upcoming in next 7 days
					</div>
				`);
			}
		}
	});

	// Load occupancy statistics
	frappe.call({
		method: 'posnext.posnext.page.hotel_dashboard.hotel_dashboard.get_occupancy_stats',
		callback: function(r) {
			if (r.message) {
				let stats = r.message;
				$(wrapper).find('#occupancy-stats').html(`
					<div class="metric-value">${stats.current_guests}</div>
					<div class="metric-label">Guests Checked In</div>
					<div style="margin-top: 10px; font-size: 12px;">
						${stats.occupancy_rate}% occupancy rate
					</div>
				`);
			}
		}
	});

	// Load revenue statistics
	frappe.call({
		method: 'posnext.posnext.page.hotel_dashboard.hotel_dashboard.get_revenue_stats',
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

	// Load recent activity
	frappe.call({
		method: 'posnext.posnext.page.hotel_dashboard.hotel_dashboard.get_recent_activity',
		callback: function(r) {
			if (r.message) {
				let activities = r.message;
				let activity_html = activities.map(activity => `
					<div class="activity-item">
						<span>${activity.description}</span>
						<span class="status-badge ${activity.status_class}">${activity.status}</span>
					</div>
				`).join('');

				$(wrapper).find('#recent-activity-list').html(activity_html);
			}
		}
	});
}