import frappe
from erpnext.accounts.doctype.pos_invoice.pos_invoice import get_bin_qty,get_bundle_availability

@frappe.whitelist()
def get_stock_availability(item_code, warehouse):
	if not frappe.db.exists("Item", item_code):
		return {warehouse: 0}, False

	is_stock_item = frappe.db.get_value("Item", item_code, "is_stock_item")
	if not is_stock_item:
		if frappe.db.exists("Product Bundle", {"name": item_code, "disabled": 0}):
			# For bundles, return the bundle availability
			from erpnext.accounts.doctype.pos_invoice.pos_invoice import get_bundle_availability
			return {warehouse: get_bundle_availability(item_code, warehouse)}, True
		return {warehouse: 0}, False

	is_group = frappe.db.get_value("Warehouse", warehouse, "is_group")
	if is_group:
		lft, rgt = frappe.db.get_value("Warehouse", warehouse, ["lft", "rgt"])
		child_warehouses = frappe.db.get_all(
			"Warehouse",
			fields=["name"],
			filters={"lft": [">=", lft], "rgt": ["<=", rgt]},
			pluck="name"
		)
	else:
		child_warehouses = [warehouse]

	# Calculate total available quantity across all child warehouses
	total_qty = 0
	for wh in child_warehouses:
		qty = get_bin_qty(item_code, wh)
		if qty:
			total_qty += qty

	# Subtract POS reserved quantity
	from erpnext.accounts.doctype.pos_invoice.pos_invoice import get_pos_reserved_qty
	pos_reserved = get_pos_reserved_qty(item_code, warehouse)
	total_qty -= pos_reserved

	return {warehouse: total_qty}, True