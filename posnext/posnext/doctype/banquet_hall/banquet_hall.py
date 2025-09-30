import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import today, getdate, time_diff_in_hours

class BanquetHall(Document):
	def validate(self):
		self.validate_capacity()
		self.validate_pricing()
		self.validate_operating_hours()
		self.set_defaults()

	def validate_capacity(self):
		"""Validate hall capacity"""
		if self.capacity and self.capacity <= 0:
			frappe.throw(_("Capacity must be greater than 0"))

	def validate_pricing(self):
		"""Validate pricing configuration"""
		if self.base_hourly_rate and self.base_hourly_rate <= 0:
			frappe.throw(_("Base hourly rate must be greater than 0"))

		if self.minimum_booking_hours and self.minimum_booking_hours <= 0:
			frappe.throw(_("Minimum booking hours must be greater than 0"))

	def validate_operating_hours(self):
		"""Validate operating hours configuration"""
		for hour in self.operating_hours:
			if hour.opening_time and hour.closing_time:
				if hour.opening_time >= hour.closing_time:
					frappe.throw(_("Closing time must be after opening time for {0}").format(hour.day_of_week))

	def set_defaults(self):
		"""Set default values"""
		if not self.minimum_booking_hours:
			self.minimum_booking_hours = 2

		if not self.setup_time_hours:
			self.setup_time_hours = 1

		if not self.cleanup_time_hours:
			self.cleanup_time_hours = 1

	def on_update(self):
		"""Update related records if needed"""
		self.update_facility_availability()

	def update_facility_availability(self):
		"""Update facility availability based on hall status"""
		if not self.is_active:
			# Mark all facilities as unavailable
			for facility in self.facilities:
				facility.is_available = 0

@frappe.whitelist()
def get_available_halls(event_date, start_time, end_time, expected_guests=None):
	"""Get available banquet halls for the specified date and time"""
	available_halls = []

	halls = frappe.get_all("Banquet Hall",
		filters={"is_active": 1},
		fields=["name", "hall_name", "capacity", "minimum_booking_hours"]
	)

	for hall in halls:
		# Check capacity
		if expected_guests and hall.capacity < expected_guests:
			continue

		# Check minimum booking hours
		duration_hours = time_diff_in_hours(end_time, start_time)
		if duration_hours < hall.minimum_booking_hours:
			continue

		# Check for conflicting bookings
		conflicting_bookings = frappe.get_all("Event Booking",
			filters={
				"banquet_hall": hall.name,
				"event_date": event_date,
				"status": ["in", ["Confirmed", "In Progress"]],
				"docstatus": 1
			},
			fields=["start_time", "end_time"]
		)

		is_available = True
		for booking in conflicting_bookings:
			# Check for time overlap
			if (start_time < booking.end_time and end_time > booking.start_time):
				is_available = False
				break

		# Check blackout dates
		blackout_dates = frappe.get_all("Banquet Hall Blackout Date",
			filters={
				"parent": hall.name,
				"blackout_date": event_date
			}
		)

		if blackout_dates:
			is_available = False

		if is_available:
			available_halls.append(hall)

	return available_halls

@frappe.whitelist()
def calculate_hall_rate(hall_name, start_time, end_time, event_date):
	"""Calculate the total rate for a banquet hall booking"""
	hall = frappe.get_doc("Banquet Hall", hall_name)

	duration_hours = time_diff_in_hours(end_time, start_time)
	if duration_hours < hall.minimum_booking_hours:
		return {"error": f"Minimum booking hours is {hall.minimum_booking_hours}"}

	# Base calculation
	base_rate = hall.base_hourly_rate or hall.base_daily_rate or 0
	if hall.base_daily_rate and duration_hours >= 8:  # Consider it a full day if 8+ hours
		total_rate = hall.base_daily_rate
	else:
		total_rate = base_rate * duration_hours

	# Apply surcharges
	event_date_obj = getdate(event_date)
	day_of_week = event_date_obj.strftime("%A")

	# Weekend surcharge
	if day_of_week in ["Saturday", "Sunday"] and hall.weekend_surcharge_percent:
		total_rate += total_rate * (hall.weekend_surcharge_percent / 100)

	# Peak season surcharge (simplified - would need more complex logic)
	current_month = event_date_obj.month
	peak_months = [6, 7, 8, 12]  # Summer and December
	if current_month in peak_months and hall.peak_season_surcharge_percent:
		total_rate += total_rate * (hall.peak_season_surcharge_percent / 100)

	return {
		"base_rate": base_rate,
		"duration_hours": duration_hours,
		"subtotal": total_rate,
		"taxes": total_rate * 0.1,  # 10% tax
		"total": total_rate * 1.1
	}

@frappe.whitelist()
def get_hall_facilities(hall_name):
	"""Get available facilities for a banquet hall"""
	facilities = frappe.get_all("Banquet Hall Facility",
		filters={
			"parent": hall_name,
			"is_available": 1
		},
		fields=["facility_name", "facility_type", "quantity", "additional_cost"]
	)

	return facilities