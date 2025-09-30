# -*- coding: utf-8 -*-
# Copyright (c) 2025, POSNext and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import today, getdate, add_days


@frappe.whitelist()
def get_room_stats():
	"""Get room statistics for dashboard"""
	rooms = frappe.db.get_all("Hotel Room",
		fields=["status", "count(*) as count"],
		group_by="status"
	)

	stats = {
		"total_rooms": 0,
		"available": 0,
		"occupied": 0,
		"reserved": 0,
		"maintenance": 0
	}

	for room in rooms:
		stats["total_rooms"] += room.count
		if room.status == "Available":
			stats["available"] = room.count
		elif room.status == "Occupied":
			stats["occupied"] = room.count
		elif room.status == "Reserved":
			stats["reserved"] = room.count
		elif room.status == "Maintenance":
			stats["maintenance"] = room.count

	return stats


@frappe.whitelist()
def get_reservation_stats():
	"""Get reservation statistics for dashboard"""
	today_date = today()

	# Today's check-ins
	today_checkins = frappe.db.count("Hotel Reservation", {
		"arrival_date": today_date,
		"status": ["in", ["Confirmed", "Checked In"]]
	})

	# Upcoming check-ins (next 7 days)
	upcoming_checkins = frappe.db.count("Hotel Reservation", {
		"arrival_date": [">", today_date],
		"arrival_date": ["<=", add_days(today_date, 7)],
		"status": "Confirmed"
	})

	return {
		"today_checkins": today_checkins,
		"upcoming_checkins": upcoming_checkins
	}


@frappe.whitelist()
def get_occupancy_stats():
	"""Get occupancy statistics for dashboard"""
	total_rooms = frappe.db.count("Hotel Room", {"status": ["!=", "Maintenance"]})
	occupied_rooms = frappe.db.count("Hotel Room", {"status": "Occupied"})

	occupancy_rate = round((occupied_rooms / total_rooms * 100), 1) if total_rooms > 0 else 0

	# Current guests (rooms with active check-ins)
	current_guests = frappe.db.count("Hotel Room", {
		"status": "Occupied",
		"current_guest": ["!=", ""]
	})

	return {
		"current_guests": current_guests,
		"occupancy_rate": occupancy_rate,
		"total_rooms": total_rooms,
		"occupied_rooms": occupied_rooms
	}


@frappe.whitelist()
def get_revenue_stats():
	"""Get revenue statistics for dashboard"""
	today_date = today()

	# Today's revenue from folios
	today_revenue = frappe.db.sql("""
		SELECT COALESCE(SUM(total_amount), 0) as revenue
		FROM `tabHotel Folio`
		WHERE DATE(posting_date) = %s
		AND docstatus = 1
	""", (today_date))[0][0]

	# Current month revenue
	current_month = getdate().strftime("%Y-%m")
	month_revenue = frappe.db.sql("""
		SELECT COALESCE(SUM(total_amount), 0) as revenue
		FROM `tabHotel Folio`
		WHERE DATE_FORMAT(posting_date, '%%Y-%%m') = %s
		AND docstatus = 1
	""", (current_month))[0][0]

	return {
		"today_revenue": round(today_revenue, 2),
		"month_revenue": round(month_revenue, 2)
	}


@frappe.whitelist()
def get_recent_activity():
	"""Get recent hotel activities for dashboard"""
	activities = []

	# Recent reservations
	recent_reservations = frappe.get_all("Hotel Reservation",
		fields=["name", "guest_name", "status", "arrival_date", "creation"],
		order_by="creation desc",
		limit=5
	)

	for res in recent_reservations:
		status_class = {
			"Draft": "status-available",
			"Confirmed": "status-reserved",
			"Checked In": "status-occupied",
			"Checked Out": "status-available",
			"Cancelled": "status-maintenance"
		}.get(res.status, "status-available")

		activities.append({
			"description": f"Reservation for {res.guest_name} - {res.arrival_date}",
			"status": res.status,
			"status_class": status_class,
			"type": "reservation"
		})

	# Recent room status changes
	recent_rooms = frappe.get_all("Hotel Room",
		fields=["room_number", "status", "modified"],
		order_by="modified desc",
		limit=3
	)

	for room in recent_rooms:
		status_class = {
			"Available": "status-available",
			"Occupied": "status-occupied",
			"Reserved": "status-reserved",
			"Maintenance": "status-maintenance"
		}.get(room.status, "status-available")

		activities.append({
			"description": f"Room {room.room_number} status changed",
			"status": room.status,
			"status_class": status_class,
			"type": "room"
		})

	# Sort by modified date and return top 8
	activities.sort(key=lambda x: x.get("modified", ""), reverse=True)
	return activities[:8]