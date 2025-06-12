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

@frappe.whitelist()
def print_captain_order(invoice_name, current_items, print_format, _lang, force_print=False):
    from frappe.utils import now
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
        
        # Calculate new items to print - Use item_code as the primary key
        new_items_to_print = []
        
        # Create a dictionary of previously printed items using item_code as key
        prev_items_dict = {}
        for prev_item in previously_printed_items:
            item_code = prev_item.get('item_code')
            if item_code:
                prev_items_dict[item_code] = float(prev_item.get('qty', 0))
        
        frappe.log_error(f"Prev items count: {len(previously_printed_items)}", "Print Debug")
        frappe.log_error(f"Current items count: {len(current_items)}", "Print Debug")
        frappe.log_error(f"Force print: {force_print}", "Print Debug")
        
        for current_item in current_items:
            item_code = current_item.get('item_code')
            if not item_code:
                continue
                
            current_qty = float(current_item.get('qty', 0))
            previous_qty = float(prev_items_dict.get(item_code, 0))
            
            frappe.log_error(f"{item_code}: curr={current_qty}, prev={previous_qty}", "Print Debug")
            
            if force_print or current_qty > previous_qty:
                qty_to_print = current_qty if force_print else (current_qty - previous_qty)
                frappe.log_error(f"Calculated qty_to_print: {qty_to_print}", "Print Debug")
                
                if qty_to_print > 0:
                    new_item = current_item.copy()
                    new_item['qty'] = qty_to_print
                    new_item['item_name'] = current_item.get('item_name') or current_item.get('item_code')
                    new_item['amount'] = qty_to_print * float(current_item.get('rate', 0))
                    new_items_to_print.append(new_item)
                    frappe.log_error(f"Added {item_code} qty={qty_to_print} (was {new_item['qty']})", "Print Debug")
                else:
                    frappe.log_error(f"Skipped {item_code} qty_to_print={qty_to_print}", "Print Debug")
            else:
                frappe.log_error(f"No change {item_code}", "Print Debug")
        
        if not new_items_to_print:
            frappe.log_error("No new items to print", "Print Debug")
            return {
                "success": True, 
                "data": {},
                "message": "No new items to print",
                "new_items_count": 0,
                "print_count": (getattr(print_log, 'print_count', 0) or 0)
            }
        
        # Get original invoice for context
        try:
            original_invoice = frappe.get_doc("POS Invoice", invoice_name)
        except frappe.DoesNotExistError:
            frappe.log_error(f"POS Invoice {invoice_name} not found", "Print Debug")
            return {"success": False, "error": f"POS Invoice {invoice_name} not found"}
        
        # Create pseudo document data
        pseudo_doc_data = {
            "name": invoice_name,
            "customer": original_invoice.customer,
            "posting_date": original_invoice.posting_date,
            "posting_time": original_invoice.posting_time,
            "pos_profile": original_invoice.pos_profile,
            "company": original_invoice.company,
            "territory": getattr(original_invoice, 'territory', ''),
            "items": new_items_to_print,
            "timestamp": now(),
            "is_captain_order_reprint": len(previously_printed_items) > 0,
            "print_count": (getattr(print_log, 'print_count', 0) or 0) + 1,
            "created_by_name": getattr(original_invoice, 'owner', '')
        }
        
        # Update print log with the CURRENT state (all items with their current quantities)
        if print_log:
            # Create updated printed items list with current quantities
            updated_printed_items = []
            current_items_dict = {item.get('item_code'): item for item in current_items if item.get('item_code')}
            
            # Add all current items to the printed items log
            for item_code, item_data in current_items_dict.items():
                updated_printed_items.append({
                    'item_code': item_code,
                    'item_name': item_data.get('item_name', item_code),
                    'qty': item_data.get('qty', 0),
                    'rate': item_data.get('rate', 0),
                    'uom': item_data.get('uom', ''),
                    'name': item_data.get('name', '')
                })
            
            print_log.printed_items = json.dumps(updated_printed_items)
            print_log.last_print_time = now()
            print_log.print_count = (print_log.print_count or 0) + 1
            try:
                print_log.save(ignore_permissions=True)
                frappe.db.commit()
                frappe.log_error(f"Updated print log: {print_log_name} with {len(updated_printed_items)} items", "Print Debug")
            except Exception as e:
                frappe.log_error(f"Failed to update print log {print_log_name}: {str(e)}", "Print Debug")
        
        frappe.log_error(f"Returning {len(new_items_to_print)} new items to print", "Print Debug")
        
        return {
            "success": True, 
            "data": pseudo_doc_data,
            "new_items_count": len(new_items_to_print),
            "print_count": print_log.print_count or 1
        }
        
    except Exception as e:
        frappe.log_error(f"Error in print_captain_order: {str(e)}", "Captain Order Print Error")
        import traceback
        frappe.log_error(f"Traceback: {traceback.format_exc()}", "Captain Order Print Error")
        return {"success": False, "error": str(e)}