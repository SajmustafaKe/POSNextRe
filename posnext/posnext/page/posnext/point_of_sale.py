# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt


import json
from typing import Dict, Optional

import frappe
from frappe.utils import cint
from frappe.utils.nestedset import get_root_of

from erpnext.accounts.doctype.pos_invoice.pos_invoice import get_stock_availability
from erpnext.accounts.doctype.pos_profile.pos_profile import get_child_nodes, get_item_groups
from erpnext.stock.utils import scan_barcode


def search_by_term(search_term, warehouse, price_list):
	result = search_for_serial_or_batch_or_barcode_number(search_term) or {}

	item_code = result.get("item_code", search_term)
	serial_no = result.get("serial_no", "")
	batch_no = result.get("batch_no", "")
	barcode = result.get("barcode", "")

	if not result:
		return

	item_doc = frappe.get_doc("Item", item_code)

	if not item_doc:
		return

	item = {
		"barcode": barcode,
		"batch_no": batch_no,
		"description": item_doc.description,
		"is_stock_item": item_doc.is_stock_item,
		"item_code": item_doc.name,
		"item_image": item_doc.image,
		"item_name": item_doc.item_name,
		"serial_no": serial_no,
		"stock_uom": item_doc.stock_uom,
		"uom": item_doc.stock_uom,
	}

	if barcode:
		barcode_info = next(filter(lambda x: x.barcode == barcode, item_doc.get("barcodes", [])), None)
		if barcode_info and barcode_info.uom:
			uom = next(filter(lambda x: x.uom == barcode_info.uom, item_doc.uoms), {})
			item.update(
				{
					"uom": barcode_info.uom,
					"conversion_factor": uom.get("conversion_factor", 1),
				}
			)

	item_stock_qty, is_stock_item = get_stock_availability(item_code, warehouse)
	item_stock_qty = item_stock_qty // item.get("conversion_factor", 1)
	item.update({"actual_qty": item_stock_qty})

	price = frappe.get_list(
		doctype="Item Price",
		filters={
			"price_list": price_list,
			"item_code": item_code,
			"batch_no": batch_no,
		},
		fields=["uom", "currency", "price_list_rate", "batch_no"],
	)

	def __sort(p):
		p_uom = p.get("uom")

		if p_uom == item.get("uom"):
			return 0
		elif p_uom == item.get("stock_uom"):
			return 1
		else:
			return 2

	# sort by fallback preference. always pick exact uom match if available
	price = sorted(price, key=__sort)

	if len(price) > 0:
		p = price.pop(0)
		item.update(
			{
				"currency": p.get("currency"),
				"price_list_rate": p.get("price_list_rate"),
			}
		)

	return {"items": [item]}


@frappe.whitelist()
def get_items(start, page_length, price_list, item_group, pos_profile, search_term=""):
	warehouse, hide_unavailable_items = frappe.db.get_value(
		"POS Profile", pos_profile, ["warehouse", "hide_unavailable_items"]
	)

	result = []

	if search_term:
		result = search_by_term(search_term, warehouse, price_list) or []
		if result:
			return result

	if not frappe.db.exists("Item Group", item_group):
		item_group = get_root_of("Item Group")

	condition = get_conditions(search_term)
	condition += get_item_group_condition(pos_profile)

	lft, rgt = frappe.db.get_value("Item Group", item_group, ["lft", "rgt"])

	bin_join_selection, bin_join_condition = "", ""
	if hide_unavailable_items:
		bin_join_selection = ", `tabBin` bin"
		bin_join_condition = (
			"AND bin.warehouse = %(warehouse)s AND bin.item_code = item.name AND bin.actual_qty > 0"
		)

	items_data = frappe.db.sql(
		"""
		SELECT
			item.name AS item_code,
			item.item_name,
			item.description,
			item.stock_uom,
			item.image AS item_image,
			item.is_stock_item
		FROM
			`tabItem` item {bin_join_selection}
		WHERE
			item.disabled = 0
			AND item.has_variants = 0
			AND item.is_sales_item = 1
			AND item.is_fixed_asset = 0
			AND item.item_group in (SELECT name FROM `tabItem Group` WHERE lft >= {lft} AND rgt <= {rgt})
			AND {condition}
			{bin_join_condition}
		ORDER BY
			item.name asc
		LIMIT
			{page_length} offset {start}""".format(
			start=cint(start),
			page_length=cint(page_length),
			lft=cint(lft),
			rgt=cint(rgt),
			condition=condition,
			bin_join_selection=bin_join_selection,
			bin_join_condition=bin_join_condition,
		),
		{"warehouse": warehouse},
		as_dict=1,
	)

	# return (empty) list if there are no results
	if not items_data:
		return result

	for item in items_data:
		uoms = frappe.get_doc("Item", item.item_code).get("uoms", [])

		item.actual_qty, _ = get_stock_availability(item.item_code, warehouse)
		item.uom = item.stock_uom

		item_price = frappe.get_all(
			"Item Price",
			fields=["price_list_rate", "currency", "uom", "batch_no"],
			filters={
				"price_list": price_list,
				"item_code": item.item_code,
				"selling": True,
			},
		)

		if not item_price:
			result.append(item)

		for price in item_price:
			uom = next(filter(lambda x: x.uom == price.uom, uoms), {})

			if price.uom != item.stock_uom and uom and uom.conversion_factor:
				item.actual_qty = item.actual_qty // uom.conversion_factor

			result.append(
				{
					**item,
					"price_list_rate": price.get("price_list_rate"),
					"currency": price.get("currency"),
					"uom": price.uom or item.uom,
					"batch_no": price.batch_no,
				}
			)
	return {"items": result}


@frappe.whitelist()
def search_for_serial_or_batch_or_barcode_number(search_value: str) -> Dict[str, Optional[str]]:
	return scan_barcode(search_value)


def get_conditions(search_term):
	condition = "("
	condition += """item.name like {search_term}
		or item.item_name like {search_term}""".format(
		search_term=frappe.db.escape("%" + search_term + "%")
	)
	condition += add_search_fields_condition(search_term)
	condition += ")"

	return condition


def add_search_fields_condition(search_term):
	condition = ""
	search_fields = frappe.get_all("POS Search Fields", fields=["fieldname"])
	if search_fields:
		for field in search_fields:
			condition += " or item.`{0}` like {1}".format(
				field["fieldname"], frappe.db.escape("%" + search_term + "%")
			)
	return condition


def get_item_group_condition(pos_profile):
	cond = "and 1=1"
	item_groups = get_item_groups(pos_profile)
	if item_groups:
		cond = "and item.item_group in (%s)" % (", ".join(["%s"] * len(item_groups)))

	return cond % tuple(item_groups)


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def item_group_query(doctype, txt, searchfield, start, page_len, filters):
	item_groups = []
	cond = "1=1"
	pos_profile = filters.get("pos_profile")

	if pos_profile:
		item_groups = get_item_groups(pos_profile)

		if item_groups:
			cond = "name in (%s)" % (", ".join(["%s"] * len(item_groups)))
			cond = cond % tuple(item_groups)

	return frappe.db.sql(
		""" select distinct name from `tabItem Group`
			where {condition} and (name like %(txt)s) limit {page_len} offset {start}""".format(
			condition=cond, start=start, page_len=page_len
		),
		{"txt": "%%%s%%" % txt},
	)


@frappe.whitelist()
def check_opening_entry(user,value):
	filters = {"user": user, "pos_closing_entry": ["in", ["", None]], "docstatus": 1}
	if value:
		filters['pos_profile'] = value
	open_vouchers = frappe.db.get_all(
		"POS Opening Entry",
		filters=filters,
		fields=["name", "company", "pos_profile", "period_start_date"],
		order_by="period_start_date desc",
	)

	return open_vouchers


@frappe.whitelist()
def create_opening_voucher(pos_profile, company, balance_details):
	balance_details = json.loads(balance_details)

	new_pos_opening = frappe.get_doc(
		{
			"doctype": "POS Opening Entry",
			"period_start_date": frappe.utils.get_datetime(),
			"posting_date": frappe.utils.getdate(),
			"user": frappe.session.user,
			"pos_profile": pos_profile,
			"company": company,
		}
	)
	new_pos_opening.set("balance_details", balance_details)
	new_pos_opening.submit()

	return new_pos_opening.as_dict()


@frappe.whitelist()
@frappe.whitelist()
def get_past_order_list(search_term, status, limit=20):
	fields = ["name", "grand_total", "currency", "customer", "posting_time", "posting_date"]
	invoice_list = []

	if search_term and status:
		invoices_by_customer = frappe.db.get_all(
			"POS Invoice",
			filters={"customer": ["like", "%{}%".format(search_term)], "status": status},
			fields=fields,
			page_length=limit,
		)
		invoices_by_name = frappe.db.get_all(
			"POS Invoice",
			filters={"name": ["like", "%{}%".format(search_term)], "status": status},
			fields=fields,
			page_length=limit,
		)

		# Combine and remove duplicates based on invoice name
		invoice_dict = {}
		for invoice in invoices_by_customer + invoices_by_name:
			invoice_dict[invoice.name] = invoice
		invoice_list = list(invoice_dict.values())
	elif search_term:
		invoices_by_customer = frappe.db.get_all(
			"POS Invoice",
			filters={"customer": ["like", "%{}%".format(search_term)]},
			fields=fields,
			page_length=limit,
		)
		invoices_by_name = frappe.db.get_all(
			"POS Invoice",
			filters={"name": ["like", "%{}%".format(search_term)]},
			fields=fields,
			page_length=limit,
		)

		# Combine and remove duplicates based on invoice name
		invoice_dict = {}
		for invoice in invoices_by_customer + invoices_by_name:
			invoice_dict[invoice.name] = invoice
		invoice_list = list(invoice_dict.values())
	elif status:
		invoice_list = frappe.db.get_all(
			"POS Invoice", filters={"status": status}, fields=fields, page_length=limit
		)
	else:
		# If no search term and no status, return recent invoices
		invoice_list = frappe.db.get_all(
			"POS Invoice", fields=fields, page_length=limit, order_by="creation desc"
		)

	return invoice_list


@frappe.whitelist()
def set_customer_info(fieldname, customer, value=""):
	if fieldname == "loyalty_program":
		frappe.db.set_value("Customer", customer, "loyalty_program", value)

	contact = frappe.get_cached_value("Customer", customer, "customer_primary_contact")
	if not contact:
		contact = frappe.db.sql(
			"""
			SELECT parent FROM `tabDynamic Link`
			WHERE
				parenttype = 'Contact' AND
				parentfield = 'links' AND
				link_doctype = 'Customer' AND
				link_name = %s
			""",
			(customer),
			as_dict=1,
		)
		contact = contact[0].get("parent") if contact else None

	if not contact:
		new_contact = frappe.new_doc("Contact")
		new_contact.is_primary_contact = 1
		new_contact.first_name = customer
		new_contact.set("links", [{"link_doctype": "Customer", "link_name": customer}])
		new_contact.save()
		contact = new_contact.name
		frappe.db.set_value("Customer", customer, "customer_primary_contact", contact)

	contact_doc = frappe.get_doc("Contact", contact)
	if fieldname == "email_id":
		contact_doc.set("email_ids", [{"email_id": value, "is_primary": 1}])
		frappe.db.set_value("Customer", customer, "email_id", value)
	elif fieldname == "mobile_no":
		contact_doc.set("phone_nos", [{"phone": value, "is_primary_mobile_no": 1}])
		frappe.db.set_value("Customer", customer, "mobile_no", value)
	contact_doc.save()


@frappe.whitelist()
def get_pos_profile_data(pos_profile):
	pos_profile = frappe.get_doc("POS Profile", pos_profile)
	pos_profile = pos_profile.as_dict()

	_customer_groups_with_children = []
	for row in pos_profile.customer_groups:
		children = get_child_nodes("Customer Group", row.customer_group)
		_customer_groups_with_children.extend(children)

	pos_profile.customer_groups = _customer_groups_with_children
	return pos_profile


@frappe.whitelist()
def create_customer(customer):
	customer_check = frappe.db.sql(""" SELECT * FROM `tabCustomer` WHERE name=%s""",customer,as_dict=1)
	if len(customer_check) == 0:
		obj = {
			"doctype": "Customer",
			"customer_name": customer
		}

		frappe.get_doc(obj).insert()
		frappe.db.commit()


import frappe
from frappe.utils.pdf import get_pdf
from frappe.utils.file_manager import save_file

@frappe.whitelist()
def generate_pdf_and_save(docname, doctype, print_format=None):
	# Get the HTML content of the print format
	data = frappe.get_doc(doctype,docname)
	html = frappe.get_print(doctype, docname, print_format)

	# Generate PDF from HTML
	pdf_data = get_pdf(html)

	# Define file name
	file_name = f"{data.customer_name + docname.split('-')[-1]}.pdf"

	# Save the PDF as a file
	file_doc = save_file(file_name, pdf_data, doctype, docname, is_private=0)
	print("FILE DOOOOC")
	print(file_doc)
	return file_doc


@frappe.whitelist()
@frappe.whitelist()
def get_tables():
	"""Get all tables with dynamic status based on active orders"""
	tables = frappe.get_all("Table", fields=["name", "table_id", "table_name", "seating_capacity", "status"])

	# Check for active orders and update status dynamically
	for table in tables:
		# Check if there are any active POS Invoices for this table
		active_orders = frappe.db.count("POS Invoice", {
			"pos_table": table.name,
			"status": ["in", ["Draft", "Submitted", "Paid"]]
		})

		# Get order details for display
		order_details = frappe.db.sql("""
			SELECT
				COUNT(*) as order_count,
				MIN(TIMEDIFF(NOW(), creation)) as elapsed_time
			FROM `tabPOS Invoice`
			WHERE pos_table = %s AND status IN ('Draft', 'Submitted', 'Paid')
		""", (table.name,), as_dict=True)

		if order_details and order_details[0].order_count > 0:
			table.order_count = order_details[0].order_count
			# Convert timedelta to HH:MM format
			if order_details[0].elapsed_time:
				total_minutes = int(order_details[0].elapsed_time.total_seconds() / 60)
				hours = total_minutes // 60
				minutes = total_minutes % 60
				table.elapsed_time = f"{hours:02d}:{minutes:02d}"
			else:
				table.elapsed_time = "00:00"
		else:
			table.order_count = 0
			table.elapsed_time = None

		if active_orders > 0:
			# Table has active orders, should be occupied
			if table.status != "Occupied":
				table.status = "Occupied"
				# Update the actual table record
				frappe.db.set_value("Table", table.name, "status", "Occupied")
		else:
			# No active orders, table should be available
			if table.status != "Available":
				table.status = "Available"
				# Update the actual table record
				frappe.db.set_value("Table", table.name, "status", "Available")

	return tables


@frappe.whitelist()
def update_table_status_on_order(table_name, action):
	"""Update table status when order is created or completed"""
	if not table_name:
		return

	if action == "create":
		# Set table to Occupied when order is created
		frappe.db.set_value("Table", table_name, "status", "Occupied")
		log_table_status_change(table_name, "Available", "Occupied", f"Order created for table {table_name}")
	elif action == "complete":
		# Set table to Available when order is completed
		frappe.db.set_value("Table", table_name, "status", "Available")
		log_table_status_change(table_name, "Occupied", "Available", f"Order completed for table {table_name}")

@frappe.whitelist()
def manual_table_status_override(table_name, new_status, reason=None):
	"""Manually override table status with logging"""
	if not table_name or not new_status:
		frappe.throw("Table name and new status are required")

	current_status = frappe.db.get_value("Table", table_name, "status")

	if current_status != new_status:
		frappe.db.set_value("Table", table_name, "status", new_status)
		log_table_status_change(table_name, current_status, new_status,
			f"Manual override: {reason or 'No reason provided'}")

	return {"success": True, "message": f"Table {table_name} status updated to {new_status}"}

def log_table_status_change(table_name, old_status, new_status, reason):
	"""Log table status changes for tracking"""
	try:
		log_entry = frappe.get_doc({
			"doctype": "Table Status Log",
			"table": table_name,
			"old_status": old_status,
			"new_status": new_status,
			"changed_by": frappe.session.user,
			"change_reason": reason,
			"change_type": "Status Change" if "Manual" not in reason else "Override",
			"timestamp": frappe.utils.now()
		})
		log_entry.insert(ignore_permissions=True)
		frappe.db.commit()
	except Exception as e:
		# Log the error but don't fail the main operation
		frappe.log_error(f"Failed to log table status change: {str(e)}", "Table Status Logging")


# KOT API Functions
import json

def load_json(data):
	"""Load JSON data or return as is if it's already a Python dictionary"""
	if isinstance(data, str):
		return json.loads(data)
	return data


def create_order_items(items):
	"""Create a list of order items from a list of input items"""
	order_items = []
	for item in items:
		order_item = {
			"item_code": item.get("item_code", item.get("item", "")),
			"qty": item.get("qty", item.get("quantity", 0)),
			"item_name": item.get("item_name", ""),
			"comments": item.get("comments", ""),
		}
		order_items.append(order_item)
	return order_items


def compare_two_arrays(array_1, array_2):
	"""Compare two arrays and return the items that are different"""
	final_array = []
	for item1 in array_1:
		found = False
		for item2 in array_2:
			if item1["item_code"] == item2["item_code"]:
				qty_diff = item1["qty"] - item2["qty"]
				if qty_diff != 0:
					item1_copy = item1.copy()
					item1_copy["qty"] = qty_diff
					final_array.append(item1_copy)
				found = True
				break
		if not found:
			final_array.append(item1)
	return final_array


def get_removed_items(array_1, array_2):
	"""Get the items that have been removed from the second array compared to the first array"""
	removed_items = []
	for item2 in array_2:
		found = False
		for item1 in array_1:
			if item1["item_code"] == item2["item_code"]:
				found = True
				break
		if not found:
			removed_items.append(item2)
	return removed_items


def create_kot_doc(invoice_id, customer, restaurant_table, items, kot_type, comments, pos_profile_id, kot_naming_series, production=None):
	"""Create a KOT document with enhanced fields"""
	pos_invoice = frappe.get_doc("POS Invoice", invoice_id)
	order_number = pos_invoice.name or ""

	# Get menu for the branch
	branch = frappe.db.get_value("POS Profile", pos_profile_id, "branch")
	menu = None
	if branch:
		menu = frappe.db.get_value("Menu", {"branch": branch, "is_active": 1}, "name")

	# Check if aggregator order
	is_aggregator = 0
	aggregator_id = ""
	if hasattr(pos_invoice, 'order_type') and pos_invoice.order_type == "Aggregators":
		is_aggregator = 1
		aggregator_id = getattr(pos_invoice, 'custom_aggregator_id', "") or ""

	kot_items = []
	for item in items:
		# Get course and serve_priority from Menu Item
		course = "Main Course"
		serve_priority = 1

		if menu:
			menu_item = frappe.db.get_value("Menu Item",
				{"item": item["item_code"], "parent": menu, "parenttype": "Menu"},
				["course", "serve_priority"])
			if menu_item:
				course = menu_item[0] or "Main Course"
				serve_priority = menu_item[1] or 1

		kot_items.append({
			"item": item["item_code"],
			"item_name": item["item_name"],
			"quantity": item["qty"],
			"comments": item.get("comments", ""),
			"course": course,
			"serve_priority": serve_priority,
			"production_unit": production
		})

	kot_doc = frappe.get_doc({
		"doctype": "KOT",
		"invoice": invoice_id,
		"restaurant_table": restaurant_table,
		"customer_name": customer,
		"pos_profile": pos_profile_id,
		"comments": comments,
		"type": kot_type,
		"naming_series": kot_naming_series,
		"production": production,
		"order_no": order_number,
		"menu": menu,
		"is_aggregator": is_aggregator,
		"aggregator_id": aggregator_id,
		"time": frappe.utils.nowtime(),
		"branch": branch,
		"kot_items": kot_items
	})

	kot_doc.insert()
	kot_doc.save()
	frappe.db.commit()
	return kot_doc


@frappe.whitelist()
def kot_execute(invoice_id, customer, restaurant_table=None, current_items=[], previous_items=[], comments=None):
	"""Main function to handle KOT entry"""
	print(f"KOT: kot_execute called with invoice_id={invoice_id}")

	current_items = load_json(current_items)
	previous_items = load_json(previous_items)

	new_invoice_items_array = create_order_items(previous_items)
	new_order_items_array = create_order_items(current_items)

	final_array = compare_two_arrays(new_order_items_array, new_invoice_items_array)
	removed_item = get_removed_items(new_order_items_array, new_invoice_items_array)

	pos_invoice = frappe.get_doc("POS Invoice", invoice_id)
	pos_profile_id = pos_invoice.pos_profile
	pos_profile = frappe.get_doc("POS Profile", pos_profile_id)
	kot_naming_series = pos_profile.custom_kot_naming_series

	if not kot_naming_series:
		frappe.throw("KOT Naming Series is mandatory. Ensure it is configured in the POS Profile.")

	cancel_kot_naming_series = f"CNCL-{kot_naming_series}"

	positive_qty_items = [item for item in final_array if int(item["qty"]) > 0]
	negative_qty_items = [item for item in final_array if int(item["qty"]) <= 0]
	total_cancel_items = negative_qty_items + removed_item

	created_kots = []

	if positive_qty_items:
		print("KOT: Creating New Order KOT")
		kot_doc = process_items_for_kot(
			invoice_id,
			customer,
			restaurant_table,
			positive_qty_items,
			comments,
			pos_profile_id,
			kot_naming_series,
			"New Order",
		)
		if kot_doc:
			created_kots.append(kot_doc)

	if total_cancel_items:
		print("KOT: Creating Cancelled KOT")
		kot_doc = process_items_for_cancel_kot(
			invoice_id,
			customer,
			restaurant_table,
			total_cancel_items,
			comments,
			pos_profile_id,
			cancel_kot_naming_series,
			"Cancelled",
			invoice_items=new_invoice_items_array
		)
		if kot_doc:
			created_kots.append(kot_doc)

	result = created_kots[0] if created_kots else None
	print(f"KOT: Returning {result.name if result else None}")
	return result


def process_items_for_kot(invoice_id, customer, restaurant_table, items, comments, pos_profile_id, kot_naming_series, kot_type):
	"""Process items to create KOT documents with production unit assignment"""
	pos_invoice = frappe.get_doc("POS Invoice", invoice_id)
	branch = frappe.db.get_value("POS Profile", pos_profile_id, "branch") or None

	# Group items by production unit
	production_units = {}
	for item in items:
		item_group = frappe.db.get_value("Item", item["item_code"], "item_group")
		production_unit = get_production_unit_for_item_group(item_group, branch)

		if production_unit not in production_units:
			production_units[production_unit] = []
		production_units[production_unit].append(item)

	created_kots = []
	for production_unit, unit_items in production_units.items():
		kot_doc = create_kot_doc(
			invoice_id,
			customer,
			restaurant_table,
			unit_items,
			kot_type,
			comments,
			pos_profile_id,
			kot_naming_series,
			production_unit,
		)
		if kot_doc:
			created_kots.append(kot_doc)

	return created_kots[0] if created_kots else None


def get_production_unit_for_item_group(item_group, branch):
	"""Get production unit for item group and branch"""
	if not item_group or not branch:
		return None

	# Get all production units for the branch
	production_units = frappe.get_all("Production Unit",
		filters={"branch": branch},
		fields=["name"])

	# Check each production unit to see if it contains the item group
	for pu in production_units:
		production_unit_doc = frappe.get_doc("Production Unit", pu.name)
		for item_group_entry in production_unit_doc.item_groups:
			if item_group_entry.item_group == item_group:
				return pu.name

	return None


def process_items_for_cancel_kot(invoice_id, customer, restaurant_table, cancel_items, comments, pos_profile_id, cancel_kot_naming_series, kot_type, invoice_items=None):
	"""Process items to create a cancel KOT document"""
	pos_invoice = frappe.get_doc("POS Invoice", invoice_id)

	kot_doc = frappe.get_doc({
		"doctype": "KOT",
		"naming_series": cancel_kot_naming_series,
		"restaurant_table": restaurant_table,
		"customer_name": customer,
		"type": kot_type,
		"invoice": invoice_id,
		"pos_profile": pos_profile_id,
		"comments": comments,
		"time": frappe.utils.nowtime(),
		"branch": frappe.db.get_value("POS Profile", pos_profile_id, "branch") or None
	})

	for cancel_item in cancel_items:
		# Find matching item in invoice for quantity reference
		original_qty = 0
		if invoice_items:
			for inv_item in invoice_items:
				if inv_item["item_code"] == cancel_item["item_code"]:
					original_qty = inv_item["qty"]
					break

		kot_doc.append("kot_items", {
			"item": cancel_item["item_code"],
			"item_name": cancel_item["item_name"],
			"cancelled_qty": abs(int(cancel_item["qty"])),
			"quantity": original_qty,
			"comments": cancel_item.get("comments", ""),
		})

	kot_doc.insert()
	kot_doc.save()
	frappe.db.commit()
	return kot_doc