import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import today, getdate, date_diff
import json

class HotelRoomPackage(Document):
	def validate(self):
		self.validate_dates()
		self.create_or_update_item()
		self.validate_amenities()
		self.set_max_occupancy()

	def validate_dates(self):
		"""Validate date ranges"""
		if self.valid_from and self.valid_to:
			if getdate(self.valid_from) > getdate(self.valid_to):
				frappe.throw(_("Valid From date cannot be after Valid To date"))

	def create_or_update_item(self):
		"""Create or update the associated Item record"""
		if not self.item:
			# Create new item
			item = frappe.get_doc({
				"doctype": "Item",
				"item_code": self.package_name,
				"item_name": self.package_name,
				"item_group": "Services",
				"is_stock_item": 0,
				"stock_uom": "Unit",
				"standard_rate": self.base_rate,
				"description": self.description or self.package_name
			})
			item.insert()
			self.item = item.name
			self.item_name = item.item_name
		else:
			# Update existing item
			item = frappe.get_doc("Item", self.item)
			item.standard_rate = self.base_rate
			item.description = self.description or self.package_name
			item.save()

	def validate_amenities(self):
		"""Validate amenities and set item names"""
		for amenity in self.amenities:
			if amenity.item:
				item_name = frappe.db.get_value("Item", amenity.item, "item_name")
				amenity.item_name = item_name

	def set_max_occupancy(self):
		"""Set max occupancy from room type if not set"""
		if not self.max_occupancy and self.hotel_room_type:
			self.max_occupancy = frappe.db.get_value("Room Type", self.hotel_room_type, "max_occupancy")

	def on_trash(self):
		"""Clean up associated item when package is deleted"""
		if self.item:
			try:
				frappe.delete_doc("Item", self.item)
			except:
				pass  # Item might be referenced elsewhere

@frappe.whitelist()
def get_package_rate(package_name, check_in_date, check_out_date, occupancy=1):
	"""Calculate the total rate for a package based on dates and occupancy"""
	package = frappe.get_doc("Hotel Room Package", package_name)

	if not package.is_active:
		return {"error": "Package is not active"}

	# Check validity dates
	if package.valid_from and getdate(check_in_date) < getdate(package.valid_from):
		return {"error": "Package not valid for this check-in date"}

	if package.valid_to and getdate(check_out_date) > getdate(package.valid_to):
		return {"error": "Package not valid for this check-out date"}

	# Calculate number of nights
	nights = date_diff(check_out_date, check_in_date)
	if nights <= 0:
		return {"error": "Invalid date range"}

	# Check minimum/maximum stay
	if package.minimum_stay and nights < package.minimum_stay:
		return {"error": f"Minimum stay is {package.minimum_stay} nights"}

	if package.maximum_stay and nights > package.maximum_stay:
		return {"error": f"Maximum stay is {package.maximum_stay} nights"}

	# Base rate calculation
	base_rate = package.base_rate
	total_rate = base_rate * nights

	# Apply pricing rules
	for rule in package.pricing_rules:
		if apply_pricing_rule(rule, check_in_date, check_out_date, nights, occupancy):
			adjustment = calculate_adjustment(rule, base_rate, nights)
			if rule.adjustment_type == "Fixed Amount":
				total_rate += adjustment
			elif rule.adjustment_type == "Percentage":
				total_rate += (total_rate * adjustment / 100)
			elif rule.adjustment_type == "Multiplier":
				total_rate *= adjustment

	# Calculate amenity costs
	amenity_total = 0
	for amenity in package.amenities:
		if amenity.billable and amenity.rate:
			amenity_total += amenity.rate * nights

	total_rate += amenity_total

	return {
		"base_rate": base_rate,
		"nights": nights,
		"package_total": total_rate - amenity_total,
		"amenity_total": amenity_total,
		"total_rate": total_rate,
		"currency": package.currency
	}

def apply_pricing_rule(rule, check_in_date, check_out_date, nights, occupancy):
	"""Check if a pricing rule applies to the given conditions"""
	condition_value = rule.condition_value

	if rule.condition_type == "Stay Duration":
		min_nights, max_nights = parse_range(condition_value)
		return min_nights <= nights <= max_nights

	elif rule.condition_type == "Occupancy":
		return int(condition_value) == occupancy

	elif rule.condition_type == "Day of Week":
		check_in_day = getdate(check_in_date).strftime("%A")
		return condition_value == check_in_day

	elif rule.condition_type == "Season":
		# Simple season check - could be enhanced
		check_in_month = getdate(check_in_date).month
		if condition_value.lower() == "summer":
			return check_in_month in [6, 7, 8]
		elif condition_value.lower() == "winter":
			return check_in_month in [12, 1, 2]
		# Add more seasons as needed

	elif rule.condition_type == "Advance Booking":
		days_advance = date_diff(check_in_date, today())
		return days_advance >= int(condition_value)

	return False

def calculate_adjustment(rule, base_rate, nights):
	"""Calculate the adjustment amount based on rule type"""
	if rule.adjustment_type == "Fixed Amount":
		return rule.adjustment_value
	elif rule.adjustment_type == "Percentage":
		return rule.adjustment_value
	elif rule.adjustment_type == "Multiplier":
		return rule.adjustment_value
	return 0

def parse_range(range_str):
	"""Parse range string like '3-7' into min, max"""
	try:
		min_val, max_val = range_str.split('-')
		return int(min_val), int(max_val)
	except:
		return 0, 999

@frappe.whitelist()
def get_available_packages(room_type=None, check_in_date=None, check_out_date=None):
	"""Get available packages for given criteria"""
	filters = {"is_active": 1}

	if room_type:
		filters["hotel_room_type"] = room_type

	if check_in_date and check_out_date:
		# Check validity dates
		valid_packages = []
		packages = frappe.get_all("Hotel Room Package", filters=filters, fields=["name"])

		for package in packages:
			doc = frappe.get_doc("Hotel Room Package", package.name)
			valid = True

			if doc.valid_from and getdate(check_in_date) < getdate(doc.valid_from):
				valid = False
			if doc.valid_to and getdate(check_out_date) > getdate(doc.valid_to):
				valid = False

			if valid:
				valid_packages.append(package.name)

		return valid_packages

	return frappe.get_all("Hotel Room Package", filters=filters, pluck="name")

@frappe.whitelist()
def create_package_item(package_name):
	"""Manually create item for package"""
	package = frappe.get_doc("Hotel Room Package", package_name)
	package.create_or_update_item()
	package.save()
	return package.item