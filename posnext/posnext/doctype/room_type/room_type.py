# -*- coding: utf-8 -*-
# Copyright (c) 2025, POSNext and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class RoomType(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amenities: DF.TableMultiSelect | None
		base_rate: DF.Currency
		currency: DF.Link | None
		description: DF.SmallText | None
		features: DF.SmallText | None
		images: DF.AttachImage | None
		is_active: DF.Check
		max_occupancy: DF.Int
		room_size: DF.Data | None
		room_type_name: DF.Data
	# end: auto-generated types

	def validate(self):
		"""Validate room type data"""
		self.validate_room_type_name()

	def validate_room_type_name(self):
		"""Ensure room type name is unique"""
		if self.room_type_name:
			existing = frappe.db.exists("Room Type", {
				"room_type_name": self.room_type_name,
				"name": ("!=", self.name)
			})
			if existing:
				frappe.throw(f"Room type '{self.room_type_name}' already exists")

	@frappe.whitelist()
	def get_available_rooms(self, arrival_date, departure_date):
		"""Get number of available rooms for this type"""
		total_rooms = frappe.db.count("Hotel Room", {
			"room_type": self.name,
			"status": ["!=", "Maintenance"]
		})

		# Get conflicting reservations
		conflicting_reservations = frappe.db.sql("""
			SELECT COUNT(rr.quantity) as reserved_rooms
			FROM `tabReservation Room` rr
			INNER JOIN `tabHotel Reservation` hr ON rr.parent = hr.name
			WHERE rr.room_type = %s
			AND hr.status IN ('Confirmed', 'Checked In')
			AND (
				(hr.arrival_date <= %s AND hr.departure_date > %s) OR
				(hr.arrival_date < %s AND hr.departure_date >= %s) OR
				(hr.arrival_date >= %s AND hr.departure_date <= %s)
			)
		""", (self.name, arrival_date, arrival_date, departure_date, departure_date, arrival_date, departure_date))

		reserved_rooms = conflicting_reservations[0][0] if conflicting_reservations else 0
		return max(0, total_rooms - reserved_rooms)