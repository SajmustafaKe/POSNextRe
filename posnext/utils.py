import frappe

@frappe.whitelist()
def get_user_name_from_secret_key(secret_key):
    if frappe.db.exists("User Secret Key", {"secret_key": secret_key}):
        return frappe.get_value("User Secret Key", {"secret_key": secret_key}, "user_name")
    else:
        frappe.throw("Invalid secret key")

@frappe.whitelist()
def clean_workspace_links():
    """Clean invalid links from POSNext App workspace"""
    try:
        # Get the workspace
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        # Get invalid links
        invalid_links, cancelled_links = workspace.get_invalid_links()

        frappe.msgprint(f"Found {len(invalid_links)} invalid links")
        for link in invalid_links:
            frappe.msgprint(f"Invalid: {link}")

        # Remove invalid links
        for link_info in invalid_links:
            fieldname, docname, msg = link_info
            # Find and remove the link
            for i, link in enumerate(workspace.links):
                if link.link_to == docname:
                    frappe.msgprint(f"Removing link at index {i}: {link.link_to}")
                    workspace.links.remove(link)
                    break

        # Update directly in database to bypass validation
        workspace.db_update()
        frappe.msgprint("Workspace updated successfully")
        return {"success": True, "message": "Invalid links removed"}

    except Exception as e:
        frappe.log_error(f"Error cleaning workspace: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def add_valid_links_to_workspace():
    """Add valid DocTypes to POSNext App workspace"""
    try:
        # Get the workspace
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        # Valid DocTypes to add
        valid_doctypes = [
            "POS Closing Entry",
            "POS Invoice Merge Log",
            "POS Settings",
            "POS Profile WhatsApp Field Names",
            "Printer Settings",
            "Captain Print Log",
            "KOT",
            "KOT Item",
            "KOT Error Log",
            "Menu Item",
            "Table",
            "Table Status Log",
            "Production Item Groups",
            "Production Unit",
            "Hotel Guest",
            "Hotel Reservation",
            "Hotel Room",
            "Hotel Room Package",
            "Hotel Room Package Amenity",
            "Hotel Room Package Pricing Rule",
            "Room Type"
        ]

        # Check which ones are valid
        valid_links = []
        for doctype in valid_doctypes:
            if frappe.db.exists('DocType', doctype):
                valid_links.append(doctype)

        frappe.msgprint(f"Adding {len(valid_links)} valid DocTypes to workspace")

        # Add links to workspace
        for doctype in valid_links:
            # Check if link already exists
            exists = False
            for link in workspace.links:
                if link.link_to == doctype:
                    exists = True
                    break

            if not exists:
                workspace.append('links', {
                    'link_type': 'DocType',
                    'link_to': doctype,
                    'type': 'Link'
                })
                frappe.msgprint(f"Added link for {doctype}")

        # Update directly in database to bypass validation
        workspace.db_update()
        frappe.msgprint("Workspace updated successfully")
        return {"success": True, "message": f"Added {len(valid_links)} links"}

    except Exception as e:
        frappe.log_error(f"Error adding links: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def test_workspace_validation():
    """Test if workspace validation passes"""
    try:
        # Get the workspace
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        # Try to get invalid links
        invalid_links, cancelled_links = workspace.get_invalid_links()

        if invalid_links:
            frappe.msgprint(f"Still has {len(invalid_links)} invalid links:")
            for link in invalid_links:
                frappe.msgprint(f"Invalid: {link}")
            return {"success": False, "message": f"Still has {len(invalid_links)} invalid links"}
        else:
            frappe.msgprint("No invalid links found!")
            frappe.msgprint(f"Workspace has {len(workspace.links)} total links")
            return {"success": True, "message": f"Workspace is valid with {len(workspace.links)} links"}

    except Exception as e:
        frappe.log_error(f"Error testing workspace: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def check_workspace_content():
    """Check workspace content and links"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        frappe.msgprint(f"Workspace title: {workspace.title}")
        frappe.msgprint(f"Number of links: {len(workspace.links)}")
        frappe.msgprint(f"Content length: {len(workspace.content) if workspace.content else 0}")

        # Check content parsing
        try:
            import json
            content_data = json.loads(workspace.content)
            frappe.msgprint(f"Content has {len(content_data)} items")
            for i, item in enumerate(content_data[:5]):  # Show first 5 items
                frappe.msgprint(f"Item {i}: {item.get('type')} - {item.get('data', {}).get('text', '')[:50]}")
        except Exception as e:
            frappe.msgprint(f"Content parsing error: {str(e)}")

        # Check links
        card_breaks = [link for link in workspace.links if link.type == 'Card Break']
        frappe.msgprint(f"Card breaks: {len(card_breaks)}")
        for cb in card_breaks:
            frappe.msgprint(f"Card: {cb.label} (count: {cb.link_count})")

        return {"success": True}

    except Exception as e:
        frappe.log_error(f"Error checking workspace: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def rebuild_workspace_content():
    """Rebuild workspace content from links"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        # Clear existing content
        workspace.content = "[]"

        # Build content from links
        content_items = []

        # Add header
        content_items.append({
            "id": "header1",
            "type": "header",
            "data": {
                "text": "<span class=\"h4\">POSNext - Complete Hospitality Management</span>",
                "col": 12
            }
        })

        # Add spacer
        content_items.append({
            "id": "spacer1",
            "type": "spacer",
            "data": {"col": 12}
        })

        # Group links by card breaks
        current_card = None
        card_links = []

        for link in workspace.links:
            if link.type == "Card Break":
                # Save previous card if exists
                if current_card and card_links:
                    content_items.append({
                        "id": f"card_{current_card.label.lower().replace(' ', '_')}",
                        "type": "card",
                        "data": {
                            "card_name": current_card.label,
                            "col": 4
                        }
                    })

                current_card = link
                card_links = []
            else:
                card_links.append(link)

        # Add last card
        if current_card and card_links:
            content_items.append({
                "id": f"card_{current_card.label.lower().replace(' ', '_')}",
                "type": "card",
                "data": {
                    "card_name": current_card.label,
                    "col": 4
                }
            })

        # Convert to JSON string
        import json
        workspace.content = json.dumps(content_items)

        # Save workspace
        workspace.db_update()

        frappe.msgprint(f"Rebuilt content with {len(content_items)} items")
        return {"success": True, "message": f"Content rebuilt with {len(content_items)} items"}

    except Exception as e:
        frappe.log_error(f"Error rebuilding workspace: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def check_workspace_status():
    """Check workspace status and properties"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        frappe.msgprint(f"Title: {workspace.title}")
        frappe.msgprint(f"Public: {workspace.public}")
        frappe.msgprint(f"For User: {workspace.for_user}")
        frappe.msgprint(f"Module: {workspace.module}")
        frappe.msgprint(f"Content length: {len(workspace.content) if workspace.content else 0}")
        frappe.msgprint(f"Links count: {len(workspace.links)}")

        # Check if user can access
        user = frappe.session.user
        frappe.msgprint(f"Current user: {user}")

        # Check permissions
        can_read = workspace.has_permission('read')
        frappe.msgprint(f"Can read: {can_read}")

        return {"success": True}

    except Exception as e:
        frappe.log_error(f"Error checking status: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def show_workspace_content():
    """Show current workspace content"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        frappe.msgprint(f"Content: {workspace.content[:500]}...")

        import json
        try:
            content_data = json.loads(workspace.content)
            frappe.msgprint(f"Parsed content has {len(content_data)} items:")
            for i, item in enumerate(content_data):
                frappe.msgprint(f"{i+1}. {item.get('type')}: {item.get('data', {})}")
        except Exception as e:
            frappe.msgprint(f"JSON parse error: {str(e)}")

        return {"success": True}

    except Exception as e:
        frappe.log_error(f"Error showing content: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def make_workspace_public():
    """Make the workspace public"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        frappe.msgprint(f"Current public status: {workspace.public}")
        frappe.msgprint(f"For user: {workspace.for_user}")

        # Make it public
        workspace.public = 1
        workspace.for_user = ""
        workspace.db_update()

        frappe.msgprint("Workspace made public")
        return {"success": True, "message": "Workspace is now public"}

    except Exception as e:
        frappe.log_error(f"Error making public: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def export_workspace_to_file():
    """Export workspace to file"""
    try:
        from frappe.modules.export_file import export_to_files

        # Export the workspace
        export_to_files(record_list=[["Workspace", "POSNext App"]], record_module="posnext")

        frappe.msgprint("Workspace exported to file")
        return {"success": True, "message": "Workspace exported"}

    except Exception as e:
        frappe.log_error(f"Error exporting: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def debug_workspace_content():
    """Debug workspace content rendering"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        # Parse content
        import json
        content_data = json.loads(workspace.content)

        frappe.msgprint(f"Content has {len(content_data)} items")

        # Check each item
        for i, item in enumerate(content_data):
            item_type = item.get('type')
            item_data = item.get('data', {})
            frappe.msgprint(f"Item {i+1}: {item_type} - {item_data}")

            if item_type == 'card':
                card_name = item_data.get('card_name')
                frappe.msgprint(f"  Card: {card_name}")

                # Check if card has corresponding link group
                has_links = False
                for link in workspace.links:
                    if link.type == 'Card Break' and link.label == card_name:
                        frappe.msgprint(f"  Found link group: {link.label} ({link.link_count} links)")
                        has_links = True
                        break

                if not has_links:
                    frappe.msgprint(f"  WARNING: No link group found for card '{card_name}'")

        # Check link groups
        card_breaks = [link for link in workspace.links if link.type == 'Card Break']
        frappe.msgprint(f"Total card breaks: {len(card_breaks)}")

        for cb in card_breaks:
            frappe.msgprint(f"Card Break: {cb.label} (count: {cb.link_count})")

        return {"success": True}

    except Exception as e:
        frappe.log_error(f"Error debugging: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def get_workspace_debug_info():
    """Get workspace debug information"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        # Parse content
        import json
        content_data = json.loads(workspace.content)

        debug_info = []
        debug_info.append(f"Content has {len(content_data)} items")

        # Check each item
        for i, item in enumerate(content_data):
            item_type = item.get('type')
            item_data = item.get('data', {})
            debug_info.append(f"Item {i+1}: {item_type} - {item_data}")

            if item_type == 'card':
                card_name = item_data.get('card_name')
                debug_info.append(f"  Card: {card_name}")

                # Check if card has corresponding link group
                has_links = False
                for link in workspace.links:
                    if link.type == 'Card Break' and link.label == card_name:
                        debug_info.append(f"  Found link group: {link.label} ({link.link_count} links)")
                        has_links = True
                        break

                if not has_links:
                    debug_info.append(f"  WARNING: No link group found for card '{card_name}'")

        # Check link groups
        card_breaks = [link for link in workspace.links if link.type == 'Card Break']
        debug_info.append(f"Total card breaks: {len(card_breaks)}")

        for cb in card_breaks:
            debug_info.append(f"Card Break: {cb.label} (count: {cb.link_count})")

        return {"success": True, "debug_info": debug_info}

    except Exception as e:
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def check_duplicate_links():
    """Check for duplicate links in workspace"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        debug_info = []
        debug_info.append(f"Total links: {len(workspace.links)}")

        # Check for duplicates
        seen_breaks = {}
        duplicates = []

        for i, link in enumerate(workspace.links):
            if link.type == 'Card Break':
                key = link.label
                if key in seen_breaks:
                    duplicates.append(f"Duplicate Card Break '{key}' at index {i} (first at {seen_breaks[key]})")
                else:
                    seen_breaks[key] = i

        debug_info.append(f"Found {len(duplicates)} duplicate card breaks:")
        for dup in duplicates:
            debug_info.append(dup)

        # Show all card breaks
        debug_info.append("All Card Breaks:")
        for i, link in enumerate(workspace.links):
            if link.type == 'Card Break':
                debug_info.append(f"  {i}: {link.label} (count: {link.link_count})")

        return {"success": True, "debug_info": debug_info}

    except Exception as e:
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def remove_all_duplicate_links():
    """Remove all duplicate links from workspace"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        debug_info = []
        debug_info.append(f"Original links count: {len(workspace.links)}")

        # Track seen links
        seen_links = {}
        duplicates_to_remove = []

        for i, link in enumerate(workspace.links):
            key = f"{link.type}-{link.label}"
            if key in seen_links:
                duplicates_to_remove.append(i)
                debug_info.append(f"Found duplicate: {key} at index {i}")
            else:
                seen_links[key] = i

        # Remove duplicates in reverse order to maintain indices
        duplicates_to_remove.reverse()
        for index in duplicates_to_remove:
            del workspace.links[index]
            debug_info.append(f"Removed duplicate at index {index}")

        workspace.save()
        frappe.db.commit()

        debug_info.append(f"Final links count: {len(workspace.links)}")
        debug_info.append(f"Removed {len(duplicates_to_remove)} duplicates")

        return {"success": True, "debug_info": debug_info}

    except Exception as e:
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def list_all_workspace_links():
    """List all links in the workspace for debugging"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        debug_info = []
        debug_info.append(f"Total links: {len(workspace.links)}")

        for i, link in enumerate(workspace.links):
            debug_info.append(f"{i}: {link.type} - {link.label} - {getattr(link, 'link_to', 'N/A')}")

        return {"success": True, "debug_info": debug_info}

    except Exception as e:
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def validate_workspace_links():
    """Validate all links in workspace and identify invalid ones"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        debug_info = []
        debug_info.append(f"Total links: {len(workspace.links)}")

        invalid_links = []

        for i, link in enumerate(workspace.links):
            if link.type == 'Link' and link.link_to:
                if not frappe.db.exists('DocType', link.link_to):
                    invalid_links.append(i)
                    debug_info.append(f"Invalid link at {i}: {link.label} -> {link.link_to}")
                else:
                    debug_info.append(f"Valid link at {i}: {link.label} -> {link.link_to}")
            else:
                debug_info.append(f"Non-link at {i}: {link.type} - {link.label}")

        debug_info.append(f"Found {len(invalid_links)} invalid links")

        return {"success": True, "debug_info": debug_info, "invalid_indices": invalid_links}

    except Exception as e:
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def remove_invalid_links():
    """Remove invalid links from workspace"""
    try:
        workspace = frappe.get_doc('Workspace', 'POSNext App')

        debug_info = []
        debug_info.append(f"Original links count: {len(workspace.links)}")

        # Get invalid indices
        validation_result = validate_workspace_links()
        invalid_indices = validation_result.get('invalid_indices', [])

        # Remove invalid links in reverse order
        invalid_indices.reverse()
        for index in invalid_indices:
            removed_link = workspace.links[index]
            del workspace.links[index]
            debug_info.append(f"Removed invalid link at {index}: {removed_link.label} -> {removed_link.link_to}")

        workspace.save()
        frappe.db.commit()

        debug_info.append(f"Final links count: {len(workspace.links)}")
        debug_info.append(f"Removed {len(invalid_indices)} invalid links")

        return {"success": True, "debug_info": debug_info}

    except Exception as e:
        return {"success": False, "message": str(e)}