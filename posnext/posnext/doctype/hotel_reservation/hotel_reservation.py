# -*- coding: utf-8 -*-
# Copyright (c) 2025, POSNext and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import date_diff, getdate, now_datetime


class HotelReservation(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from posnext.posnext.doctype.reservation_room.reservation_room import ReservationRoom
		accessibility_needs: DF.SmallText | None
		actual_arrival_time: DF.Datetime | None
		actual_departure_time: DF.Datetime | None
		adults: DF.Int
		assigned_rooms: DF.SmallText | None
		arrival_date: DF.Date
		booking_reference: DF.Data | None
		booking_source: DF.Literal["Direct", "Online Travel Agency", "Travel Agent", "Corporate", "Walk-in", "Phone"]
		checkout_remarks: DF.SmallText | None
		children: DF.Int
		credit_card_info: DF.SmallText | None
		departure_date: DF.Date
		deposit_amount: DF.Currency
		deposit_date: DF.Date | None
		deposit_refundable: DF.Check
		dietary_restrictions: DF.SmallText | None
		email: DF.Data | None
		estimated_arrival_time: DF.Time | None
		estimated_departure_time: DF.Time | None
		guarantee_type: DF.Literal["Credit Card", "Cash Deposit", "Corporate Guarantee", "Travel Agent"]
		guaranteed: DF.Check
		guest: DF.Link
		guest_name: DF.Data
		infants: DF.Int
		nights: DF.Int
		outstanding_amount: DF.Currency
		paid_amount: DF.Currency
		payment_status: DF.Literal["Unpaid", "Partially Paid", "Paid", "Refunded"]
		phone: DF.Data | None
		reservation_rooms: DF.Table[ReservationRoom]
		room_rate: DF.Currency
		special_requests: DF.SmallText | None
		status: DF.Literal["Draft", "Confirmed", "Checked In", "Checked Out", "Cancelled", "No Show"]
		subtotal: DF.Currency
		taxes: DF.Currency
		total_amount: DF.Currency
		total_guests: DF.Int
		total_rooms: DF.Int
		travel_agent: DF.Link | None
	# end: auto-generated types

	def validate(self):
		"""Validate reservation data"""
		self.validate_dates()
		self.calculate_nights()
		self.calculate_totals()
		self.update_guest_info()
		self.validate_room_availability()

	def validate_dates(self):
		"""Validate arrival and departure dates"""
		if self.arrival_date and self.departure_date:
			if self.arrival_date >= self.departure_date:
				frappe.throw("Departure date must be after arrival date")

			if self.arrival_date < getdate():
				frappe.throw("Arrival date cannot be in the past")

	def calculate_nights(self):
		"""Calculate number of nights"""
		if self.arrival_date and self.departure_date:
			self.nights = date_diff(self.departure_date, self.arrival_date)

	def calculate_totals(self):
		"""Calculate total rooms, guests, and amounts"""
		self.total_rooms = len(self.reservation_rooms) if self.reservation_rooms else 0
		self.total_guests = (self.adults or 0) + (self.children or 0) + (self.infants or 0)

		# Calculate amounts based on room rates and nights
		if self.room_rate and self.nights:
			self.subtotal = self.room_rate * self.nights * self.total_rooms
			# Add tax calculation (simplified - 10% tax)
			self.taxes = self.subtotal * 0.10
			self.total_amount = self.subtotal + self.taxes

		# Calculate outstanding amount
		self.outstanding_amount = (self.total_amount or 0) - (self.paid_amount or 0)

		# Update payment status
		if self.outstanding_amount == 0:
			self.payment_status = "Paid"
		elif self.paid_amount and self.paid_amount > 0:
			self.payment_status = "Partially Paid"
		else:
			self.payment_status = "Unpaid"

	def update_guest_info(self):
		"""Update guest information from guest record"""
		if self.guest:
			guest = frappe.get_doc("Hotel Guest", self.guest)
			if not self.guest_name:
				self.guest_name = guest.guest_name
			if not self.phone:
				self.phone = guest.phone
			if not self.email:
				self.email = guest.email
			if not self.special_requests and guest.special_requests:
				self.special_requests = guest.special_requests

	def validate_room_availability(self):
		"""Validate that rooms are available for the selected dates"""
		if self.status in ["Confirmed", "Checked In"] and self.reservation_rooms:
			for room in self.reservation_rooms:
				if room.room_type:
					available_rooms = self.get_available_rooms(room.room_type, self.arrival_date, self.departure_date)
					if available_rooms < room.quantity:
						frappe.throw(f"Only {available_rooms} rooms of type {room.room_type} are available for the selected dates")

	def get_available_rooms(self, room_type, arrival_date, departure_date):
		"""Get number of available rooms for given type and dates"""
		# Get total rooms of this type
		total_rooms = frappe.db.count("Hotel Room", {"room_type": room_type, "status": ["!=", "Maintenance"]})

		# Get conflicting reservations
		conflicting_reservations = frappe.db.sql("""
			SELECT COUNT(rr.quantity) as reserved_rooms
			FROM `tabReservation Room` rr
			INNER JOIN `tabHotel Reservation` hr ON rr.parent = hr.name
			WHERE rr.room_type = %s
			AND hr.status IN ('Confirmed', 'Checked In')
			AND hr.name != %s
			AND (
				(hr.arrival_date <= %s AND hr.departure_date > %s) OR
				(hr.arrival_date < %s AND hr.departure_date >= %s) OR
				(hr.arrival_date >= %s AND hr.departure_date <= %s)
			)
		""", (room_type, self.name, arrival_date, arrival_date, departure_date, departure_date, arrival_date, departure_date))

		reserved_rooms = conflicting_reservations[0][0] if conflicting_reservations else 0
		return total_rooms - reserved_rooms

	def on_update(self):
		"""Handle status changes and notifications"""
		if self.has_value_changed("status"):
			self.handle_status_change()

	def handle_status_change(self):
		"""Handle different status change scenarios"""
		if self.status == "Confirmed":
			self.reserve_rooms()
		elif self.status == "Checked In":
			self.check_in_guest()
		elif self.status == "Checked Out":
			self.check_out_guest()
		elif self.status == "Cancelled":
			self.cancel_reservation()

	def reserve_rooms(self):
		"""Reserve rooms for confirmed reservation"""
		if self.reservation_rooms:
			for room in self.reservation_rooms:
				# Update room status to Reserved
				rooms = frappe.get_all("Hotel Room",
					filters={"room_type": room.room_type, "status": "Available"},
					limit=room.quantity
				)
				for r in rooms:
					room_doc = frappe.get_doc("Hotel Room", r.name)
					room_doc.status = "Reserved"
					room_doc.reservation_reference = self.name
					room_doc.save()

	def check_in_guest(self):
		"""Handle guest check-in process"""
		if not self.actual_arrival_time:
			self.actual_arrival_time = now_datetime()

		# Assign specific rooms
		assigned_rooms = []
		if self.reservation_rooms:
			for room in self.reservation_rooms:
				available_rooms = frappe.get_all("Hotel Room",
					filters={"room_type": room.room_type, "status": ["in", ["Available", "Reserved"]]},
					limit=room.quantity
				)
				for r in available_rooms:
					room_doc = frappe.get_doc("Hotel Room", r.name)
					room_doc.status = "Occupied"
					room_doc.current_guest = self.guest
					room_doc.check_in_date = self.actual_arrival_time
					room_doc.reservation_reference = self.name
					room_doc.save()
					assigned_rooms.append(room_doc.room_number)

		self.assigned_rooms = ", ".join(assigned_rooms)

	def check_out_guest(self):
		"""Handle guest check-out process"""
		if not self.actual_departure_time:
			self.actual_departure_time = now_datetime()

		# Free up rooms
		if self.assigned_rooms:
			room_numbers = [r.strip() for r in self.assigned_rooms.split(",")]
			for room_number in room_numbers:
				room = frappe.get_all("Hotel Room", filters={"room_number": room_number})
				if room:
					room_doc = frappe.get_doc("Hotel Room", room[0].name)
					room_doc.check_out_guest()

		# Update guest statistics
		if self.guest:
			guest = frappe.get_doc("Hotel Guest", self.guest)
			guest.update_guest_stats()

	def cancel_reservation(self):
		"""Handle reservation cancellation"""
		# Free up reserved rooms
		if self.reservation_rooms:
			for room in self.reservation_rooms:
				rooms = frappe.get_all("Hotel Room",
					filters={"room_type": room.room_type, "reservation_reference": self.name}
				)
				for r in rooms:
					room_doc = frappe.get_doc("Hotel Room", r.name)
					if room_doc.status == "Reserved":
						room_doc.status = "Available"
						room_doc.reservation_reference = None
						room_doc.save()

	@frappe.whitelist()
	def create_folio(self):
		"""Create hotel folio for billing"""
		if self.status not in ["Checked In", "Checked Out"]:
			frappe.throw("Can only create folio for checked-in reservations")

		folio = frappe.get_doc({
			"doctype": "Hotel Folio",
			"reservation": self.name,
			"guest": self.guest,
			"guest_name": self.guest_name,
			"arrival_date": self.arrival_date,
			"departure_date": self.departure_date,
			"status": "Open"
		})

		# Add room charges
		if self.total_amount:
			folio.append("folio_items", {
				"item_type": "Room Charge",
				"description": f"Room charges for {self.nights} nights",
				"amount": self.total_amount,
				"date": self.arrival_date
			})

		folio.insert()
		return folio.name

	@frappe.whitelist()
	def extend_stay(self, additional_nights, new_departure_date=None):
		"""Extend guest stay"""
		if self.status != "Checked In":
			frappe.throw("Can only extend stay for checked-in guests")

		if new_departure_date:
			self.departure_date = new_departure_date
		else:
			self.departure_date = frappe.utils.add_days(self.departure_date, additional_nights)

		self.calculate_nights()
		self.calculate_totals()
		self.save()

		return {"success": True, "new_departure_date": self.departure_date, "additional_charges": self.total_amount}