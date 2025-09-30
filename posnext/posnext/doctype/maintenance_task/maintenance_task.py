import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now, get_datetime, time_diff_in_hours
import json

class MaintenanceTask(Document):
	def validate(self):
		self.validate_room()
		self.set_timestamps()
		self.calculate_cost_variance()
		self.update_room_status()

	def validate_room(self):
		"""Validate that the room exists"""
		if not frappe.db.exists("Hotel Room", self.room):
			frappe.throw(_("Hotel Room {0} does not exist").format(self.room))

	def set_timestamps(self):
		"""Set automatic timestamps based on status changes"""
		if self.status == "Assigned" and not self.assigned_date:
			self.assigned_date = now()

		if self.status == "In Progress" and not self.started_at:
			self.started_at = now()

		if self.status == "Completed" and not self.completed_at:
			self.completed_at = now()

	def calculate_cost_variance(self):
		"""Calculate cost variance when task is completed"""
		if self.status == "Completed" and self.estimated_cost and self.actual_cost:
			self.cost_variance = self.actual_cost - self.estimated_cost

	def update_room_status(self):
		"""Update room maintenance status"""
		if self.status in ["Open", "Assigned", "In Progress"]:
			room = frappe.get_doc("Hotel Room", self.room)
			room.maintenance_status = "Under Maintenance"
			room.save()
		elif self.status == "Completed":
			room = frappe.get_doc("Hotel Room", self.room)
			room.maintenance_status = "None"
			room.save()

	def on_submit(self):
		"""Create follow-up tasks if preventive action is required"""
		if self.preventive_action and self.follow_up_date:
			self.create_preventive_task()

	def create_preventive_task(self):
		"""Create a preventive maintenance task"""
		preventive_task = frappe.get_doc({
			"doctype": "Maintenance Task",
			"room": self.room,
			"issue_type": self.issue_type,
			"issue_category": "Preventive Maintenance",
			"priority": "Low",
			"status": "Open",
			"scheduled_date": self.follow_up_date,
			"issue_description": f"Preventive maintenance follow-up: {self.preventive_action}",
			"reported_by": frappe.session.user
		})
		preventive_task.insert()
		frappe.msgprint(_("Preventive maintenance task scheduled for {0}").format(self.follow_up_date))

@frappe.whitelist()
def get_maintenance_tasks(filters=None):
	"""Get maintenance tasks with filters"""
	if isinstance(filters, str):
		filters = json.loads(filters)

	conditions = []
	values = []

	if filters.get("room"):
		conditions.append("room = %s")
		values.append(filters["room"])

	if filters.get("status"):
		conditions.append("status = %s")
		values.append(filters["status"])

	if filters.get("priority"):
		conditions.append("priority = %s")
		values.append(filters["priority"])

	if filters.get("issue_type"):
		conditions.append("issue_type = %s")
		values.append(filters["issue_type"])

	where_clause = " AND ".join(conditions) if conditions else "1=1"

	tasks = frappe.db.sql("""
		SELECT name, room, issue_type, priority, status, reported_date,
			   assigned_to, scheduled_date, estimated_cost
		FROM `tabMaintenance Task`
		WHERE {0}
		ORDER BY priority DESC, reported_date DESC
	""".format(where_clause), values, as_dict=True)

	return tasks

@frappe.whitelist()
def assign_maintenance_task(task_name, assigned_to, scheduled_date=None):
	"""Assign a maintenance task to a technician"""
	task = frappe.get_doc("Maintenance Task", task_name)
	task.status = "Assigned"
	task.assigned_to = assigned_to
	task.assigned_date = now()
	if scheduled_date:
		task.scheduled_date = scheduled_date
	task.save()

	frappe.msgprint(_("Maintenance task {0} assigned to {1}").format(task_name, assigned_to))

@frappe.whitelist()
def start_maintenance_task(task_name):
	"""Mark a maintenance task as started"""
	task = frappe.get_doc("Maintenance Task", task_name)
	task.status = "In Progress"
	task.started_at = now()
	task.save()

	frappe.msgprint(_("Maintenance task {0} started").format(task_name))

@frappe.whitelist()
def complete_maintenance_task(task_name, resolution_details, parts_used=None, actual_cost=None):
	"""Mark a maintenance task as completed"""
	task = frappe.get_doc("Maintenance Task", task_name)
	task.status = "Completed"
	task.completed_at = now()
	task.resolution_details = resolution_details

	if parts_used:
		task.parts_used = parts_used
	if actual_cost:
		task.actual_cost = actual_cost

	task.save()

	frappe.msgprint(_("Maintenance task {0} completed").format(task_name))

@frappe.whitelist()
def get_maintenance_stats():
	"""Get maintenance statistics for dashboard"""
	stats = frappe.db.sql("""
		SELECT
			COUNT(CASE WHEN status = 'Open' THEN 1 END) as open_tasks,
			COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_tasks,
			COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_today,
			COUNT(CASE WHEN priority = 'Critical' AND status != 'Completed' THEN 1 END) as critical_tasks,
			SUM(CASE WHEN status = 'Completed' AND DATE(completed_at) = CURDATE() THEN actual_cost ELSE 0 END) as today_cost
		FROM `tabMaintenance Task`
		WHERE DATE(reported_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
	""", as_dict=True)[0]

	return stats

@frappe.whitelist()
def create_preventive_maintenance_schedule():
	"""Create preventive maintenance tasks based on schedule"""
	# This would typically be called by a scheduled job
	# For now, create basic preventive tasks for common items

	preventive_tasks = [
		{
			"room": None,  # All rooms
			"issue_type": "HVAC",
			"issue_description": "Monthly HVAC filter check and cleaning",
			"priority": "Medium",
			"issue_category": "Preventive Maintenance"
		},
		{
			"room": None,
			"issue_type": "Electrical",
			"issue_description": "Monthly electrical system inspection",
			"priority": "Medium",
			"issue_category": "Preventive Maintenance"
		},
		{
			"room": None,
			"issue_type": "Plumbing",
			"issue_description": "Monthly plumbing system check",
			"priority": "Medium",
			"issue_category": "Preventive Maintenance"
		}
	]

	created_tasks = []
	for task_data in preventive_tasks:
		# If room is None, create for all rooms
		if not task_data["room"]:
			rooms = frappe.get_all("Hotel Room", fields=["name"])
			for room in rooms:
				task_data_copy = task_data.copy()
				task_data_copy["room"] = room.name
				task = frappe.get_doc({
					"doctype": "Maintenance Task",
					**task_data_copy,
					"status": "Open",
					"reported_by": "System",
					"scheduled_date": frappe.utils.add_months(frappe.utils.today(), 1)
				})
				task.insert()
				created_tasks.append(task.name)
		else:
			task = frappe.get_doc({
				"doctype": "Maintenance Task",
				**task_data,
				"status": "Open",
				"reported_by": "System",
				"scheduled_date": frappe.utils.add_months(frappe.utils.today(), 1)
			})
			task.insert()
			created_tasks.append(task.name)

	return created_tasks