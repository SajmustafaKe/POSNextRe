frappe.ui.form.on('POS Invoice Item', {
    item_code: function(frm, cdt, cdn) {
        var current_row = locals[cdt][cdn];
        
        if (!current_row.item_code) return;
        
        // Find existing row with same item_code (excluding current row)
        var existing_row_index = -1;
        var existing_row = null;
        
        for (let i = 0; i < frm.doc.items.length; i++) {
            let item = frm.doc.items[i];
            if (item.item_code === current_row.item_code && item.name !== current_row.name) {
                existing_row = item;
                existing_row_index = i;
                break;
            }
        }
        
        if (existing_row) {
            // Update quantity of existing row
            existing_row.qty = (existing_row.qty || 1) + (current_row.qty || 1);
            
            // Find and remove the current row
            var current_row_index = -1;
            for (let i = 0; i < frm.doc.items.length; i++) {
                if (frm.doc.items[i].name === current_row.name) {
                    current_row_index = i;
                    break;
                }
            }
            
            if (current_row_index !== -1) {
                // Remove the duplicate row
                frm.doc.items.splice(current_row_index, 1);
                
                // Refresh the form
                frm.refresh_field('items');
                frm.trigger('calculate_taxes_and_totals');
            }
        }
    }
});
