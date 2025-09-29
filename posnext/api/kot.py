import json
import frappe


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


def check_pos_profiles():
    try:
        profiles = frappe.get_all('POS Profile', fields=['name', 'custom_kot_naming_series'])
        print("POS Profiles found:")
        for profile in profiles:
            print(f"Name: {profile.name}, KOT Naming Series: {profile.get('custom_kot_naming_series', 'Not set')}")
        return profiles
    except Exception as e:
        print(f"Error: {e}")
        return []


def check_naming_series():
    try:
        series = frappe.get_all('Naming Series', fields=['name'])
        print("Naming Series found:")
        for s in series:
            if 'KOT' in s.name:
                print(f"Name: {s.name}")
        return series
    except Exception as e:
        print(f"Error: {e}")
        return []


def update_pos_profile_kot_series():
    try:
        pos_profile = frappe.get_doc("POS Profile", "Hotel")
        pos_profile.custom_kot_naming_series = "KOT-.YYYY.-.#####"
        pos_profile.save()
        frappe.db.commit()
        print("Updated POS Profile with KOT naming series")
        return True
    except Exception as e:
        print(f"Error updating POS Profile: {e}")
        return False


def check_pos_profiles():
    try:
        profiles = frappe.get_all('POS Profile', fields=['name', 'custom_kot_naming_series'])
        print("POS Profiles found:")
        for profile in profiles:
            print(f"Name: {profile.name}, KOT Naming Series: {profile.get('custom_kot_naming_series', 'Not set')}")
        return profiles
    except Exception as e:
        print(f"Error: {e}")
        return []


def check_naming_series():
    try:
        series = frappe.get_all('Naming Series', fields=['name'])
        print("Naming Series found:")
        for s in series:
            if 'KOT' in s.name:
                print(f"Name: {s.name}")
        return series
    except Exception as e:
        print(f"Error: {e}")
        return []


def update_pos_profile_kot_series():
    try:
        pos_profile = frappe.get_doc("POS Profile", "Hotel")
        pos_profile.custom_kot_naming_series = "KOT-.YYYY.-.#####"
        pos_profile.save()
        frappe.db.commit()
        print("Updated POS Profile with KOT naming series")
        return True
    except Exception as e:
        print(f"Error updating POS Profile: {e}")
        return False


