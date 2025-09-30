# -*- coding: utf-8 -*-
# Copyright (c) 2025, POSNext and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class HotelGuest(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		accessibility_needs: DF.SmallText | None
		address_line_1: DF.Data | None
		address_line_2: DF.Data | None
		blacklist_reason: DF.SmallText | None
		blacklist_status: DF.Check
		city: DF.Data | None
		company: DF.Data | None
		country: DF.Link | None
		credit_card_info: DF.SmallText | None
		date_of_birth: DF.Date | None
		designation: DF.Data | None
		dietary_restrictions: DF.SmallText | None
		email: DF.Data | None
		emergency_contact: DF.SmallText | None
		first_name: DF.Data
		gender: DF.Literal["Male", "Female", "Other"]
		guest_name: DF.Data
		last_name: DF.Data
		last_visit_date: DF.Date | None
		loyalty_number: DF.Data | None
		loyalty_program: DF.Data | None
		nationality: DF.Link | None
		passport_number: DF.Data | None
		phone: DF.Data | None
		postal_code: DF.Data | None
		preferred_payment_method: DF.Literal["Cash", "Credit Card", "Debit Card", "Bank Transfer", "Digital Wallet"]
		preferred_room_type: DF.Link | None
		special_requests: DF.SmallText | None
		state: DF.Data | None
		total_nights: DF.Int
		total_spent: DF.Currency
		total_stays: DF.Int
		vip_status: DF.Check
	# end: auto-generated types

	def validate(self):
		"""Validate guest information"""
		self.validate_guest_name()
		self.update_guest_history()

	def validate_guest_name(self):
		"""Generate guest name from first and last name"""
		if self.first_name and self.last_name:
			self.guest_name = f"{self.first_name} {self.last_name}"

	def update_guest_history(self):
		"""Update guest history statistics"""
		# This will be updated when reservations are completed
		pass

	def before_save(self):
		"""Set default values and validate data"""
		if not self.guest_name and self.first_name and self.last_name:
			self.guest_name = f"{self.first_name} {self.last_name}"

	@frappe.whitelist()
	def get_guest_history(self):
		"""Get complete guest history including reservations and stays"""
		reservations = frappe.get_all("Hotel Reservation",
			filters={"guest": self.name},
			fields=["name", "arrival_date", "departure_date", "status", "total_amount"],
			order_by="arrival_date desc"
		)

		return {
			"reservations": reservations,
			"total_stays": len(reservations),
			"total_nights": sum((frappe.utils.date_diff(r.departure_date, r.arrival_date)) for r in reservations if r.departure_date and r.arrival_date),
			"total_spent": sum(r.total_amount or 0 for r in reservations)
		}

	@frappe.whitelist()
	def update_guest_stats(self):
		"""Update guest statistics based on completed reservations"""
		history = self.get_guest_history()

		self.total_stays = history["total_stays"]
		self.total_nights = history["total_nights"]
		self.total_spent = history["total_spent"]

		# Update last visit date
		if history["reservations"]:
			completed_reservations = [r for r in history["reservations"] if r.status == "Completed"]
			if completed_reservations:
				self.last_visit_date = max(r.arrival_date for r in completed_reservations)

		self.save()

	@frappe.whitelist()
	def add_to_blacklist(self, reason):
		"""Add guest to blacklist"""
		self.blacklist_status = 1
		self.blacklist_reason = reason
		self.add_comment("Comment", f"Added to blacklist: {reason}")
		self.save()

	@frappe.whitelist()
	def remove_from_blacklist(self):
		"""Remove guest from blacklist"""
		self.blacklist_status = 0
		self.blacklist_reason = ""
		self.add_comment("Comment", "Removed from blacklist")
		self.save()

	@frappe.whitelist()
	def mark_as_vip(self):
		"""Mark guest as VIP"""
		self.vip_status = 1
		self.add_comment("Comment", "Marked as VIP guest")
		self.save()

	@frappe.whitelist()
	def create_reservation(self, room_type=None, arrival_date=None, departure_date=None, special_requests=None):
		"""Create a new reservation for this guest"""
		reservation = frappe.get_doc({
			"doctype": "Hotel Reservation",
			"guest": self.name,
			"guest_name": self.guest_name,
			"arrival_date": arrival_date,
			"departure_date": departure_date,
			"status": "Draft",
			"special_requests": special_requests or self.special_requests
		})

		if room_type:
			reservation.append("reservation_rooms", {
				"room_type": room_type,
				"quantity": 1
			})

		reservation.insert()
		return reservation.name