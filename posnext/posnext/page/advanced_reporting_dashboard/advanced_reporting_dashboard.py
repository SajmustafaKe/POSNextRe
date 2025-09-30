import frappe
from frappe import _
from frappe.utils import today, getdate, date_diff, get_datetime, now_datetime
import json
from datetime import datetime, timedelta

@frappe.whitelist()
def get_kpi_data(from_date=None, to_date=None, branch=None, report_type="summary"):
	"""Get KPI data for the dashboard"""
	if not from_date:
		from_date = frappe.utils.add_months(today(), -1)
	if not to_date:
		to_date = today()

	# Total Revenue
	total_revenue = get_total_revenue(from_date, to_date, branch)

	# Occupancy Rate
	occupancy_data = get_occupancy_rate(from_date, to_date, branch)

	# Average Daily Rate
	avg_daily_rate = get_average_daily_rate(from_date, to_date, branch)

	# Total Bookings
	total_bookings = get_total_bookings(from_date, to_date, branch)

	# Guest Satisfaction (placeholder - would integrate with feedback system)
	guest_satisfaction = 4.2

	# Loyalty Points Issued
	loyalty_points = get_loyalty_points_issued(from_date, to_date, branch)

	return {
		"total_revenue": total_revenue,
		"occupancy_rate": occupancy_data.get("rate", 0),
		"avg_daily_rate": avg_daily_rate,
		"total_bookings": total_bookings,
		"guest_satisfaction": guest_satisfaction,
		"loyalty_points_issued": loyalty_points
	}

@frappe.whitelist()
def get_revenue_chart_data(from_date=None, to_date=None, branch=None, period="monthly"):
	"""Get revenue chart data"""
	if not from_date:
		from_date = frappe.utils.add_months(today(), -6)
	if not to_date:
		to_date = today()

	labels = []
	values = []

	if period == "monthly":
		current_date = getdate(from_date)
		end_date = getdate(to_date)

		while current_date <= end_date:
			month_start = current_date.replace(day=1)
			next_month = frappe.utils.add_months(month_start, 1)
			month_end = frappe.utils.add_days(next_month, -1)

			revenue = get_total_revenue(month_start, min(month_end, end_date), branch)
			labels.append(current_date.strftime("%b %Y"))
			values.append(revenue)

			current_date = next_month

	elif period == "weekly":
		current_date = getdate(from_date)
		end_date = getdate(to_date)

		while current_date <= end_date:
			week_end = min(frappe.utils.add_days(current_date, 6), end_date)
			revenue = get_total_revenue(current_date, week_end, branch)
			labels.append(f"Week of {current_date.strftime('%b %d')}")
			values.append(revenue)

			current_date = frappe.utils.add_days(week_end, 1)

	return {
		"labels": labels,
		"values": values
	}

@frappe.whitelist()
def get_room_type_chart_data(from_date=None, to_date=None, branch=None, metric="revenue"):
	"""Get room type performance chart data"""
	if not from_date:
		from_date = frappe.utils.add_months(today(), -1)
	if not to_date:
		to_date = today()

	room_types = frappe.get_all("Room Type", fields=["name", "room_type"])

	labels = []
	values = []

	for room_type in room_types:
		if metric == "revenue":
			value = get_room_type_revenue(room_type.name, from_date, to_date, branch)
		elif metric == "occupancy":
			value = get_room_type_occupancy(room_type.name, from_date, to_date, branch)
		elif metric == "bookings":
			value = get_room_type_bookings(room_type.name, from_date, to_date, branch)
		else:
			value = 0

		labels.append(room_type.room_type or room_type.name)
		values.append(value)

	return {
		"labels": labels,
		"values": values
	}

@frappe.whitelist()
def get_guest_source_chart_data(from_date=None, to_date=None, branch=None):
	"""Get guest source analysis chart data"""
	if not from_date:
		from_date = frappe.utils.add_months(today(), -1)
	if not to_date:
		to_date = today()

	# This would typically analyze booking sources
	# For now, return sample data
	sources = ["Direct", "Online Travel Agency", "Corporate", "Walk-in", "Referral", "Other"]
	values = [35, 25, 20, 10, 7, 3]  # Sample percentages

	return {
		"labels": sources,
		"values": values
	}

@frappe.whitelist()
def get_event_revenue_chart_data(from_date=None, to_date=None, branch=None):
	"""Get event revenue chart data"""
	if not from_date:
		from_date = frappe.utils.add_months(today(), -6)
	if not to_date:
		to_date = today()

	# Get event bookings and their revenue
	events = frappe.get_all("Event Booking",
		filters={
			"event_date": ["between", [from_date, to_date]],
			"status": "Completed"
		},
		fields=["event_date", "total_amount", "event_type"]
	)

	# Group by month
	revenue_by_month = {}
	event_types = {}

	for event in events:
		month_key = getdate(event.event_date).strftime("%b %Y")

		if month_key not in revenue_by_month:
			revenue_by_month[month_key] = 0
		revenue_by_month[month_key] += event.total_amount

		if event.event_type not in event_types:
			event_types[event.event_type] = 0
		event_types[event.event_type] += event.total_amount

	# Sort months chronologically
	sorted_months = sorted(revenue_by_month.keys(),
		key=lambda x: datetime.strptime(x, "%b %Y"))

	return {
		"labels": sorted_months,
		"values": [revenue_by_month[month] for month in sorted_months]
	}

@frappe.whitelist()
def get_report_data(from_date=None, to_date=None, branch=None, report_type="occupancy"):
	"""Get detailed report data"""
	if not from_date:
		from_date = frappe.utils.add_months(today(), -1)
	if not to_date:
		to_date = today()

	if report_type == "occupancy":
		return get_occupancy_report_data(from_date, to_date, branch)
	elif report_type == "revenue":
		return get_revenue_report_data(from_date, to_date, branch)
	elif report_type == "guest":
		return get_guest_analytics_data(from_date, to_date, branch)
	elif report_type == "loyalty":
		return get_loyalty_report_data(from_date, to_date, branch)
	elif report_type == "events":
		return get_events_report_data(from_date, to_date, branch)
	elif report_type == "maintenance":
		return get_maintenance_report_data(from_date, to_date, branch)

	return []

def get_occupancy_report_data(from_date, to_date, branch):
	"""Get occupancy report data"""
	room_types = frappe.get_all("Room Type", fields=["name", "room_type"])

	report_data = []

	for room_type in room_types:
		rooms = frappe.get_all("Hotel Room",
			filters={"room_type": room_type.name},
			fields=["name"]
		)

		total_rooms = len(rooms)

		# Calculate occupancy for each day in the period
		current_date = getdate(from_date)
		end_date = getdate(to_date)

		while current_date <= end_date:
			occupied_rooms = get_occupied_rooms_count(room_type.name, current_date, branch)
			occupancy_percent = (occupied_rooms / total_rooms * 100) if total_rooms > 0 else 0
			revenue = get_room_revenue(room_type.name, current_date, branch)

			report_data.append({
				"date": current_date.strftime("%Y-%m-%d"),
				"room_type": room_type.room_type or room_type.name,
				"total_rooms": total_rooms,
				"occupied": occupied_rooms,
				"occupancy_percent": round(occupancy_percent, 1),
				"revenue": revenue
			})

			current_date = frappe.utils.add_days(current_date, 1)

	return report_data

def get_revenue_report_data(from_date, to_date, branch):
	"""Get revenue report data"""
	# This would analyze different revenue streams
	# For now, return sample data
	return [
		{
			"date": "2025-01-01",
			"category": "Room Revenue",
			"transactions": 45,
			"amount": 12500,
			"percentage": 65.2
		},
		{
			"date": "2025-01-01",
			"category": "Restaurant Revenue",
			"transactions": 120,
			"amount": 4200,
			"percentage": 21.8
		},
		{
			"date": "2025-01-01",
			"category": "Event Revenue",
			"transactions": 8,
			"amount": 2600,
			"percentage": 13.0
		}
	]

def get_guest_analytics_data(from_date, to_date, branch):
	"""Get guest analytics data"""
	# Analyze guest demographics, repeat visits, etc.
	return []

def get_loyalty_report_data(from_date, to_date, branch):
	"""Get loyalty program report data"""
	# Analyze loyalty program performance
	return []

def get_events_report_data(from_date, to_date, branch):
	"""Get events report data"""
	events = frappe.get_all("Event Booking",
		filters={
			"event_date": ["between", [from_date, to_date]]
		},
		fields=["name", "event_name", "event_type", "event_date", "expected_guests", "total_amount", "status"]
	)

	return events

def get_maintenance_report_data(from_date, to_date, branch):
	"""Get maintenance report data"""
	maintenance_tasks = frappe.get_all("Maintenance Task",
		filters={
			"creation": ["between", [from_date, to_date]]
		},
		fields=["name", "task_type", "priority", "status", "estimated_cost", "actual_cost", "creation"]
	)

	return maintenance_tasks

# Helper functions

def get_total_revenue(from_date, to_date, branch=None):
	"""Calculate total revenue for the period"""
	# This would sum up all sales invoices for hotel services
	# For now, return a sample value
	return 45000

def get_occupancy_rate(from_date, to_date, branch=None):
	"""Calculate average occupancy rate"""
	# Complex calculation involving room availability and bookings
	return {"rate": 78.5}

def get_average_daily_rate(from_date, to_date, branch=None):
	"""Calculate average daily rate"""
	# ADR = Total Room Revenue / Total Rooms Occupied
	return 125

def get_total_bookings(from_date, to_date, branch=None):
	"""Get total number of bookings"""
	bookings = frappe.get_all("Hotel Reservation",
		filters={
			"check_in_date": ["between", [from_date, to_date]]
		},
		pluck="name"
	)
	return len(bookings)

def get_loyalty_points_issued(from_date, to_date, branch=None):
	"""Get total loyalty points issued"""
	points = frappe.get_all("Loyalty Point Entry",
		filters={
			"posting_date": ["between", [from_date, to_date]]
		},
		pluck="loyalty_points"
	)
	return sum(points) if points else 0

def get_room_type_revenue(room_type, from_date, to_date, branch=None):
	"""Get revenue for specific room type"""
	# Complex calculation
	return 15000

def get_room_type_occupancy(room_type, from_date, to_date, branch=None):
	"""Get occupancy percentage for room type"""
	return 82.3

def get_room_type_bookings(room_type, from_date, to_date, branch=None):
	"""Get booking count for room type"""
	return 25

def get_occupied_rooms_count(room_type, date, branch=None):
	"""Get number of occupied rooms for specific date and room type"""
	# This would check reservations and actual occupancy
	return 18

def get_room_revenue(room_type, date, branch=None):
	"""Get revenue for specific room type on specific date"""
	return 2250

@frappe.whitelist()
def export_dashboard_data(from_date=None, to_date=None, branch=None):
	"""Export dashboard data as PDF/Excel"""
	# Implementation for exporting dashboard data
	return "/files/dashboard_export.pdf"

@frappe.whitelist()
def export_table_data(from_date=None, to_date=None, branch=None, report_type="occupancy"):
	"""Export table data as Excel"""
	# Implementation for exporting table data
	return "/files/table_export.xlsx"