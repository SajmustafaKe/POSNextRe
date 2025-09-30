# -*- coding: utf-8 -*-
# Copyright (c) 2025, POSNext and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, get_datetime, time_diff_in_hours


class RestaurantReservation(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		actual_arrival_time: DF.Datetime | None
		actual_party_size: DF.Int
		assigned_table: DF.Link | None
		bill_generated: DF.Check
		booking_source: DF.Literal["Phone", "Walk-in", "Online", "Third Party", "Email"]
		confirmation_number: DF.Data | None
		customer_name: DF.Data
		departure_time: DF.Datetime | None
		deposit_amount: DF.Currency
		dietary_restrictions: DF.SmallText | None
		duration_hours: DF.Float
		email: DF.Data | None
		occasion: DF.Literal["Birthday", "Anniversary", "Business Meeting", "Family Gathering", "Date Night", "Other"]
		outstanding_amount: DF.Currency
		paid_amount: DF.Currency
		party_size: DF.Int
		payment_method: DF.Literal["Cash", "Credit Card", "Digital Wallet", "Room Charge"]
		payment_status: DF.Literal["Unpaid", "Partially Paid", "Paid"]
		phone: DF.Data | None
		reservation_date: DF.Date
		reservation_time: DF.Time
		restaurant_table: DF.Link | None
		seated_time: DF.Datetime | None
		server_assigned: DF.Link | None
		special_requests: DF.SmallText | None
		status: DF.Literal["Draft", "Confirmed", "Arrived", "Seated", "Completed", "Cancelled", "No Show"]
		total_amount: DF.Currency
	# end: auto-generated types

	def validate(self):
		"""Validate reservation data"""
		self.validate_reservation_time()
		self.validate_table_availability()
		self.generate_confirmation_number()
		self.calculate_amounts()

	def validate_reservation_time(self):
		"""Validate reservation date and time"""
		if self.reservation_date and self.reservation_time:
			reservation_datetime = get_datetime(f"{self.reservation_date} {self.reservation_time}")

			if reservation_datetime < now_datetime():
				frappe.throw("Reservation date and time cannot be in the past")

			# Check business hours (assuming 6 AM to 11 PM)
			hour = reservation_datetime.hour
			if hour < 6 or hour > 23:
				frappe.throw("Reservations are only accepted between 6:00 AM and 11:00 PM")

	def validate_table_availability(self):
		"""Validate that preferred/assigned table is available"""
		if self.status in ["Confirmed", "Arrived", "Seated"] and self.assigned_table:
			conflicting_reservations = frappe.db.exists("Restaurant Reservation", {
				"assigned_table": self.assigned_table,
				"reservation_date": self.reservation_date,
				"status": ["in", ["Confirmed", "Arrived", "Seated"]],
				"name": ["!=", self.name]
			})

			if conflicting_reservations:
				frappe.throw(f"Table {self.assigned_table} is already reserved for this date and time")

	def generate_confirmation_number(self):
		"""Generate unique confirmation number"""
		if not self.confirmation_number:
			self.confirmation_number = f"RES-{self.name[-6:].upper()}"

	def calculate_amounts(self):
		"""Calculate billing amounts (placeholder for future implementation)"""
		# This will be updated when integrating with POS orders
		pass

	def on_update(self):
		"""Handle status changes and notifications"""
		if self.has_value_changed("status"):
			self.handle_status_change()

	def handle_status_change(self):
		"""Handle different status change scenarios"""
		if self.status == "Confirmed":
			self.send_confirmation_notification()
		elif self.status == "Arrived":
			self.handle_arrival()
		elif self.status == "Seated":
			self.handle_seating()
		elif self.status == "Completed":
			self.handle_completion()
		elif self.status == "Cancelled":
			self.handle_cancellation()

	def send_confirmation_notification(self):
		"""Send confirmation notification to customer"""
		# Implementation for sending SMS/email confirmation
		pass

	def handle_arrival(self):
		"""Handle guest arrival"""
		if not self.actual_arrival_time:
			self.actual_arrival_time = now_datetime()

		if not self.actual_party_size:
			self.actual_party_size = self.party_size

	def handle_seating(self):
		"""Handle guest seating"""
		if not self.seated_time:
			self.seated_time = now_datetime()

		# Update table status if assigned
		if self.assigned_table:
			table = frappe.get_doc("Table", self.assigned_table)
			table.status = "Occupied"
			table.save()

	def handle_completion(self):
		"""Handle reservation completion"""
		if not self.departure_time:
			self.departure_time = now_datetime()

		# Free up table
		if self.assigned_table:
			table = frappe.get_doc("Table", self.assigned_table)
			table.status = "Available"
			table.save()

	def handle_cancellation(self):
		"""Handle reservation cancellation"""
		# Free up table if assigned
		if self.assigned_table:
			table = frappe.get_doc("Table", self.assigned_table)
			table.status = "Available"
			table.save()

	@frappe.whitelist()
	def check_in_party(self):
		"""Mark party as arrived"""
		if self.status == "Confirmed":
			self.status = "Arrived"
			self.actual_arrival_time = now_datetime()
			self.save()
			return {"success": True, "message": "Party checked in successfully"}
		else:
			frappe.throw("Can only check in confirmed reservations")

	@frappe.whitelist()
	def seat_party(self, table=None):
		"""Seat the party at a table"""
		if self.status in ["Arrived", "Confirmed"]:
			self.status = "Seated"
			self.seated_time = now_datetime()
			if table:
				self.assigned_table = table
			self.save()
			return {"success": True, "message": "Party seated successfully"}
		else:
			frappe.throw("Can only seat arrived or confirmed reservations")

	@frappe.whitelist()
	def complete_reservation(self):
		"""Mark reservation as completed"""
		if self.status == "Seated":
			self.status = "Completed"
			self.departure_time = now_datetime()
			self.save()
			return {"success": True, "message": "Reservation completed successfully"}
		else:
			frappe.throw("Can only complete seated reservations")

	@frappe.whitelist()
	def cancel_reservation(self, reason=None):
		"""Cancel the reservation"""
		if self.status in ["Draft", "Confirmed"]:
			self.status = "Cancelled"
			if reason:
				self.add_comment("Comment", f"Cancelled: {reason}")
			self.save()
			return {"success": True, "message": "Reservation cancelled successfully"}
		else:
			frappe.throw("Cannot cancel reservations that are already in progress")

	@frappe.whitelist()
	def get_available_tables(self):
		"""Get available tables for the reservation date and time"""
		if not self.reservation_date or not self.reservation_time:
			return []

		# Get all tables
		tables = frappe.get_all("Table",
			filters={"status": "Available"},
			fields=["name", "table_name", "seating_capacity"]
		)

		# Filter out tables that are reserved
		available_tables = []
		for table in tables:
			conflicting = frappe.db.exists("Restaurant Reservation", {
				"assigned_table": table.name,
				"reservation_date": self.reservation_date,
				"status": ["in", ["Confirmed", "Arrived", "Seated"]],
				"name": ["!=", self.name]
			})

			if not conflicting and table.seating_capacity >= self.party_size:
				available_tables.append(table)

		return available_tables