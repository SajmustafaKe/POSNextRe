# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt


import json
from copy import deepcopy
from typing import Dict, Optional
import traceback

import frappe
from frappe import _
from frappe.utils import cint, flt, now, nowdate, cstr
from frappe.utils.file_manager import save_file
from frappe.utils.nestedset import get_root_of
from frappe.utils.pdf import get_pdf
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
def get_past_order_list(search_term='', status='', created_by='', limit=20):
	# Convert limit to integer if it's passed as string
	limit = int(limit) if limit else 20
	fields = ["name", "grand_total", "currency", "customer", "posting_time", "posting_date", "created_by_name"]
	invoice_list = []
	
	# Build base filters
	base_filters = {}
	if status:
		base_filters["status"] = status
	if created_by:
		# Filter by created_by_name field in POS Invoice
		# This should match the user_name from User Secret Key
		base_filters["created_by_name"] = created_by
	
	if search_term and (status or created_by):
		# Search by customer name
		customer_filters = base_filters.copy()
		customer_filters["customer"] = ["like", "%{}%".format(search_term)]
		
		invoices_by_customer = frappe.db.get_all(
			"POS Invoice",
			filters=customer_filters,
			fields=fields,
			page_length=limit,
			order_by="modified desc"
		)
		
		# Search by invoice name
		name_filters = base_filters.copy()
		name_filters["name"] = ["like", "%{}%".format(search_term)]
		
		invoices_by_name = frappe.db.get_all(
			"POS Invoice",
			filters=name_filters,
			fields=fields,
			page_length=limit,
			order_by="modified desc"
		)
		
		# Combine results and remove duplicates
		invoice_list = invoices_by_customer + invoices_by_name
		# Remove duplicates by converting to dict with name as key, then back to list
		unique_invoices = {}
		for invoice in invoice_list:
			unique_invoices[invoice.name] = invoice
		invoice_list = list(unique_invoices.values())
		
	elif status or created_by:
		# Filter by status and/or created_by only
		invoice_list = frappe.db.get_all(
			"POS Invoice", 
			filters=base_filters, 
			fields=fields, 
			page_length=limit,
			order_by="modified desc"
		)
	else:
		# No filters - get all invoices
		invoice_list = frappe.db.get_all(
			"POS Invoice", 
			fields=fields, 
			page_length=limit,
			order_by="modified desc"
		)
	
	# Sort by creation date (most recent first) and limit results
	invoice_list = sorted(invoice_list, key=lambda x: x.get('creation', ''), reverse=True)[:limit]
	
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
def save_draft_invoice(doc):
    try:
        doc = frappe.parse_json(doc)
        
        # Validate required fields
        if not doc.get("pos_profile"):
            frappe.throw("POS Profile is required for draft invoice")
        if not doc.get("customer"):
            frappe.throw("Customer is required for draft invoice")
        if not doc.get("items"):
            frappe.throw("Items are required for draft invoice")
        if not doc.get("created_by_name"):
            frappe.throw("Created By Name is required for draft invoice")
        
        # Fetch POS Profile
        pos_profile_doc = frappe.get_doc("POS Profile", doc.get("pos_profile"))
        
        # Ensure "Cash" Mode of Payment exists
        if not frappe.db.exists("Mode of Payment", "Cash"):
            frappe.get_doc({
                "doctype": "Mode of Payment",
                "mode_of_payment": "Cash",
                "enabled": 1
            }).insert(ignore_permissions=True)
        
        # Set payment methods
        payment_methods = pos_profile_doc.get("payments", [])
        default_payment = (
            [{"mode_of_payment": payment_methods[0].mode_of_payment, "amount": 0}]
            if payment_methods
            else [{"mode_of_payment": "Cash", "amount": 0}]
        )
        
        # Check if invoice with the provided name exists and is in draft status
        invoice_name = doc.get("name")
        input_created_by_name = doc.get("created_by_name")
        
        if invoice_name and frappe.db.exists("POS Invoice", {"name": invoice_name, "docstatus": 0}):
            # Load existing draft invoice
            invoice = frappe.get_doc("POS Invoice", invoice_name)
            
            # Check if the input created_by_name matches the existing invoice's created_by_name
            if invoice.created_by_name != input_created_by_name:
                frappe.throw(
                    f"You are not authorized to edit this invoice. Only the creator ({invoice.created_by_name}) can edit it.",
                    frappe.PermissionError
                )
            
            # Update existing draft invoice
            invoice_data = {
                "customer": doc.get("customer"),
                "items": [
                    {
                        "item_code": item.get("item_code"),
                        "qty": item.get("qty", 1),
                        "rate": item.get("rate", 0),
                        "uom": item.get("uom"),
                        "warehouse": item.get("warehouse") or pos_profile_doc.warehouse,
                        "serial_no": item.get("serial_no"),
                        "batch_no": item.get("batch_no")
                    } for item in doc.get("items", [])
                ],
                "pos_profile": doc.get("pos_profile"),
                "company": doc.get("company") or pos_profile_doc.company,
                "payments": default_payment,
                "set_warehouse": pos_profile_doc.warehouse,
                "posting_date": frappe.utils.nowdate(),
                "posting_time": frappe.utils.nowtime(),
                "currency": pos_profile_doc.currency or frappe.defaults.get_global_default("currency"),
                "docstatus": 0
            }
            # Update created_by_name only if explicitly provided and valid
            if doc.get("created_by_name"):
                invoice_data["created_by_name"] = doc.get("created_by_name")
                
            invoice.update(invoice_data)
            invoice.save()
        else:
            # Create new POS Invoice
            invoice = frappe.get_doc({
                "doctype": "POS Invoice",
                "customer": doc.get("customer"),
                "items": [
                    {
                        "item_code": item.get("item_code"),
                        "qty": item.get("qty", 1),
                        "rate": item.get("rate", 0),
                        "uom": item.get("uom"),
                        "warehouse": item.get("warehouse") or pos_profile_doc.warehouse,
                        "serial_no": item.get("serial_no"),
                        "batch_no": item.get("batch_no")
                    } for item in doc.get("items", [])
                ],
                "created_by_name": input_created_by_name,
                "is_pos": 1,
                "pos_profile": doc.get("pos_profile"),
                "company": doc.get("company") or pos_profile_doc.company,
                "payments": default_payment,
                "set_warehouse": pos_profile_doc.warehouse,
                "posting_date": frappe.utils.nowdate(),
                "posting_time": frappe.utils.nowtime(),
                "currency": pos_profile_doc.currency or frappe.defaults.get_global_default("currency"),
                "docstatus": 0
            })
            invoice.insert()
        
        return {"name": invoice.name}
    except Exception as e:
        frappe.log_error(f"Save Draft Failed: {str(e)[:100]}", "POSNext")
        raise

@frappe.whitelist()
def check_edit_permission(invoice_name, secret_key):
    try:
        if not frappe.db.exists("POS Invoice", {"name": invoice_name, "docstatus": 0}):
            frappe.throw("Invoice not found or is not in draft status")
        
        # Get the user associated with the secret key
        user = frappe.call("posnext.posnext.page.posnext.point_of_sale.get_user_name_from_secret_key", secret_key=secret_key)
        if not user:
            frappe.throw("Invalid secret key", frappe.AuthenticationError)
        
        invoice = frappe.get_doc("POS Invoice", invoice_name)
        
        # Check if the user matches created_by_name
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

@frappe.whitelist()
def get_user_name_from_secret_key(secret_key):
    if frappe.db.exists("User Secret Key", {"secret_key": secret_key}):
        return frappe.get_value("User Secret Key", {"secret_key": secret_key}, "user_name")
    else:
        frappe.throw("Invalid secret key")

@frappe.whitelist()
def print_captain_order(invoice_name, current_items, print_format, _lang):
    """
    Print only newly added items to a captain order (POS Invoice)
    """
    try:
        # Parse current_items if it's a string
        if isinstance(current_items, str):
            try:
                current_items = json.loads(current_items)
            except json.JSONDecodeError as e:
                frappe.log_error(f"Failed to parse current_items: {str(e)}")
                return {"success": False, "error": "Invalid current_items format: not a valid JSON string"}
        
        # Validate current_items
        if not isinstance(current_items, list):
            frappe.log_error(f"Invalid current_items type: expected list, got {type(current_items)}")
            return {"success": False, "error": "current_items must be a list"}
        
        if not current_items:
            frappe.log_error("current_items is empty", "Print Debug")
            return {"success": False, "error": "No items to print"}
        
        # Log input for debugging
        frappe.log_error(f"Invoice: {invoice_name}, Received {len(current_items)} items", "Print Debug")
        
        # Get or create print tracking record
        print_log_name = f"captain_print_{invoice_name}"
        
        previously_printed_items = []
        print_log = None
        
        # Check if print log exists before trying to get it
        if frappe.db.exists("Captain Print Log", print_log_name):
            print_log = frappe.get_doc("Captain Print Log", print_log_name)
            previously_printed_items = json.loads(print_log.printed_items or "[]")
            frappe.log_error(f"Found print log: {print_log_name}, Previously printed {len(previously_printed_items)} items", "Print Debug")
        else:
            frappe.log_error(f"Print log {print_log_name} not found, creating new one", "Print Debug")
            try:
                print_log = frappe.get_doc({
                    "doctype": "Captain Print Log",
                    "name": print_log_name,
                    "invoice_name": invoice_name,
                    "printed_items": "[]",
                    "last_print_time": now()
                })
                print_log.insert(ignore_permissions=True)
                frappe.db.commit()
                frappe.log_error(f"Created new print log: {print_log_name}", "Print Debug")
            except Exception as e:
                frappe.log_error(f"Failed to create print log {print_log_name}: {str(e)}", "Print Debug")
                return {"success": False, "error": f"Failed to create print log: {str(e)}"}
        
        # Calculate new items to print - Use item_code + item_name as composite key for better matching
        new_items_to_print = []
        
        # Create a dictionary of previously printed items using composite key
        prev_items_dict = {}
        for prev_item in previously_printed_items:
            item_code = prev_item.get('item_code')
            item_name = prev_item.get('item_name', item_code)
            if item_code:
                # Use item_code as primary key, but consider item_name for uniqueness
                key = f"{item_code}|{item_name}"
                prev_items_dict[key] = {
                    'qty': float(prev_item.get('qty', 0)),
                    'rate': float(prev_item.get('rate', 0)),
                    'item_data': prev_item
                }
        
        frappe.log_error(f"Previous items: {len(previously_printed_items)}", "Print Debug")
        frappe.log_error(f"Current items: {len(current_items)}", "Print Debug")
        
        # Process each current item to determine what's new
        for current_item in current_items:
            item_code = current_item.get('item_code')
            item_name = current_item.get('item_name') or item_code
            
            if not item_code:
                frappe.log_error(f"Skipping item without item_code: {current_item}", "Print Debug")
                continue
                
            current_qty = float(current_item.get('qty', 0))
            current_rate = float(current_item.get('rate', 0))
            
            # Create composite key
            key = f"{item_code}|{item_name}"
            
            # Check if this item was previously printed
            if key in prev_items_dict:
                previous_qty = prev_items_dict[key]['qty']
                previous_rate = prev_items_dict[key]['rate']
                
                frappe.log_error(f"{item_code}: current_qty={current_qty}, previous_qty={previous_qty}", "Print Debug")
                
                # Only print if quantity increased or rate changed
                if current_qty > previous_qty:
                    qty_to_print = current_qty - previous_qty
                    
                    new_item = current_item.copy()
                    new_item['qty'] = qty_to_print
                    new_item['item_name'] = item_name
                    new_item['amount'] = qty_to_print * current_rate
                    new_items_to_print.append(new_item)
                    
                    frappe.log_error(f"Added to print: {item_code} - qty_to_print={qty_to_print}", "Print Debug")
                elif current_rate != previous_rate:
                    # If rate changed, print the full current quantity with updated rate
                    new_item = current_item.copy()
                    new_item['qty'] = current_qty
                    new_item['item_name'] = item_name
                    new_item['amount'] = current_qty * current_rate
                    new_items_to_print.append(new_item)
                    
                    frappe.log_error(f"Added to print (rate change): {item_code} - qty={current_qty}, new_rate={current_rate}", "Print Debug")
                else:
                    frappe.log_error(f"No change for: {item_code}", "Print Debug")
            else:
                # This is a completely new item
                new_item = current_item.copy()
                new_item['item_name'] = item_name
                new_item['amount'] = current_qty * current_rate
                new_items_to_print.append(new_item)
                
                frappe.log_error(f"New item added: {item_code} - qty={current_qty}", "Print Debug")
        
        # If no new items to print
        if not new_items_to_print:
            frappe.log_error("No new items to print", "Print Debug")
            return {
                "success": True, 
                "data": {},
                "message": "No new items to print",
                "new_items_count": 0,
                "print_count": getattr(print_log, 'print_count', 0) or 0
            }
        
        # Get original invoice for context
        try:
            original_invoice = frappe.get_doc("POS Invoice", invoice_name)
        except frappe.DoesNotExistError:
            frappe.log_error(f"POS Invoice {invoice_name} not found", "Print Debug")
            return {"success": False, "error": f"POS Invoice {invoice_name} not found"}
        
        # Calculate totals for new items only
        total_qty = sum(float(item.get('qty', 0)) for item in new_items_to_print)
        total_amount = sum(float(item.get('amount', 0)) for item in new_items_to_print)
        
        # Create pseudo document data with ONLY new items
        pseudo_doc_data = {
            "name": invoice_name,
            "customer": original_invoice.customer,
            "posting_date": original_invoice.posting_date,
            "posting_time": original_invoice.posting_time,
            "pos_profile": original_invoice.pos_profile,
            "company": original_invoice.company,
            "territory": getattr(original_invoice, 'territory', ''),
            "items": new_items_to_print,  # Only new items
            "timestamp": now(),
            "is_captain_order_reprint": len(previously_printed_items) > 0,
            "print_count": (getattr(print_log, 'print_count', 0) or 0) + 1,
            "created_by_name": original_invoice.created_by_name,
            "total_qty": total_qty,
            "total_amount": total_amount,
            "new_items_only": True  # Flag to indicate this contains only new items
        }
        
        # Update print log with ALL current items (complete state)
        if print_log:
            # Create updated printed items list with current quantities
            updated_printed_items = []
            
            # Add all current items to the printed items log with their current state
            for item in current_items:
                item_code = item.get('item_code')
                if item_code:
                    updated_printed_items.append({
                        'item_code': item_code,
                        'item_name': item.get('item_name') or item_code,
                        'qty': item.get('qty', 0),
                        'rate': item.get('rate', 0),
                        'uom': item.get('uom', ''),
                        'name': item.get('name', ''),
                        'amount': float(item.get('qty', 0)) * float(item.get('rate', 0))
                    })
            
            print_log.printed_items = json.dumps(updated_printed_items)
            print_log.last_print_time = now()
            print_log.print_count = (print_log.print_count or 0) + 1
            
            try:
                print_log.save(ignore_permissions=True)
                frappe.db.commit()
                frappe.log_error(f"Updated print log: {print_log_name} with {len(updated_printed_items)} total items", "Print Debug")
            except Exception as e:
                frappe.log_error(f"Failed to update print log {print_log_name}: {str(e)}", "Print Debug")
        
        frappe.log_error(f"SUCCESS: Returning {len(new_items_to_print)} new items to print", "Print Debug")
        
        return {
            "success": True, 
            "data": pseudo_doc_data,
            "new_items_count": len(new_items_to_print),
            "print_count": print_log.print_count or 1,
            "total_items_in_invoice": len(current_items)
        }
        
    except Exception as e:
        frappe.log_error(f"Error in print_captain_order: {str(e)}", "Captain Order Print Error")
        frappe.log_error(f"Traceback: {traceback.format_exc()}", "Captain Order Print Error")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def merge_invoices(invoice_names, customer):
    """
    Merge multiple POS invoices into a single invoice
    """
    try:
        # Check if user has Waiter role - if they do, deny access
        user_roles = frappe.get_roles(frappe.session.user)
        if 'Waiter' in user_roles:
            return {"success": False, "error": "You do not have permission to merge invoices"}
        
        # Parse invoice_names if it's a string
        if isinstance(invoice_names, str):
            invoice_names = json.loads(invoice_names)
        
        # Validate inputs
        if not invoice_names or len(invoice_names) < 2:
            return {"success": False, "error": "At least 2 invoices are required for merging"}
        
        # Get all invoices to merge
        invoices_to_merge = []
        for name in invoice_names:
            invoice = frappe.get_doc("POS Invoice", name)
            if invoice.customer != customer:
                return {"success": False, "error": f"Invoice {name} belongs to a different customer"}
            if invoice.docstatus != 0:  # Only draft invoices can be merged
                return {"success": False, "error": f"Invoice {name} is not in draft status"}
            invoices_to_merge.append(invoice)
        
        # Create new merged invoice
        first_invoice = invoices_to_merge[0]
        merged_invoice = frappe.new_doc("POS Invoice")
        
        # Copy header information from first invoice
        merged_invoice.customer = first_invoice.customer
        merged_invoice.posting_date = first_invoice.posting_date
        merged_invoice.posting_time = now()
        merged_invoice.company = first_invoice.company
        merged_invoice.pos_profile = first_invoice.pos_profile
        merged_invoice.currency = first_invoice.currency
        merged_invoice.selling_price_list = first_invoice.selling_price_list
        merged_invoice.price_list_currency = first_invoice.price_list_currency
        merged_invoice.plc_conversion_rate = first_invoice.plc_conversion_rate
        merged_invoice.conversion_rate = first_invoice.conversion_rate
        merged_invoice.is_pos = 1
        merged_invoice.is_return = 0
        
        # Copy created_by_name from first invoice
        if hasattr(first_invoice, 'created_by_name') and first_invoice.created_by_name:
            merged_invoice.created_by_name = first_invoice.created_by_name
        
        # Copy customer details
        merged_invoice.customer_name = first_invoice.customer_name
        merged_invoice.customer_group = first_invoice.customer_group
        merged_invoice.territory = first_invoice.territory
        
        # Copy address and contact details if available
        if hasattr(first_invoice, 'customer_address'):
            merged_invoice.customer_address = first_invoice.customer_address
        if hasattr(first_invoice, 'address_display'):
            merged_invoice.address_display = first_invoice.address_display
        if hasattr(first_invoice, 'contact_person'):
            merged_invoice.contact_person = first_invoice.contact_person
        if hasattr(first_invoice, 'contact_display'):
            merged_invoice.contact_display = first_invoice.contact_display
        if hasattr(first_invoice, 'contact_mobile'):
            merged_invoice.contact_mobile = first_invoice.contact_mobile
        if hasattr(first_invoice, 'contact_email'):
            merged_invoice.contact_email = first_invoice.contact_email
        
        # Merge all items from all invoices
        item_dict = {}  # To consolidate same items
        
        for invoice in invoices_to_merge:
            for item in invoice.items:
                key = (item.item_code, item.rate, item.uom)  # Group by item_code, rate, and uom
                
                if key in item_dict:
                    # Add to existing item
                    item_dict[key]['qty'] += item.qty
                    item_dict[key]['amount'] += item.amount
                else:
                    # Create new item entry
                    item_dict[key] = {
                        'item_code': item.item_code,
                        'item_name': item.item_name,
                        'description': item.description,
                        'qty': item.qty,
                        'uom': item.uom,
                        'rate': item.rate,
                        'amount': item.amount,
                        'item_group': item.item_group,
                        'warehouse': item.warehouse,
                        'income_account': item.income_account,
                        'expense_account': item.expense_account,
                        'cost_center': item.cost_center
                    }
        
        # Add consolidated items to merged invoice
        for item_data in item_dict.values():
            merged_invoice.append("items", item_data)
        
        # Handle taxes - use taxes from first invoice
        for tax in first_invoice.taxes:
            merged_invoice.append("taxes", {
                'charge_type': tax.charge_type,
                'account_head': tax.account_head,
                'description': tax.description,
                'rate': tax.rate,
                'tax_amount': tax.tax_amount,
                'total': tax.total,
                'cost_center': tax.cost_center
            })
        
        # Handle payments - combine all payments
        total_paid = 0
        payment_dict = {}  # To consolidate same payment methods
        
        for invoice in invoices_to_merge:
            for payment in invoice.payments:
                mode_of_payment = payment.mode_of_payment
                if mode_of_payment in payment_dict:
                    payment_dict[mode_of_payment]['amount'] += payment.amount
                else:
                    payment_dict[mode_of_payment] = {
                        'mode_of_payment': payment.mode_of_payment,
                        'account': payment.account,
                        'amount': payment.amount,
                        'default': payment.default
                    }
                total_paid += payment.amount
        
        # Add consolidated payments to merged invoice
        for payment_data in payment_dict.values():
            merged_invoice.append("payments", payment_data)
        
        # Save the merged invoice
        merged_invoice.insert()
        
        # Calculate totals
        merged_invoice.run_method("calculate_taxes_and_totals")
        merged_invoice.save()
        
        # Add comment showing all creators and original invoices
        creators = list(set([inv.created_by_name for inv in invoices_to_merge if hasattr(inv, 'created_by_name') and inv.created_by_name]))
        original_invoices = [inv.name for inv in invoices_to_merge]
        
        comment_parts = []
        comment_parts.append(f"Merged from invoices: {', '.join(original_invoices)}")
        
        if creators:
            if len(creators) > 1:
                comment_parts.append(f"Originally created by: {', '.join(creators)}")
            else:
                comment_parts.append(f"Originally created by: {creators[0]}")
        
        merged_invoice.add_comment('Comment', ' | '.join(comment_parts))
        
        # Handle Captain Print Log records before deleting invoices
        print_logs_transferred = 0
        print_logs_errors = []
        
        for invoice in invoices_to_merge:
            try:
                # Find all Captain Print Log records linked to this invoice
                print_logs = frappe.get_all("Captain Print Log", 
                                           filters={"invoice_name": invoice.name},
                                           pluck="name")
                
                # Transfer each Captain Print Log record to the merged invoice
                for log_name in print_logs:
                    try:
                        log_doc = frappe.get_doc("Captain Print Log", log_name)
                        log_doc.invoice_name = merged_invoice.name  # Update reference to merged invoice
                        log_doc.add_comment('Comment', f'Transferred from {invoice.name} due to invoice merge')
                        log_doc.save()
                        print_logs_transferred += 1
                    except Exception as e:
                        error_msg = f"Error transferring Captain Print Log {log_name}: {str(e)}"
                        print_logs_errors.append(error_msg)
                        frappe.log_error(error_msg)
                        
            except Exception as e:
                error_msg = f"Error finding Captain Print Log records for invoice {invoice.name}: {str(e)}"
                print_logs_errors.append(error_msg)
                frappe.log_error(error_msg)
        
        # Cancel the original invoices
        for invoice in invoices_to_merge:
            # Add a comment about the merge
            invoice.add_comment('Comment', f'Invoice merged into {merged_invoice.name}')
            # Delete the draft invoice
            frappe.delete_doc("POS Invoice", invoice.name)
        
        frappe.db.commit()
        
        # Prepare success message
        success_message = f"Successfully merged {len(invoice_names)} invoices into {merged_invoice.name}"
        if print_logs_transferred > 0:
            success_message += f". Transferred {print_logs_transferred} Captain Print Log records"
        if print_logs_errors:
            success_message += f". Warning: {len(print_logs_errors)} print log transfer errors (check error log)"
        
        return {
            "success": True, 
            "new_invoice": merged_invoice.name,
            "message": success_message,
            "print_logs_transferred": print_logs_transferred,
            "print_logs_errors": len(print_logs_errors)
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error merging invoices: {str(e)}")
        return {"success": False, "error": str(e)}
# Simplified version of the split_pos_invoice function

@frappe.whitelist()
def split_pos_invoice(original_invoice, invoice_groups, payment_distribution=None, distribute_evenly=False):
    """
    Split a POS Invoice into multiple invoices with proper sequential payment distribution
    
    Args:
        original_invoice: Name of the original invoice
        invoice_groups: Dictionary with invoice numbers as keys and items as values
                       e.g., {"1": [{"item_code": "ITEM001", "split_qty": 2}], "2": [...]}
        payment_distribution: Dictionary with payment amounts for each invoice group
    """
    try:
        # Parse invoice groups if it's a string
        if isinstance(invoice_groups, str):
            invoice_groups = json.loads(invoice_groups)
        
        if isinstance(payment_distribution, str):
            payment_distribution = json.loads(payment_distribution)
        
        # Get the original invoice
        original_doc = frappe.get_doc("POS Invoice", original_invoice)
        
        # Basic validations
        if original_doc.docstatus != 0:
            frappe.throw("Cannot split submitted invoices")
        
        if not invoice_groups:
            frappe.throw("No invoice groups specified for splitting")
        
        # Validate split items
        validate_split_items(original_doc, invoice_groups)
        
        # Calculate sequential payment distribution if not provided
        if not payment_distribution:
            payment_distribution = calculate_sequential_payment_distribution(original_doc, invoice_groups)
        
        # Create new invoices with proper payment distribution
        new_invoices = []
        for invoice_num, items in invoice_groups.items():
            if items:  # Only create if there are items
                payment_info = payment_distribution.get(invoice_num) if payment_distribution else None
                new_invoice = create_new_invoice_with_payments(original_doc, items, invoice_num, payment_info)
                new_invoices.append(new_invoice)
        
        # Update original invoice with remaining payments
        update_original_invoice_with_payments(original_doc, invoice_groups, payment_distribution)
        
        return {
            "success": True,
            "original_invoice": original_doc.name,
            "new_invoices": [
                {
                    "name": inv.name,
                    "grand_total": inv.grand_total,
                    "items_count": len(inv.items)
                }
                for inv in new_invoices
            ],
            "message": f"Successfully created {len(new_invoices)} new invoice(s)"
        }
        
    except Exception as e:
        frappe.log_error(f"Error in split_pos_invoice: {str(e)}")
        frappe.throw(f"Failed to split invoice: {str(e)}")

def calculate_sequential_payment_distribution(original_doc, invoice_groups):
    """
    Calculate sequential payment distribution - fill first invoice, then second, etc.
    """
    payment_distribution = {}
    remaining_payment = flt(original_doc.paid_amount)
    
    # First, create temporary invoices to calculate their totals
    invoice_totals = {}
    for invoice_num, items in invoice_groups.items():
        if items:
            temp_total = 0
            split_items_map = {item['item_code']: item for item in items}
            
            for original_item in original_doc.items:
                if original_item.item_code in split_items_map:
                    split_data = split_items_map[original_item.item_code]
                    split_qty = flt(split_data['split_qty'])
                    temp_total += flt(split_qty * original_item.rate)
            
            invoice_totals[invoice_num] = temp_total
    
    # Sort invoice numbers to ensure consistent order
    sorted_invoice_nums = sorted(invoice_groups.keys())
    
    # Distribute payments sequentially
    for invoice_num in sorted_invoice_nums:
        if invoice_num in invoice_totals:
            invoice_total = invoice_totals[invoice_num]
            
            if remaining_payment >= invoice_total:
                # Fully pay this invoice
                payment_distribution[invoice_num] = {'payment_amount': invoice_total}
                remaining_payment -= invoice_total
            elif remaining_payment > 0:
                # Partially pay this invoice with remaining amount
                payment_distribution[invoice_num] = {'payment_amount': remaining_payment}
                remaining_payment = 0
            else:
                # No payment left for this invoice
                payment_distribution[invoice_num] = {'payment_amount': 0}
    
    return payment_distribution

def validate_split_items(original_doc, invoice_groups):
    """Basic validation of split items"""
    # Create a map of original items
    original_items = {item.item_code: item.qty for item in original_doc.items}
    
    # Track total quantities being split per item
    split_totals = {}
    
    for invoice_num, items in invoice_groups.items():
        for split_item in items:
            item_code = split_item['item_code']
            split_qty = flt(split_item['split_qty'])
            
            # Check if item exists
            if item_code not in original_items:
                frappe.throw(f"Item {item_code} not found in original invoice")
            
            # Check if quantity is valid
            if split_qty <= 0:
                frappe.throw(f"Split quantity for {item_code} must be greater than 0")
            
            # Track total split quantity
            if item_code in split_totals:
                split_totals[item_code] += split_qty
            else:
                split_totals[item_code] = split_qty
    
    # Check if split quantities don't exceed available quantities
    for item_code, total_split in split_totals.items():
        if total_split > original_items[item_code]:
            frappe.throw(f"Total split quantity for {item_code} ({total_split}) exceeds available quantity ({original_items[item_code]})")

def create_new_invoice_with_payments(original_doc, split_items, invoice_number, payment_info):
    """Create a new invoice with split items and allocated payments"""
    
    # Create new document
    new_doc = frappe.new_doc("POS Invoice")
    
    # Copy essential fields from original
    copy_fields = [
        'company', 'customer', 'posting_date', 'posting_time', 'set_posting_time',
        'is_pos', 'pos_profile', 'currency', 'conversion_rate', 'selling_price_list',
        'customer_address', 'address_display', 'contact_person', 'contact_display',
        'contact_mobile', 'contact_email', 'territory', 'customer_group', 'cost_center'
    ]
    
    for field in copy_fields:
        if hasattr(original_doc, field) and original_doc.get(field):
            new_doc.set(field, original_doc.get(field))
    
    # Set created_by_name from original invoice or owner
    if original_doc.get('created_by_name'):
        new_doc.created_by_name = original_doc.created_by_name
    else:
        # Try to get from original owner
        try:
            user_full_name = frappe.get_value("User", original_doc.owner, "full_name")
            if user_full_name:
                new_doc.created_by_name = user_full_name
        except:
            pass
    
    # Set basic properties
    new_doc.naming_series = original_doc.naming_series
    new_doc.title = f"{original_doc.customer} - Split {invoice_number}"
    
    # Add split items
    split_items_map = {item['item_code']: item for item in split_items}
    
    for original_item in original_doc.items:
        if original_item.item_code in split_items_map:
            split_data = split_items_map[original_item.item_code]
            
            # Create new item row
            new_item = new_doc.append('items')
            
            # Copy item properties
            copy_item_fields = [
                'item_code', 'item_name', 'description', 'item_group', 'brand',
                'uom', 'conversion_factor', 'stock_uom', 'rate', 'price_list_rate',
                'warehouse', 'serial_no', 'batch_no'
            ]
            
            for field in copy_item_fields:
                if hasattr(original_item, field):
                    new_item.set(field, original_item.get(field))
            
            # Set split quantity and calculate amounts
            new_item.qty = flt(split_data['split_qty'])
            new_item.amount = flt(new_item.qty * new_item.rate)
            new_item.base_amount = flt(new_item.amount * new_doc.conversion_rate)
    
    # Copy taxes proportionally
    if original_doc.taxes:
        for original_tax in original_doc.taxes:
            new_tax = new_doc.append('taxes')
            
            tax_copy_fields = [
                'charge_type', 'account_head', 'description', 'rate',
                'cost_center', 'included_in_print_rate'
            ]
            
            for field in tax_copy_fields:
                if hasattr(original_tax, field):
                    new_tax.set(field, original_tax.get(field))
    
    # Calculate totals first
    new_doc.run_method("calculate_taxes_and_totals")
    
    # Add payments based on allocated amount
    allocated_payment = flt(payment_info.get('payment_amount', 0)) if payment_info else 0
    
    if allocated_payment > 0 and original_doc.payments:
        # Copy payment methods from original invoice
        remaining_allocation = allocated_payment
        
        for original_payment in original_doc.payments:
            if original_payment.amount > 0 and remaining_allocation > 0:
                # Allocate up to the payment method's original amount or remaining allocation
                payment_amount = min(original_payment.amount, remaining_allocation)
                
                new_payment = new_doc.append('payments')
                
                # Copy payment fields
                payment_copy_fields = [
                    'mode_of_payment', 'account', 'type', 'default'
                ]
                
                for field in payment_copy_fields:
                    if hasattr(original_payment, field):
                        new_payment.set(field, original_payment.get(field))
                
                new_payment.amount = payment_amount
                new_payment.base_amount = flt(payment_amount * new_doc.conversion_rate)
                
                remaining_allocation -= payment_amount
                
                if remaining_allocation <= 0:
                    break
    
    # Ensure at least one payment mode exists (POS requirement)
    if not new_doc.payments:
        # Create default payment mode
        default_mode = get_default_payment_mode(new_doc.pos_profile)
        if default_mode:
            new_payment = new_doc.append('payments')
            new_payment.mode_of_payment = default_mode["mode_of_payment"]  # Fixed: use bracket notation
            new_payment.account = default_mode["default_account"]  # Fixed: use bracket notation
            new_payment.amount = allocated_payment
            new_payment.base_amount = flt(allocated_payment * new_doc.conversion_rate)
        elif original_doc.payments:
            # Fallback: copy first payment mode from original
            new_payment = new_doc.append('payments')
            original_payment = original_doc.payments[0]
            
            payment_copy_fields = [
                'mode_of_payment', 'account', 'type', 'default'
            ]
            
            for field in payment_copy_fields:
                if hasattr(original_payment, field):
                    new_payment.set(field, original_payment.get(field))
            
            new_payment.amount = allocated_payment
            new_payment.base_amount = flt(allocated_payment * new_doc.conversion_rate)
    
    # Update paid amount
    new_doc.paid_amount = allocated_payment
    new_doc.outstanding_amount = flt(new_doc.grand_total - allocated_payment)
    
    # Save the new invoice
    new_doc.insert()
    
    return new_doc


def update_original_invoice_with_payments(original_doc, invoice_groups, payment_distribution):
    """Update original invoice by removing/reducing split items and adjusting payments"""
    
    # Calculate total quantities being split per item
    split_totals = {}
    for invoice_num, items in invoice_groups.items():
        for item in items:
            item_code = item['item_code']
            split_qty = flt(item['split_qty'])
            
            if item_code in split_totals:
                split_totals[item_code] += split_qty
            else:
                split_totals[item_code] = split_qty
    
    # Update or remove items
    items_to_remove = []
    
    for i, item in enumerate(original_doc.items):
        if item.item_code in split_totals:
            total_split = split_totals[item.item_code]
            
            if flt(item.qty) <= total_split:
                # Remove entire item
                items_to_remove.append(i)
            else:
                # Reduce quantity
                item.qty = flt(item.qty) - total_split
                item.amount = flt(item.qty * item.rate)
                item.base_amount = flt(item.amount * original_doc.conversion_rate)
    
    # Remove items (in reverse order to maintain indices)
    for i in reversed(items_to_remove):
        original_doc.items.pop(i)
    
    # Recalculate totals
    original_doc.run_method("calculate_taxes_and_totals")
    
    # Handle edge case where all items are removed
    if original_doc.grand_total == 0:
        # If no amount left, set minimal payment to satisfy POS requirement
        if original_doc.payments:
            # Keep one payment method with 0 amount
            first_payment = original_doc.payments[0]
            original_doc.payments = [first_payment]
            first_payment.amount = 0
            first_payment.base_amount = 0
        else:
            # Create a minimal payment entry if none exists
            default_mode = get_default_payment_mode(original_doc.pos_profile)
            if default_mode:
                new_payment = original_doc.append('payments')
                new_payment.mode_of_payment = default_mode["mode_of_payment"]  # Fixed: use bracket notation
                new_payment.account = default_mode["default_account"]  # Fixed: use bracket notation
                new_payment.amount = 0
                new_payment.base_amount = 0
        
        original_doc.paid_amount = 0
        original_doc.outstanding_amount = 0
        
    elif payment_distribution:
        # Calculate total allocated payments to new invoices
        total_allocated = sum(
            flt(payment_info.get('payment_amount', 0)) 
            for payment_info in payment_distribution.values()
        )
        
        # Remaining payment should stay with original
        remaining_payment = flt(original_doc.paid_amount - total_allocated)
        
        # Ensure we keep at least one payment method for POS requirement
        if remaining_payment > 0 and original_doc.payments:
            # Adjust payment amounts to match remaining payment
            total_original_payments = sum(payment.amount for payment in original_doc.payments)
            
            if total_original_payments > 0:
                for payment in original_doc.payments:
                    # Calculate proportional reduction
                    payment_ratio = remaining_payment / total_original_payments
                    payment.amount = flt(payment.amount * payment_ratio)
                    payment.base_amount = flt(payment.amount * original_doc.conversion_rate)
        elif remaining_payment <= 0 and original_doc.payments:
            # Keep first payment method with 0 amount to satisfy POS requirement
            first_payment = original_doc.payments[0]
            original_doc.payments = [first_payment]
            first_payment.amount = 0
            first_payment.base_amount = 0
            remaining_payment = 0
        elif not original_doc.payments:
            # Create a minimal payment entry if none exists
            default_mode = get_default_payment_mode(original_doc.pos_profile)
            if default_mode:
                new_payment = original_doc.append('payments')
                new_payment.mode_of_payment = default_mode["mode_of_payment"]  # Fixed: use bracket notation
                new_payment.account = default_mode["default_account"]  # Fixed: use bracket notation
                new_payment.amount = max(0, remaining_payment)
                new_payment.base_amount = flt(new_payment.amount * original_doc.conversion_rate)
        
        # Update totals
        original_doc.paid_amount = max(0, remaining_payment)
        original_doc.outstanding_amount = flt(original_doc.grand_total - original_doc.paid_amount)
        
    elif original_doc.payments and original_doc.grand_total > 0:
        # If no payment distribution provided, keep original payment structure
        # but adjust amounts proportionally to new grand total
        original_paid_amount = original_doc.paid_amount
        
        if original_paid_amount > 0:
            payment_ratio = min(1.0, original_doc.grand_total / original_paid_amount)
            
            for payment in original_doc.payments:
                payment.amount = flt(payment.amount * payment_ratio)
                payment.base_amount = flt(payment.amount * original_doc.conversion_rate)
            
            original_doc.paid_amount = flt(original_doc.paid_amount * payment_ratio)
        
        original_doc.outstanding_amount = flt(original_doc.grand_total - original_doc.paid_amount)
        
    elif not original_doc.payments and original_doc.grand_total > 0:
        # Create outstanding invoice with default payment method
        default_mode = get_default_payment_mode(original_doc.pos_profile)
        if default_mode:
            new_payment = original_doc.append('payments')
            new_payment.mode_of_payment = default_mode["mode_of_payment"]  # Fixed: use bracket notation
            new_payment.account = default_mode["default_account"]  # Fixed: use bracket notation
            new_payment.amount = 0
            new_payment.base_amount = 0
        
        original_doc.paid_amount = 0
        original_doc.outstanding_amount = original_doc.grand_total
    
    # Save updated original
    original_doc.save()
    
    return original_doc

def get_default_payment_mode(pos_profile):
    """Get default payment mode from POS profile"""
    try:
        if pos_profile:
            pos_doc = frappe.get_doc("POS Profile", pos_profile)
            if pos_doc.payments:
                payment_method = pos_doc.payments[0]  # This is a POSPaymentMethod object
                return {
                    "mode_of_payment": payment_method.mode_of_payment,
                    "default_account": payment_method.default_account
                }
        
        # Fallback to any available mode of payment
        mode_of_payment = frappe.get_all("Mode of Payment", 
                                        filters={"enabled": 1}, 
                                        fields=["name"], 
                                        limit=1)
        if mode_of_payment:
            # Get default account for this mode of payment
            account = frappe.get_value("Mode of Payment Account", 
                                     {"parent": mode_of_payment[0].name}, 
                                     "default_account")
            return {
                "mode_of_payment": mode_of_payment[0].name,
                "default_account": account
            }
    except Exception as e:
        frappe.log_error(f"Error getting default payment mode: {str(e)}", "Payment Mode Error")
    
    return None
# Add these functions to your existing posnext/posnext/page/posnext/point-of-sale.py file

# Split Payment Backend Functions
# Add these imports at the top of your file if not already present

# Split Payment Validation and Processing Functions

@frappe.whitelist()
def validate_split_payments(pos_invoice_name):
    """Validate split payments if multiple payment methods are used"""
    try:
        doc = frappe.get_doc('POS Invoice', pos_invoice_name)
        
        if not doc.payments:
            return {'valid': True, 'message': 'No payments to validate'}
            
        # Check if this is a split payment (multiple payment methods with amounts > 0)
        active_payments = [p for p in doc.payments if flt(p.amount) > 0]
        
        if len(active_payments) <= 1:
            return {'valid': True, 'message': 'Single payment method - no split validation needed'}
            
        # Validate split payment rules
        total_payment_amount = sum(flt(p.amount) for p in active_payments)
        grand_total = flt(doc.rounded_total) if not cint(frappe.sys_defaults.disable_rounded_total) else flt(doc.grand_total)
        
        # Allow small rounding differences (0.01)
        if abs(total_payment_amount - grand_total) > 0.01:
            return {
                'valid': False,
                'message': f"Total split payment amount {frappe.format_value(total_payment_amount, {'fieldtype': 'Currency'})} does not match grand total {frappe.format_value(grand_total, {'fieldtype': 'Currency'})}"
            }
        
        # Validate individual payment method limits if any
        validation_result = validate_payment_method_limits(active_payments)
        if not validation_result['valid']:
            return validation_result
        
        # Log split payment for audit if enabled
        log_split_payment_details(doc, active_payments)
        
        return {'valid': True, 'message': 'Split payment validation passed'}
        
    except Exception as e:
        frappe.log_error(f"Split payment validation error: {str(e)}", "Split Payment Validation")
        return {'valid': False, 'message': str(e)}

def validate_payment_method_limits(active_payments):
    """Validate payment method specific limits"""
    try:
        for payment in active_payments:
            # Get payment method limits from Mode of Payment master
            mop_doc = frappe.get_cached_doc('Mode of Payment', payment.mode_of_payment)
            
            if hasattr(mop_doc, 'maximum_payment_amount') and mop_doc.maximum_payment_amount:
                if flt(payment.amount) > flt(mop_doc.maximum_payment_amount):
                    return {
                        'valid': False,
                        'message': f"Payment amount {frappe.format_value(payment.amount, {'fieldtype': 'Currency'})} for {payment.mode_of_payment} exceeds maximum limit of {frappe.format_value(mop_doc.maximum_payment_amount, {'fieldtype': 'Currency'})}"
                    }
        
        return {'valid': True, 'message': 'Payment method limits validation passed'}
        
    except Exception as e:
        frappe.log_error(f"Payment method limits validation error: {str(e)}", "Split Payment Validation")
        return {'valid': False, 'message': str(e)}

def log_split_payment_details(doc, active_payments):
    """Log split payment details for audit purposes"""
    try:
        payment_details = []
        split_payment_count = 0
        
        for payment in active_payments:
            # Check if this payment has split details in remarks
            if payment.remarks:
                try:
                    split_details = json.loads(payment.remarks)
                    for detail in split_details:
                        payment_details.append({
                            'mode_of_payment': payment.mode_of_payment,
                            'display_name': detail.get('display_name', payment.mode_of_payment),
                            'amount': flt(detail['amount']),
                            'reference': detail.get('reference', ''),
                            'notes': detail.get('notes', ''),
                            'type': payment.type
                        })
                        split_payment_count += 1
                except (json.JSONDecodeError, KeyError):
                    # If remarks is not JSON or doesn't have expected structure, treat as regular payment
                    payment_details.append({
                        'mode_of_payment': payment.mode_of_payment,
                        'display_name': payment.mode_of_payment,
                        'amount': flt(payment.amount),
                        'reference': '',
                        'notes': '',
                        'type': payment.type
                    })
            else:
                payment_details.append({
                    'mode_of_payment': payment.mode_of_payment,
                    'display_name': payment.mode_of_payment,
                    'amount': flt(payment.amount),
                    'reference': '',
                    'notes': '',
                    'type': payment.type
                })
        
        # Create detailed comment for audit trail
        comment_content = []
        if split_payment_count > len(active_payments):
            comment_content.append('Multiple Split Payments Used:')
        else:
            comment_content.append('Split Payment Used:')
            
        for detail in payment_details:
            payment_line = f"{detail['display_name']}: {frappe.format_value(detail['amount'], {'fieldtype': 'Currency'})}"
            if detail['reference']:
                payment_line += f" (Ref: {detail['reference']})"
            if detail['notes']:
                payment_line += f" - {detail['notes']}"
            comment_content.append(payment_line)
        
        # Add to document comments
        frappe.get_doc({
            'doctype': 'Comment',
            'comment_type': 'Info',
            'reference_doctype': doc.doctype,
            'reference_name': doc.name,
            'content': '\n'.join(comment_content)
        }).insert(ignore_permissions=True)
        
    except Exception as e:
        # Log error but don't fail the main transaction
        frappe.log_error(f"Failed to log split payment details: {str(e)}", "Split Payment Audit")

@frappe.whitelist()
def get_split_payment_summary(pos_invoice_name):
    """Get split payment summary for a POS Invoice"""
    try:
        doc = frappe.get_doc('POS Invoice', pos_invoice_name)
        
        active_payments = []
        total_split_entries = 0
        
        for payment in doc.payments:
            if flt(payment.amount) > 0:
                # Check if this payment has split details
                if payment.remarks:
                    try:
                        split_details = json.loads(payment.remarks)
                        for detail in split_details:
                            active_payments.append({
                                'mode_of_payment': payment.mode_of_payment,
                                'display_name': detail.get('display_name', payment.mode_of_payment),
                                'amount': flt(detail['amount']),
                                'reference': detail.get('reference', ''),
                                'notes': detail.get('notes', ''),
                                'type': payment.type,
                                'formatted_amount': frappe.format_value(detail['amount'], {'fieldtype': 'Currency'})
                            })
                            total_split_entries += 1
                    except (json.JSONDecodeError, KeyError):
                        # Regular payment
                        active_payments.append({
                            'mode_of_payment': payment.mode_of_payment,
                            'display_name': payment.mode_of_payment,
                            'amount': flt(payment.amount),
                            'reference': '',
                            'notes': '',
                            'type': payment.type,
                            'formatted_amount': frappe.format_value(payment.amount, {'fieldtype': 'Currency'})
                        })
                else:
                    active_payments.append({
                        'mode_of_payment': payment.mode_of_payment,
                        'display_name': payment.mode_of_payment,
                        'amount': flt(payment.amount),
                        'reference': '',
                        'notes': '',
                        'type': payment.type,
                        'formatted_amount': frappe.format_value(payment.amount, {'fieldtype': 'Currency'})
                    })
        
        return {
            'is_split_payment': len(active_payments) > 1 or total_split_entries > len([p for p in doc.payments if flt(p.amount) > 0]),
            'has_multiple_same_method': total_split_entries > len([p for p in doc.payments if flt(p.amount) > 0]),
            'payments': active_payments,
            'total_amount': sum(p['amount'] for p in active_payments),
            'formatted_total': frappe.format_value(sum(p['amount'] for p in active_payments), {'fieldtype': 'Currency'}),
            'split_entries_count': total_split_entries
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting split payment summary: {str(e)}", "Split Payment Summary")
        return {'error': str(e)}

@frappe.whitelist()
def get_split_payment_report(from_date=None, to_date=None, company=None):
    """Get report of all split payments within date range"""
    try:
        conditions = ["pi.docstatus = 1"]  # Only submitted invoices
        
        if from_date:
            conditions.append(f"pi.posting_date >= '{from_date}'")
        if to_date:
            conditions.append(f"pi.posting_date <= '{to_date}'")
        if company:
            conditions.append(f"pi.company = '{company}'")
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        query = f"""
            SELECT 
                pi.name,
                pi.posting_date,
                pi.posting_time,
                pi.customer,
                pi.grand_total,
                pi.outstanding_amount,
                pi.company,
                GROUP_CONCAT(
                    CONCAT(sip.mode_of_payment, ': ', sip.amount) 
                    ORDER BY sip.amount DESC 
                    SEPARATOR ' | '
                ) as payment_methods,
                COUNT(CASE WHEN sip.amount > 0 THEN 1 END) as payment_count,
                SUM(sip.amount) as total_paid,
                GROUP_CONCAT(
                    CASE WHEN sip.remarks IS NOT NULL AND sip.remarks != '' 
                    THEN CONCAT(sip.mode_of_payment, ' Details: ', sip.remarks)
                    END
                    SEPARATOR ' || '
                ) as split_details
            FROM 
                `tabPOS Invoice` pi
            INNER JOIN 
                `tabSales Invoice Payment` sip ON pi.name = sip.parent
            {where_clause}
            GROUP BY 
                pi.name
            HAVING 
                payment_count > 1 AND total_paid > 0
            ORDER BY 
                pi.posting_date DESC, pi.name DESC
            LIMIT 1000
        """
        
        return frappe.db.sql(query, as_dict=True)
        
    except Exception as e:
        frappe.log_error(f"Error generating split payment report: {str(e)}", "Split Payment Report")
        return []

@frappe.whitelist()
def get_payment_method_usage_stats(from_date=None, to_date=None, company=None):
    """Get statistics on payment method usage in split payments"""
    try:
        conditions = ["pi.docstatus = 1"]
        
        if from_date:
            conditions.append(f"pi.posting_date >= '{from_date}'")
        if to_date:
            conditions.append(f"pi.posting_date <= '{to_date}'")
        if company:
            conditions.append(f"pi.company = '{company}'")
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # Get split payment statistics
        split_stats_query = f"""
            SELECT 
                sip.mode_of_payment,
                COUNT(DISTINCT pi.name) as invoices_used_in,
                COUNT(sip.name) as total_transactions,
                SUM(sip.amount) as total_amount,
                AVG(sip.amount) as avg_amount,
                MIN(sip.amount) as min_amount,
                MAX(sip.amount) as max_amount
            FROM 
                `tabPOS Invoice` pi
            INNER JOIN 
                `tabSales Invoice Payment` sip ON pi.name = sip.parent
            {where_clause}
                AND pi.name IN (
                    SELECT DISTINCT parent 
                    FROM `tabSales Invoice Payment` 
                    WHERE parent = pi.name AND amount > 0
                    GROUP BY parent 
                    HAVING COUNT(*) > 1
                )
            GROUP BY 
                sip.mode_of_payment
            ORDER BY 
                total_amount DESC
        """
        
        return frappe.db.sql(split_stats_query, as_dict=True)
        
    except Exception as e:
        frappe.log_error(f"Error getting payment method stats: {str(e)}", "Split Payment Stats")
        return []

@frappe.whitelist()
def validate_split_payment_before_submit(pos_invoice_name):
    """Validate split payment before submitting the invoice"""
    try:
        doc = frappe.get_doc('POS Invoice', pos_invoice_name)
        
        # Run validation
        validation_result = validate_split_payments(pos_invoice_name)
        
        if validation_result['valid']:
            return {
                'valid': True,
                'message': 'Split payment validation passed'
            }
        else:
            return validation_result
            
    except Exception as e:
        frappe.log_error(f"Error validating split payment before submit: {str(e)}", "Split Payment Validation")
        return {
            'valid': False,
            'message': str(e)
        }

@frappe.whitelist()
def get_split_payment_analytics(from_date=None, to_date=None, company=None):
    """Get analytics data for split payments"""
    try:
        conditions = ["pi.docstatus = 1"]
        
        if from_date:
            conditions.append(f"pi.posting_date >= '{from_date}'")
        if to_date:
            conditions.append(f"pi.posting_date <= '{to_date}'")
        if company:
            conditions.append(f"pi.company = '{company}'")
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # Total invoices with split payments
        split_count_query = f"""
            SELECT 
                COUNT(DISTINCT pi.name) as total_split_invoices,
                SUM(pi.grand_total) as total_split_amount,
                AVG(pi.grand_total) as avg_split_amount
            FROM 
                `tabPOS Invoice` pi
            {where_clause}
                AND pi.name IN (
                    SELECT DISTINCT parent 
                    FROM `tabSales Invoice Payment` 
                    WHERE parent = pi.name AND amount > 0
                    GROUP BY parent 
                    HAVING COUNT(*) > 1
                )
        """
        
        # Payment method combinations
        combination_query = f"""
            SELECT 
                GROUP_CONCAT(sip.mode_of_payment ORDER BY sip.mode_of_payment SEPARATOR ' + ') as payment_combination,
                COUNT(*) as frequency,
                AVG(pi.grand_total) as avg_amount
            FROM 
                `tabPOS Invoice` pi
            INNER JOIN 
                `tabSales Invoice Payment` sip ON pi.name = sip.parent
            {where_clause}
                AND sip.amount > 0
                AND pi.name IN (
                    SELECT DISTINCT parent 
                    FROM `tabSales Invoice Payment` 
                    WHERE parent = pi.name AND amount > 0
                    GROUP BY parent 
                    HAVING COUNT(*) > 1
                )
            GROUP BY 
                pi.name
            ORDER BY 
                frequency DESC
            LIMIT 10
        """
        
        # Time-based analysis
        time_analysis_query = f"""
            SELECT 
                DATE(pi.posting_date) as date,
                COUNT(DISTINCT pi.name) as split_invoices,
                SUM(pi.grand_total) as total_amount
            FROM 
                `tabPOS Invoice` pi
            {where_clause}
                AND pi.name IN (
                    SELECT DISTINCT parent 
                    FROM `tabSales Invoice Payment` 
                    WHERE parent = pi.name AND amount > 0
                    GROUP BY parent 
                    HAVING COUNT(*) > 1
                )
            GROUP BY 
                DATE(pi.posting_date)
            ORDER BY 
                date DESC
            LIMIT 30
        """
        
        summary_result = frappe.db.sql(split_count_query, as_dict=True)
        combinations_result = frappe.db.sql(combination_query, as_dict=True)
        time_analysis_result = frappe.db.sql(time_analysis_query, as_dict=True)
        
        return {
            'summary': summary_result[0] if summary_result else {},
            'combinations': combinations_result,
            'time_analysis': time_analysis_result
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting split payment analytics: {str(e)}", "Split Payment Analytics")
        return {'error': str(e)}

@frappe.whitelist()
def reconcile_split_payments(pos_invoice_name):
    """Reconcile split payments if there are discrepancies"""
    try:
        doc = frappe.get_doc('POS Invoice', pos_invoice_name)
        active_payments = [p for p in doc.payments if flt(p.amount) > 0]
        
        if len(active_payments) <= 1:
            return {'success': True, 'message': 'No split payment to reconcile'}
        
        # Check for reconciliation issues
        total_payment_amount = sum(flt(p.amount) for p in active_payments)
        grand_total = flt(doc.rounded_total) if not cint(frappe.sys_defaults.disable_rounded_total) else flt(doc.grand_total)
        
        difference = grand_total - total_payment_amount
        
        if abs(difference) <= 0.01:
            return {'success': True, 'message': 'Split payments are already reconciled'}
        
        # Auto-reconciliation logic
        if abs(difference) <= 1.00:  # Small differences can be auto-reconciled
            # Find the largest payment to adjust
            largest_payment = max(active_payments, key=lambda p: flt(p.amount))
            new_amount = flt(largest_payment.amount) + difference
            
            if new_amount > 0:
                frappe.db.set_value('Sales Invoice Payment', largest_payment.name, 'amount', new_amount)
                doc.reload()
                
                # Add reconciliation note
                frappe.get_doc({
                    'doctype': 'Comment',
                    'comment_type': 'Info',
                    'reference_doctype': doc.doctype,
                    'reference_name': doc.name,
                    'content': f'Split payment auto-reconciled: {difference} added to {largest_payment.mode_of_payment}'
                }).insert(ignore_permissions=True)
                
                return {
                    'success': True, 
                    'message': f'Auto-reconciled difference of {frappe.format_value(abs(difference), {"fieldtype": "Currency"})}'
                }
        
        return {
            'success': False, 
            'message': f'Manual reconciliation required. Difference: {frappe.format_value(difference, {"fieldtype": "Currency"})}'
        }
        
    except Exception as e:
        frappe.log_error(f"Error reconciling split payments: {str(e)}", "Split Payment Reconciliation")
        return {'success': False, 'message': str(e)}

@frappe.whitelist()
def get_payment_method_limits():
    """Get payment method limits for validation"""
    try:
        payment_methods = frappe.get_all('Mode of Payment', 
            fields=['name', 'maximum_payment_amount', 'type'],
            filters={'enabled': 1}
        )
        
        limits = {}
        for method in payment_methods:
            limits[method.name] = {
                'max_amount': flt(method.maximum_payment_amount) if method.maximum_payment_amount else None,
                'type': method.type
            }
        
        return limits
        
    except Exception as e:
        frappe.log_error(f"Error getting payment method limits: {str(e)}", "Payment Method Limits")
        return {}

@frappe.whitelist()
def check_split_payment_permissions(user=None):
    """Check if user has permissions for split payment operations"""
    try:
        if not user:
            user = frappe.session.user
        
        # Check if user has required roles
        required_roles = ['Sales User', 'POS User', 'Sales Manager']
        user_roles = frappe.get_roles(user)
        
        has_permission = any(role in user_roles for role in required_roles)
        
        # Additional checks
        can_modify_payments = 'Sales Manager' in user_roles or 'System Manager' in user_roles
        can_view_reports = has_permission
        
        return {
            'can_use_split_payments': has_permission,
            'can_modify_payments': can_modify_payments,
            'can_view_reports': can_view_reports,
            'max_split_count': 5 if 'Sales Manager' in user_roles else 3
        }
        
    except Exception as e:
        frappe.log_error(f"Error checking split payment permissions: {str(e)}", "Split Payment Permissions")
        return {
            'can_use_split_payments': False,
            'can_modify_payments': False,
            'can_view_reports': False,
            'max_split_count': 0
        }

@frappe.whitelist()
def get_split_payment_settings():
    """Get split payment configuration settings"""
    try:
        # You can create a custom Single DocType for settings or use existing settings
        settings = frappe.get_single('POS Settings')
        
        return {
            'max_split_count': getattr(settings, 'max_split_payment_count', 5),
            'allow_same_method_split': getattr(settings, 'allow_same_method_split', True),
            'require_reference_for_split': getattr(settings, 'require_reference_for_split', False),
            'auto_reconcile_threshold': getattr(settings, 'auto_reconcile_threshold', 1.0),
            'enable_split_payment_audit': getattr(settings, 'enable_split_payment_audit', True)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting split payment settings: {str(e)}", "Split Payment Settings")
        # Return default settings if unable to fetch
        return {
            'max_split_count': 5,
            'allow_same_method_split': True,
            'require_reference_for_split': False,
            'auto_reconcile_threshold': 1.0,
            'enable_split_payment_audit': True
        }

# Error handling and logging functions

def log_split_payment_error(error_message, pos_invoice=None, additional_data=None):
    """Log split payment related errors"""
    try:
        error_log = {
            'error_message': error_message,
            'pos_invoice': pos_invoice,
            'user': frappe.session.user,
            'timestamp': frappe.utils.now(),
            'additional_data': additional_data
        }
        
        frappe.log_error(
            message=json.dumps(error_log),
            title="Split Payment Error"
        )
        
    except Exception as e:
        # Fallback logging
        frappe.log_error(f"Split payment error logging failed: {str(e)}")

# Hook function to be called when POS Invoice is submitted
def on_submit_pos_invoice(doc, method):
    """Hook called when POS Invoice is submitted"""
    try:
        if doc.doctype == 'POS Invoice':
            # Check if this is a split payment
            active_payments = [p for p in doc.payments if flt(p.amount) > 0]
            if len(active_payments) > 1:
                # Log split payment for audit
                log_split_payment_details(doc, active_payments)
                
                # Additional processing for split payments if needed
                create_split_payment_log(doc, active_payments)
                
    except Exception as e:
        frappe.log_error(f"Error in split payment submission hook: {str(e)}", "Split Payment Submission")

def create_split_payment_log(doc, active_payments):
    """Create a log entry for split payments for reporting purposes"""
    try:
        # Create a custom doctype record for split payment tracking
        # This is optional - only if you want detailed reporting
        
        # For now, we'll just add a comprehensive comment
        payment_summary = []
        total_methods = len(active_payments)
        total_amount = sum(flt(p.amount) for p in active_payments)
        
        for payment in active_payments:
            payment_info = f"{payment.mode_of_payment}: {frappe.format_value(payment.amount, {'fieldtype': 'Currency'})}"
            if payment.remarks:
                try:
                    split_details = json.loads(payment.remarks)
                    if len(split_details) > 1:
                        payment_info += f" (Split into {len(split_details)} transactions)"
                except:
                    pass
            payment_summary.append(payment_info)
        
        comprehensive_comment = f"""
SPLIT PAYMENT SUMMARY:
- Total Payment Methods: {total_methods}
- Total Amount: {frappe.format_value(total_amount, {'fieldtype': 'Currency'})}
- Payment Breakdown: {' | '.join(payment_summary)}
- Processed by: {frappe.session.user}
- Timestamp: {frappe.utils.now()}
        """.strip()
        
        doc.add_comment('Info', comprehensive_comment)
        
    except Exception as e:
        # Log error but don't fail the main transaction
        frappe.log_error(f"Failed to create split payment log: {str(e)}", "Split Payment Log Error")

# Add these functions to your posnext/posnext/page/posnext/point-of-sale.py file

# Partial Payment Backend Functions

@frappe.whitelist()
def save_partial_payment_invoice(invoice_name, partial_payments):
    """Save invoice with partial payment information"""
    try:
        partial_payments = json.loads(partial_payments) if isinstance(partial_payments, str) else partial_payments
        
        # Get the invoice
        doc = frappe.get_doc('POS Invoice', invoice_name)
        
        if doc.docstatus != 0:
            frappe.throw("Cannot modify submitted invoice")
        
        # Calculate totals
        grand_total = flt(doc.rounded_total) if not cint(frappe.sys_defaults.disable_rounded_total) else flt(doc.grand_total)
        total_partial_paid = sum(flt(p.get('amount', 0)) for p in partial_payments)
        outstanding_amount = grand_total - total_partial_paid
        
        # Update payment records with partial payment data
        update_payments_with_partial_data(doc, partial_payments)
        
        # Set partial payment status
        doc.status = "Partial Payment" if outstanding_amount > 0.01 else "Paid"
        
        # Add partial payment summary to remarks
        add_partial_payment_remarks(doc, partial_payments, total_partial_paid, outstanding_amount)
        
        # Save the document
        doc.save()
        
        # Create partial payment log
        create_partial_payment_log(doc, partial_payments, total_partial_paid, outstanding_amount)
        
        # Send notification if needed
        if outstanding_amount > 0.01:
            send_partial_payment_notification(doc, total_partial_paid, outstanding_amount)
        
        return {
            'success': True,
            'invoice_name': doc.name,
            'grand_total': grand_total,
            'paid_amount': total_partial_paid,
            'outstanding_amount': outstanding_amount,
            'status': doc.status,
            'message': f'Invoice saved with partial payment. Outstanding: {frappe.format_value(outstanding_amount, {"fieldtype": "Currency"})}'
        }
        
    except Exception as e:
        frappe.log_error(f"Error saving partial payment invoice: {str(e)}", "Partial Payment Error")
        frappe.throw(f"Failed to save partial payment: {str(e)}")

def update_payments_with_partial_data(doc, partial_payments):
    """Update payment records with partial payment details"""
    
    # Clear existing payment amounts
    for payment in doc.payments:
        payment.amount = 0
    
    # Group partial payments by mode of payment
    payment_groups = {}
    for partial_payment in partial_payments:
        mode = partial_payment.get('mode_of_payment')
        if mode not in payment_groups:
            payment_groups[mode] = {
                'total_amount': 0,
                'details': []
            }
        
        payment_groups[mode]['total_amount'] += flt(partial_payment.get('amount', 0))
        payment_groups[mode]['details'].append({
            'amount': flt(partial_payment.get('amount', 0)),
            'reference_number': partial_payment.get('reference_number', ''),
            'notes': partial_payment.get('notes', ''),
            'payment_date': partial_payment.get('payment_date'),
            'recorded_by': partial_payment.get('recorded_by', frappe.session.user)
        })
    
    # Update payment records
    for mode, group_data in payment_groups.items():
        payment_record = next((p for p in doc.payments if p.mode_of_payment == mode), None)
        if payment_record:
            payment_record.amount = group_data['total_amount']
            payment_record.remarks = json.dumps(group_data['details'])

def add_partial_payment_remarks(doc, partial_payments, total_paid, outstanding):
    """Add partial payment information to invoice remarks"""
    
    payment_summary = []
    for payment in partial_payments:
        payment_date = frappe.utils.format_datetime(payment.get('payment_date'), 'dd/MM/yyyy HH:mm')
        payment_info = f"{payment.get('mode_of_payment')}: {frappe.format_value(payment.get('amount'), {'fieldtype': 'Currency'})}"
        
        if payment.get('reference_number'):
            payment_info += f" (Ref: {payment.get('reference_number')})"
        
        payment_info += f" on {payment_date}"
        
        if payment.get('notes'):
            payment_info += f" - {payment.get('notes')}"
            
        payment_summary.append(payment_info)
    
    partial_remarks = f"""
PARTIAL PAYMENT RECORD:
Total Invoice Amount: {frappe.format_value(total_paid + outstanding, {'fieldtype': 'Currency'})}
Amount Paid: {frappe.format_value(total_paid, {'fieldtype': 'Currency'})}
Outstanding: {frappe.format_value(outstanding, {'fieldtype': 'Currency'})}

Payment Details:
{chr(10).join(f'- {payment}' for payment in payment_summary)}

Status: {'Partially Paid' if outstanding > 0.01 else 'Fully Paid'}
Last Updated: {frappe.utils.now()}
    """.strip()
    
    existing_remarks = doc.remarks or ''
    doc.remarks = f"{existing_remarks}\n\n{partial_remarks}" if existing_remarks else partial_remarks

def create_partial_payment_log(doc, partial_payments, total_paid, outstanding):
    """Create a log entry for partial payment tracking"""
    try:
        # Create comment for audit trail
        comment_content = f"""
PARTIAL PAYMENT LOG:
- Invoice: {doc.name}
- Customer: {doc.customer}
- Total Amount: {frappe.format_value(doc.grand_total, {'fieldtype': 'Currency'})}
- Paid Amount: {frappe.format_value(total_paid, {'fieldtype': 'Currency'})}
- Outstanding: {frappe.format_value(outstanding, {'fieldtype': 'Currency'})}
- Number of Payments: {len(partial_payments)}
- Recorded by: {frappe.session.user_fullname or frappe.session.user}
        """.strip()
        
        doc.add_comment('Info', comment_content)
        
        # If you have a custom Partial Payment Log doctype, create an entry
        # create_partial_payment_log_entry(doc, partial_payments, total_paid, outstanding)
        
    except Exception as e:
        frappe.log_error(f"Error creating partial payment log: {str(e)}", "Partial Payment Log")

def send_partial_payment_notification(doc, paid_amount, outstanding):
    """Send notification about partial payment"""
    try:
        # Send email notification if customer has email
        if doc.contact_email:
            send_partial_payment_email(doc, paid_amount, outstanding)
        
        # Create notification for internal users
        create_partial_payment_notification(doc, paid_amount, outstanding)
        
    except Exception as e:
        frappe.log_error(f"Error sending partial payment notification: {str(e)}", "Partial Payment Notification")

def send_partial_payment_email(doc, paid_amount, outstanding):
    """Send email notification to customer about partial payment"""
    
    subject = f"Partial Payment Received - Invoice {doc.name}"
    
    message = f"""
    Dear {doc.customer_name or doc.customer},
    
    We have received a partial payment for your invoice.
    
    Invoice Details:
    - Invoice Number: {doc.name}
    - Invoice Date: {frappe.utils.format_date(doc.posting_date)}
    - Total Amount: {frappe.format_value(doc.grand_total, {'fieldtype': 'Currency'})}
    - Amount Paid: {frappe.format_value(paid_amount, {'fieldtype': 'Currency'})}
    - Outstanding Balance: {frappe.format_value(outstanding, {'fieldtype': 'Currency'})}
    
    Please complete the remaining payment at your earliest convenience.
    
    Thank you for your business!
    
    Best regards,
    {doc.company}
    """
    
    frappe.sendmail(
        recipients=[doc.contact_email],
        subject=subject,
        message=message,
        delayed=False
    )

def create_partial_payment_notification(doc, paid_amount, outstanding):
    """Create internal notification for partial payment"""
    
    # Get users who should be notified (Sales team, managers, etc.)
    notification_users = get_partial_payment_notification_users(doc.company)
    
    for user in notification_users:
        frappe.get_doc({
            'doctype': 'Notification Log',
            'subject': f'Partial Payment Received - {doc.name}',
            'for_user': user,
            'type': 'Alert',
            'document_type': 'POS Invoice',
            'document_name': doc.name,
            'email_content': f"""
            Partial payment received for invoice {doc.name}:
            - Customer: {doc.customer}
            - Paid: {frappe.format_value(paid_amount, {'fieldtype': 'Currency'})}
            - Outstanding: {frappe.format_value(outstanding, {'fieldtype': 'Currency'})}
            """
        }).insert(ignore_permissions=True)

def get_partial_payment_notification_users(company):
    """Get list of users to notify about partial payments"""
    
    # Get users with specific roles
    notification_roles = ['Sales Manager', 'Accounts Manager', 'POS Manager']
    
    users = frappe.get_all('Has Role',
        filters={
            'role': ['in', notification_roles],
            'parenttype': 'User'
        },
        fields=['parent as user'],
        distinct=True
    )
    
    return [user.user for user in users]

@frappe.whitelist()
def get_partial_payment_details(invoice_name):
    """Get partial payment details for an invoice"""
    try:
        doc = frappe.get_doc('POS Invoice', invoice_name)
        
        partial_payments = []
        
        # Extract partial payment details from payment records
        for payment in doc.payments:
            if payment.amount > 0 and payment.remarks:
                try:
                    payment_details = json.loads(payment.remarks)
                    for detail in payment_details:
                        partial_payments.append({
                            'id': f"{payment.mode_of_payment}_{len(partial_payments)}",
                            'mode_of_payment': payment.mode_of_payment,
                            'amount': detail.get('amount', 0),
                            'reference_number': detail.get('reference_number', ''),
                            'notes': detail.get('notes', ''),
                            'payment_date': detail.get('payment_date'),
                            'recorded_by': detail.get('recorded_by', '')
                        })
                except (json.JSONDecodeError, TypeError):
                    # Handle case where remarks is not JSON
                    if payment.amount > 0:
                        partial_payments.append({
                            'id': f"{payment.mode_of_payment}_{len(partial_payments)}",
                            'mode_of_payment': payment.mode_of_payment,
                            'amount': payment.amount,
                            'reference_number': '',
                            'notes': '',
                            'payment_date': doc.posting_date,
                            'recorded_by': doc.owner
                        })
        
        return {
            'partial_payments': partial_payments,
            'total_paid': sum(p['amount'] for p in partial_payments),
            'outstanding': doc.outstanding_amount or 0
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting partial payment details: {str(e)}", "Partial Payment Details")
        return {'partial_payments': [], 'total_paid': 0, 'outstanding': 0}

@frappe.whitelist()
def complete_partial_payment(invoice_name, final_payments):
    """Complete a partial payment by adding final payments"""
    try:
        final_payments = json.loads(final_payments) if isinstance(final_payments, str) else final_payments
        
        doc = frappe.get_doc('POS Invoice', invoice_name)
        
        if doc.docstatus != 0:
            frappe.throw("Cannot modify submitted invoice")
        
        # Get existing partial payments
        existing_partial_details = get_partial_payment_details(invoice_name)
        existing_payments = existing_partial_details.get('partial_payments', [])
        
        # Combine existing and final payments
        all_payments = existing_payments + final_payments
        
        # Update the invoice
        result = save_partial_payment_invoice(invoice_name, json.dumps(all_payments))
        
        # If payment is now complete, submit the invoice
        if result.get('outstanding_amount', 0) <= 0.01:
            doc.reload()
            doc.submit()
            result['submitted'] = True
            result['message'] = 'Payment completed and invoice submitted successfully'
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Error completing partial payment: {str(e)}", "Complete Partial Payment")
        frappe.throw(f"Failed to complete partial payment: {str(e)}")

@frappe.whitelist()
def get_outstanding_invoices(customer=None, from_date=None, to_date=None):
    """Get list of invoices with outstanding partial payments"""
    try:
        conditions = ["docstatus = 0", "outstanding_amount > 0"]
        
        if customer:
            conditions.append(f"customer = '{customer}'")
        if from_date:
            conditions.append(f"posting_date >= '{from_date}'")
        if to_date:
            conditions.append(f"posting_date <= '{to_date}'")
        
        where_clause = " AND ".join(conditions)
        
        query = f"""
            SELECT 
                name,
                customer,
                customer_name,
                posting_date,
                grand_total,
                paid_amount,
                outstanding_amount,
                status,
                created_by_name
            FROM 
                `tabPOS Invoice`
            WHERE 
                {where_clause}
            ORDER BY 
                posting_date DESC, name DESC
            LIMIT 100
        """
        
        return frappe.db.sql(query, as_dict=True)
        
    except Exception as e:
        frappe.log_error(f"Error getting outstanding invoices: {str(e)}", "Outstanding Invoices")
        return []

@frappe.whitelist()
def get_partial_payment_report(from_date=None, to_date=None, customer=None, company=None):
    """Get comprehensive report of partial payments"""
    try:
        conditions = ["1=1"]
        
        if from_date:
            conditions.append(f"posting_date >= '{from_date}'")
        if to_date:
            conditions.append(f"posting_date <= '{to_date}'")
        if customer:
            conditions.append(f"customer = '{customer}'")
        if company:
            conditions.append(f"company = '{company}'")
        
        where_clause = " AND ".join(conditions)
        
        # Get invoices with partial payments
        query = f"""
            SELECT 
                name,
                customer,
                customer_name,
                posting_date,
                grand_total,
                paid_amount,
                outstanding_amount,
                status,
                created_by_name,
                remarks
            FROM 
                `tabPOS Invoice`
            WHERE 
                {where_clause}
                AND (
                    outstanding_amount > 0 
                    OR remarks LIKE '%PARTIAL PAYMENT%'
                    OR status = 'Partial Payment'
                )
            ORDER BY 
                posting_date DESC
        """
        
        invoices = frappe.db.sql(query, as_dict=True)
        
        # Add partial payment details for each invoice
        for invoice in invoices:
            partial_details = get_partial_payment_details(invoice.name)
            invoice.partial_payments = partial_details.get('partial_payments', [])
            invoice.payment_count = len(invoice.partial_payments)
        
        return invoices
        
    except Exception as e:
        frappe.log_error(f"Error generating partial payment report: {str(e)}", "Partial Payment Report")
        return []

@frappe.whitelist()
def send_payment_reminder(invoice_name, reminder_type="email"):
    """Send payment reminder to customer for outstanding amount"""
    try:
        doc = frappe.get_doc('POS Invoice', invoice_name)
        
        if doc.outstanding_amount <= 0:
            return {'success': False, 'message': 'No outstanding amount for this invoice'}
        
        if reminder_type == "email":
            return send_payment_reminder_email(doc)
        elif reminder_type == "sms":
            return send_payment_reminder_sms(doc)
        else:
            return {'success': False, 'message': 'Invalid reminder type'}
            
    except Exception as e:
        frappe.log_error(f"Error sending payment reminder: {str(e)}", "Payment Reminder")
        return {'success': False, 'message': str(e)}

def send_payment_reminder_email(doc):
    """Send email payment reminder"""
    if not doc.contact_email:
        return {'success': False, 'message': 'No email address found for customer'}
    
    subject = f"Payment Reminder - Invoice {doc.name}"
    
    # Calculate days overdue
    days_since_invoice = (frappe.utils.getdate() - frappe.utils.getdate(doc.posting_date)).days
    
    message = f"""
    Dear {doc.customer_name or doc.customer},
    
    This is a friendly reminder about your outstanding payment.
    
    Invoice Details:
    - Invoice Number: {doc.name}
    - Invoice Date: {frappe.utils.format_date(doc.posting_date)}
    - Days Since Invoice: {days_since_invoice} days
    - Total Amount: {frappe.format_value(doc.grand_total, {'fieldtype': 'Currency'})}
    - Amount Paid: {frappe.format_value(doc.paid_amount, {'fieldtype': 'Currency'})}
    - Outstanding Balance: {frappe.format_value(doc.outstanding_amount, {'fieldtype': 'Currency'})}
    
    Please arrange payment at your earliest convenience. You can:
    - Visit our store with invoice number {doc.name}
    - Call us to arrange payment
    - Pay online using our payment portal
    
    If you have already made the payment, please ignore this reminder.
    
    Thank you for your business!
    
    Best regards,
    {doc.company}
    """
    
    try:
        frappe.sendmail(
            recipients=[doc.contact_email],
            subject=subject,
            message=message,
            delayed=False
        )
        
        # Log the reminder
        doc.add_comment('Info', f'Payment reminder email sent to {doc.contact_email}')
        
        return {'success': True, 'message': f'Payment reminder sent to {doc.contact_email}'}
        
    except Exception as e:
        return {'success': False, 'message': f'Failed to send email: {str(e)}'}

def send_payment_reminder_sms(doc):
    """Send SMS payment reminder"""
    if not doc.contact_mobile:
        return {'success': False, 'message': 'No mobile number found for customer'}
    
    message = f"""
    Payment Reminder from {doc.company}:
    Invoice: {doc.name}
    Outstanding: {frappe.format_value(doc.outstanding_amount, {'fieldtype': 'Currency'})}
    Please visit our store or call to complete payment.
    Thank you!
    """
    
    try:
        # You'll need to implement SMS sending based on your SMS provider
        # This is a placeholder for SMS functionality
        send_sms(doc.contact_mobile, message)
        
        # Log the reminder
        doc.add_comment('Info', f'Payment reminder SMS sent to {doc.contact_mobile}')
        
        return {'success': True, 'message': f'Payment reminder SMS sent to {doc.contact_mobile}'}
        
    except Exception as e:
        return {'success': False, 'message': f'Failed to send SMS: {str(e)}'}

def send_sms(mobile_number, message):
    """Send SMS using your SMS provider"""
    # Implement based on your SMS provider (Twilio, AWS SNS, etc.)
    # This is a placeholder
    frappe.log_error(f"SMS to {mobile_number}: {message}", "SMS Placeholder")

@frappe.whitelist()
def get_partial_payment_analytics(from_date=None, to_date=None, company=None):
    """Get analytics for partial payments"""
    try:
        conditions = ["1=1"]
        
        if from_date:
            conditions.append(f"posting_date >= '{from_date}'")
        if to_date:
            conditions.append(f"posting_date <= '{to_date}'")
        if company:
            conditions.append(f"company = '{company}'")
        
        where_clause = " AND ".join(conditions)
        
        # Summary statistics
        summary_query = f"""
            SELECT 
                COUNT(*) as total_invoices,
                COUNT(CASE WHEN outstanding_amount > 0 THEN 1 END) as partial_payment_invoices,
                SUM(grand_total) as total_invoice_amount,
                SUM(paid_amount) as total_paid_amount,
                SUM(outstanding_amount) as total_outstanding_amount,
                AVG(outstanding_amount) as avg_outstanding_amount
            FROM 
                `tabPOS Invoice`
            WHERE 
                {where_clause}
                AND docstatus >= 0
        """
        
        # Monthly trend
        monthly_trend_query = f"""
            SELECT 
                DATE_FORMAT(posting_date, '%Y-%m') as month,
                COUNT(CASE WHEN outstanding_amount > 0 THEN 1 END) as partial_payment_count,
                SUM(outstanding_amount) as monthly_outstanding
            FROM 
                `tabPOS Invoice`
            WHERE 
                {where_clause}
                AND docstatus >= 0
            GROUP BY 
                DATE_FORMAT(posting_date, '%Y-%m')
            ORDER BY 
                month DESC
            LIMIT 12
        """
        
        # Top customers with outstanding payments
        top_customers_query = f"""
            SELECT 
                customer,
                customer_name,
                COUNT(*) as invoice_count,
                SUM(outstanding_amount) as total_outstanding
            FROM 
                `tabPOS Invoice`
            WHERE 
                {where_clause}
                AND outstanding_amount > 0
            GROUP BY 
                customer
            ORDER BY 
                total_outstanding DESC
            LIMIT 10
        """
        
        summary = frappe.db.sql(summary_query, as_dict=True)[0]
        monthly_trend = frappe.db.sql(monthly_trend_query, as_dict=True)
        top_customers = frappe.db.sql(top_customers_query, as_dict=True)
        
        return {
            'summary': summary,
            'monthly_trend': monthly_trend,
            'top_customers': top_customers
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting partial payment analytics: {str(e)}", "Partial Payment Analytics")
        return {'summary': {}, 'monthly_trend': [], 'top_customers': []}

@frappe.whitelist()
def convert_to_sales_invoice(pos_invoice_name, submit_immediately=False):
    """Convert POS Invoice with partial payments to regular Sales Invoice"""
    try:
        pos_doc = frappe.get_doc('POS Invoice', pos_invoice_name)
        
        # Create new Sales Invoice
        sales_invoice = frappe.new_doc('Sales Invoice')
        
        # Copy relevant fields
        copy_fields = [
            'customer', 'customer_name', 'posting_date', 'due_date', 'company',
            'currency', 'conversion_rate', 'selling_price_list', 'price_list_currency',
            'customer_address', 'address_display', 'contact_person', 'contact_display',
            'contact_mobile', 'contact_email', 'territory', 'customer_group',
            'cost_center', 'project', 'remarks'
        ]
        
        for field in copy_fields:
            if hasattr(pos_doc, field) and pos_doc.get(field):
                sales_invoice.set(field, pos_doc.get(field))
        
        # Copy items
        for pos_item in pos_doc.items:
            sales_invoice.append('items', {
                'item_code': pos_item.item_code,
                'item_name': pos_item.item_name,
                'description': pos_item.description,
                'qty': pos_item.qty,
                'uom': pos_item.uom,
                'rate': pos_item.rate,
                'amount': pos_item.amount,
                'warehouse': pos_item.warehouse,
                'cost_center': pos_item.cost_center,
                'income_account': pos_item.income_account
            })
        
        # Copy taxes
        for pos_tax in pos_doc.taxes:
            sales_invoice.append('taxes', {
                'charge_type': pos_tax.charge_type,
                'account_head': pos_tax.account_head,
                'description': pos_tax.description,
                'rate': pos_tax.rate,
                'tax_amount': pos_tax.tax_amount,
                'total': pos_tax.total,
                'cost_center': pos_tax.cost_center
            })
        
        # Set payment terms for partial payment
        if pos_doc.outstanding_amount > 0:
            sales_invoice.append('payment_schedule', {
                'due_date': pos_doc.posting_date,
                'invoice_portion': 100,
                'payment_amount': pos_doc.grand_total,
                'outstanding': pos_doc.outstanding_amount,
                'paid_amount': pos_doc.paid_amount
            })
        
        # Add reference to original POS Invoice
        sales_invoice.remarks = f"{sales_invoice.remarks or ''}\n\nConverted from POS Invoice: {pos_invoice_name}"
        
        # Save the sales invoice
        sales_invoice.insert()
        
        if submit_immediately and pos_doc.outstanding_amount <= 0:
            sales_invoice.submit()
        
        # Cancel the POS Invoice
        pos_doc.add_comment('Info', f'Converted to Sales Invoice: {sales_invoice.name}')
        pos_doc.cancel()
        
        return {
            'success': True,
            'sales_invoice': sales_invoice.name,
            'message': f'Successfully converted to Sales Invoice: {sales_invoice.name}'
        }
        
    except Exception as e:
        frappe.log_error(f"Error converting to sales invoice: {str(e)}", "Convert to Sales Invoice")
        return {'success': False, 'message': str(e)}

@frappe.whitelist()
def get_payment_history(invoice_name):
    """Get complete payment history for an invoice"""
    try:
        doc = frappe.get_doc('POS Invoice', invoice_name)
        
        payment_history = []
        
        # Get partial payment details
        partial_details = get_partial_payment_details(invoice_name)
        
        for payment in partial_details.get('partial_payments', []):
            payment_history.append({
                'date': payment.get('payment_date'),
                'mode': payment.get('mode_of_payment'),
                'amount': payment.get('amount'),
                'reference': payment.get('reference_number'),
                'notes': payment.get('notes'),
                'recorded_by': payment.get('recorded_by'),
                'type': 'Partial Payment'
            })
        
        # Get comments related to payments
        comments = frappe.get_all('Comment',
            filters={
                'reference_doctype': 'POS Invoice',
                'reference_name': invoice_name,
                'comment_type': 'Info'
            },
            fields=['content', 'creation', 'owner'],
            order_by='creation asc'
        )
        
        for comment in comments:
            if any(keyword in comment.content.lower() for keyword in ['payment', 'reminder', 'partial']):
                payment_history.append({
                    'date': comment.creation,
                    'type': 'System Log',
                    'content': comment.content,
                    'recorded_by': comment.owner
                })
        
        # Sort by date
        payment_history.sort(key=lambda x: x.get('date') or '', reverse=True)
        
        return {
            'invoice': {
                'name': doc.name,
                'customer': doc.customer,
                'grand_total': doc.grand_total,
                'paid_amount': doc.paid_amount,
                'outstanding_amount': doc.outstanding_amount,
                'status': doc.status
            },
            'payment_history': payment_history
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting payment history: {str(e)}", "Payment History")
        return {'invoice': {}, 'payment_history': []}

@frappe.whitelist()
def bulk_send_payment_reminders(invoice_names, reminder_type="email"):
    """Send payment reminders for multiple invoices"""
    try:
        invoice_names = json.loads(invoice_names) if isinstance(invoice_names, str) else invoice_names
        
        results = []
        for invoice_name in invoice_names:
            result = send_payment_reminder(invoice_name, reminder_type)
            results.append({
                'invoice': invoice_name,
                'success': result.get('success', False),
                'message': result.get('message', '')
            })
        
        successful_count = sum(1 for r in results if r['success'])
        
        return {
            'success': True,
            'total_processed': len(results),
            'successful': successful_count,
            'failed': len(results) - successful_count,
            'details': results
        }
        
    except Exception as e:
        frappe.log_error(f"Error in bulk payment reminders: {str(e)}", "Bulk Payment Reminders")
        return {'success': False, 'message': str(e)}

# Utility functions for partial payment management

def calculate_partial_payment_aging(from_date=None, to_date=None):
    """Calculate aging analysis for partial payments"""
    
    conditions = ["outstanding_amount > 0"]
    
    if from_date:
        conditions.append(f"posting_date >= '{from_date}'")
    if to_date:
        conditions.append(f"posting_date <= '{to_date}'")
    
    where_clause = " AND ".join(conditions)
    
    aging_query = f"""
        SELECT 
            name,
            customer,
            posting_date,
            grand_total,
            outstanding_amount,
            DATEDIFF(CURDATE(), posting_date) as days_outstanding,
            CASE 
                WHEN DATEDIFF(CURDATE(), posting_date) <= 30 THEN '0-30 days'
                WHEN DATEDIFF(CURDATE(), posting_date) <= 60 THEN '31-60 days'
                WHEN DATEDIFF(CURDATE(), posting_date) <= 90 THEN '61-90 days'
                ELSE '90+ days'
            END as aging_bucket
        FROM 
            `tabPOS Invoice`
        WHERE 
            {where_clause}
        ORDER BY 
            days_outstanding DESC
    """
    
    return frappe.db.sql(aging_query, as_dict=True)

@frappe.whitelist()
def get_partial_payment_aging_report(from_date=None, to_date=None):
    """Get aging report for partial payments"""
    try:
        aging_data = calculate_partial_payment_aging(from_date, to_date)
        
        # Group by aging buckets
        aging_summary = {}
        for record in aging_data:
            bucket = record['aging_bucket']
            if bucket not in aging_summary:
                aging_summary[bucket] = {
                    'count': 0,
                    'total_outstanding': 0,
                    'invoices': []
                }
            
            aging_summary[bucket]['count'] += 1
            aging_summary[bucket]['total_outstanding'] += record['outstanding_amount']
            aging_summary[bucket]['invoices'].append(record)
        
        return {
            'aging_summary': aging_summary,
            'detailed_data': aging_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting aging report: {str(e)}", "Partial Payment Aging")
        return {'aging_summary': {}, 'detailed_data': []}

# Hook functions for automation

def schedule_payment_reminders():
    """Scheduled function to send automatic payment reminders"""
    try:
        # Get invoices that need reminders (e.g., 7, 14, 30 days overdue)
        reminder_intervals = [7, 14, 30]
        
        for days in reminder_intervals:
            target_date = frappe.utils.add_days(frappe.utils.getdate(), -days)
            
            overdue_invoices = frappe.get_all('POS Invoice',
                filters={
                    'posting_date': target_date,
                    'outstanding_amount': ['>', 0],
                    'docstatus': ['!=', 2]  # Not cancelled
                },
                fields=['name', 'customer', 'contact_email']
            )
            
            for invoice in overdue_invoices:
                if invoice.contact_email:
                    # Check if reminder was already sent today
                    existing_reminder = frappe.get_all('Comment',
                        filters={
                            'reference_doctype': 'POS Invoice',
                            'reference_name': invoice.name,
                            'content': ['like', '%Payment reminder%'],
                            'creation': ['>=', frappe.utils.getdate()]
                        }
                    )
                    
                    if not existing_reminder:
                        send_payment_reminder(invoice.name, "email")
        
        frappe.log_error("Automated payment reminders sent successfully", "Payment Reminder Scheduler")
        
    except Exception as e:
        frappe.log_error(f"Error in scheduled payment reminders: {str(e)}", "Payment Reminder Scheduler")

# Configuration and settings for partial payments

@frappe.whitelist()
def get_partial_payment_settings():
    """Get partial payment configuration settings"""
    try:
        # You can extend POS Settings or create a custom doctype
        settings = frappe.get_single('POS Settings')
        
        return {
            'allow_partial_payments': getattr(settings, 'allow_partial_payments', True),
            'require_approval_for_partial': getattr(settings, 'require_approval_for_partial', False),
            'auto_send_reminders': getattr(settings, 'auto_send_reminders', True),
            'reminder_intervals': getattr(settings, 'reminder_intervals', '7,14,30'),
            'partial_payment_terms': getattr(settings, 'partial_payment_terms', 30),
            'enable_partial_payment_notifications': getattr(settings, 'enable_partial_payment_notifications', True)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting partial payment settings: {str(e)}", "Partial Payment Settings")
        return {
            'allow_partial_payments': True,
            'require_approval_for_partial': False,
            'auto_send_reminders': True,
            'reminder_intervals': '7,14,30',
            'partial_payment_terms': 30,
            'enable_partial_payment_notifications': True
        }