import frappe
from frappe.utils.scheduler import is_scheduler_inactive
from frappe.utils.background_jobs import enqueue, is_job_enqueued
from erpnext.accounts.doctype.pos_invoice_merge_log.pos_invoice_merge_log import POSInvoiceMergeLog
from frappe.utils import cint, flt, get_time, getdate, nowdate, nowtime
from frappe import _

class PosnextPOSInvoiceMergeLog(POSInvoiceMergeLog):
    def serial_and_batch_bundle_reference_for_pos_invoice(self):
        for d in self.pos_invoices:
            pos_invoice = frappe.get_doc("Sales Invoice", d.pos_invoice)
            for table_name in ["items", "packed_items"]:
                pos_invoice.set_serial_and_batch_bundle(table_name)
    def on_cancel(self):
        pos_invoice_docs = [frappe.get_cached_doc("Sales Invoice", d.pos_invoice) for d in self.pos_invoices]

        self.update_pos_invoices(pos_invoice_docs)
        self.serial_and_batch_bundle_reference_for_pos_invoice()
        self.cancel_linked_invoices()
    def on_submit(self):
        pos_invoice_docs = [frappe.get_cached_doc("Sales Invoice", d.pos_invoice) for d in self.pos_invoices]

        returns = [d for d in pos_invoice_docs if d.get("is_return") == 1]
        sales = [d for d in pos_invoice_docs if d.get("is_return") == 0]

        sales_invoice, credit_note = "", ""
        if returns:
            credit_note = self.process_merging_into_credit_note(returns)

        if sales:
            sales_invoice = self.process_merging_into_sales_invoice(sales)

        self.save()  # save consolidated_sales_invoice & consolidated_credit_note ref in merge log
        self.update_pos_invoices(pos_invoice_docs, sales_invoice, credit_note)
    def validate_pos_invoice_status(self):
        for d in self.pos_invoices:
            status, docstatus, is_return, return_against = frappe.db.get_value(
                "Sales Invoice", d.pos_invoice, ["status", "docstatus", "is_return", "return_against"]
            )

            bold_pos_invoice = frappe.bold(d.pos_invoice)
            bold_status = frappe.bold(status)
            if docstatus != 1:
                frappe.throw(
                    _("Row #{}: Sales Invoice {} is not submitted yet").format(d.idx, bold_pos_invoice)
                )
            if status == "Consolidated":
                frappe.throw(
                    _("Row #{}: Sales Invoice {} has been {}").format(d.idx, bold_pos_invoice, bold_status)
                )
            if (
                            is_return
                        and return_against
                    and return_against not in [d.pos_invoice for d in self.pos_invoices]
            ):
                bold_return_against = frappe.bold(return_against)
                return_against_status = frappe.db.get_value("Sales Invoice", return_against, "status")
                if return_against_status != "Consolidated":
                    # if return entry is not getting merged in the current pos closing and if it is not consolidated
                    bold_unconsolidated = frappe.bold("not Consolidated")
                    msg = _("Row #{}: Original Invoice {} of return invoice {} is {}.").format(
                        d.idx, bold_return_against, bold_pos_invoice, bold_unconsolidated
                    )
                    msg += " "
                    msg += _(
                        "Original invoice should be consolidated before or along with the return invoice."
                    )
                    msg += "<br><br>"
                    msg += _("You can add original invoice {} manually to proceed.").format(
                        bold_return_against
                    )
                    frappe.throw(msg)

def split_invoices(invoices):
    """
    Splits invoices into multiple groups
    Use-case:
    If a serial no is sold and later it is returned
    then split the invoices such that the selling entry is merged first and then the return entry
    """
    # Input
    # invoices = [
    # 	{'pos_invoice': 'Invoice with SR#1 & SR#2', 'is_return': 0},
    # 	{'pos_invoice': 'Invoice with SR#1', 'is_return': 1},
    # 	{'pos_invoice': 'Invoice with SR#2', 'is_return': 0}
    # ]
    # Output
    # _invoices = [
    # 	[{'pos_invoice': 'Invoice with SR#1 & SR#2', 'is_return': 0}],
    # 	[{'pos_invoice': 'Invoice with SR#1', 'is_return': 1}, {'pos_invoice': 'Invoice with SR#2', 'is_return': 0}],
    # ]

    _invoices = []
    special_invoices = []
    pos_return_docs = [
        frappe.get_cached_doc("Sales Invoice", d.pos_invoice)
        for d in invoices
        if d.is_return and d.return_against
    ]

    for pos_invoice in pos_return_docs:
        for item in pos_invoice.items:
            if not item.serial_no and not item.serial_and_batch_bundle:
                continue

            return_against_is_added = any(d for d in _invoices if d.pos_invoice == pos_invoice.return_against)
            if return_against_is_added:
                break

            return_against_is_consolidated = (
                frappe.db.get_value("POS Invoice", pos_invoice.return_against, "status", cache=True)
                == "Consolidated"
            )
            if return_against_is_consolidated:
                break

            pos_invoice_row = [d for d in invoices if d.pos_invoice == pos_invoice.return_against]
            _invoices.append(pos_invoice_row)
            special_invoices.append(pos_invoice.return_against)
            break

    _invoices.append([d for d in invoices if d.pos_invoice not in special_invoices])

    return _invoices

def consolidate_pos_invoices(pos_invoices=None, closing_entry=None):
    invoices = pos_invoices or (closing_entry and closing_entry.get("pos_transactions"))
    if frappe.flags.in_test and not invoices:
        invoices = get_all_unconsolidated_invoices()

    invoice_by_customer = get_invoice_customer_map(invoices)

    if len(invoices) >= 10 and closing_entry:
        closing_entry.set_status(update=True, status="Queued")
        enqueue_job(create_merge_logs, invoice_by_customer=invoice_by_customer, closing_entry=closing_entry)
    else:
        create_merge_logs(invoice_by_customer, closing_entry)

def get_all_unconsolidated_invoices():
    filters = {
        "consolidated_invoice": ["in", ["", None]],
        "status": ["not in", ["Consolidated"]],
        "docstatus": 1,
    }
    pos_invoices = frappe.db.get_all(
        "Sales Invoice",
        filters=filters,
        fields=[
            "name as pos_invoice",
            "posting_date",
            "grand_total",
            "customer",
            "is_return",
            "return_against",
        ],
    )

    return pos_invoices

def get_invoice_customer_map(pos_invoices):
    # pos_invoice_customer_map = { 'Customer 1': [{}, {}, {}], 'Customer 2' : [{}] }
    pos_invoice_customer_map = {}
    for invoice in pos_invoices:
        customer = invoice.get("customer")
        pos_invoice_customer_map.setdefault(customer, [])
        pos_invoice_customer_map[customer].append(invoice)

    return pos_invoice_customer_map


def unconsolidate_pos_invoices(closing_entry):
    merge_logs = frappe.get_all(
        "POS Invoice Merge Log", filters={"pos_closing_entry": closing_entry.name}, pluck="name"
    )

    if len(merge_logs) >= 10:
        closing_entry.set_status(update=True, status="Queued")
        enqueue_job(cancel_merge_logs, merge_logs=merge_logs, closing_entry=closing_entry)
    else:
        cancel_merge_logs(merge_logs, closing_entry)
def cancel_merge_logs(merge_logs, closing_entry=None):
    try:
        for log in merge_logs:
            merge_log = frappe.get_doc("POS Invoice Merge Log", log)
            merge_log.flags.ignore_permissions = True
            merge_log.cancel()

        if closing_entry:
            closing_entry.set_status(update=True, status="Cancelled")
            closing_entry.db_set("error_message", "")
            closing_entry.update_opening_entry(for_cancel=True)

    except Exception as e:
        frappe.db.rollback()
        message_log = frappe.message_log.pop() if frappe.message_log else str(e)
        error_message = get_error_message(message_log)

        if closing_entry:
            closing_entry.set_status(update=True, status="Submitted")
            closing_entry.db_set("error_message", error_message)
        raise

    finally:
        frappe.db.commit()
        frappe.publish_realtime("closing_process_complete", user=frappe.session.user)

def create_merge_logs(invoice_by_customer, closing_entry=None):
    try:
        for customer, invoices in invoice_by_customer.items():
            for _invoices in split_invoices(invoices):
                merge_log = frappe.new_doc("POS Invoice Merge Log")
                merge_log.posting_date = (
                    getdate(closing_entry.get("posting_date")) if closing_entry else nowdate()
                )
                merge_log.posting_time = (
                    get_time(closing_entry.get("posting_time")) if closing_entry else nowtime()
                )
                merge_log.customer = customer
                merge_log.pos_closing_entry = closing_entry.get("name") if closing_entry else None
                merge_log.set("pos_invoices", _invoices)
                merge_log.save(ignore_permissions=True)
                merge_log.submit()
        if closing_entry:
            closing_entry.set_status(update=True, status="Submitted")
            closing_entry.db_set("error_message", "")
            closing_entry.update_opening_entry()

    except Exception as e:
        frappe.db.rollback()
        message_log = frappe.message_log.pop() if frappe.message_log else str(e)
        error_message = get_error_message(message_log)

        if closing_entry:
            closing_entry.set_status(update=True, status="Failed")
            if isinstance(error_message, list):
                error_message = json.dumps(error_message)
            closing_entry.db_set("error_message", error_message)
        raise

    finally:
        frappe.db.commit()
        frappe.publish_realtime("closing_process_complete", user=frappe.session.user)
def enqueue_job(job, **kwargs):
    check_scheduler_status()

    closing_entry = kwargs.get("closing_entry") or {}

    job_id = "pos_invoice_merge::" + str(closing_entry.get("name"))
    if not is_job_enqueued(job_id):
        enqueue(
            job,
            **kwargs,
            queue="long",
            timeout=10000,
            event="processing_merge_logs",
            job_id=job_id,
            now=frappe.conf.developer_mode or frappe.flags.in_test,
        )

        if job == create_merge_logs:
            msg = _("POS Invoices will be consolidated in a background process")
        else:
            msg = _("POS Invoices will be unconsolidated in a background process")

        frappe.msgprint(msg, alert=1)

def check_scheduler_status():
    if is_scheduler_inactive() and not frappe.flags.in_test:
        frappe.throw(_("Scheduler is inactive. Cannot enqueue job."), title=_("Scheduler Inactive"))


def get_error_message(message) -> str:
	try:
		return message["message"]
	except Exception:
		return str(message)