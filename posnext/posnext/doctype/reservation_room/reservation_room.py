# -*- coding: utf-8 -*-
# Copyright (c) 2025, POSNext and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class ReservationRoom(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		quantity: DF.Int
		rate: DF.Currency
		room_type: DF.Link
	# end: auto-generated types

	pass