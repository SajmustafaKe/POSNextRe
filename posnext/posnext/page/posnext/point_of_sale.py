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

		invoice_list = invoices_by_customer + invoices_by_name
	elif status:
		invoice_list = frappe.db.get_all(
			"POS Invoice", filters={"status": status}, fields=fields, page_length=limit
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


import frappe
import json
from frappe.utils import now, cstr

import frappe
import json
from frappe.utils import now, cstr

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
        try:
            print_log = frappe.get_doc("Captain Print Log", print_log_name)
            previously_printed_items = json.loads(print_log.printed_items or "[]")
            frappe.log_error(f"Found print log: {print_log_name}, Previously printed {len(previously_printed_items)} items", "Print Debug")
        except frappe.DoesNotExistError:
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
            "created_by_name": getattr(original_invoice, 'owner', ''),
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
        import traceback
        frappe.log_error(f"Traceback: {traceback.format_exc()}", "Captain Order Print Error")
        return {"success": False, "error": str(e)}

import frappe
from frappe import _
from frappe.utils import now, flt
import json

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
        
        # Cancel the original invoices
        for invoice in invoices_to_merge:
            # Add a comment about the merge
            invoice.add_comment('Comment', f'Invoice merged into {merged_invoice.name}')
            # Delete the draft invoice
            frappe.delete_doc("POS Invoice", invoice.name)
        
        frappe.db.commit()
        
        return {
            "success": True, 
            "new_invoice": merged_invoice.name,
            "message": f"Successfully merged {len(invoice_names)} invoices into {merged_invoice.name}"
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error merging invoices: {str(e)}")
        return {"success": False, "error": str(e)}

# Add this method to your point_of_sale.py file in the page folder
# Enhanced version of the split_pos_invoice function with created_by_name and custom distribution

import frappe
import json
from frappe.utils import flt, nowdate
from copy import deepcopy

@frappe.whitelist()
def split_pos_invoice(original_invoice, invoice_groups, distribute_evenly=False):
    """
    Split a POS Invoice into multiple invoices with custom item distribution
    
    Args:
        original_invoice: Name of the original invoice
        invoice_groups: Dictionary with invoice numbers as keys and items as values
                       e.g., {"1": [{"item_code": "ITEM001", "split_qty": 2}], "2": [...]}
        distribute_evenly: Whether to distribute items evenly (deprecated in favor of custom grouping)
    """
    try:
        # Parse invoice groups if it's a string
        if isinstance(invoice_groups, str):
            invoice_groups = json.loads(invoice_groups)
        
        # Get the original invoice
        original_doc = frappe.get_doc("POS Invoice", original_invoice)
        
        # Validate that the invoice can be split
        if original_doc.docstatus != 0:
            frappe.throw("Cannot split submitted invoices")
        
        if not invoice_groups:
            frappe.throw("No invoice groups specified for splitting")
        
        # Validate that all specified items exist in the original invoice
        validate_split_items(original_doc, invoice_groups)
        
        # Create new invoices based on groups
        new_invoices = []
        
        for invoice_num, items in invoice_groups.items():
            if items:  # Only create invoice if there are items
                new_invoice = create_split_invoice(original_doc, items, invoice_num)
                new_invoices.append(new_invoice)
        
        # Update the original invoice by removing split items
        all_split_items = []
        for items in invoice_groups.values():
            all_split_items.extend(items)
        
        update_original_invoice(original_doc, all_split_items)
        
        return {
            "success": True,
            "original_invoice": original_doc.name,
            "new_invoices": [
                {
                    "name": inv.name,
                    "grand_total": inv.grand_total,
                    "items": [{"item_code": item.item_code, "qty": item.qty} for item in inv.items],
                    "created_by": inv.owner
                }
                for inv in new_invoices
            ],
            "message": f"Successfully created {len(new_invoices)} new invoice(s)"
        }
        
    except Exception as e:
        frappe.log_error(f"Error in split_pos_invoice: {str(e)}")
        frappe.throw(f"Failed to split invoice: {str(e)}")

def validate_split_items(original_doc, invoice_groups):
    """Validate that split items exist and quantities are valid"""
    original_items = {item.item_code: item for item in original_doc.items}
    
    for invoice_num, items in invoice_groups.items():
        for split_item in items:
            item_code = split_item['item_code']
            split_qty = flt(split_item['split_qty'])
            
            if item_code not in original_items:
                frappe.throw(f"Item {item_code} not found in original invoice")
            
            if split_qty <= 0:
                frappe.throw(f"Split quantity for {item_code} must be greater than 0")
            
            if split_qty > original_items[item_code].qty:
                frappe.throw(f"Split quantity for {item_code} exceeds available quantity")

def create_split_invoice(original_doc, split_items, invoice_number):
    """Create a new invoice with the split items"""
    
    # Create new invoice document
    new_doc = frappe.new_doc("POS Invoice")
    
    # Copy basic information from original
    fields_to_copy = [
        'company', 'customer', 'posting_date', 'posting_time', 'set_posting_time',
        'due_date', 'is_pos', 'pos_profile', 'is_return', 'update_stock',
        'currency', 'conversion_rate', 'selling_price_list', 'price_list_currency',
        'plc_conversion_rate', 'ignore_pricing_rule', 'customer_address',
        'address_display', 'contact_person', 'contact_display', 'contact_mobile',
        'contact_email', 'territory', 'tc_name', 'terms', 'remarks',
        'sales_partner', 'commission_rate', 'total_commission', 'loyalty_program',
        'loyalty_points', 'redeem_loyalty_points', 'campaign', 'source',
        'customer_group', 'tax_category', 'cost_center', 'project',
        'created_by_name'  # Include created_by_name from original invoice
    ]
    
    for field in fields_to_copy:
        if hasattr(original_doc, field) and original_doc.get(field):
            new_doc.set(field, original_doc.get(field))
    
    # If created_by_name is not set, try to get it from the original document's owner
    if not new_doc.get('created_by_name') and original_doc.owner:
        try:
            user_full_name = frappe.get_value("User", original_doc.owner, "full_name")
            if user_full_name:
                new_doc.created_by_name = user_full_name
        except:
            pass  # If we can't get the user name, continue without it
    
    # Set naming series and title
    new_doc.naming_series = original_doc.naming_series
    new_doc.title = f"{original_doc.customer} - Split {invoice_number}"
    
    # Add split items to new invoice
    split_item_codes = {item['item_code']: item for item in split_items}
    
    for original_item in original_doc.items:
        if original_item.item_code in split_item_codes:
            split_item_data = split_item_codes[original_item.item_code]
            
            # Create new item row
            new_item = new_doc.append('items')
            
            # Copy all item fields
            item_fields = [
                'item_code', 'item_name', 'description', 'item_group', 'brand',
                'uom', 'conversion_factor', 'stock_uom', 'price_list_rate',
                'base_price_list_rate', 'margin_type', 'margin_rate_or_amount',
                'rate_with_margin', 'discount_percentage', 'discount_amount',
                'base_rate_with_margin', 'rate', 'base_rate', 'net_rate',
                'base_net_rate', 'warehouse', 'actual_batch_qty', 'actual_qty',
                'stock_uom_rate', 'is_free_item', 'grant_commission', 'weight_per_unit',
                'total_weight', 'weight_uom', 'serial_no', 'batch_no'
            ]
            
            for field in item_fields:
                if hasattr(original_item, field):
                    new_item.set(field, original_item.get(field))
            
            # Set the split quantity
            new_item.qty = flt(split_item_data['split_qty'])
            new_item.amount = flt(new_item.qty * new_item.rate)
            new_item.base_amount = flt(new_item.amount * new_doc.conversion_rate)
            new_item.net_amount = new_item.amount
            new_item.base_net_amount = new_item.base_amount
    
    # Copy tax rules (proportionally if needed)
    if original_doc.taxes:
        for original_tax in original_doc.taxes:
            new_tax = new_doc.append('taxes')
            
            tax_fields = [
                'charge_type', 'account_head', 'description', 'included_in_print_rate',
                'included_in_paid_amount', 'cost_center', 'rate', 'account_currency',
                'tax_amount', 'total', 'tax_amount_after_discount_amount',
                'base_tax_amount', 'base_total', 'base_tax_amount_after_discount_amount'
            ]
            
            for field in tax_fields:
                if hasattr(original_tax, field):
                    new_tax.set(field, original_tax.get(field))
    
    # Copy payment information (will need to be adjusted manually)
    if original_doc.payments:
        # For now, we'll create a placeholder payment that needs to be adjusted
        new_payment = new_doc.append('payments')
        new_payment.mode_of_payment = original_doc.payments[0].mode_of_payment
        new_payment.amount = 0  # Will be calculated after save
    
    # Calculate totals
    new_doc.run_method("calculate_taxes_and_totals")
    
    # Save the new invoice
    new_doc.insert()
    
    return new_doc

def update_original_invoice(original_doc, selected_items):
    """Update the original invoice by removing or reducing split items"""
    
    # Group split items by item_code and sum the quantities
    split_item_totals = {}
    for item in selected_items:
        item_code = item['item_code']
        split_qty = flt(item['split_qty'])
        
        if item_code in split_item_totals:
            split_item_totals[item_code] += split_qty
        else:
            split_item_totals[item_code] = split_qty
    
    # Update item quantities or remove items
    items_to_remove = []
    
    for i, item in enumerate(original_doc.items):
        if item.item_code in split_item_totals:
            total_split_qty = split_item_totals[item.item_code]
            
            if flt(item.qty) <= total_split_qty:
                # Remove the entire item
                items_to_remove.append(i)
            else:
                # Reduce the quantity
                new_qty = flt(item.qty) - total_split_qty
                item.qty = new_qty
                item.amount = flt(item.rate * new_qty)
                item.base_amount = flt(item.amount * original_doc.conversion_rate)
                item.net_amount = item.amount
                item.base_net_amount = item.base_amount
    
    # Remove items in reverse order to maintain indices
    for i in reversed(items_to_remove):
        original_doc.items.pop(i)
    
    # Recalculate totals
    original_doc.run_method("calculate_taxes_and_totals")
    
    # Update payment amounts if needed
    if original_doc.payments:
        total_paid = sum([payment.amount for payment in original_doc.payments])
        if total_paid > original_doc.grand_total:
            # Adjust the first payment to match the new grand total
            excess = total_paid - original_doc.grand_total
            if original_doc.payments[0].amount >= excess:
                original_doc.payments[0].amount -= excess
    
    # Save the updated original invoice
    original_doc.save()
    
    return original_doc