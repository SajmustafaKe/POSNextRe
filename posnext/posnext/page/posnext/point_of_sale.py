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


def search_by_term(search_term,custom_show_alternative_item_for_pos_search, warehouse, price_list):
	result = search_for_serial_or_batch_or_barcode_number(search_term) or {}

	item_code = result.get("item_code", "")
	serial_no = result.get("serial_no", "")
	batch_no = result.get("batch_no", "")
	barcode = result.get("barcode", "")

	if not result:
		return
	print("RESSSSULT")
	print(result)
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
		"item_uoms": frappe.db.get_all("UOM Conversion Detail", {"parent": item_doc.item_code}, ["uom"], pluck="uom")
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
	warehouse, hide_unavailable_items,custom_show_last_incoming_rate, custom_show_alternative_item_for_pos_search,custom_show_logical_rack, custom_skip_stock_transaction_validation = frappe.db.get_value(
		"POS Profile", pos_profile, ["warehouse", "hide_unavailable_items","custom_show_last_incoming_rate","custom_show_alternative_item_for_pos_search","custom_show_logical_rack", "custom_skip_stock_transaction_validation"]
	)

	result = []

	if search_term:
		result = search_by_term(search_term,custom_show_alternative_item_for_pos_search, warehouse, price_list) or []
		if result:
			return result
	alt_items = []
	if custom_show_alternative_item_for_pos_search:
		alt_items = frappe.db.sql(""" SELECT * FROM `tabAlternative Items` 
 									WHERE parent like %s or parent_item_name like %s or parent_item_description like %s or parent_oem_part_number like %s""",('%' + search_term + '%','%' + search_term + '%','%' + search_term + '%','%' + search_term + '%'),as_dict=1)
	if not frappe.db.exists("Item Group", item_group):
		item_group = get_root_of("Item Group")

	condition = get_conditions(search_term,alt_items)
	condition += get_item_group_condition(pos_profile)

	lft, rgt = frappe.db.get_value("Item Group", item_group, ["lft", "rgt"])

	bin_join_selection, bin_join_condition,bin_valuation_rate,bin_join_condition_valuation = "", "","",""
	if not custom_skip_stock_transaction_validation:
		if hide_unavailable_items:
			bin_join_selection = ", `tabBin` bin"
			bin_join_condition = (
				"AND bin.warehouse = %(warehouse)s AND bin.item_code = item.name AND bin.actual_qty > 0"
			)

		if not bin_join_selection:
			bin_join_selection = ", `tabBin` bin"
		bin_valuation_rate = "bin.valuation_rate, bin.valuation_rate as custom_valuation_rate,"
	
		bin_join_condition_valuation = (
			"AND bin.warehouse = %(warehouse)s AND bin.item_code = item.name"
		)

	items_data = frappe.db.sql(
		"""
		SELECT
			item.name AS item_code,
			item.custom_oem_part_number,
			item.item_name,
			item.description,
			item.stock_uom,
			{bin_valuation_rate}
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
			{bin_join_condition_valuation}
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
			bin_valuation_rate=bin_valuation_rate,
			bin_join_condition=bin_join_condition,
			bin_join_condition_valuation=bin_join_condition_valuation
		),
		{"warehouse": warehouse},
		as_dict=1,
	)

	# return (empty) list if there are no results
	if not items_data:
		return result

	for item in items_data:
		if custom_show_logical_rack:
			rack = frappe.db.sql(""" SELECT * FROM `tabLogical Rack` WHERE item=%s and pos_profile=%s """,(item.item_code,pos_profile),as_dict=1)
			if len(rack) > 0:
				item['rack'] = rack[0].rack_id
				item['custom_logical_rack'] = rack[0].rack_id
		uoms = frappe.get_doc("Item", item.item_code).get("uoms", [])
		item["custom_item_uoms"] = frappe.db.get_all("UOM Conversion Detail", {"parent": item.item_code}, ["uom"], pluck="uom")
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
			order_by="creation desc",
			limit=1
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


def get_conditions(search_term,new_items):
	condition = "("

	condition += """(item.name like {search_term}
		or item.item_name like {search_term} or item.description like {search_term} or item.custom_oem_part_number like {search_term}) """.format(
		search_term=frappe.db.escape("%" + search_term + "%")
	)
	if len(new_items) > 0:
		for xx in new_items:
			condition += """or (item.name like {xx}
		or item.item_name like {xx}) """.format(
		xx=frappe.db.escape("%" + xx.item + "%")
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
def get_past_order_list(search_term, status, pos_profile=None, limit=20):
	fields = ["name", "grand_total", "currency", "customer", "posting_time", "posting_date"]
	invoice_list = []
	if status == "Unpaid":
		status = ["in", ["Unpaid", "Partly Paid", "Overdue"]]

	if search_term and status:
		fltr1 = {"customer": ["like", "%{}%".format(search_term)], "status": status}
		if pos_profile:
			fltr1 = {"customer": ["like", "%{}%".format(search_term)], "status": status, "pos_profile": pos_profile}
		invoices_by_customer = frappe.db.get_all(
			"Sales Invoice",
			filters=fltr1,
			fields=fields,
			page_length=limit,
		)
		fltr2 = {"name": ["like", "%{}%".format(search_term)], "status": status}
		if pos_profile:
			fltr2 = {"name": ["like", "%{}%".format(search_term)], "status": status, "pos_profile": pos_profile}
		invoices_by_name = frappe.db.get_all(
			"Sales Invoice",
			filters=fltr2,
			fields=fields,
			page_length=limit,
		)

		invoice_list = invoices_by_customer + invoices_by_name
	elif status:
		fltr = {"status": status}
		if pos_profile:
			fltr = {"status": status, "pos_profile": pos_profile}
		invoice_list = frappe.db.get_all(
			"Sales Invoice", filters=fltr, fields=fields, page_length=limit
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
	for row in pos_profile.payments:
		if row.default:
			pos_profile['default_payment'] = row.mode_of_payment
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
def make_sales_return(source_name, target_doc=None):
	from erpnext.controllers.sales_and_purchase_return import make_return_doc

	return make_return_doc("Sales Invoice", source_name, target_doc)


@frappe.whitelist()
def get_lcr(customer=None, item_code=None):
	d = None
	if customer and item_code:
		d = frappe.db.sql(f"""
		SELECT item.rate FROM `tabSales Invoice Item` item INNER JOIN `tabSales Invoice` SI ON SI.name=item.parent
		WHERE SI.customer='{customer}' AND item.item_code='{item_code}' 
		ORDER BY SI.creation desc 
		LIMIT 1
		""", as_dict=True)
	if d:
		return d[0].rate
	else:
		return 0

@frappe.whitelist()
def get_uoms(item_code):
	d = frappe.db.get_all("UOM Conversion Detail", {"parent": item_code}, ["uom"], pluck="uom")
	if d:
		return d
	else:
		return []
	
@frappe.whitelist()
def get_barcodes(item_code):
	return frappe.db.get_all("Item Barcode", filters={"parent": item_code}, fields=["barcode"])

@frappe.whitelist()
def get_user_name_from_secret_key(secret_key):
    if frappe.db.exists("User Secret Key", {"secret_key": secret_key}):
        return frappe.get_value("User Secret Key", {"secret_key": secret_key}, "user_name")
    else:
        frappe.throw("Invalid secret key")


@frappe.whitelist()
def check_edit_permission(invoice_name, secret_key):
    try:
        if not frappe.db.exists("Sales Invoice", {"name": invoice_name, "docstatus": 0}):
            frappe.throw("Invoice not found or is not in draft status")
        
        
        user = frappe.call("posnext.posnext.page.posnext.point_of_sale.get_user_name_from_secret_key", secret_key=secret_key)
        if not user:
            frappe.throw("Invalid secret key", frappe.AuthenticationError)
        
        invoice = frappe.get_doc("Sales Invoice", invoice_name)
        
        
        if invoice.created_by_name != user:
            frappe.throw(
                f"You did not create this invoice, hence you cannot edit it. Only the creator ({invoice.created_by_name}) can edit it.",
                frappe.PermissionError
            )
        
        return {
            "can_edit": True,
            "created_by_name": invoice.created_by_name
        }
    except Exception as e:
        frappe.log_error(f"Permission Check Failed: {str(e)[:100]}", "POSNext")
        raise

@frappe.whitelist()
def get_available_opening_entry():
	"""
	Get any available POS Opening Entry for waiters to use
	Returns the most recent opening entry that hasn't been closed
	"""
	# Get all open POS Opening Entries (not closed)
	open_vouchers = frappe.db.get_all(
		"POS Opening Entry",
		filters={
			"pos_closing_entry": ["in", ["", None]], 
			"docstatus": 1
		},
		fields=["name", "company", "pos_profile", "period_start_date", "user"],
		order_by="period_start_date desc",
		limit=1  # Get the most recent one
	)
	
	return open_vouchers