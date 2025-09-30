import frappe
from frappe import _
from frappe.utils import today, getdate, now_datetime, get_datetime
import json

@frappe.whitelist()
def get_table_stats():
	"""Get comprehensive table statistics for the dashboard"""
	try:
		# Get total tables
		total_tables = frappe.db.count('Table')

		# Get table status counts
		status_counts = frappe.db.sql("""
			SELECT status, COUNT(*) as count
			FROM `tabTable`
			GROUP BY status
		""", as_dict=True)

		# Initialize counts
		available = 0
		occupied = 0
		reserved = 0

		for status in status_counts:
			if status.status == 'Available':
				available = status.count
			elif status.status == 'Occupied':
				occupied = status.count
			elif status.status == 'Reserved':
				reserved = status.count

		return {
			'total_tables': total_tables,
			'available': available,
			'occupied': occupied,
			'reserved': reserved
		}

	except Exception as e:
		frappe.log_error(f"Error getting table stats: {str(e)}")
		return {
			'total_tables': 0,
			'available': 0,
			'occupied': 0,
			'reserved': 0
		}

@frappe.whitelist()
def get_reservation_stats():
	"""Get reservation statistics for today"""
	try:
		today_date = today()

		# Today's confirmed reservations
		today_reservations = frappe.db.count('Restaurant Reservation', {
			'reservation_date': today_date,
			'status': ['in', ['Confirmed', 'Arrived', 'Seated']]
		})

		# Upcoming reservations for today
		upcoming_reservations = frappe.db.count('Restaurant Reservation', {
			'reservation_date': today_date,
			'status': 'Confirmed',
			'reservation_time': ['>', now_datetime().strftime('%H:%M:%S')]
		})

		return {
			'today_reservations': today_reservations,
			'upcoming_reservations': upcoming_reservations
		}

	except Exception as e:
		frappe.log_error(f"Error getting reservation stats: {str(e)}")
		return {
			'today_reservations': 0,
			'upcoming_reservations': 0
		}

@frappe.whitelist()
def get_occupancy_stats():
	"""Get current occupancy statistics"""
	try:
		# Get current guests seated (from active reservations)
		current_guests = frappe.db.sql("""
			SELECT SUM(party_size) as total_guests
			FROM `tabRestaurant Reservation`
			WHERE status = 'Seated'
			AND reservation_date = %s
		""", (today(),), as_dict=True)[0].total_guests or 0

		# Get table utilization percentage
		total_capacity = frappe.db.sql("""
			SELECT SUM(seating_capacity) as total_capacity
			FROM `tabTable`
		""", as_dict=True)[0].total_capacity or 1

		occupied_capacity = frappe.db.sql("""
			SELECT SUM(t.seating_capacity) as occupied_capacity
			FROM `tabTable` t
			INNER JOIN `tabRestaurant Reservation` rr ON rr.assigned_table = t.name
			WHERE rr.status = 'Seated'
			AND rr.reservation_date = %s
		""", (today(),), as_dict=True)[0].occupied_capacity or 0

		table_utilization = round((occupied_capacity / total_capacity) * 100, 1)

		return {
			'current_guests': current_guests,
			'table_utilization': table_utilization
		}

	except Exception as e:
		frappe.log_error(f"Error getting occupancy stats: {str(e)}")
		return {
			'current_guests': 0,
			'table_utilization': 0
		}

@frappe.whitelist()
def get_revenue_stats():
	"""Get revenue statistics for today and month"""
	try:
		today_date = today()
		current_month = getdate(today_date).strftime('%Y-%m')

		# Today's revenue from POS invoices
		today_revenue = frappe.db.sql("""
			SELECT COALESCE(SUM(grand_total), 0) as revenue
			FROM `tabPOS Invoice`
			WHERE DATE(posting_date) = %s
			AND docstatus = 1
		""", (today_date,), as_dict=True)[0].revenue

		# Current month revenue
		month_revenue = frappe.db.sql("""
			SELECT COALESCE(SUM(grand_total), 0) as revenue
			FROM `tabPOS Invoice`
			WHERE DATE_FORMAT(posting_date, '%%Y-%%m') = %s
			AND docstatus = 1
		""", (current_month,), as_dict=True)[0].revenue

		return {
			'today_revenue': round(today_revenue, 2),
			'month_revenue': round(month_revenue, 2)
		}

	except Exception as e:
		frappe.log_error(f"Error getting revenue stats: {str(e)}")
		return {
			'today_revenue': 0.0,
			'month_revenue': 0.0
		}

@frappe.whitelist()
def get_table_grid():
	"""Get table grid data for visual display"""
	try:
		tables = frappe.db.sql("""
			SELECT name, table_name, seating_capacity, status
			FROM `tabTable`
			ORDER BY table_name
		""", as_dict=True)

		# Enhance with reservation info for reserved tables
		for table in tables:
			if table.status == 'Reserved':
				reservation = frappe.db.sql("""
					SELECT customer_name, reservation_time
					FROM `tabRestaurant Reservation`
					WHERE assigned_table = %s
					AND reservation_date = %s
					AND status = 'Confirmed'
					ORDER BY reservation_time
					LIMIT 1
				""", (table.name, today()), as_dict=True)

				if reservation:
					table.customer_name = reservation[0].customer_name
					table.reservation_time = reservation[0].reservation_time

		return tables

	except Exception as e:
		frappe.log_error(f"Error getting table grid: {str(e)}")
		return []

@frappe.whitelist()
def get_today_reservations():
	"""Get today's reservations for the dashboard"""
	try:
		today_date = today()

		reservations = frappe.db.sql("""
			SELECT name, customer_name, party_size, reservation_time,
				   assigned_table, status, phone
			FROM `tabRestaurant Reservation`
			WHERE reservation_date = %s
			AND status IN ('Confirmed', 'Arrived', 'Seated')
			ORDER BY reservation_time
			LIMIT 20
		""", (today_date,), as_dict=True)

		# Format reservation time for display
		for res in reservations:
			if res.reservation_time:
				res.reservation_time = res.reservation_time.strftime('%I:%M %p')

		return reservations

	except Exception as e:
		frappe.log_error(f"Error getting today's reservations: {str(e)}")
		return []

@frappe.whitelist()
def get_recent_activity():
	"""Get recent restaurant activity for dashboard"""
	try:
		# Recent reservations
		recent_reservations = frappe.db.sql("""
			SELECT 'Reservation' as type, customer_name as description,
				   creation as timestamp, status
			FROM `tabRestaurant Reservation`
			WHERE DATE(creation) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
			ORDER BY creation DESC
			LIMIT 10
		""", as_dict=True)

		# Recent POS invoices
		recent_invoices = frappe.db.sql("""
			SELECT 'Sale' as type, customer as description,
				   posting_date as timestamp, grand_total as amount
			FROM `tabPOS Invoice`
			WHERE DATE(posting_date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
			AND docstatus = 1
			ORDER BY posting_date DESC
			LIMIT 10
		""", as_dict=True)

		# Combine and sort by timestamp
		activities = recent_reservations + recent_invoices
		activities.sort(key=lambda x: x.timestamp, reverse=True)

		# Format for display
		for activity in activities[:15]:  # Limit to 15 most recent
			if activity.type == 'Reservation':
				activity.description = f"Reservation: {activity.description} ({activity.status})"
			else:
				activity.description = f"Sale: {activity.description} - ${activity.amount}"
			activity.timestamp = activity.timestamp.strftime('%m/%d %I:%M %p')

		return activities[:15]

	except Exception as e:
		frappe.log_error(f"Error getting recent activity: {str(e)}")
		return []

@frappe.whitelist()
def get_menu_performance():
	"""Get menu item performance statistics"""
	try:
		# Top selling items today
		top_items = frappe.db.sql("""
			SELECT mi.item_name, COUNT(*) as order_count,
				   SUM(poi.amount) as total_revenue
			FROM `tabPOS Invoice Item` poi
			INNER JOIN `tabMenu Item` mi ON poi.item_code = mi.name
			INNER JOIN `tabPOS Invoice` pi ON poi.parent = pi.name
			WHERE DATE(pi.posting_date) = CURDATE()
			AND pi.docstatus = 1
			GROUP BY mi.item_name
			ORDER BY order_count DESC
			LIMIT 10
		""", as_dict=True)

		return top_items

	except Exception as e:
		frappe.log_error(f"Error getting menu performance: {str(e)}")
		return []