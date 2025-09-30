import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now, get_datetime, time_diff_in_hours
import json

class HousekeepingTask(Document):
	def validate(self):
		self.validate_room_availability()
		self.set_timestamps()
		self.calculate_duration()
		self.update_room_status()

	def validate_room_availability(self):
		"""Validate that the room exists and is accessible"""
		if not frappe.db.exists("Hotel Room", self.room):
			frappe.throw(_("Hotel Room {0} does not exist").format(self.room))

	def set_timestamps(self):
		"""Set automatic timestamps based on status changes"""
		if self.status == "Assigned" and not self.assigned_date:
			self.assigned_date = now()
			if not self.assigned_by:
				self.assigned_by = frappe.session.user

		if self.status == "In Progress" and not self.started_at:
			self.started_at = now()

		if self.status == "Completed" and not self.completed_at:
			self.completed_at = now()

	def calculate_duration(self):
		"""Calculate actual duration when task is completed"""
		if self.started_at and self.completed_at:
			start = get_datetime(self.started_at)
			end = get_datetime(self.completed_at)
			self.actual_duration = time_diff_in_hours(end, start) * 60  # Convert to minutes

	def update_room_status(self):
		"""Update room housekeeping status based on task completion"""
		if self.status == "Completed":
			room = frappe.get_doc("Hotel Room", self.room)
			if self.task_type in ["Daily Cleaning", "Deep Cleaning", "Turndown Service"]:
				room.housekeeping_status = "Clean"
				room.last_cleaned = now()
			room.save()

	def on_submit(self):
		"""Create follow-up tasks if required"""
		if self.follow_up_required and self.issues_found:
			self.create_maintenance_task()

	def create_maintenance_task(self):
		"""Create a maintenance task for issues found during housekeeping"""
		maintenance_task = frappe.get_doc({
			"doctype": "Maintenance Task",
			"room": self.room,
			"issue_description": self.issues_found,
			"reported_by": self.assigned_to or frappe.session.user,
			"priority": "High" if "urgent" in (self.issues_found or "").lower() else "Medium",
			"status": "Open",
			"housekeeping_reference": self.name
		})
		maintenance_task.insert()
		frappe.msgprint(_("Maintenance task created for issues found in room {0}").format(self.room))

@frappe.whitelist()
def get_housekeeping_tasks(filters=None):
	"""Get housekeeping tasks with filters"""
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

	if filters.get("assigned_to"):
		conditions.append("assigned_to = %s")
		values.append(filters["assigned_to"])

	if filters.get("scheduled_date"):
		conditions.append("scheduled_date = %s")
		values.append(filters["scheduled_date"])

	where_clause = " AND ".join(conditions) if conditions else "1=1"

	tasks = frappe.db.sql("""
		SELECT name, room, task_type, priority, status, scheduled_date,
			   scheduled_time, assigned_to, started_at, completed_at
		FROM `tabHousekeeping Task`
		WHERE {0}
		ORDER BY scheduled_date, scheduled_time
	""".format(where_clause), values, as_dict=True)

	return tasks

@frappe.whitelist()
def assign_task(task_name, assigned_to):
	"""Assign a housekeeping task to a user"""
	task = frappe.get_doc("Housekeeping Task", task_name)
	task.status = "Assigned"
	task.assigned_to = assigned_to
	task.assigned_by = frappe.session.user
	task.assigned_date = now()
	task.save()

	frappe.msgprint(_("Task {0} assigned to {1}").format(task_name, assigned_to))

@frappe.whitelist()
def start_task(task_name):
	"""Mark a task as started"""
	task = frappe.get_doc("Housekeeping Task", task_name)
	task.status = "In Progress"
	task.started_at = now()
	task.save()

	frappe.msgprint(_("Task {0} started").format(task_name))

@frappe.whitelist()
def complete_task(task_name, qc_passed=None, qc_notes=None):
	"""Mark a task as completed"""
	task = frappe.get_doc("Housekeeping Task", task_name)
	task.status = "Completed"
	task.completed_at = now()

	if qc_passed is not None:
		task.qc_passed = qc_passed
	if qc_notes:
		task.qc_notes = qc_notes

	task.save()

	frappe.msgprint(_("Task {0} completed").format(task_name))

@frappe.whitelist()
def get_daily_housekeeping_schedule(date=None):
	"""Get housekeeping schedule for a specific date"""
	if not date:
		date = frappe.utils.today()

	tasks = frappe.db.sql("""
		SELECT ht.name, ht.room, ht.task_type, ht.priority, ht.status,
			   ht.scheduled_time, ht.assigned_to, hr.room_number
		FROM `tabHousekeeping Task` ht
		INNER JOIN `tabHotel Room` hr ON ht.room = hr.name
		WHERE ht.scheduled_date = %s
		ORDER BY ht.scheduled_time, ht.priority DESC
	""", (date,), as_dict=True)

	return tasks

@frappe.whitelist()
def create_daily_cleaning_tasks(date=None):
	"""Create daily cleaning tasks for all occupied/clean rooms"""
	if not date:
		date = frappe.utils.today()

	# Get all rooms that need daily cleaning
	rooms = frappe.db.sql("""
		SELECT name, room_number, housekeeping_status
		FROM `tabHotel Room`
		WHERE status IN ('Occupied', 'Available')
		AND housekeeping_status IN ('Dirty', 'Clean')
	""", as_dict=True)

	created_tasks = []
	for room in rooms:
		# Check if task already exists for this room and date
		existing_task = frappe.db.exists("Housekeeping Task", {
			"room": room.name,
			"task_type": "Daily Cleaning",
			"scheduled_date": date
		})

		if not existing_task:
			task = frappe.get_doc({
				"doctype": "Housekeeping Task",
				"room": room.name,
				"task_type": "Daily Cleaning",
				"priority": "Medium",
				"status": "Pending",
				"scheduled_date": date,
				"task_description": f"Daily cleaning for room {room.room_number}"
			})
			task.insert()
			created_tasks.append(task.name)

	return created_tasks