# -*- coding: utf-8 -*-
# Copyright (c) 2025, POSNext and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class HotelRoom(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amenities: DF.TableMultiSelect | None
		bed_type: DF.Literal["King", "Queen", "Double", "Twin", "Suite"]
		building_wing: DF.Data | None
		check_in_date: DF.Datetime | None
		check_out_date: DF.Datetime | None
		currency: DF.Link | None
		current_guest: DF.Link | None
		floor: DF.Data | None
		housekeeping_status: DF.Literal["Clean", "Dirty", "In Progress", "Inspected"]
		last_cleaned: DF.Datetime | None
		maintenance_status: DF.Literal["Good", "Needs Repair", "Under Maintenance"]
		max_occupancy: DF.Int
		next_cleaning_due: DF.Datetime | None
		pets_allowed: DF.Check
		reservation_reference: DF.Link | None
		room_features: DF.SmallText | None
		room_number: DF.Data
		room_rate: DF.Currency
		room_size: DF.Data | None
		room_type: DF.Link
		smoking_allowed: DF.Check
		status: DF.Literal["Available", "Occupied", "Out of Order", "Maintenance", "Reserved"]
	# end: auto-generated types

	def validate(self):
		"""Validate hotel room data"""
		self.validate_room_number()
		self.validate_occupancy()
		self.update_housekeeping_schedule()

	def validate_room_number(self):
		"""Ensure room number is unique within the property"""
		if self.room_number:
			existing = frappe.db.exists("Hotel Room", {
				"room_number": self.room_number,
				"name": ("!=", self.name)
			})
			if existing:
				frappe.throw(f"Room number {self.room_number} already exists")

	def validate_occupancy(self):
		"""Validate room occupancy settings"""
		if self.max_occupancy and self.max_occupancy < 1:
			frappe.throw("Maximum occupancy must be at least 1")

	def update_housekeeping_schedule(self):
		"""Update housekeeping schedule based on room status"""
		if self.status in ["Occupied", "Reserved"]:
			# Set next cleaning due date
			if not self.next_cleaning_due:
				self.next_cleaning_due = frappe.utils.add_days(frappe.utils.nowdate(), 1)

	def on_update(self):
		"""Update room status and notify relevant departments"""
		self.notify_status_change()

	def notify_status_change(self):
		"""Notify housekeeping and front desk of status changes"""
		if self.has_value_changed("status"):
			# Create notification for housekeeping if status changed to needs cleaning
			if self.status == "Occupied" and self.housekeeping_status != "Clean":
				self.create_housekeeping_task()

	def create_housekeeping_task(self):
		"""Create housekeeping task for room cleaning"""
		# This will be implemented when we create the housekeeping module
		pass

	@frappe.whitelist()
	def check_in_guest(self, guest, check_in_date=None):
		"""Check in a guest to the room"""
		if self.status != "Available":
			frappe.throw(f"Room {self.room_number} is not available for check-in")

		self.current_guest = guest
		self.check_in_date = check_in_date or frappe.utils.now_datetime()
		self.status = "Occupied"
		self.housekeeping_status = "Dirty"  # Will need cleaning after checkout
		self.save()

	@frappe.whitelist()
	def check_out_guest(self):
		"""Check out guest from the room"""
		if self.status != "Occupied":
			frappe.throw(f"Room {self.room_number} is not occupied")

		self.status = "Available"
		self.current_guest = None
		self.check_in_date = None
		self.check_out_date = frappe.utils.now_datetime()
		self.housekeeping_status = "Dirty"  # Needs cleaning
		self.save()

	@frappe.whitelist()
	def mark_for_maintenance(self, reason=None):
		"""Mark room for maintenance"""
		self.status = "Maintenance"
		self.maintenance_status = "Under Maintenance"
		if reason:
			self.add_comment("Comment", f"Maintenance required: {reason}")
		self.save()

	@frappe.whitelist()
	def complete_maintenance(self):
		"""Mark maintenance as completed"""
		self.status = "Available"
		self.maintenance_status = "Good"
		self.add_comment("Comment", "Maintenance completed")
		self.save()