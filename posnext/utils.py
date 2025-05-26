import frappe

@frappe.whitelist()
def get_user_name_from_secret_key(secret_key):
    if frappe.db.exists("User Secret Key", {"secret_key": secret_key}):
        return frappe.get_value("User Secret Key", {"secret_key": secret_key}, "user_name")
    else:
        frappe.throw("Invalid secret key")