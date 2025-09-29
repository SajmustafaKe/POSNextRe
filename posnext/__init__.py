__version__ = "0.1.0"

import sys
from posnext.overrides import pos_closing_entry as custom_pos_script
import erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry

# Replace the module in sys.modules
sys.modules['erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry'] = custom_pos_script

# Monkey patch get_stock_availability
from posnext.overrides.pos_invoice import get_stock_availability as custom_get_stock_availability
import erpnext.accounts.doctype.pos_invoice.pos_invoice
erpnext.accounts.doctype.pos_invoice.pos_invoice.get_stock_availability = custom_get_stock_availability