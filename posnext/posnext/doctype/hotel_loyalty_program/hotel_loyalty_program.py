import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import today, getdate, date_diff
from erpnext.accounts.doctype.loyalty_program.loyalty_program import get_loyalty_details

class HotelLoyaltyProgram(Document):
	def validate(self):
		self.validate_dates()
		self.validate_hotel_settings()

	def validate_dates(self):
		"""Validate date ranges"""
		if self.from_date and self.to_date:
			if getdate(self.from_date) > getdate(self.to_date):
				frappe.throw(_("From Date cannot be after To Date"))

	def validate_hotel_settings(self):
		"""Validate hotel-specific settings"""
		if not (self.applies_to_hotel_stays or self.applies_to_restaurant_orders or self.applies_to_events):
			frappe.throw(_("At least one application area must be selected (Hotel Stays, Restaurant Orders, or Events)"))

	def on_update(self):
		"""Sync with base ERPNext Loyalty Program if needed"""
		self.sync_with_base_loyalty_program()

	def sync_with_base_loyalty_program(self):
		"""Create or update corresponding base Loyalty Program"""
		if not frappe.db.exists("Loyalty Program", self.loyalty_program_name):
			# Create base loyalty program
			base_program = frappe.get_doc({
				"doctype": "Loyalty Program",
				"loyalty_program_name": self.loyalty_program_name,
				"loyalty_program_type": self.loyalty_program_type,
				"from_date": self.from_date,
				"to_date": self.to_date,
				"customer_group": self.customer_group,
				"customer_territory": self.customer_territory,
				"auto_opt_in": self.auto_opt_in,
				"conversion_factor": self.conversion_factor,
				"expiry_duration": self.expiry_duration,
				"expense_account": self.expense_account,
				"cost_center": self.cost_center,
				"company": self.company,
				"collection_rules": self.collection_rules
			})
			base_program.insert()
		else:
			# Update existing base program
			base_program = frappe.get_doc("Loyalty Program", self.loyalty_program_name)
			base_program.loyalty_program_type = self.loyalty_program_type
			base_program.from_date = self.from_date
			base_program.to_date = self.to_date
			base_program.customer_group = self.customer_group
			base_program.customer_territory = self.customer_territory
			base_program.auto_opt_in = self.auto_opt_in
			base_program.conversion_factor = self.conversion_factor
			base_program.expiry_duration = self.expiry_duration
			base_program.expense_account = self.expense_account
			base_program.cost_center = self.cost_center
			base_program.company = self.company
			base_program.collection_rules = self.collection_rules
			base_program.save()

@frappe.whitelist()
def calculate_hotel_loyalty_points(customer, stay_nights=0, amount_spent=0, transaction_type="stay"):
	"""Calculate loyalty points for hotel transactions"""
	loyalty_programs = get_applicable_loyalty_programs(customer)

	if not loyalty_programs:
		return {"points": 0, "program": None}

	program = loyalty_programs[0]  # Use first applicable program
	doc = frappe.get_doc("Hotel Loyalty Program", program)

	points = 0

	if transaction_type == "stay" and doc.applies_to_hotel_stays:
		# Base points for stay nights
		points += stay_nights * (doc.points_per_stay_night or 0)

		# Bonus points for long stays
		if doc.bonus_points_threshold and stay_nights >= doc.bonus_points_threshold:
			bonus_points = points * ((doc.bonus_points_multiplier or 1) - 1)
			points += bonus_points

	elif transaction_type == "restaurant" and doc.applies_to_restaurant_orders:
		points += amount_spent * (doc.points_per_dollar_spent or 0)

	elif transaction_type == "event" and doc.applies_to_events:
		points += amount_spent * (doc.points_per_dollar_spent or 0)

	return {
		"points": int(points),
		"program": program,
		"program_name": doc.loyalty_program_name
	}

@frappe.whitelist()
def award_special_loyalty_points(customer, points_type, reference_doc=None):
	"""Award special loyalty points (room upgrades, referrals, etc.)"""
	loyalty_programs = get_applicable_loyalty_programs(customer)

	if not loyalty_programs:
		return {"success": False, "message": "No applicable loyalty program found"}

	program = loyalty_programs[0]
	doc = frappe.get_doc("Hotel Loyalty Program", program)

	points = 0
	description = ""

	if points_type == "room_upgrade":
		points = doc.room_upgrade_points or 0
		description = "Room upgrade bonus"
	elif points_type == "complimentary_service":
		points = doc.complimentary_service_points or 0
		description = "Complimentary service bonus"
	elif points_type == "referral":
		points = doc.referral_points or 0
		description = "Guest referral bonus"
	elif points_type == "birthday":
		points = doc.birthday_bonus_points or 0
		description = "Birthday bonus"

	if points > 0:
		# Create loyalty point entry
		point_entry = frappe.get_doc({
			"doctype": "Loyalty Point Entry",
			"loyalty_program": program,
			"customer": customer,
			"loyalty_points": points,
			"purchase_amount": 0,
			"posting_date": today(),
			"company": doc.company,
			"expiry_date": frappe.utils.add_days(today(), doc.expiry_duration or 365)
		})
		point_entry.insert()

		return {
			"success": True,
			"points": points,
			"description": description
		}

	return {"success": False, "message": "Invalid points type or no points configured"}

def get_applicable_loyalty_programs(customer):
	"""Get applicable hotel loyalty programs for a customer"""
	customer_doc = frappe.get_doc("Customer", customer)
	programs = []

	hotel_programs = frappe.get_all("Hotel Loyalty Program",
		filters={
			"from_date": ["<=", today()],
			"to_date": [">=", today()]
		},
		pluck="name"
	)

	for program_name in hotel_programs:
		program = frappe.get_doc("Hotel Loyalty Program", program_name)

		# Check customer group and territory
		if program.customer_group and customer_doc.customer_group != program.customer_group:
			continue
		if program.customer_territory and customer_doc.territory != program.customer_territory:
			continue

		programs.append(program_name)

	return programs

@frappe.whitelist()
def get_customer_loyalty_summary(customer):
	"""Get comprehensive loyalty summary for a customer"""
	base_details = get_loyalty_details(customer)

	# Add hotel-specific information
	hotel_programs = get_applicable_loyalty_programs(customer)

	summary = {
		"loyalty_points": base_details.get("loyalty_points", 0),
		"total_spent": base_details.get("total_spent", 0),
		"loyalty_programs": hotel_programs,
		"expiry_date": base_details.get("expiry_date"),
		"tier": base_details.get("loyalty_program_tier")
	}

	return summary