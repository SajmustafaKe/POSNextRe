# -*- coding: utf-8 -*-
# Copyright (c) 2025, POSNext and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class RoomAmenity(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amenity_name: DF.Data
		category: DF.Literal["Basic Amenities", "Entertainment", "Comfort", "Dining", "Services", "Technology", "Bathroom", "Other"]
		description: DF.SmallText | None
		icon: DF.AttachImage | None
		is_active: DF.Check
	# end: auto-generated types

	def validate(self):
		"""Validate amenity data"""
		self.validate_amenity_name()

	def validate_amenity_name(self):
		"""Ensure amenity name is unique"""
		if self.amenity_name:
			existing = frappe.db.exists("Room Amenity", {
				"amenity_name": self.amenity_name,
				"name": ("!=", self.name)
			})
			if existing:
				frappe.throw(f"Amenity '{self.amenity_name}' already exists")