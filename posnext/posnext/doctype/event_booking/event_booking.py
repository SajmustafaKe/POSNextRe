import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import today, getdate, time_diff_in_hours, flt

class EventBooking(Document):
	def validate(self):
		self.validate_dates_and_times()
		self.validate_capacity()
		self.calculate_totals()
		self.validate_payment()
		self.check_hall_availability()

	def validate_dates_and_times(self):
		"""Validate event dates and times"""
		if self.event_date and self.setup_date:
			if getdate(self.setup_date) > getdate(self.event_date):
				frappe.throw(_("Setup date cannot be after event date"))

		if self.start_time and self.end_time:
			if self.start_time >= self.end_time:
				frappe.throw(_("End time must be after start time"))

			# Calculate duration
			self.duration_hours = time_diff_in_hours(self.end_time, self.start_time)

	def validate_capacity(self):
		"""Validate hall capacity against expected guests"""
		if self.banquet_hall and self.expected_guests:
			hall_capacity = frappe.db.get_value("Banquet Hall", self.banquet_hall, "capacity")
			if hall_capacity and self.expected_guests > hall_capacity:
				frappe.throw(_("Expected guests ({0}) exceed hall capacity ({1})").format(
					self.expected_guests, hall_capacity))

	def calculate_totals(self):
		"""Calculate total amounts"""
		total = 0

		# Calculate hall charges
		if self.banquet_hall and self.start_time and self.end_time and self.event_date:
			hall_rate = frappe.call(
				'posnext.posnext.doctype.banquet_hall.banquet_hall.calculate_hall_rate',
				hall_name=self.banquet_hall,
				start_time=self.start_time,
				end_time=self.end_time,
				event_date=self.event_date
			)
			if hall_rate and not hall_rate.get('error'):
				total += hall_rate.get('total', 0)

		# Calculate service charges
		for service in self.services_required:
			service.amount = flt(service.quantity) * flt(service.rate)
			total += service.amount

		self.total_amount = total
		self.balance_amount = total - flt(self.advance_amount)

	def validate_payment(self):
		"""Validate payment amounts"""
		if self.advance_amount and self.advance_amount > self.total_amount:
			frappe.throw(_("Advance amount cannot exceed total amount"))

	def check_hall_availability(self):
		"""Check if the selected hall is available for the booking"""
		if self.banquet_hall and self.event_date and self.start_time and self.end_time:
			available_halls = frappe.call(
				'posnext.posnext.doctype.banquet_hall.banquet_hall.get_available_halls',
				event_date=self.event_date,
				start_time=self.start_time,
				end_time=self.end_time,
				expected_guests=self.expected_guests
			)

			hall_available = any(hall.name == self.banquet_hall for hall in available_halls)

			if not hall_available:
				frappe.throw(_("Selected hall is not available for the chosen date and time"))

	def on_submit(self):
		"""Actions when booking is submitted"""
		self.create_event_invoice()
		self.send_confirmation_email()

	def on_cancel(self):
		"""Actions when booking is cancelled"""
		self.process_refund()

	def create_event_invoice(self):
		"""Create sales invoice for the event booking"""
		if not self.total_amount:
			return

		invoice = frappe.get_doc({
			"doctype": "Sales Invoice",
			"customer": self.customer,
			"posting_date": today(),
			"due_date": self.final_payment_due or self.event_date,
			"items": [
				{
					"item_name": f"Event Booking - {self.event_name}",
					"description": f"Event: {self.event_name} on {self.event_date}",
					"qty": 1,
					"rate": self.total_amount,
					"amount": self.total_amount
				}
			],
			"event_booking": self.name
		})

		invoice.insert()
		invoice.submit()

		# Link invoice to booking
		self.db_set("sales_invoice", invoice.name)

	def send_confirmation_email(self):
		"""Send booking confirmation email"""
		# Implementation for email sending
		pass

	def process_refund(self):
		"""Process refund for cancelled booking"""
		# Implementation for refund processing
		pass

@frappe.whitelist()
def get_available_halls_for_booking(expected_guests=None, event_date=None, start_time=None, end_time=None):
	"""Get available halls for booking"""
	return frappe.call(
		'posnext.posnext.doctype.banquet_hall.banquet_hall.get_available_halls',
		event_date=event_date,
		start_time=start_time,
		end_time=end_time,
		expected_guests=expected_guests
	)

@frappe.whitelist()
def calculate_booking_total(banquet_hall, start_time, end_time, event_date, services=None):
	"""Calculate total booking amount"""
	total = 0

	# Hall charges
	if banquet_hall and start_time and end_time and event_date:
		hall_rate = frappe.call(
			'posnext.posnext.doctype.banquet_hall.banquet_hall.calculate_hall_rate',
			hall_name=banquet_hall,
			start_time=start_time,
			end_time=end_time,
			event_date=event_date
		)
		if hall_rate and not hall_rate.get('error'):
			total += hall_rate.get('total', 0)

	# Service charges
	if services:
		for service in services:
			total += flt(service.get('quantity', 1)) * flt(service.get('rate', 0))

	return {
		"total": total,
		"hall_charges": hall_rate.get('total', 0) if hall_rate else 0,
		"service_charges": total - (hall_rate.get('total', 0) if hall_rate else 0)
	}

@frappe.whitelist()
def get_upcoming_events():
	"""Get list of upcoming events"""
	events = frappe.get_all("Event Booking",
		filters={
			"event_date": [">=", today()],
			"status": ["in", ["Confirmed", "In Progress"]],
			"docstatus": 1
		},
		fields=["name", "event_name", "event_date", "start_time", "banquet_hall", "expected_guests"],
		order_by="event_date, start_time"
	)

	return events
