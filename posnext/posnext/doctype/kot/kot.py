# Copyright (c) 2025, POSNext and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class KOT(Document):
	def on_submit(self):
		self.multi_print_kot()
		self.kot_display_realtime()

	def before_submit(self):
		self.user_setting()
		self.assign_production_units()
		self.set_item_courses()
		self.detect_duplicate_kot()

	def multi_print_kot(self):
		"""Function for printing multiple KOTs at different levels."""
		def print_kot(printer, kot_print_format):
			try:
				from frappe.utils.print_format import print_by_server
				print_by_server("KOT", self.name, printer, kot_print_format)
			except Exception as e:
				frappe.log_error(f"KOT Print Error: {str(e)}", "KOT Print")

		# POS Profile printers
		pos_kot_printers = frappe.get_all(
			"Printer Settings",
			fields=["printer", "custom_kot_print_format", "custom_kot_print"],
			filters={"parent": self.pos_profile, "custom_kot_print": 1, "parenttype": "POS Profile"},
			order_by="idx"
		)

		pos_print_flag = True
		if self.production:
			# Production unit printers
			production_unit_printers = frappe.get_all(
				"Printer Settings",
				fields=["printer", "custom_kot_print_format", "custom_kot_print", "custom_block_takeaway_kot"],
				filters={"parent": self.production, "custom_kot_print": 1, "parenttype": "Production Unit"},
				order_by="idx"
			)

			if production_unit_printers:
				for printer in production_unit_printers:
					pos_print_flag = False
					if printer.custom_block_takeaway_kot == 1:
						if self.restaurant_table and self.table_takeaway == 0:
							print_kot(printer.printer, printer.custom_kot_print_format)
					else:
						print_kot(printer.printer, printer.custom_kot_print_format)

		if pos_print_flag and pos_kot_printers:
			for printer in pos_kot_printers:
				print_kot(printer.printer, printer.custom_kot_print_format)

	def kot_display_realtime(self):
		"""Function for displaying KOT-related information in real-time."""
		current_branch = self.branch
		production = self.production or ""
		kot_json = frappe.as_json(self)

		# Get audio file from POS Profile
		audio_file = frappe.db.get_value(
			"POS Profile", self.pos_profile, "custom_kot_alert_sound"
		)

		cache_key = f"{current_branch}_{production}_last_kot_time"
		time_value = frappe.cache().get_value(cache_key)
		kot_channel = f"kot_update_{current_branch}_{production}"

		frappe.publish_realtime(
			kot_channel,
			{"kot": kot_json, "audio_file": audio_file, "last_kot_time": time_value},
		)
		frappe.cache().set_value(cache_key, self.time)

	def user_setting(self):
		"""Set user information."""
		user_doc = frappe.get_doc("User", self.owner)
		self.user = user_doc.full_name

	def assign_production_units(self):
		"""Assign items to production units based on item groups"""
		for item in self.kot_items:
			item_group = frappe.db.get_value("Item", item.item, "item_group")
			production_unit = self.get_production_unit_for_item_group(item_group)
			item.production_unit = production_unit

	def get_production_unit_for_item_group(self, item_group):
		"""Get production unit for item group"""
		if not item_group or not self.branch:
			return None

		production_unit = frappe.db.get_value("Production Item Groups",
			{"item_group": item_group, "parent": ["in", frappe.get_all("Production Unit",
				filters={"branch": self.branch}, pluck="name")]},
			"parent")

		return production_unit

	def set_item_courses(self):
		"""Set course information for KOT items"""
		for item in self.kot_items:
			course = frappe.db.get_value("Menu Item",
				{"item": item.item, "parent": self.menu}, "course")
			serve_priority = frappe.db.get_value("Menu Item",
				{"item": item.item, "parent": self.menu}, "serve_priority")

			if course:
				item.course = course
			if serve_priority:
				item.serve_priority = serve_priority

	def detect_duplicate_kot(self):
		"""Check for duplicate KOTs for same invoice"""
		if self.type == "New Order":
			existing_kot = frappe.db.exists("KOT", {
				"invoice": self.invoice,
				"type": "New Order",
				"docstatus": 1,
				"creation": (">", frappe.utils.add_to_date(self.creation, hours=-1))
			})
			if existing_kot:
				self.type = "Duplicate"