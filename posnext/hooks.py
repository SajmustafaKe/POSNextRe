app_name = "posnext"
app_title = "Posnext"
app_publisher = "jan"
app_description = "POSNext"
app_email = "jan@gmail.com"
app_license = "mit"
# required_apps = []

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/posnext/css/posnext.css"
app_include_js = [
    # "/assets/posnext/js/posnext_namespace.js",
    # "/assets/posnext/js/pos_controller.js",
    # "/assets/posnext/js/pos_item_cart.js",
    # "/assets/posnext/js/pos_item_details.js",
    # "/assets/posnext/js/pos_item_selector.js",
    # "/assets/posnext/js/pos_number_pad.js",
    # "/assets/posnext/js/pos_past_order_list.js",
    # "/assets/posnext/js/pos_past_order_summary.js",
    # "/assets/posnext/js/pos_payment.js",
    #"/assets/posnext/js/pos_invoice.js",
    "posnext.bundle.js",
]

# include js, css files in header of web template
# web_include_css = "/assets/posnext/css/posnext.css"
# web_include_js = "/assets/posnext/js/posnext.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "posnext/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {"POS Profile" : "public/js/pos_profile.js",
"Sales Invoice" : "public/js/sales_invoice.js",
"POS Closing Entry": "public/js/pos_closing_entry.js"
}

# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "posnext/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "posnext.utils.jinja_methods",
# 	"filters": "posnext.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "posnext.install.before_install"
# after_install = "posnext.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "posnext.uninstall.before_uninstall"
# after_uninstall = "posnext.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "posnext.utils.before_app_install"
# after_app_install = "posnext.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "posnext.utils.before_app_uninstall"
# after_app_uninstall = "posnext.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "posnext.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

override_doctype_class = {
	"Sales Invoice": "posnext.overrides.sales_invoice.PosnextSalesInvoice",
	"POS Closing Entry": "posnext.overrides.pos_closing_entry.PosnextPOSClosingEntry",
	"POS Invoice Merge Log": "posnext.overrides.pos_invoice_merge_log.PosnextPOSInvoiceMergeLog",
}
# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }


# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"posnext.tasks.all"
# 	],
# 	"daily": [
# 		"posnext.tasks.daily"
# 	],
# 	"hourly": [
# 		"posnext.tasks.hourly"
# 	],
# 	"weekly": [
# 		"posnext.tasks.weekly"
# 	],
# 	"monthly": [
# 		"posnext.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "posnext.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "posnext.event.get_events"
# }
override_whitelisted_methods = {
	"erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry.get_pos_invoices": "posnext.overrides.pos_closing_entry.get_pos_invoices"
	#"erpnext.accounts.doctype.pos_invoice.pos_invoice.get_stock_availability": "posnext.overrides.pos_invoice.get_stock_availability"
}
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "posnext.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["posnext.utils.before_request"]
# after_request = ["posnext.utils.after_request"]

# Job Events
# ----------
# before_job = ["posnext.utils.before_job"]
# after_job = ["posnext.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"posnext.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }


fixtures = [
	{
		"doctype":"Custom Field",
		"filters": [
			[
				"module",
				"in",
				["Posnext"]
            ]
        ]
	},
]