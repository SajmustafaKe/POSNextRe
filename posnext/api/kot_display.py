import json
import frappe
from frappe.utils import get_datetime


@frappe.whitelist()
def serve_kot(name, time):
    """Set order status to Served and record timing"""
    current_time = get_datetime()
    creation_time = frappe.db.get_value("KOT", name, "creation")

    production_time = current_time - creation_time
    production_time_minutes = production_time.total_seconds() / 60

    frappe.db.set_value("KOT", name, "start_time_serv", time)
    frappe.db.set_value("KOT", name, "production_time", production_time_minutes)
    frappe.db.set_value("KOT", name, "order_status", "Served")


@frappe.whitelist()
def confirm_cancel_kot(name, user):
    """Mark cancelled KOT as verified by user"""
    frappe.db.set_value("KOT", name, "verified", 1)
    frappe.db.set_value("KOT", name, "verified_by", user)


@frappe.whitelist()
def kot_list():
    """Get list of KOTs for KDS display"""
    branch = frappe.db.get_value("User", frappe.session.user, "branch") or frappe.session.get("branch")
    if not branch:
        return {"KOT": [], "Branch": None}

    kot_alert_time = frappe.db.get_value("POS Profile", {"branch": branch}, "custom_kot_warning_time") or 10
    daily_order_number = frappe.db.get_value("POS Profile", {"branch": branch}, "custom_reset_order_number_daily") or 0
    audio_alert = frappe.db.get_value("POS Profile", {"branch": branch}, "custom_kot_alert") or 0

    three_hours_ago = frappe.utils.add_to_date(frappe.utils.now(), hours=-3)

    kot_list = frappe.get_list(
        "KOT",
        fields=["name"],
        filters={
            "order_status": "Ready For Prepare",
            "branch": branch,
            "type": ["in", ["New Order", "Order Modified", "Duplicate", "Cancelled", "Partially cancelled"]],
            "docstatus": 1,
            "verified": 0,
            "creation": (">=", three_hours_ago),
        },
        order_by="creation desc",
    )

    kots = []
    for kot in kot_list:
        kot_doc = frappe.get_doc("KOT", kot.name)
        kot_json = json.loads(frappe.as_json(kot_doc))
        kots.append(kot_json)

    return {
        "KOT": kots,
        "Branch": branch,
        "kot_alert_time": kot_alert_time,
        "audio_alert": audio_alert,
        "daily_order_number": daily_order_number
    }


@frappe.whitelist()
def served_kot_list():
    """Get list of served KOTs for verification"""
    branch = frappe.db.get_value("User", frappe.session.user, "branch") or frappe.session.get("branch")
    if not branch:
        return {"KOT": []}

    three_hours_ago = frappe.utils.add_to_date(frappe.utils.now(), hours=-3)

    kot_list = frappe.get_list(
        "KOT",
        fields=["name"],
        filters={
            "order_status": "Served",
            "branch": branch,
            "type": ["in", ["New Order", "Order Modified", "Duplicate", "Cancelled", "Partially cancelled"]],
            "docstatus": 1,
            "verified": 0,
            "creation": (">=", three_hours_ago),
        },
        order_by="creation desc",
    )

    kots = []
    for kot in kot_list:
        kot_doc = frappe.get_doc("KOT", kot.name)
        kot_json = json.loads(frappe.as_json(kot_doc))
        kots.append(kot_json)

    return {"KOT": kots}


@frappe.whitelist(allow_guest=True)
def get_site_name():
    """Get site name for KDS"""
    return {"site_name": frappe.local.site}