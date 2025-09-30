(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // ../posnext/node_modules/onscan.js/onscan.js
  var require_onscan = __commonJS({
    "../posnext/node_modules/onscan.js/onscan.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory()) : global.onScan = factory();
      })(exports, function() {
        var onScan2 = {
          attachTo: function(oDomElement, oOptions) {
            if (oDomElement.scannerDetectionData !== void 0) {
              throw new Error("onScan.js is already initialized for DOM element " + oDomElement);
            }
            var oDefaults = {
              onScan: function(sScanned, iQty) {
              },
              onScanError: function(oDebug) {
              },
              onKeyProcess: function(sChar, oEvent) {
              },
              onKeyDetect: function(iKeyCode, oEvent) {
              },
              onPaste: function(sPasted, oEvent) {
              },
              keyCodeMapper: function(oEvent) {
                return onScan2.decodeKeyEvent(oEvent);
              },
              onScanButtonLongPress: function() {
              },
              scanButtonKeyCode: false,
              scanButtonLongPressTime: 500,
              timeBeforeScanTest: 100,
              avgTimeByChar: 30,
              minLength: 6,
              suffixKeyCodes: [9, 13],
              prefixKeyCodes: [],
              ignoreIfFocusOn: false,
              stopPropagation: false,
              preventDefault: false,
              captureEvents: false,
              reactToKeydown: true,
              reactToPaste: false,
              singleScanQty: 1
            };
            oOptions = this._mergeOptions(oDefaults, oOptions);
            oDomElement.scannerDetectionData = {
              options: oOptions,
              vars: {
                firstCharTime: 0,
                lastCharTime: 0,
                accumulatedString: "",
                testTimer: false,
                longPressTimeStart: 0,
                longPressed: false
              }
            };
            if (oOptions.reactToPaste === true) {
              oDomElement.addEventListener("paste", this._handlePaste, oOptions.captureEvents);
            }
            if (oOptions.scanButtonKeyCode !== false) {
              oDomElement.addEventListener("keyup", this._handleKeyUp, oOptions.captureEvents);
            }
            if (oOptions.reactToKeydown === true || oOptions.scanButtonKeyCode !== false) {
              oDomElement.addEventListener("keydown", this._handleKeyDown, oOptions.captureEvents);
            }
            return this;
          },
          detachFrom: function(oDomElement) {
            if (oDomElement.scannerDetectionData.options.reactToPaste) {
              oDomElement.removeEventListener("paste", this._handlePaste);
            }
            if (oDomElement.scannerDetectionData.options.scanButtonKeyCode !== false) {
              oDomElement.removeEventListener("keyup", this._handleKeyUp);
            }
            oDomElement.removeEventListener("keydown", this._handleKeyDown);
            oDomElement.scannerDetectionData = void 0;
            return;
          },
          getOptions: function(oDomElement) {
            return oDomElement.scannerDetectionData.options;
          },
          setOptions: function(oDomElement, oOptions) {
            switch (oDomElement.scannerDetectionData.options.reactToPaste) {
              case true:
                if (oOptions.reactToPaste === false) {
                  oDomElement.removeEventListener("paste", this._handlePaste);
                }
                break;
              case false:
                if (oOptions.reactToPaste === true) {
                  oDomElement.addEventListener("paste", this._handlePaste);
                }
                break;
            }
            switch (oDomElement.scannerDetectionData.options.scanButtonKeyCode) {
              case false:
                if (oOptions.scanButtonKeyCode !== false) {
                  oDomElement.addEventListener("keyup", this._handleKeyUp);
                }
                break;
              default:
                if (oOptions.scanButtonKeyCode === false) {
                  oDomElement.removeEventListener("keyup", this._handleKeyUp);
                }
                break;
            }
            oDomElement.scannerDetectionData.options = this._mergeOptions(oDomElement.scannerDetectionData.options, oOptions);
            this._reinitialize(oDomElement);
            return this;
          },
          decodeKeyEvent: function(oEvent) {
            var iCode = this._getNormalizedKeyNum(oEvent);
            switch (true) {
              case (iCode >= 48 && iCode <= 90):
              case (iCode >= 106 && iCode <= 111):
                if (oEvent.key !== void 0 && oEvent.key !== "") {
                  return oEvent.key;
                }
                var sDecoded = String.fromCharCode(iCode);
                switch (oEvent.shiftKey) {
                  case false:
                    sDecoded = sDecoded.toLowerCase();
                    break;
                  case true:
                    sDecoded = sDecoded.toUpperCase();
                    break;
                }
                return sDecoded;
              case (iCode >= 96 && iCode <= 105):
                return 0 + (iCode - 96);
            }
            return "";
          },
          simulate: function(oDomElement, mStringOrArray) {
            this._reinitialize(oDomElement);
            if (Array.isArray(mStringOrArray)) {
              mStringOrArray.forEach(function(mKey) {
                var oEventProps = {};
                if ((typeof mKey === "object" || typeof mKey === "function") && mKey !== null) {
                  oEventProps = mKey;
                } else {
                  oEventProps.keyCode = parseInt(mKey);
                }
                var oEvent = new KeyboardEvent("keydown", oEventProps);
                document.dispatchEvent(oEvent);
              });
            } else {
              this._validateScanCode(oDomElement, mStringOrArray);
            }
            return this;
          },
          _reinitialize: function(oDomElement) {
            var oVars = oDomElement.scannerDetectionData.vars;
            oVars.firstCharTime = 0;
            oVars.lastCharTime = 0;
            oVars.accumulatedString = "";
            return;
          },
          _isFocusOnIgnoredElement: function(oDomElement) {
            var ignoreSelectors = oDomElement.scannerDetectionData.options.ignoreIfFocusOn;
            if (!ignoreSelectors) {
              return false;
            }
            var oFocused = document.activeElement;
            if (Array.isArray(ignoreSelectors)) {
              for (var i = 0; i < ignoreSelectors.length; i++) {
                if (oFocused.matches(ignoreSelectors[i]) === true) {
                  return true;
                }
              }
            } else if (oFocused.matches(ignoreSelectors)) {
              return true;
            }
            return false;
          },
          _validateScanCode: function(oDomElement, sScanCode) {
            var oScannerData = oDomElement.scannerDetectionData;
            var oOptions = oScannerData.options;
            var iSingleScanQty = oScannerData.options.singleScanQty;
            var iFirstCharTime = oScannerData.vars.firstCharTime;
            var iLastCharTime = oScannerData.vars.lastCharTime;
            var oScanError = {};
            var oEvent;
            switch (true) {
              case sScanCode.length < oOptions.minLength:
                oScanError = {
                  message: "Receieved code is shorter then minimal length"
                };
                break;
              case iLastCharTime - iFirstCharTime > sScanCode.length * oOptions.avgTimeByChar:
                oScanError = {
                  message: "Receieved code was not entered in time"
                };
                break;
              default:
                oOptions.onScan.call(oDomElement, sScanCode, iSingleScanQty);
                oEvent = new CustomEvent(
                  "scan",
                  {
                    detail: {
                      scanCode: sScanCode,
                      qty: iSingleScanQty
                    }
                  }
                );
                oDomElement.dispatchEvent(oEvent);
                onScan2._reinitialize(oDomElement);
                return true;
            }
            oScanError.scanCode = sScanCode;
            oScanError.scanDuration = iLastCharTime - iFirstCharTime;
            oScanError.avgTimeByChar = oOptions.avgTimeByChar;
            oScanError.minLength = oOptions.minLength;
            oOptions.onScanError.call(oDomElement, oScanError);
            oEvent = new CustomEvent(
              "scanError",
              { detail: oScanError }
            );
            oDomElement.dispatchEvent(oEvent);
            onScan2._reinitialize(oDomElement);
            return false;
          },
          _mergeOptions: function(oDefaults, oOptions) {
            var oExtended = {};
            var prop;
            for (prop in oDefaults) {
              if (Object.prototype.hasOwnProperty.call(oDefaults, prop)) {
                oExtended[prop] = oDefaults[prop];
              }
            }
            for (prop in oOptions) {
              if (Object.prototype.hasOwnProperty.call(oOptions, prop)) {
                oExtended[prop] = oOptions[prop];
              }
            }
            return oExtended;
          },
          _getNormalizedKeyNum: function(e) {
            return e.which || e.keyCode;
          },
          _handleKeyDown: function(e) {
            var iKeyCode = onScan2._getNormalizedKeyNum(e);
            var oOptions = this.scannerDetectionData.options;
            var oVars = this.scannerDetectionData.vars;
            var bScanFinished = false;
            if (oOptions.onKeyDetect.call(this, iKeyCode, e) === false) {
              return;
            }
            if (onScan2._isFocusOnIgnoredElement(this)) {
              return;
            }
            if (oOptions.scanButtonKeyCode !== false && iKeyCode == oOptions.scanButtonKeyCode) {
              if (!oVars.longPressed) {
                oVars.longPressTimer = setTimeout(oOptions.onScanButtonLongPress, oOptions.scanButtonLongPressTime, this);
                oVars.longPressed = true;
              }
              return;
            }
            switch (true) {
              case (oVars.firstCharTime && oOptions.suffixKeyCodes.indexOf(iKeyCode) !== -1):
                e.preventDefault();
                e.stopImmediatePropagation();
                bScanFinished = true;
                break;
              case (!oVars.firstCharTime && oOptions.prefixKeyCodes.indexOf(iKeyCode) !== -1):
                e.preventDefault();
                e.stopImmediatePropagation();
                bScanFinished = false;
                break;
              default:
                var character = oOptions.keyCodeMapper.call(this, e);
                if (character === null) {
                  return;
                }
                oVars.accumulatedString += character;
                if (oOptions.preventDefault) {
                  e.preventDefault();
                }
                if (oOptions.stopPropagation) {
                  e.stopImmediatePropagation();
                }
                bScanFinished = false;
                break;
            }
            if (!oVars.firstCharTime) {
              oVars.firstCharTime = Date.now();
            }
            oVars.lastCharTime = Date.now();
            if (oVars.testTimer) {
              clearTimeout(oVars.testTimer);
            }
            if (bScanFinished) {
              onScan2._validateScanCode(this, oVars.accumulatedString);
              oVars.testTimer = false;
            } else {
              oVars.testTimer = setTimeout(onScan2._validateScanCode, oOptions.timeBeforeScanTest, this, oVars.accumulatedString);
            }
            oOptions.onKeyProcess.call(this, character, e);
            return;
          },
          _handlePaste: function(e) {
            var oOptions = this.scannerDetectionData.options;
            var oVars = this.scannerDetectionData.vars;
            var sPasteString = (event.clipboardData || window.clipboardData).getData("text");
            if (onScan2._isFocusOnIgnoredElement(this)) {
              return;
            }
            e.preventDefault();
            if (oOptions.stopPropagation) {
              e.stopImmediatePropagation();
            }
            oOptions.onPaste.call(this, sPasteString, event);
            oVars.firstCharTime = 0;
            oVars.lastCharTime = 0;
            onScan2._validateScanCode(this, sPasteString);
            return;
          },
          _handleKeyUp: function(e) {
            if (onScan2._isFocusOnIgnoredElement(this)) {
              return;
            }
            var iKeyCode = onScan2._getNormalizedKeyNum(e);
            if (iKeyCode == this.scannerDetectionData.options.scanButtonKeyCode) {
              clearTimeout(this.scannerDetectionData.vars.longPressTimer);
              this.scannerDetectionData.vars.longPressed = false;
            }
            return;
          },
          isScanInProgressFor: function(oDomElement) {
            return oDomElement.scannerDetectionData.vars.firstCharTime > 0;
          },
          isAttachedTo: function(oDomElement) {
            return oDomElement.scannerDetectionData !== void 0;
          }
        };
        return onScan2;
      });
    }
  });

  // ../posnext/posnext/public/js/pos_controller.js
  frappe.provide("posnext.PointOfSale");
  var selected_item = null;
  posnext.PointOfSale.Controller = class {
    constructor(wrapper) {
      console.log("CONTROLLLER HERE ssssssadasdasd");
      this.wrapper = $(wrapper).find(".layout-main-section");
      this.page = wrapper.page;
      frappe.run_serially([
        () => this.reload_status = false,
        () => this.check_opening_entry(""),
        () => this.reload_status = true
      ]);
      this.setup_form_events();
    }
    setup_form_events() {
      frappe.ui.form.on("Sales Invoice", {
        after_save: function(frm) {
          if (!frm.doc.pos_profile)
            return;
          frappe.db.get_doc("POS Profile", frm.doc.pos_profile).then((pos_profile) => {
            if (pos_profile.custom_stock_update) {
              frm.set_value("update_stock", 0);
            }
          });
        }
      });
    }
    fetch_opening_entry(value) {
      return frappe.call("posnext.posnext.page.posnext.point_of_sale.check_opening_entry", { "user": frappe.session.user, "value": value });
    }
    check_opening_entry(value = "") {
      if (frappe.user_roles.includes("Waiter")) {
        this.find_available_opening_entry();
      } else {
        this.fetch_opening_entry(value).then((r) => {
          if (r.message.length) {
            this.prepare_app_defaults(r.message[0]);
          } else {
            this.create_opening_voucher();
          }
        });
      }
    }
    find_available_opening_entry() {
      const me = this;
      frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.get_available_opening_entry",
        callback: (r) => {
          if (r.message && r.message.length > 0) {
            me.prepare_app_defaults(r.message[0]);
            frappe.show_alert({
              message: __("Using existing POS Opening Entry: {0}", [r.message[0].name]),
              indicator: "blue"
            });
          } else {
            frappe.msgprint({
              title: __("No POS Opening Entry Available"),
              message: __("No POS Opening Entry is currently available. Please contact your manager to create one."),
              indicator: "red"
            });
          }
        }
      });
    }
    create_opening_voucher() {
      const me = this;
      const table_fields = [
        {
          fieldname: "mode_of_payment",
          fieldtype: "Link",
          in_list_view: 1,
          label: "Mode of Payment",
          options: "Mode of Payment",
          reqd: 1
        },
        {
          fieldname: "opening_amount",
          fieldtype: "Currency",
          in_list_view: 1,
          label: "Opening Amount",
          options: "company:company_currency",
          change: function() {
            dialog.fields_dict.balance_details.df.data.some((d) => {
              if (d.idx == this.doc.idx) {
                d.opening_amount = this.value;
                dialog.fields_dict.balance_details.grid.refresh();
                return true;
              }
            });
          }
        }
      ];
      const fetch_pos_payment_methods = () => {
        const pos_profile = dialog.fields_dict.pos_profile.get_value();
        if (!pos_profile)
          return;
        frappe.db.get_doc("POS Profile", pos_profile).then(({ payments }) => {
          dialog.fields_dict.balance_details.df.data = [];
          payments.forEach((pay) => {
            const { mode_of_payment } = pay;
            dialog.fields_dict.balance_details.df.data.push({ mode_of_payment, opening_amount: "0" });
          });
          dialog.fields_dict.balance_details.grid.refresh();
        });
      };
      const dialog = new frappe.ui.Dialog({
        title: __("Create POS Opening Entry"),
        static: true,
        fields: [
          {
            fieldtype: "Link",
            label: __("Company"),
            default: frappe.defaults.get_default("company"),
            options: "Company",
            fieldname: "company",
            reqd: 1
          },
          {
            fieldtype: "Link",
            label: __("POS Profile"),
            options: "POS Profile",
            fieldname: "pos_profile",
            reqd: 1,
            get_query: () => pos_profile_query(),
            onchange: () => fetch_pos_payment_methods()
          },
          {
            fieldname: "balance_details",
            fieldtype: "Table",
            label: "Opening Balance Details",
            cannot_add_rows: false,
            in_place_edit: true,
            reqd: 1,
            data: [],
            fields: table_fields
          }
        ],
        primary_action: async function({ company, pos_profile, balance_details }) {
          if (!balance_details.length) {
            frappe.show_alert({
              message: __("Please add Mode of payments and opening balance details."),
              indicator: "red"
            });
            return frappe.utils.play_sound("error");
          }
          balance_details = balance_details.filter((d) => d.mode_of_payment);
          const method = "posnext.posnext.page.posnext.point_of_sale.create_opening_voucher";
          const res = await frappe.call({ method, args: { pos_profile, company, balance_details }, freeze: true });
          !res.exc && me.prepare_app_defaults(res.message);
          dialog.hide();
        },
        primary_action_label: __("Submit")
      });
      dialog.show();
      const pos_profile_query = () => {
        return {
          query: "erpnext.accounts.doctype.pos_profile.pos_profile.pos_profile_query",
          filters: { company: dialog.fields_dict.company.get_value() }
        };
      };
    }
    async prepare_app_defaults(data) {
      this.pos_opening = data.name;
      this.company = data.company;
      this.pos_profile = data.pos_profile;
      this.pos_opening_time = data.period_start_date;
      this.item_stock_map = {};
      this.settings = {};
      window.current_pos_profile = this.pos_profile;
      frappe.db.get_value("Stock Settings", void 0, "allow_negative_stock").then(({ message }) => {
        this.allow_negative_stock = flt(message.allow_negative_stock) || false;
      });
      frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.get_pos_profile_data",
        args: { "pos_profile": this.pos_profile },
        callback: (res) => {
          const profile = res.message;
          Object.assign(this.settings, profile);
          this.settings.customer_groups = profile.customer_groups.map((group) => group.name);
          this.make_app();
        }
      });
    }
    set_opening_entry_status() {
      this.page.set_title_sub(
        `<span class="indicator orange">
				<a class="text-muted" href="#Form/POS%20Opening%20Entry/${this.pos_opening}">
					Opened at ${moment(this.pos_opening_time).format("Do MMMM, h:mma")}
				</a>
			</span>`
      );
    }
    make_app() {
      this.prepare_dom();
      this.show_table_selector();
    }
    show_table_selector() {
      if (!this.recent_order_list) {
        this.init_recent_order_list();
      }
      this.table_selector = new posnext.PointOfSale.TableSelector({
        wrapper: this.$components_wrapper,
        events: {
          table_selected: (table) => {
            this.selected_table = table;
            this.start_ordering();
          },
          toggle_recent_order: () => {
            this.toggle_recent_order();
          }
        },
        pos_profile: this.pos_profile
      });
    }
    start_ordering() {
      this.$components_wrapper.empty();
      this.prepare_components();
      this.prepare_menu();
      this.make_new_invoice();
    }
    prepare_dom() {
      this.wrapper.append(
        `<div class="point-of-sale-app"></div>`
      );
      this.$components_wrapper = this.wrapper.find(".point-of-sale-app");
    }
    prepare_components() {
      this.init_item_selector();
      this.init_item_details();
      this.init_item_cart();
      this.init_payments();
      this.init_recent_order_list();
      this.init_order_summary();
    }
    prepare_menu() {
      this.page.clear_menu();
      if (this.settings.custom_show_open_form_view) {
        this.page.add_menu_item(__("Open Form View"), this.open_form_view.bind(this), false, "Ctrl+F");
      }
      if (this.settings.custom_show_toggle_recent_orders) {
        this.page.add_menu_item(__("Toggle Recent Orders"), this.toggle_recent_order.bind(this), false, "Ctrl+O");
      }
      if (this.settings.custom_show_save_as_draft) {
        this.page.add_menu_item(__("Save as Draft"), this.save_draft_invoice.bind(this), false, "Ctrl+S");
      }
      if (this.settings.custom_show_close_the_pos && !frappe.user_roles.includes("Waiter")) {
        this.page.add_menu_item(__("Close the POS"), this.close_pos.bind(this), false, "Shift+Ctrl+C");
      }
    }
    open_form_view() {
      frappe.model.sync(this.frm.doc);
      frappe.set_route("Form", this.frm.doc.doctype, this.frm.doc.name);
    }
    show_recent_order_list() {
      return this.toggle_recent_order_list(true);
    }
    toggle_recent_order() {
      const show = this.recent_order_list.$component.is(":hidden");
      return this.toggle_recent_order_list(show);
    }
    save_draft_invoice() {
      if (!this.$components_wrapper.is(":visible")) {
        frappe.show_alert({
          message: __("POS interface is not visible."),
          indicator: "red"
        });
        frappe.dom.unfreeze();
        return Promise.reject(new Error("POS interface is not visible"));
      }
      const frm = this.frm;
      if (!frm) {
        frappe.show_alert({
          message: __("Form not initialized. Please try again."),
          indicator: "red"
        });
        frappe.dom.unfreeze();
        return Promise.reject(new Error("Form not initialized"));
      }
      if (!frm.doc.items.length) {
        frappe.show_alert({
          message: __("You must add at least one item to save it as draft."),
          indicator: "red"
        });
        frappe.utils.play_sound("error");
        frappe.dom.unfreeze();
        return Promise.reject(new Error("No items in invoice"));
      }
      if (!frm.doc.pos_profile) {
        frappe.show_alert({
          message: __("POS Profile is required for draft invoice"),
          indicator: "red"
        });
        frappe.dom.unfreeze();
        return Promise.reject(new Error("POS Profile required"));
      }
      if (!frm.doc.customer) {
        frappe.show_alert({
          message: __("Customer is required for draft invoice"),
          indicator: "red"
        });
        frappe.dom.unfreeze();
        return Promise.reject(new Error("Customer required"));
      }
      console.log("Saving draft with doc:", frm.doc);
      return new Promise((resolve, reject) => {
        frappe.call({
          method: "posnext.posnext.page.posnext.point_of_sale.save_draft_invoice",
          args: {
            doc: {
              name: frm.doc.name,
              customer: frm.doc.customer,
              items: frm.doc.items.map((item) => ({
                item_code: item.item_code,
                qty: item.qty,
                rate: item.rate,
                uom: item.uom,
                warehouse: item.warehouse,
                serial_no: item.serial_no,
                batch_no: item.batch_no
              })),
              created_by_name: frm.doc.created_by_name || frappe.session.user,
              pos_profile: frm.doc.pos_profile,
              company: frm.doc.company
            }
          },
          callback: (r) => {
            console.log("Save draft response:", r);
            frappe.dom.unfreeze();
            if (r.exc) {
              let error_msg = r.exc;
              try {
                const exc = JSON.parse(r.exc);
                error_msg = exc._error_message || exc.message || r.exc;
              } catch (e) {
              }
              frappe.show_alert({
                message: __(`Error saving draft: ${error_msg}`),
                indicator: "red"
              });
              frappe.utils.play_sound("error");
              reject(new Error(error_msg));
              return;
            }
            if (r.message) {
              frappe.show_alert({
                message: __("Draft invoice saved successfully"),
                indicator: "green"
              });
              frm.doc.name = r.message.name || frm.doc.name;
              frm.doc.created_by_name = r.message.created_by_name || frm.doc.created_by_name;
              resolve({
                invoice_name: frm.doc.name,
                created_by_name: frm.doc.created_by_name
              });
              if (!r.message.from_hold) {
                frappe.run_serially([
                  () => frappe.dom.freeze(),
                  () => this.make_new_invoice(true),
                  () => frappe.dom.unfreeze()
                ]);
              }
            }
          },
          error: (xhr, status, error) => {
            console.error("Save draft AJAX error:", status, error);
            frappe.dom.unfreeze();
            frappe.show_alert({
              message: __("Failed to save draft. Please check your connection or contact support."),
              indicator: "red"
            });
            frappe.utils.play_sound("error");
            reject(new Error("Failed to save draft: " + error));
          }
        });
      });
    }
    close_pos() {
      if (!this.$components_wrapper.is(":visible"))
        return;
      let voucher = frappe.model.get_new_doc("POS Closing Entry");
      voucher.pos_profile = this.frm.doc.pos_profile;
      voucher.user = frappe.session.user;
      voucher.company = this.frm.doc.company;
      voucher.pos_opening_entry = this.pos_opening;
      voucher.period_end_date = frappe.datetime.now_datetime();
      voucher.posting_date = frappe.datetime.now_date();
      voucher.posting_time = frappe.datetime.now_time();
      frappe.set_route("Form", "POS Closing Entry", voucher.name);
    }
    init_item_selector() {
      if (this.frm) {
        this.frm.doc.set_warehouse = this.settings.warehouse;
      }
      this.item_selector = new posnext.PointOfSale.ItemSelector({
        wrapper: this.$components_wrapper,
        pos_profile: this.pos_profile,
        settings: this.settings,
        reload_status: this.reload_status,
        currency: this.settings.currency,
        events: {
          check_opening_entry: () => this.check_opening_entry(),
          item_selected: (args) => this.on_cart_update(args),
          init_item_cart: () => this.init_item_cart(),
          init_item_details: () => this.init_item_details(),
          change_items: (args) => this.change_items(args),
          get_frm: () => this.frm || {}
        }
      });
    }
    change_items(items) {
      var me = this;
      this.frm = items;
      this.cart.load_invoice();
    }
    init_item_cart() {
      this.cart = new posnext.PointOfSale.ItemCart({
        wrapper: this.$components_wrapper,
        settings: this.settings,
        events: {
          get_frm: () => this.frm,
          cart_item_clicked: (item) => {
            if (frappe.user_roles.includes("Waiter")) {
            } else {
              const item_row = this.frm.doc.items.find((i) => i.name === item.name);
              if (item_row) {
                if (!this.item_details.$component.is(":visible")) {
                  this.item_details.toggle_component(true);
                }
                this.item_details.toggle_item_details_section(item_row);
                selected_item = item_row;
                this.item_selector.resize_selector(true);
                this.cart.toggle_numpad(true);
              }
            }
          },
          numpad_event: (value, action) => this.update_item_field(value, action),
          checkout: () => this.save_and_checkout(),
          edit_cart: () => this.payment.edit_cart(),
          save_draft_invoice: () => this.save_draft_invoice(),
          toggle_recent_order: () => this.toggle_recent_order(),
          show_recent_order_list: () => this.show_recent_order_list(),
          show_order_list: () => this.show_recent_order_list(),
          customer_details_updated: (details) => {
          },
          load_new_invoice: (from_held) => this.make_new_invoice(from_held)
        }
      });
    }
    init_item_details() {
      this.item_details = new posnext.PointOfSale.ItemDetails({
        wrapper: this.$components_wrapper,
        settings: this.settings,
        events: {
          get_frm: () => this.frm,
          toggle_item_selector: (minimize) => {
            this.item_selector.resize_selector(minimize);
            this.cart.toggle_numpad(minimize);
          },
          form_updated: (item, field, value) => {
            const item_row = frappe.model.get_doc(item.doctype, item.name);
            if (item_row && item_row[field] != value) {
              const args = {
                field,
                value,
                item: this.item_details.current_item
              };
              return this.on_cart_update(args);
            }
            return Promise.resolve();
          },
          highlight_cart_item: (item) => {
            const cart_item = this.cart.get_cart_item(item);
            this.cart.toggle_item_highlight(cart_item);
          },
          item_field_focused: (fieldname) => {
            this.cart.toggle_numpad_field_edit(fieldname);
          },
          set_value_in_current_cart_item: (selector, value) => {
            this.cart.update_selector_value_in_cart_item(selector, value, this.item_details.current_item);
          },
          clone_new_batch_item_in_frm: (batch_serial_map, item) => {
            Object.keys(batch_serial_map).forEach((batch) => {
              const item_to_clone = this.frm.doc.items.find((i) => i.name == item.name);
              const new_row = this.frm.add_child("items", __spreadValues({}, item_to_clone));
              new_row.batch_no = batch;
              new_row.serial_no = batch_serial_map[batch].join(`
`);
              new_row.qty = batch_serial_map[batch].length;
              this.frm.doc.items.forEach((row) => {
                if (item.item_code === row.item_code) {
                  this.update_cart_html(row);
                }
              });
            });
          },
          remove_item_from_cart: () => this.remove_item_from_cart(),
          get_item_stock_map: () => this.item_stock_map,
          close_item_details: () => {
            selected_item = null;
            this.item_details.toggle_item_details_section(null);
            this.cart.prev_action = null;
            this.cart.toggle_item_highlight();
          },
          get_available_stock: (item_code, warehouse2) => this.get_available_stock(item_code, warehouse2)
        }
      });
      if (selected_item) {
        this.item_details.toggle_item_details_section(selected_item);
      }
    }
    init_payments() {
      this.payment = new posnext.PointOfSale.Payment({
        wrapper: this.$components_wrapper,
        events: {
          get_frm: () => this.frm || {},
          get_customer_details: () => this.customer_details || {},
          toggle_other_sections: (show) => {
            if (show) {
              this.item_details.$component.is(":visible") ? this.item_details.$component.css("display", "none") : "";
              this.item_selector.toggle_component(false);
            } else {
              this.item_selector.toggle_component(true);
            }
          },
          submit_invoice: () => {
            this.frm.savesubmit().then((r) => {
              this.toggle_components(false);
              this.order_summary.toggle_component(true);
              this.order_summary.load_summary_of(this.frm.doc, true);
              frappe.show_alert({
                indicator: "green",
                message: __("Sales Invoice {0} created succesfully", [r.doc.name])
              });
            });
          },
          open_recent_orders: () => {
            this.toggle_components(false);
            this.recent_order_list.toggle_component(true);
            this.order_summary.toggle_component(true);
          }
        }
      });
    }
    init_recent_order_list() {
      this.recent_order_list = new posnext.PointOfSale.PastOrderList({
        wrapper: this.$components_wrapper,
        events: {
          open_invoice_data: (name) => {
            frappe.db.get_doc("Sales Invoice", name).then((doc) => {
              this.order_summary.load_summary_of(doc);
            });
          },
          reset_summary: () => this.order_summary.toggle_summary_placeholder(true),
          previous_screen: () => {
            this.recent_order_list.toggle_component(false);
            this.wrapper.find(".past-order-summary").css("display", "none");
          }
        }
      });
    }
    init_order_summary() {
      this.order_summary = new posnext.PointOfSale.PastOrderSummary({
        wrapper: this.$components_wrapper,
        pos_profile: this.settings,
        events: {
          get_frm: () => this.frm,
          process_return: (name) => {
            this.recent_order_list.toggle_component(false);
            frappe.db.get_doc("Sales Invoice", name).then((doc) => {
              frappe.run_serially([
                () => this.make_return_invoice(doc),
                () => this.cart.load_invoice(),
                () => this.item_selector.toggle_component(true)
              ]);
            });
          },
          edit_order: (name) => {
            this.table_selector.toggle_component(false);
            this.recent_order_list.toggle_component(false);
            frappe.run_serially([
              () => this.frm.refresh(name),
              () => {
                return new Promise((resolve, reject) => {
                  this.frm.call("reset_mode_of_payments").then(() => {
                    resolve();
                  }).catch((error) => {
                    console.error("Error resetting mode of payments:", error);
                    frappe.msgprint(__("Error resetting payment modes. Please try again."));
                    reject(error);
                  });
                });
              },
              () => this.cart.load_invoice(),
              () => this.item_selector.toggle_component(true)
            ]);
          },
          delete_order: (name) => {
            frappe.model.delete_doc(this.frm.doc.doctype, name, () => {
              this.recent_order_list.refresh_list();
            });
          },
          new_order: () => {
            frappe.run_serially([
              () => frappe.dom.freeze(),
              () => this.reset_to_table_selector(),
              () => frappe.dom.unfreeze()
            ]);
          }
        }
      });
    }
    toggle_recent_order_list(show) {
      this.toggle_components(!show);
      this.recent_order_list.toggle_component(show);
      this.order_summary.toggle_component(show);
      if (show && this.recent_order_list) {
        this.recent_order_list.refresh_list();
      }
      return Promise.resolve();
    }
    toggle_components(show) {
      this.cart.toggle_component(show);
      this.item_selector.toggle_component(show);
      if (this.table_selector && typeof this.table_selector.toggle_component === "function") {
        try {
          this.table_selector.toggle_component(!show);
        } catch (error) {
          console.error("Error toggling table selector:", error);
        }
      }
      if (!show) {
        if (this.item_details)
          this.item_details.toggle_component(false);
        if (this.payment)
          this.payment.toggle_component(false);
      }
    }
    reset_to_table_selector() {
      this.$components_wrapper.empty();
      this.selected_table = null;
      this.frm = null;
      this.doc = null;
      if (this.recent_order_list) {
        this.recent_order_list.toggle_component(false);
      }
      if (this.order_summary) {
        this.order_summary.toggle_component(false);
      }
      this.show_table_selector();
    }
    make_new_invoice(from_held = false) {
      const steps = [
        () => frappe.dom.freeze(),
        () => this.make_sales_invoice_frm(),
        () => this.set_pos_profile_data(),
        () => this.set_pos_profile_status(),
        () => this.cart.load_invoice(),
        () => frappe.dom.unfreeze()
      ];
      if (from_held) {
        steps.push(() => this.toggle_components(false));
        steps.push(() => this.recent_order_list.toggle_component(true));
        steps.push(() => this.order_summary.toggle_component(true));
      }
      return frappe.run_serially(steps);
    }
    make_sales_invoice_frm() {
      const doctype = "Sales Invoice";
      return new Promise((resolve) => {
        if (this.frm) {
          this.frm = this.get_new_frm(this.frm);
          this.frm.doc.items = [];
          this.frm.doc.is_pos = 1;
          this.frm.doc.set_warehouse = this.settings.warehouse;
          if (this.selected_table && !this.frm.doc.pos_table) {
            this.frm.doc.pos_table = this.selected_table;
          }
          resolve();
        } else {
          frappe.model.with_doctype(doctype, () => {
            this.frm = this.get_new_frm();
            this.frm.doc.items = [];
            this.frm.doc.is_pos = 1;
            this.frm.doc.set_warehouse = this.settings.warehouse;
            if (this.selected_table && !this.frm.doc.pos_table) {
              this.frm.doc.pos_table = this.selected_table;
            }
            console.log("THIS FRRRRM");
            console.log(this.frm.doc);
            resolve();
          });
        }
      });
    }
    get_new_frm(_frm) {
      const doctype = "Sales Invoice";
      const page = $("<div>");
      const frm = _frm || new frappe.ui.form.Form(doctype, page, false);
      const name = frappe.model.make_new_doc_and_get_name(doctype, true);
      frm.refresh(name);
      return frm;
    }
    async make_return_invoice(doc) {
      frappe.dom.freeze();
      this.frm = this.get_new_frm(this.frm);
      this.frm.doc.items = [];
      return frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.make_sales_return",
        args: {
          "source_name": doc.name,
          "target_doc": this.frm.doc
        },
        callback: (r) => {
          frappe.model.sync(r.message);
          frappe.get_doc(r.message.doctype, r.message.name).__run_link_triggers = false;
          this.set_pos_profile_data().then(() => {
            frappe.dom.unfreeze();
          });
        }
      });
    }
    set_pos_profile_data() {
      if (this.company && !this.frm.doc.company)
        this.frm.doc.company = this.company;
      if ((this.pos_profile && !this.frm.doc.pos_profile) | (this.frm.doc.is_return && this.pos_profile != this.frm.doc.pos_profile)) {
        this.frm.doc.pos_profile = this.pos_profile;
      }
      if (!this.frm.doc.company)
        return;
      return this.frm.trigger("set_pos_data");
    }
    set_pos_profile_status() {
      this.page.set_indicator(this.pos_profile, "blue");
    }
    async on_cart_update(args) {
      let item_row = void 0;
      try {
        let { field, value, item } = args;
        item_row = this.get_item_from_frm(item);
        const item_row_exists = !$.isEmptyObject(item_row);
        const from_selector = field === "qty" && value === "+1";
        if (from_selector)
          value = flt(item_row.stock_qty) + flt(value);
        if (item_row_exists) {
          if (field === "qty")
            value = flt(value);
          if (["qty", "conversion_factor"].includes(field) && value > 0 && !this.allow_negative_stock) {
            const qty_needed = field === "qty" ? value * item_row.conversion_factor : item_row.qty * value;
            await this.check_stock_availability(item_row, qty_needed, this.frm.doc.set_warehouse);
          }
          if (this.is_current_item_being_edited(item_row) || from_selector) {
            await frappe.model.set_value(item_row.doctype, item_row.name, field, value);
            this.update_cart_html(item_row);
          }
        } else {
          if (!this.frm.doc.customer && !this.settings.custom_mobile_number_based_customer) {
            return this.raise_customer_selection_alert();
          }
          frappe.flags.ignore_company_party_validation = true;
          const { item_code, batch_no, serial_no, rate, uom } = item;
          if (!item_code)
            return;
          if (this.settings.custom_product_bundle) {
            const product_bundle = await this.get_product_bundle(item_code);
            if (product_bundle && Array.isArray(product_bundle.items)) {
              const bundle_items = product_bundle.items.map((bundle_item) => ({
                item_code: bundle_item.item_code,
                qty: bundle_item.qty * value,
                rate: bundle_item.rate,
                uom: bundle_item.uom,
                custom_bundle_id: product_bundle.name
              }));
              for (const bundle_item of bundle_items) {
                const bundle_item_row = this.frm.add_child("items", bundle_item);
                await this.trigger_new_item_events(bundle_item_row);
              }
              this.update_cart_html();
              return;
            }
          }
          const new_item = { item_code, batch_no, rate, uom, [field]: value };
          if (value) {
            new_item["qty"] = value;
          }
          if (serial_no) {
            await this.check_serial_no_availablilty(item_code, this.frm.doc.set_warehouse, serial_no);
            new_item["serial_no"] = serial_no;
          }
          if (field === "serial_no")
            new_item["qty"] = value.split(`
`).length || 0;
          item_row = this.frm.add_child("items", new_item);
          if (field === "qty" && value !== 0 && !this.allow_negative_stock) {
            const qty_needed = value * item_row.conversion_factor;
            await this.check_stock_availability(item_row, qty_needed, this.frm.doc.set_warehouse);
          }
          await this.trigger_new_item_events(item_row);
          this.update_cart_html(item_row);
          if (this.item_details.$component.is(":visible"))
            this.edit_item_details_of(item_row);
          if (this.check_serial_batch_selection_needed(item_row) && !this.item_details.$component.is(":visible"))
            this.edit_item_details_of(item_row);
        }
      } catch (error) {
        console.log(error);
      } finally {
        return item_row;
      }
    }
    raise_customer_selection_alert() {
      frappe.dom.unfreeze();
      frappe.show_alert({
        message: __("You must select a customer before adding an item."),
        indicator: "orange"
      });
      frappe.utils.play_sound("error");
    }
    async get_product_bundle(item_code) {
      const response = await frappe.call({
        method: "posnext.doc_events.item.get_product_bundle_with_items",
        args: {
          item_code
        }
      });
      return response.message;
    }
    get_item_from_frm({ name, item_code, batch_no, uom, rate }) {
      let item_row = null;
      if (name) {
        item_row = this.frm.doc.items.find((i) => i.name == name);
      } else {
        item_row = this.frm.doc.items.find((i) => {
          const basic_match = i.item_code === item_code && i.uom === uom && i.rate === flt(rate);
          if (!basic_match)
            return false;
          const item_has_batch = i.has_batch_no;
          const incoming_has_batch = batch_no && batch_no !== "null" && batch_no !== null;
          if (item_has_batch && incoming_has_batch) {
            return i.batch_no === batch_no;
          } else if (!item_has_batch && !incoming_has_batch) {
            return true;
          } else {
            return false;
          }
        });
      }
      return item_row || {};
    }
    edit_item_details_of(item_row) {
      this.item_details.toggle_item_details_section(item_row);
    }
    is_current_item_being_edited(item_row) {
      return item_row.name == this.item_details.current_item.name;
    }
    update_cart_html(item_row, remove_item) {
      this.cart.update_item_html(item_row, remove_item);
      this.cart.update_totals_section(this.frm);
    }
    check_serial_batch_selection_needed(item_row) {
      const serialized = item_row.has_serial_no;
      const batched = item_row.has_batch_no;
      const no_serial_selected = !item_row.serial_no;
      const no_batch_selected = !item_row.batch_no;
      if (serialized && no_serial_selected || batched && no_batch_selected || serialized && batched && (no_batch_selected || no_serial_selected)) {
        return true;
      }
      return false;
    }
    async trigger_new_item_events(item_row) {
      await this.frm.script_manager.trigger("item_code", item_row.doctype, item_row.name);
      await this.frm.script_manager.trigger("qty", item_row.doctype, item_row.name);
      await this.frm.script_manager.trigger("discount_percentage", item_row.doctype, item_row.name);
    }
    async check_stock_availability(item_row, qty_needed, warehouse2) {
      const resp = (await this.get_available_stock(item_row.item_code, warehouse2)).message;
      const available_qty = resp[0];
      const is_stock_item = resp[1];
      console.log("Debug:", {
        item_code: item_row.item_code,
        available_qty,
        is_stock_item,
        qty_needed
      });
      console.log(item_row);
      const bold_uom = item_row.uom.bold();
      const bold_item_code = item_row.item_code.bold();
      const bold_warehouse = warehouse2.bold();
      const bold_available_qty = available_qty.toString().bold();
      if (!(available_qty > 0)) {
        if (is_stock_item) {
          frappe.model.clear_doc(item_row.doctype, item_row.name);
          frappe.throw({
            title: __("Not Available"),
            message: __("Item Code: {0} is not available under warehouse {1}.", [bold_item_code, bold_warehouse])
          });
        } else {
          return;
        }
      } else if (is_stock_item && available_qty < qty_needed) {
        frappe.throw({
          message: __("Stock quantity not enough for Item Code: {0} under warehouse {1}. Available quantity {2} {3}.", [bold_item_code, bold_warehouse, bold_available_qty, bold_uom]),
          indicator: "orange"
        });
        frappe.utils.play_sound("error");
      }
    }
    async check_serial_no_availablilty(item_code, warehouse2, serial_no) {
      const method = "erpnext.stock.doctype.serial_no.serial_no.get_pos_reserved_serial_nos";
      const args = { filters: { item_code, warehouse: warehouse2 } };
      const res = await frappe.call({ method, args });
      if (res.message.includes(serial_no)) {
        frappe.throw({
          title: __("Not Available"),
          message: __("Serial No: {0} has already been transacted into another Sales Invoice.", [serial_no.bold()])
        });
      }
    }
    get_available_stock(item_code, warehouse2) {
      const me = this;
      return frappe.call({
        method: "erpnext.accounts.doctype.pos_invoice.pos_invoice.get_stock_availability",
        args: {
          "item_code": item_code,
          "warehouse": warehouse2
        },
        callback(res) {
          if (!me.item_stock_map[item_code])
            me.item_stock_map[item_code] = {};
          me.item_stock_map[item_code][warehouse2] = res.message;
        }
      });
    }
    update_item_field(value, field_or_action) {
      if (field_or_action === "checkout") {
        this.item_details.toggle_item_details_section(null);
      } else if (field_or_action === "remove") {
        this.remove_item_from_cart();
      } else {
        const field_control = this.item_details[`${field_or_action}_control`];
        if (!field_control)
          return;
        field_control.set_focus();
        value != "" && field_control.set_value(value);
      }
    }
    remove_item_from_cart() {
      frappe.dom.freeze();
      const { doctype, name, current_item } = this.item_details;
      return frappe.model.set_value(doctype, name, "qty", 0).then(() => {
        frappe.model.clear_doc(doctype, name);
        this.update_cart_html(current_item, true);
        this.item_details.toggle_item_details_section(null);
        frappe.dom.unfreeze();
        var total_incoming_rate = 0;
        this.frm.doc.items.forEach((item) => {
          total_incoming_rate += parseFloat(item.valuation_rate) * item.qty;
        });
        this.item_selector.update_total_incoming_rate(total_incoming_rate);
      }).catch((e) => console.log(e));
    }
    async save_and_checkout() {
      if (!this.frm.doc.items || this.frm.doc.items.length === 0) {
        frappe.show_alert({
          message: __("Please add items to cart before checkout."),
          indicator: "red"
        });
        frappe.utils.play_sound("error");
        return;
      }
      if (this.frm.is_dirty()) {
        if (this.settings.custom_add_reference_details) {
          const dialog = new frappe.ui.Dialog({
            title: __("Enter Reference Details"),
            fields: [
              {
                fieldtype: "Data",
                label: __("Reference Number"),
                fieldname: "reference_no"
              },
              {
                fieldtype: "Data",
                label: __("Reference Name"),
                fieldname: "reference_name"
              }
            ],
            primary_action_label: __("Proceed to Payment"),
            primary_action: async (values) => {
              this.frm.doc.custom_reference_no = values.reference_no;
              this.frm.doc.custom_reference_name = values.reference_name;
              const div = document.getElementById("customer-cart-container2");
              div.style.gridColumn = "";
              let save_error = false;
              await this.frm.save(null, null, null, () => save_error = true);
              dialog.hide();
              if (!save_error) {
                this.payment.checkout();
              } else {
                setTimeout(() => {
                  this.cart.toggle_checkout_btn(true);
                }, 300);
              }
            }
          });
          dialog.show();
        } else {
          const div = document.getElementById("customer-cart-container2");
          div.style.gridColumn = "";
          let save_error = false;
          await this.frm.save(null, null, null, () => save_error = true);
          !save_error && this.payment.checkout();
          save_error && setTimeout(() => {
            this.cart.toggle_checkout_btn(true);
          }, 300);
        }
      } else {
        this.payment.checkout();
      }
    }
  };

  // ../posnext/posnext/public/js/pos_item_selector.js
  var import_onscan = __toESM(require_onscan());
  frappe.provide("posnext.PointOfSale");
  var view = "List";
  posnext.PointOfSale.ItemSelector = class {
    constructor({ frm, wrapper, events, pos_profile, settings, currency, init_item_cart, reload_status }) {
      this.wrapper = wrapper;
      this.events = events;
      this.currency = currency;
      this.pos_profile = pos_profile;
      this.hide_images = settings.hide_images;
      this.reload_status = reload_status;
      this.auto_add_item = settings.auto_add_item_to_cart;
      if (settings.custom_default_view) {
        view = settings.custom_default_view;
      }
      if (settings.custom_show_only_list_view) {
        view = "List";
      }
      if (settings.custom_show_only_card_view) {
        view = "Card";
      }
      this.custom_show_item_code = settings.custom_show_item_code;
      this.show_only_list_view = settings.custom_show_only_list_view;
      this.show_only_card_view = settings.custom_show_only_card_view;
      this.inti_component();
    }
    inti_component() {
      this.prepare_dom();
      this.make_search_bar();
      this.load_items_data();
      this.bind_events();
      this.attach_shortcuts();
    }
    prepare_dom() {
      if (view === "Card" && !this.show_only_list_view) {
        this.wrapper.append(
          `<section class="items-selector" id="card-view-section">
					<div class="filter-section">
						<div class="label" style="grid-column: span 2 / span 2">${__("All Items")}</div>
						<div class="list-view"><a class="list-span">List</a></div>
						<div class="card-view"><a class="card-span">Card</a></div>
						<div class="pos-profile" style="grid-column: span 2 / span 2"></div>
						<div class="search-field" style="grid-column: span 2 / span 2"></div>
						<div class="item-group-field"></div>
					</div>
					<div class="items-container"></div>
				</section>`
        );
        this.$component = this.wrapper.find(".items-selector");
        this.$items_container = this.$component.find(".items-container");
      } else if (view === "List" && !this.show_only_card_view) {
        this.wrapper.append(
          `<section class="customer-cart-container items-selector" id="list-view-section" style="grid-column: span 6 / span 6;overflow-y:hidden">
					<div class="filter-section">
						<div class="label" style="grid-column: span 2 / span 2">${__("All Items")}</div>
						<div class="list-view"><a class="list-span">List</a></div>
						<div class="card-view"><a class="card-span">Card</a></div>
						<div class="pos-profile" style="grid-column: span 2 / span 2"></div>
						<div class="search-field" style="grid-column: span 2 / span 2"></div>
						<div class="item-group-field"></div>
					</div>
					<div class="cart-container"></div>
				</section>`
        );
        this.$component = this.wrapper.find(".customer-cart-container");
        this.$items_container = this.$component.find(".cart-container");
      }
      this.$list_view = this.$component.find(".list-view");
      this.$card_view = this.$component.find(".card-view");
      if (view === "List" && !this.show_only_list_view) {
        this.$list_view.find(".list-span").css({ "display": "inline-block", "background-color": "#3498db", "color": "white", "padding": "5px 10px", "border-radius": "20px", "font-size": "14px", "font-weight": "bold", "text-transform": "uppercase", "letter-spacing": "1px", "cursor": "pointer", "transition": "background-color 0.3s ease" });
        this.$card_view.find(".card-span").css({ "display": "", "background-color": "", "color": "", "padding": "", "border-radius": "", "font-size": "", "font-weight": "", "text-transform": "", "letter-spacing": "", "cursor": "", "transition": "" });
      } else if (view === "Card" && !this.show_only_card_view) {
        this.$card_view.find(".card-span").css({ "display": "inline-block", "background-color": "#3498db", "color": "white", "padding": "5px 10px", "border-radius": "20px", "font-size": "14px", "font-weight": "bold", "text-transform": "uppercase", "letter-spacing": "1px", "cursor": "pointer", "transition": "background-color 0.3s ease" });
        this.$list_view.find(".list-span").css({ "display": "", "background-color": "", "color": "", "padding": "", "border-radius": "", "font-size": "", "font-weight": "", "text-transform": "", "letter-spacing": "", "cursor": "", "transition": "" });
      } else {
        this.$list_view.find(".list-span").css({ "display": "none" });
        this.$card_view.find(".card-span").css({ "display": "none" });
      }
      if (!this.show_only_card_view && !this.show_only_list_view) {
        this.click_functions();
      }
    }
    click_functions() {
      this.$list_view.on("click", "a", () => {
        this.$list_view.find(".list-span").css({ "display": "inline-block", "background-color": "#3498db", "color": "white", "padding": "5px 10px", "border-radius": "20px", "font-size": "14px", "font-weight": "bold", "text-transform": "uppercase", "letter-spacing": "1px", "cursor": "pointer", "transition": "background-color 0.3s ease" });
        this.$card_view.find(".card-span").css({ "display": "", "background-color": "", "color": "", "padding": "", "border-radius": "", "font-size": "", "font-weight": "", "text-transform": "", "letter-spacing": "", "cursor": "", "transition": "" });
        view = "List";
        if (document.getElementById("card-view-section"))
          document.getElementById("card-view-section").remove();
        if (document.getElementById("list-view-section"))
          document.getElementById("list-view-section").remove();
        if (document.getElementById("customer-cart-container2"))
          document.getElementById("customer-cart-container2").remove();
        if (document.getElementById("item-details-container"))
          document.getElementById("item-details-container").remove();
        this.inti_component();
        this.events.init_item_details();
        this.events.init_item_cart();
        this.events.change_items(this.events.get_frm());
      });
      this.$card_view.on("click", "a", () => {
        this.$card_view.find(".card-span").css({ "display": "inline-block", "background-color": "#3498db", "color": "white", "padding": "5px 10px", "border-radius": "20px", "font-size": "14px", "font-weight": "bold", "text-transform": "uppercase", "letter-spacing": "1px", "cursor": "pointer", "transition": "background-color 0.3s ease" });
        this.$list_view.find(".list-span").css({ "display": "", "background-color": "", "color": "", "padding": "", "border-radius": "", "font-size": "", "font-weight": "", "text-transform": "", "letter-spacing": "", "cursor": "", "transition": "" });
        view = "Card";
        if (document.getElementById("card-view-section"))
          document.getElementById("card-view-section").remove();
        if (document.getElementById("list-view-section"))
          document.getElementById("list-view-section").remove();
        if (document.getElementById("customer-cart-container2"))
          document.getElementById("customer-cart-container2").remove();
        if (document.getElementById("item-details-container"))
          document.getElementById("item-details-container").remove();
        this.inti_component();
        this.events.init_item_details();
        this.events.init_item_cart();
        this.events.change_items(this.events.get_frm());
      });
    }
    async load_items_data() {
      if (!this.item_group) {
        const res = await frappe.db.get_value("Item Group", { lft: 1, is_group: 1 }, "name");
        this.parent_item_group = res.message.name;
      }
      if (!this.price_list) {
        const res = await frappe.db.get_value("POS Profile", this.pos_profile, "selling_price_list");
        this.price_list = res.message.selling_price_list;
      }
      this.get_items({}).then(({ message }) => {
        this.render_item_list(message.items);
      });
    }
    get_items({ start = 0, page_length = 40, search_term = "" }) {
      const doc = this.events.get_frm().doc;
      const price_list = doc && doc.selling_price_list || this.price_list;
      let { item_group, pos_profile } = this;
      !item_group && (item_group = this.parent_item_group);
      return frappe.call({
        method: "erpnext.selling.page.point_of_sale.point_of_sale.get_items",
        freeze: true,
        args: { start, page_length, price_list, item_group, search_term, pos_profile }
      });
    }
    render_item_list(items) {
      var me = this;
      if (view === "List") {
        let get_item_code_header = function() {
          if (me.custom_show_item_code) {
            return `<div style="flex: 2">${__("Item")}</div>
						<div style="flex: 1">${__("Item Code")}</div>`;
          } else {
            return `<div style="flex: 3">${__("Item")}</div>`;
          }
        };
        this.$items_container.html("");
        this.$items_container.append(
          `<div class="abs-cart-container" style="overflow-y:hidden">
					<div class="cart-header">
					${get_item_code_header()}
						<div style="flex: 1">${__("Rate")}</div>
						<div style="flex: 1">${__("Available Qty")}</div>
						<div class="qty-header">${__("UOM")}</div>
					</div>
					<div class="cart-items-section" style="overflow-y:hidden"></div>
				</div>`
        );
        this.make_cart_items_section();
        items.forEach((item) => {
          this.render_cart_item(item);
        });
      } else {
        items.forEach((item) => {
          var item_html = this.get_item_html(item);
          this.$items_container.append(item_html);
        });
      }
    }
    make_cart_items_section() {
      this.$cart_header = this.$component.find(".cart-header");
      this.$cart_items_wrapper = this.$component.find(".cart-items-section");
    }
    get_cart_item({ name }) {
      const item_selector = `.cart-item-wrapper[data-row-name="${escape(name)}"]`;
      return this.$cart_items_wrapper.find(item_selector);
    }
    get_cart_item1({ item_code }) {
      const item_selector = `.cart-item-wrapper[data-row-name="${escape(item_code)}"]`;
      return this.$cart_items_wrapper.find(item_selector);
    }
    render_cart_item(item_data) {
      const me = this;
      const currency = me.events.get_frm().currency || me.currency;
      this.$cart_items_wrapper.append(
        `<div class="cart-item-wrapper item-wrapper" 
			data-item-code="${escape(item_data.item_code)}" 
			data-serial-no="${escape(item_data.serial_no)}"
			data-batch-no="${escape(item_data.batch_no)}" 
			data-uom="${escape(item_data.uom)}"
			data-rate="${escape(item_data.price_list_rate || 0)}"
			title="${item_data.item_name}"
			data-row-name="${escape(item_data.item_code)}"></div>
			<div class="seperator"></div>`
      );
      var $item_to_update = this.get_cart_item1(item_data);
      $item_to_update.html(
        `${get_item_image_html()}
			${get_item_name()}
				<div class="item-name" >
					${item_data.item_name}
				</div>
				${get_description_html()}
			</div>
			${get_item_code()}
			${get_rate_discount_html()}`
      );
      function get_item_name() {
        if (me.custom_show_item_code) {
          return `<div class="item-name-desc" style="flex: 3">`;
        } else {
          return `<div class="item-name-desc" style="flex: 4">`;
        }
      }
      function get_item_code() {
        if (me.custom_show_item_code) {
          return `<div class="item-code-desc" style="flex: 1">
					<div class="item-code" >
						${item_data.item_code}
					</div>
				</div>`;
        } else {
          return ``;
        }
      }
      set_dynamic_rate_header_width();
      function set_dynamic_rate_header_width() {
        const rate_cols = Array.from(me.$cart_items_wrapper.find(".item-rate-amount"));
        me.$cart_header.find(".rate-amount-header").css("width", "");
        me.$cart_items_wrapper.find(".item-rate-amount").css("width", "");
        var max_width = rate_cols.reduce((max_width2, elm) => {
          if ($(elm).width() > max_width2)
            max_width2 = $(elm).width();
          return max_width2;
        }, 0);
        max_width += 1;
        if (max_width == 1)
          max_width = "";
        me.$cart_header.find(".rate-amount-header").css("width", max_width);
        me.$cart_items_wrapper.find(".item-rate-amount").css("width", max_width);
      }
      function get_rate_discount_html() {
        if (item_data.rate && item_data.amount && item_data.rate !== item_data.amount) {
          return `
					<div class="item-qty-rate" style="flex: 5">
						<div class="item-rate-amount" style="flex: 1">
							<div class="item-rate" style="text-align: center">${format_currency(item_data.price_list_rate, currency)}</div>
						</div>
						<div class="item-qty" style="flex: 1;display:block;text-align: center"><span> ${item_data.actual_qty || 0}</span></div>
						<div class="item-qty" style="margin: 0"><span> ${item_data.uom}</span></div>
						
					</div>`;
        } else {
          return `
					<div class="item-qty-rate" style="flex: 5">
						<div class="item-rate-amount" style="flex: 1">
							<div class="item-rate" style="text-align: center">${format_currency(item_data.price_list_rate, currency)}</div>
						</div>
						<div class="item-qty" style="flex: 1;display:block;text-align: center"><span> ${item_data.actual_qty || 0}</span></div>
						<div class="item-qty" style="margin: 0"><span> ${item_data.uom}</span></div>
						
					</div>`;
        }
      }
      function get_description_html() {
        if (item_data.description) {
          if (item_data.description.indexOf("<div>") != -1) {
            try {
              item_data.description = $(item_data.description).text();
            } catch (error) {
              item_data.description = item_data.description.replace(/<div>/g, " ").replace(/<\/div>/g, " ").replace(/ +/g, " ");
            }
          }
          item_data.description = frappe.ellipsis(item_data.description, 45);
          return `<div class="item-desc">${item_data.description}</div>`;
        }
        return ``;
      }
      function get_item_image_html() {
        const { image, item_name } = item_data;
        if (!me.hide_images && image) {
          return `
					<div class="item-image">
						<img
							onerror="cur_pos.cart.handle_broken_image(this)"
							src="${image}" alt="${frappe.get_abbr(item_name)}"">
					</div>`;
        } else {
          return `<div class="item-image item-abbr">${frappe.get_abbr(item_name)}</div>`;
        }
      }
    }
    get_item_html(item) {
      const me = this;
      item.currency = item.currency || me.currency;
      const { item_image, serial_no, batch_no, barcode, actual_qty, uom, price_list_rate } = item;
      const precision2 = flt(price_list_rate, 2) % 1 != 0 ? 2 : 0;
      let indicator_color;
      let qty_to_display = actual_qty;
      if (item.is_stock_item) {
        indicator_color = actual_qty > 10 ? "green" : actual_qty <= 0 ? "red" : "orange";
        if (Math.round(qty_to_display) > 999) {
          qty_to_display = Math.round(qty_to_display) / 1e3;
          qty_to_display = qty_to_display.toFixed(1) + "K";
        }
      } else {
        indicator_color = "";
        qty_to_display = "";
      }
      function get_item_image_html() {
        if (!me.hide_images && item_image) {
          return `<div class="item-qty-pill">
							<span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
						</div>
						<div class="flex items-center justify-center h-32 border-b-grey text-6xl text-grey-100">
							<img
								onerror="cur_pos.item_selector.handle_broken_image(this)"
								class="h-full item-img" src="${item_image}"
								alt="${frappe.get_abbr(item.item_name)}"
							>
						</div>`;
        } else {
          return `<div class="item-qty-pill">
							<span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
						</div>
						<div class="item-display abbr">${frappe.get_abbr(item.item_name)}</div>`;
        }
      }
      return `<div class="item-wrapper"
				data-item-code="${escape(item.item_code)}" data-serial-no="${escape(serial_no)}"
				data-batch-no="${escape(batch_no)}" data-uom="${escape(uom)}"
				data-rate="${escape(price_list_rate || 0)}"
				title="${item.item_name}">

				${get_item_image_html()}

				<div class="item-detail">
					<div class="item-name">
						${frappe.ellipsis(item.item_name, 18)}
					</div>
					<div class="item-rate">${format_currency(price_list_rate, item.currency, precision2) || 0} / ${uom}</div>
				</div>
			</div>`;
    }
    handle_broken_image($img) {
      const item_abbr = $($img).attr("alt");
      $($img).parent().replaceWith(`<div class="item-display abbr">${item_abbr}</div>`);
    }
    make_search_bar() {
      const me = this;
      const doc = me.events.get_frm().doc;
      this.$component.find(".search-field").html("");
      this.$component.find(".pos-profile").html("");
      this.$component.find(".item-group-field").html("");
      this.pos_profile_field = frappe.ui.form.make_control({
        df: {
          label: __("POS Profile"),
          fieldtype: "Link",
          options: "POS Profile",
          placeholder: __("POS Profile"),
          onchange: function() {
            if (me.reload_status && me.pos_profile !== this.value) {
              frappe.pages["posnext"].refresh(window.wrapper, window.onScan, this.value);
            }
          }
        },
        parent: this.$component.find(".pos-profile"),
        render_input: false
      });
      this.search_field = frappe.ui.form.make_control({
        df: {
          label: __("Search"),
          fieldtype: "Data",
          placeholder: __("Search by item code, serial number or barcode")
        },
        parent: this.$component.find(".search-field"),
        render_input: true
      });
      this.item_group_field = frappe.ui.form.make_control({
        df: {
          label: __("Item Group"),
          fieldtype: "Link",
          options: "Item Group",
          placeholder: __("Select item group"),
          onchange: function() {
            me.item_group = this.value;
            !me.item_group && (me.item_group = me.parent_item_group);
            me.filter_items();
          },
          get_query: function() {
            return {
              query: "erpnext.selling.page.point_of_sale.point_of_sale.item_group_query",
              filters: {
                pos_profile: doc ? doc.pos_profile : ""
              }
            };
          }
        },
        parent: this.$component.find(".item-group-field"),
        render_input: true
      });
      this.pos_profile_field.set_value(me.pos_profile);
      this.pos_profile_field.refresh();
      this.pos_profile_field.toggle_label(false);
      this.search_field.toggle_label(false);
      this.item_group_field.toggle_label(false);
      this.attach_clear_btn();
    }
    attach_clear_btn() {
      this.search_field.$wrapper.find(".control-input").append(
        `<span class="link-btn" style="top: 2px;">
				<a class="btn-open no-decoration" title="${__("Clear")}">
					${frappe.utils.icon("close", "sm")}
				</a>
			</span>`
      );
      this.$clear_search_btn = this.search_field.$wrapper.find(".link-btn");
      this.$clear_search_btn.on("click", "a", () => {
        this.set_search_value("");
        this.search_field.set_focus();
      });
    }
    set_search_value(value) {
      $(this.search_field.$input[0]).val(value).trigger("input");
    }
    bind_events() {
      const me = this;
      window.onScan = import_onscan.default;
      import_onscan.default.decodeKeyEvent = function(oEvent) {
        var iCode = this._getNormalizedKeyNum(oEvent);
        switch (true) {
          case (iCode >= 48 && iCode <= 90):
          case (iCode >= 106 && iCode <= 111):
          case (iCode >= 160 && iCode <= 164 || iCode == 170):
          case (iCode >= 186 && iCode <= 194):
          case (iCode >= 219 && iCode <= 222):
          case iCode == 32:
            if (oEvent.key !== void 0 && oEvent.key !== "") {
              return oEvent.key;
            }
            var sDecoded = String.fromCharCode(iCode);
            switch (oEvent.shiftKey) {
              case false:
                sDecoded = sDecoded.toLowerCase();
                break;
              case true:
                sDecoded = sDecoded.toUpperCase();
                break;
            }
            return sDecoded;
          case (iCode >= 96 && iCode <= 105):
            return 0 + (iCode - 96);
        }
        return "";
      };
      import_onscan.default.attachTo(document, {
        onScan: (sScancode) => {
          if (this.search_field && this.$component.is(":visible")) {
            this.search_field.set_focus();
            this.set_search_value(sScancode);
            this.barcode_scanned = true;
          }
        }
      });
      this.$component.on("click", ".item-wrapper", function() {
        const $item = $(this);
        const item_code = unescape($item.attr("data-item-code"));
        let batch_no = unescape($item.attr("data-batch-no"));
        let serial_no = unescape($item.attr("data-serial-no"));
        let uom = unescape($item.attr("data-uom"));
        let rate = unescape($item.attr("data-rate"));
        batch_no = batch_no === "undefined" ? void 0 : batch_no;
        serial_no = serial_no === "undefined" ? void 0 : serial_no;
        uom = uom === "undefined" ? void 0 : uom;
        rate = rate === "undefined" ? void 0 : rate;
        me.events.item_selected({
          field: "qty",
          value: "+1",
          item: { item_code, batch_no, serial_no, uom, rate }
        });
        me.search_field.set_focus();
      });
      this.search_field.$input.on("input", (e) => {
        clearTimeout(this.last_search);
        this.last_search = setTimeout(() => {
          const search_term = e.target.value;
          this.filter_items({ search_term });
        }, 300);
        this.$clear_search_btn.toggle(
          Boolean(this.search_field.$input.val())
        );
      });
      this.search_field.$input.on("focus", () => {
        this.$clear_search_btn.toggle(
          Boolean(this.search_field.$input.val())
        );
      });
    }
    attach_shortcuts() {
      const ctrl_label = frappe.utils.is_mac() ? "\u2318" : "Ctrl";
      this.search_field.parent.attr("title", `${ctrl_label}+I`);
      frappe.ui.keys.add_shortcut({
        shortcut: "ctrl+i",
        action: () => this.search_field.set_focus(),
        condition: () => this.$component.is(":visible"),
        description: __("Focus on search input"),
        ignore_inputs: true,
        page: cur_page.page.page
      });
      this.item_group_field.parent.attr("title", `${ctrl_label}+G`);
      frappe.ui.keys.add_shortcut({
        shortcut: "ctrl+g",
        action: () => this.item_group_field.set_focus(),
        condition: () => this.$component.is(":visible"),
        description: __("Focus on Item Group filter"),
        ignore_inputs: true,
        page: cur_page.page.page
      });
      frappe.ui.keys.on("enter", () => {
        const selector_is_visible = this.$component.is(":visible");
        if (!selector_is_visible || this.search_field.get_value() === "")
          return;
        if (this.items.length == 1) {
          this.$items_container.find(".item-wrapper").click();
          frappe.utils.play_sound("submit");
          this.set_search_value("");
        } else if (this.items.length == 0 && this.barcode_scanned) {
          frappe.show_alert({
            message: __("No items found. Scan barcode again."),
            indicator: "orange"
          });
          frappe.utils.play_sound("error");
          this.barcode_scanned = false;
          this.set_search_value("");
        }
      });
    }
    filter_items({ search_term = "" } = {}) {
      if (search_term) {
        search_term = search_term.toLowerCase();
        this.search_index = this.search_index || {};
        if (this.search_index[search_term]) {
          const items = this.search_index[search_term];
          this.items = items;
          this.render_item_list(items);
          this.auto_add_item && this.items.length == 1 && this.add_filtered_item_to_cart();
          return;
        }
      }
      this.get_items({ search_term }).then(({ message }) => {
        const { items, serial_no, batch_no, barcode } = message;
        if (search_term && !barcode) {
          this.search_index[search_term] = items;
        }
        this.items = items;
        this.render_item_list(items);
        this.auto_add_item && this.items.length == 1 && this.add_filtered_item_to_cart();
      });
    }
    add_filtered_item_to_cart() {
      this.$items_container.find(".item-wrapper").click();
      this.set_search_value("");
    }
    resize_selector(minimize) {
      minimize ? this.$component.find(".filter-section").css("grid-template-columns", "repeat(1, minmax(0, 1fr))") : this.$component.find(".filter-section").css("grid-template-columns", "repeat(12, minmax(0, 1fr))");
      minimize ? this.$component.find(".search-field").css("margin", "var(--margin-sm) 0px") : this.$component.find(".search-field").css("margin", "0px var(--margin-sm)");
      minimize ? this.$component.css("grid-column", "span 2 / span 2") : this.$component.css("grid-column", "span 6 / span 6");
      minimize ? this.$items_container.css("grid-template-columns", "repeat(1, minmax(0, 1fr))") : this.$items_container.css("grid-template-columns", "repeat(4, minmax(0, 1fr))");
    }
    toggle_component(show) {
      this.set_search_value("");
      this.$component.css("display", show ? "flex" : "none");
    }
  };

  // ../posnext/posnext/public/js/pos_item_cart.js
  frappe.provide("posnext.PointOfSale");
  posnext.PointOfSale.ItemCart = class {
    constructor({ wrapper, events, settings }) {
      this.wrapper = wrapper;
      this.events = events;
      this.customer_info = void 0;
      this.hide_images = settings.hide_images;
      this.allowed_customer_groups = settings.customer_groups;
      this.allow_rate_change = settings.allow_rate_change;
      this.allow_discount_change = settings.allow_discount_change;
      this.show_held_button = settings.custom_show_held_button;
      this.show_order_list_button = settings.custom_show_order_list_button;
      this.mobile_number_based_customer = settings.custom_mobile_number_based_customer;
      this.show_checkout_button = settings.custom_show_checkout_button;
      this.custom_edit_rate = settings.custom_edit_rate_and_uom;
      this.custom_use_discount_percentage = settings.custom_use_discount_percentage;
      this.custom_use_discount_amount = settings.custom_use_discount_amount;
      this.custom_use_additional_discount_amount = settings.custom_use_additional_discount_amount;
      this.custom_show_incoming_rate = settings.custom_show_incoming_rate && settings.custom_edit_rate_and_uom;
      this.custom_show_last_customer_rate = settings.custom_show_last_customer_rate;
      this.custom_show_logical_rack_in_cart = settings.custom_show_logical_rack_in_cart && settings.custom_edit_rate_and_uom;
      this.custom_show_uom_in_cart = settings.custom_show_uom_in_cart && settings.custom_edit_rate_and_uom;
      this.show_branch = settings.show_branch;
      this.show_batch_in_cart = settings.show_batch_in_cart;
      this.custom_show_item_discription = settings.custom_show_item_discription;
      this.custom_show_item_barcode = settings.custom_show_item_barcode;
      this.settings = settings;
      this.warehouse = settings.warehouse;
      this.init_component();
    }
    init_component() {
      this.prepare_dom();
      this.init_child_components();
      this.bind_events();
      this.attach_shortcuts();
    }
    prepare_dom() {
      if (this.custom_edit_rate) {
        this.wrapper.append(
          `<section class="customer-cart-container customer-cart-container1 " style="grid-column: span 5 / span 5;" id="customer-cart-container2"></section>`
        );
      } else {
        this.wrapper.append(
          `<section class="customer-cart-container customer-cart-container1 " id="customer-cart-container2"></section>`
        );
      }
      this.$component = this.wrapper.find(".customer-cart-container1");
    }
    init_child_components() {
      this.init_customer_selector();
      this.init_cart_components();
    }
    bind_events() {
      let me = this;
      this.$component.on("click", ".checkout-btn", function() {
        me.checkout_with_feedback();
      });
      this.$component.on("click", ".held-btn", function() {
        const original_text = me.show_loading_state(".held-btn", "Loading...");
        try {
          me.events.show_held_invoices && me.events.show_held_invoices();
        } finally {
          setTimeout(() => me.hide_loading_state(".held-btn", original_text), 500);
        }
      });
      this.$component.on("click", ".order-list-btn", function() {
        const original_text = me.show_loading_state(".order-list-btn", "Loading...");
        try {
          me.events.show_order_list && me.events.show_order_list();
        } finally {
          setTimeout(() => me.hide_loading_state(".order-list-btn", original_text), 500);
        }
      });
      this.$component.on("click", ".search-btn", function() {
        me.events.show_item_search && me.events.show_item_search();
      });
      this.$component.on("mousedown", ".numpad-btn, .checkout-btn, .held-btn, .order-list-btn, .search-btn", function() {
        $(this).addClass("btn-pressed");
      });
      this.$component.on("mouseup mouseleave", ".numpad-btn, .checkout-btn, .held-btn, .order-list-btn, .search-btn", function() {
        $(this).removeClass("btn-pressed");
      });
      this.add_keyboard_shortcut_tooltips();
    }
    attach_shortcuts() {
      let me = this;
      $(document).on("keydown.pos_cart", function(e) {
        if ($(e.target).is("input, textarea, select")) {
          return;
        }
        switch (e.keyCode || e.which) {
          case 112:
            e.preventDefault();
            me.events.checkout && me.events.checkout();
            me.show_shortcut_feedback("F1", "Checkout");
            break;
          case 113:
            e.preventDefault();
            me.events.show_held_invoices && me.events.show_held_invoices();
            me.show_shortcut_feedback("F2", "Hold Invoice");
            break;
          case 114:
            e.preventDefault();
            me.events.show_order_list && me.events.show_order_list();
            me.show_shortcut_feedback("F3", "Order List");
            break;
          case 115:
            e.preventDefault();
            me.events.show_item_search && me.events.show_item_search();
            me.show_shortcut_feedback("F4", "Search Items");
            break;
          case 27:
            e.preventDefault();
            me.clear_focus();
            break;
          case 13:
            if (me.get_all_items().length > 0) {
              e.preventDefault();
              me.events.checkout && me.events.checkout();
            }
            break;
        }
      });
    }
    show_shortcut_feedback(key, action) {
      let feedback = $(`<div class="shortcut-feedback">${key}: ${action}</div>`);
      $("body").append(feedback);
      feedback.css({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(0, 123, 255, 0.9)",
        color: "white",
        padding: "10px 20px",
        borderRadius: "5px",
        zIndex: 9999,
        fontWeight: "bold",
        boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
        animation: "shortcut-feedback 0.5s ease-out"
      });
      setTimeout(function() {
        feedback.fadeOut(300, function() {
          feedback.remove();
        });
      }, 1e3);
    }
    clear_focus() {
      $("input:focus, textarea:focus, select:focus").blur();
    }
    add_keyboard_shortcut_tooltips() {
      const tooltips = {
        ".checkout-btn": "F1 - Checkout",
        ".held-btn": "F2 - Hold Invoice",
        ".order-list-btn": "F3 - Order List",
        ".search-btn": "F4 - Search Items"
      };
      Object.keys(tooltips).forEach((selector) => {
        const $element = this.$component.find(selector);
        if ($element.length) {
          $element.addClass("tooltip");
          $element.append(`<span class="tooltiptext">${tooltips[selector]}</span>`);
        }
      });
    }
    show_loading_state(button_selector, message = "Processing...") {
      const $button = this.$component.find(button_selector);
      const original_text = $button.text();
      $button.prop("disabled", true);
      $button.html(`<span class="loading-spinner"></span>${message}`);
      return original_text;
    }
    hide_loading_state(button_selector, original_text) {
      const $button = this.$component.find(button_selector);
      $button.prop("disabled", false);
      $button.text(original_text);
    }
    show_success_feedback(message, duration = 2e3) {
      this.show_feedback(message, "success", duration);
    }
    show_error_feedback(message, duration = 3e3) {
      this.show_feedback(message, "error", duration);
    }
    show_feedback(message, type = "info", duration = 2e3) {
      const feedback = $(`<div class="feedback-message ${type}">${message}</div>`);
      $("body").append(feedback);
      const styles = {
        success: { background: "#28a745", color: "white" },
        error: { background: "#dc3545", color: "white" },
        info: { background: "#007bff", color: "white" },
        warning: { background: "#ffc107", color: "black" }
      };
      const style = styles[type] || styles.info;
      feedback.css(__spreadProps(__spreadValues({
        position: "fixed",
        top: "20px",
        right: "20px",
        padding: "12px 20px",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 9999,
        fontWeight: "bold",
        maxWidth: "300px",
        wordWrap: "break-word"
      }, style), {
        animation: type === "error" ? "error-shake 0.5s ease" : "success-bounce 0.5s ease"
      }));
      setTimeout(() => {
        feedback.fadeOut(300, () => feedback.remove());
      }, duration);
    }
    add_item_with_feedback(item) {
      try {
        this.add_item(item);
        this.show_success_feedback(__("Item added to cart"));
        this.update_cart_html();
      } catch (error) {
        this.show_error_feedback(__("Failed to add item: ") + error.message);
      }
    }
    remove_item_with_feedback(idx) {
      try {
        const item = this.items[idx];
        this.remove_item(idx);
        this.show_success_feedback(__("Item removed from cart"));
      } catch (error) {
        this.show_error_feedback(__("Failed to remove item"));
      }
    }
    async checkout_with_feedback() {
      if (this.get_all_items().length === 0) {
        this.show_error_feedback(__("Cart is empty"));
        return;
      }
      const original_text = this.show_loading_state(".checkout-btn", "Processing...");
      try {
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        this.events.checkout && this.events.checkout();
        this.show_success_feedback(__("Checkout initiated successfully"));
      } catch (error) {
        this.show_error_feedback(__("Checkout failed: ") + error.message);
      } finally {
        this.hide_loading_state(".checkout-btn", original_text);
      }
    }
    init_customer_selector() {
      this.$component.append(
        `<div class="customer-section"></div>`
      );
      this.$customer_section = this.$component.find(".customer-section");
      this.make_customer_selector();
    }
    reset_customer_selector() {
      const frm = this.events.get_frm();
      frm.set_value("customer", "");
      this.make_customer_selector();
      this.customer_field.set_focus();
    }
    init_cart_components() {
      var html = `<div class="cart-container">
				<div class="abs-cart-container">
					<div class="cart-label">${__("Item Cart")}</div>
					<div class="cart-header">
						<div class="name-header" style="flex:3">${__("Item")}</div>
						<div class="qty-header" style="flex: 1">${__("Qty")}</div>
						`;
      if (this.custom_show_uom_in_cart) {
        html += `<div class="uom-header" style="flex: 1">${__("UOM")}</div>`;
      }
      if (this.show_batch_in_cart) {
        html += `<div class="batch-header" style="flex: 1">${__("Batch")}</div>`;
      }
      if (this.custom_edit_rate) {
        html += `<div class="rate-header" style="flex: 1">${__("Rate")}</div>`;
      }
      if (this.custom_use_discount_percentage) {
        html += `<div class="discount-perc-header" style="flex: 1">${__("Disc%")}</div>`;
      }
      if (this.custom_use_discount_amount) {
        html += `<div class="discount-amount-header" style="flex: 1">${__("Disc")}</div>`;
      }
      if (this.custom_show_incoming_rate) {
        html += `<div class="incoming-rate-header" style="flex: 1">${__("Inc.Rate")}</div>`;
      }
      if (this.custom_show_logical_rack_in_cart) {
        html += `<div class="incoming-rate-header" style="flex: 1">${__("Rack")}</div>`;
      }
      if (this.custom_show_last_customer_rate) {
        html += `<div class="last-customer-rate-header" style="flex: 1">${__("LC Rate")}</div>`;
      }
      html += `<div class="rate-amount-header" style="flex: 1;text-align: left">${__("Amount")}</div>
					</div>
					<div class="cart-items-section" ></div>
					<div class="cart-branch-section"></div>
					<div class="cart-totals-section"></div>
					<div class="numpad-section"></div>
				</div>
			</div>`;
      this.$component.append(html);
      this.$cart_container = this.$component.find(".cart-container");
      this.make_branch_section();
      this.make_cart_totals_section();
      this.make_cart_items_section();
      this.make_cart_numpad();
    }
    make_cart_items_section() {
      this.$cart_header = this.$component.find(".cart-header");
      this.$cart_items_wrapper = this.$component.find(".cart-items-section");
      this.make_no_items_placeholder();
    }
    make_no_items_placeholder() {
      this.$cart_header.css("display", "none");
      this.$cart_items_wrapper.html(
        `<div class="no-item-wrapper">${__("No items in cart")}</div>`
      );
    }
    update_cart_html() {
      let me = this;
      let items = this.get_all_items();
      if (items.length === 0) {
        this.make_no_items_placeholder();
        return;
      }
      this.$cart_header.css("display", "flex");
      let html = "";
      items.forEach(function(item, idx) {
        html += me.get_item_html(item, idx);
      });
      this.$cart_items_wrapper.html(html);
      this.bind_item_events();
    }
    get_item_html(item, idx) {
      let me = this;
      let item_html = `<div class="cart-item-wrapper" data-item-code="${item.item_code}" data-idx="${idx}">
			<div class="item-name" style="flex:3">${item.item_name}</div>
			<div class="item-qty" style="flex:1">
				<input type="number" class="form-control qty-input" value="${item.qty}" min="0" step="any">
			</div>`;
      if (this.custom_show_uom_in_cart) {
        item_html += `<div class="item-uom" style="flex:1">${item.uom || ""}</div>`;
      }
      if (this.show_batch_in_cart) {
        item_html += `<div class="item-batch" style="flex:1">${item.batch_no || ""}</div>`;
      }
      if (this.custom_edit_rate) {
        item_html += `<div class="item-rate" style="flex:1">
				<input type="number" class="form-control rate-input" value="${item.rate}" min="0" step="any">
			</div>`;
      }
      if (this.custom_use_discount_percentage) {
        item_html += `<div class="item-discount-perc" style="flex:1">
				<input type="number" class="form-control discount-perc-input" value="${item.discount_percentage || 0}" min="0" max="100" step="any">
			</div>`;
      }
      if (this.custom_use_discount_amount) {
        item_html += `<div class="item-discount-amount" style="flex:1">
				<input type="number" class="form-control discount-amount-input" value="${item.discount_amount || 0}" min="0" step="any">
			</div>`;
      }
      if (this.custom_show_incoming_rate) {
        item_html += `<div class="item-incoming-rate" style="flex:1">${item.incoming_rate || ""}</div>`;
      }
      if (this.custom_show_logical_rack_in_cart) {
        item_html += `<div class="item-rack" style="flex:1">${item.logical_rack || ""}</div>`;
      }
      if (this.custom_show_last_customer_rate) {
        item_html += `<div class="item-last-customer-rate" style="flex:1">${item.last_customer_rate || ""}</div>`;
      }
      item_html += `<div class="item-amount" style="flex:1;text-align: left">${format_currency(item.amount, this.currency)}</div>
			<div class="item-remove">
				<svg class="icon icon-sm">
					<use href="#icon-close"></use>
				</svg>
			</div>
		</div>`;
      return item_html;
    }
    bind_item_events() {
      let me = this;
      this.$cart_items_wrapper.find(".qty-input").on("change", function() {
        let $item = $(this).closest(".cart-item-wrapper");
        let idx = $item.data("idx");
        let new_qty = parseFloat($(this).val()) || 0;
        me.update_item_qty(idx, new_qty);
      });
      if (this.custom_edit_rate) {
        this.$cart_items_wrapper.find(".rate-input").on("change", function() {
          let $item = $(this).closest(".cart-item-wrapper");
          let idx = $item.data("idx");
          let new_rate = parseFloat($(this).val()) || 0;
          me.update_item_rate(idx, new_rate);
        });
      }
      if (this.custom_use_discount_percentage) {
        this.$cart_items_wrapper.find(".discount-perc-input").on("change", function() {
          let $item = $(this).closest(".cart-item-wrapper");
          let idx = $item.data("idx");
          let new_disc_perc = parseFloat($(this).val()) || 0;
          me.update_item_discount_percentage(idx, new_disc_perc);
        });
      }
      if (this.custom_use_discount_amount) {
        this.$cart_items_wrapper.find(".discount-amount-input").on("change", function() {
          let $item = $(this).closest(".cart-item-wrapper");
          let idx = $item.data("idx");
          let new_disc_amt = parseFloat($(this).val()) || 0;
          me.update_item_discount_amount(idx, new_disc_amt);
        });
      }
      this.$cart_items_wrapper.find(".item-remove").on("click", function() {
        let $item = $(this).closest(".cart-item-wrapper");
        let idx = $item.data("idx");
        me.remove_item(idx);
      });
    }
    get_discount_icon() {
      return `<svg class="discount-icon" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M19 15.6213C19 15.2235 19.158 14.842 19.4393 14.5607L20.9393 13.0607C21.5251 12.4749 21.5251 11.5251 20.9393 10.9393L19.4393 9.43934C19.158 9.15804 19 8.7765 19 8.37868V6.5C19 5.67157 18.3284 5 17.5 5H15.6213C15.2235 5 14.842 4.84196 14.5607 4.56066L13.0607 3.06066C12.4749 2.47487 11.5251 2.47487 10.9393 3.06066L9.43934 4.56066C9.15804 4.84196 8.7765 5 8.37868 5H6.5C5.67157 5 5 5.67157 5 6.5V8.37868C5 8.7765 4.84196 9.15804 4.56066 9.43934L3.06066 10.9393C2.47487 11.5251 2.47487 12.4749 3.06066 13.0607L4.56066 14.5607C4.84196 14.842 5 15.2235 5 15.6213V17.5C5 18.3284 5.67157 19 6.5 19H8.37868C8.7765 19 9.15804 19.158 9.43934 19.4393L10.9393 20.9393C11.5251 21.5251 12.4749 21.5251 13.0607 20.9393L14.5607 19.4393C14.842 19.158 15.2235 19 15.6213 19H17.5C18.3284 19 19 18.3284 19 17.5V15.6213Z" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M15 9L9 15" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M10.5 9.5C10.5 10.0523 10.0523 10.5 9.5 10.5C8.94772 10.5 8.5 10.0523 8.5 9.5C8.5 8.94772 8.94772 8.5 9.5 8.5C10.0523 8.5 10.5 8.94772 10.5 9.5Z" fill="white" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M15.5 14.5C15.5 15.0523 15.0523 15.5 14.5 15.5C13.9477 15.5 13.5 15.0523 13.5 14.5C13.5 13.9477 13.9477 13.5 14.5 13.5C15.0523 13.5 15.5 13.9477 15.5 14.5Z" fill="white" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`;
    }
    make_branch_section() {
      let me = this;
      let html = `<div class="branch-section">
			<div class="branch-label">${__("Branch")}</div>
			<div class="branch-field">
				<select class="form-control branch-select">
					<option value="">Select Branch</option>
				</select>
			</div>
		</div>`;
      this.$component.find(".cart-branch-section").html(html);
      this.$branch_select = this.$component.find(".branch-select");
      this.$branch_select.on("change", function() {
        me.branch = $(this).val();
        me.events.on_branch_change && me.events.on_branch_change(me.branch);
      });
      this.load_branches();
    }
    make_cart_totals_section() {
      this.$totals_section = this.$component.find(".cart-totals-section");
      this.$totals_section.append(
        `<div class="add-discount-wrapper">
            ${this.get_discount_icon()} ${__("Add Discount")}
        </div>
        <div class="item-qty-total-container">
            <div class="item-qty-total-label">${__("Total Items")}</div>
            <div class="item-qty-total-value">0.00</div>
        </div>
        <div class="net-total-container">
            <div class="net-total-label">${__("Net Total")}</div>
            <div class="net-total-value">0.00</div>
        </div>
        <div class="taxes-container"></div>
        <div class="grand-total-container">
            <div>${__("Grand Total")}</div>
            <div>0.00</div>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 10px;">
         ${!frappe.user_roles.includes("Waiter") ? `
                <div class="checkout-btn" style="
                    padding: 10px;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    flex: 1;">${__("Checkout")}</div>
            ` : ""}
            <div class="checkout-btn-held" style="
                padding: 10px;
                align-items: center;
                justify-content: center;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                flex: 1;">${__("Held")}</div>
            <div class="checkout-btn-order" style="
                padding: 10px;
                align-items: center;
                justify-content: center;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                flex: 1;">${__("Order List")}</div>
        </div>    
        <div class="edit-cart-btn">${__("Edit Cart")}</div>`
      );
      this.$add_discount_elem = this.$component.find(".add-discount-wrapper");
      this.highlight_checkout_btn(true);
    }
    load_branches() {
      let me = this;
      frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "Branch",
          fields: ["name", "branch"],
          limit_page_length: 0
        },
        callback: function(r) {
          if (r.message) {
            me.$branch_select.empty();
            me.$branch_select.append('<option value="">Select Branch</option>');
            r.message.forEach(function(branch) {
              me.$branch_select.append(`<option value="${branch.name}">${branch.branch}</option>`);
            });
          }
        }
      });
    }
    make_cart_numpad() {
      this.$numpad_section = this.$component.find(".numpad-section");
      this.number_pad = new posnext.PointOfSale.NumberPad({
        wrapper: this.$numpad_section,
        events: {
          numpad_event: this.on_numpad_event.bind(this)
        },
        cols: 5,
        keys: [
          [1, 2, 3, "Quantity"],
          [4, 5, 6, "Discount"],
          [7, 8, 9, "Rate"],
          [".", 0, "Delete", "Remove"]
        ],
        css_classes: [
          ["", "", "", "col-span-2"],
          ["", "", "", "col-span-2"],
          ["", "", "", "col-span-2"],
          ["", "", "", "col-span-2 remove-btn"]
        ],
        fieldnames_map: { "Quantity": "qty", "Discount": "discount_percentage" }
      });
      this.$numpad_section.prepend(
        `<div class="numpad-totals">
			<span class="numpad-item-qty-total"></span>
				<span class="numpad-net-total"></span>
				<span class="numpad-grand-total"></span>
			</div>`
      );
      this.$numpad_section.append(
        `<div class="numpad-btn checkout-btn" data-button-value="checkout">${__("Checkout")}</div>`
      );
    }
    update_item_qty(idx, new_qty) {
      let item = this.items[idx];
      if (item) {
        item.qty = new_qty;
        this.update_item_amount(idx);
        this.update_totals();
        this.update_cart_html();
      }
    }
    update_item_rate(idx, new_rate) {
      let item = this.items[idx];
      if (item) {
        item.rate = new_rate;
        this.update_item_amount(idx);
        this.update_totals();
        this.update_cart_html();
      }
    }
    update_item_discount_percentage(idx, new_disc_perc) {
      let item = this.items[idx];
      if (item) {
        item.discount_percentage = new_disc_perc;
        this.update_item_amount(idx);
        this.update_totals();
        this.update_cart_html();
      }
    }
    update_item_discount_amount(idx, new_disc_amt) {
      let item = this.items[idx];
      if (item) {
        item.discount_amount = new_disc_amt;
        this.update_item_amount(idx);
        this.update_totals();
        this.update_cart_html();
      }
    }
    remove_item(idx) {
      if (this.items[idx]) {
        this.items.splice(idx, 1);
        this.update_totals();
        this.update_cart_html();
      }
    }
    update_item_amount(idx) {
      let item = this.items[idx];
      if (item) {
        let discount_amount = item.discount_amount || 0;
        let discount_percentage = item.discount_percentage || 0;
        let discounted_rate = item.rate * (1 - discount_percentage / 100);
        item.amount = (discounted_rate - discount_amount) * item.qty;
      }
    }
    create_mobile_dialog(callback) {
      const me = this;
      let dialog = new frappe.ui.Dialog({
        title: __("Enter Mobile Number"),
        fields: [
          {
            label: __("Mobile Number"),
            fieldname: "mobile_number",
            fieldtype: "Data",
            reqd: 1,
            description: __("Enter 10-digit mobile number")
          },
          {
            label: "",
            fieldname: "mobile_number_numpad",
            fieldtype: "HTML",
            options: `<div class="mobile_number_numpad">
						<div class="custom-numpad">
							<style>
							.custom-numpad {
								display: grid;
								grid-template-columns: repeat(3, 1fr);
								gap: 8px;
								max-width: 320px;
								margin: 15px auto;
							}
							.numpad-button {
								padding: 12px;
								font-size: 16px;
								font-weight: bold;
								cursor: pointer;
								background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
								color: white;
								border: none;
								border-radius: 8px;
								text-align: center;
								transition: all 0.2s ease;
								box-shadow: 0 2px 4px rgba(0,0,0,0.1);
							}
							.numpad-button:hover {
								transform: translateY(-1px);
								box-shadow: 0 4px 8px rgba(0,0,0,0.2);
								background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
							}
							.numpad-button:active {
								transform: translateY(0);
								box-shadow: 0 2px 4px rgba(0,0,0,0.1);
							}
							.numpad-button.delete {
								background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
							}
							.numpad-button.delete:hover {
								background: linear-gradient(135deg, #ff5252 0%, #e74c3c 100%);
							}
							.numpad-button.clear {
								background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%);
							}
							.numpad-button.clear:hover {
								background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
							}
							.mobile-input-display {
								font-size: 18px;
								font-weight: bold;
								text-align: center;
								padding: 10px;
								margin-bottom: 15px;
								border: 2px solid #e0e0e0;
								border-radius: 8px;
								background: #f8f9fa;
								min-height: 40px;
								display: flex;
								align-items: center;
								justify-content: center;
							}
							.validation-message {
								text-align: center;
								margin-top: 10px;
								font-size: 14px;
								min-height: 20px;
							}
							.valid { color: #28a745; }
							.invalid { color: #dc3545; }
							</style>
							<div class="mobile-input-display" id="mobile-display">Enter mobile number</div>
							<div class="validation-message" id="validation-msg"></div>
							<button class="numpad-button one">1</button>
							<button class="numpad-button two">2</button>
							<button class="numpad-button three">3</button>
							<button class="numpad-button four">4</button>
							<button class="numpad-button five">5</button>
							<button class="numpad-button six">6</button>
							<button class="numpad-button seven">7</button>
							<button class="numpad-button eight">8</button>
							<button class="numpad-button nine">9</button>
							<button class="numpad-button delete">\u232B</button>
							<button class="numpad-button zero">0</button>
							<button class="numpad-button clear">C</button>
						</div>
					</div>`
          }
        ],
        size: "small",
        primary_action_label: __("Continue"),
        primary_action: function() {
          const mobile = dialog.get_value("mobile_number") || "";
          if (me.validate_mobile_number(mobile)) {
            callback();
          }
        }
      });
      const numpad = dialog.wrapper.find(".custom-numpad");
      const display = dialog.wrapper.find("#mobile-display");
      const validationMsg = dialog.wrapper.find("#validation-msg");
      const update_display = function(value) {
        display.text(value || "Enter mobile number");
        display.toggleClass("has-value", !!value);
        if (value) {
          const isValid = me.validate_mobile_number(value);
          display.toggleClass("valid", isValid);
          display.toggleClass("invalid", !isValid);
          validationMsg.toggleClass("valid", isValid);
          validationMsg.toggleClass("invalid", !isValid);
          validationMsg.text(isValid ? "\u2713 Valid mobile number" : value.length < 10 ? "Enter 10 digits" : "Invalid mobile number");
        } else {
          display.removeClass("valid invalid");
          validationMsg.removeClass("valid invalid");
          validationMsg.text("");
        }
      };
      const numbers = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "zero"];
      numbers.forEach((num) => {
        numpad.on("click", "." + num, function() {
          const current_value = dialog.get_value("mobile_number") || "";
          if (current_value.length < 10) {
            const new_value = current_value + $(this).text();
            dialog.set_value("mobile_number", new_value);
            update_display(new_value);
          }
          $(this).addClass("pressed");
          setTimeout(() => $(this).removeClass("pressed"), 100);
        });
      });
      numpad.on("click", ".clear", function() {
        dialog.set_value("mobile_number", "");
        update_display("");
        $(this).addClass("pressed");
        setTimeout(() => $(this).removeClass("pressed"), 100);
      });
      numpad.on("click", ".delete", function() {
        const current_value = dialog.get_value("mobile_number") || "";
        const new_value = current_value.slice(0, -1);
        dialog.set_value("mobile_number", new_value);
        update_display(new_value);
        $(this).addClass("pressed");
        setTimeout(() => $(this).removeClass("pressed"), 100);
      });
      dialog.wrapper.find('input[fieldname="mobile_number"]').on("input", function() {
        const value = $(this).val();
        update_display(value);
      });
      return dialog;
    }
    validate_mobile_number(mobile) {
      const mobileRegex = /^[6-9]\d{9}$/;
      return mobileRegex.test(mobile);
    }
    create_secret_dialog(callback) {
      let dialog = new frappe.ui.Dialog({
        title: "Enter Secret Key",
        fields: [
          {
            label: "Secret Key",
            fieldname: "secret_key",
            fieldtype: "Password",
            reqd: 1
          },
          {
            label: "",
            fieldname: "secret_key_numpad",
            fieldtype: "HTML",
            options: `<div class="secret_key_numpad">
						<div class="custom-numpad">
							<style>
							.custom-numpad {
								display: grid;
								grid-template-columns: repeat(3, 1fr);
								gap: 10px;
								max-width: 350px;
								margin: 0 auto;
							}
							.numpad-button {
								padding: 15px;
								font-size: 18px;
								cursor: pointer;
								background-color: #f1f1f1;
								border: 1px solid #ccc;
								border-radius: 5px;
								text-align: center;
							}
							.numpad-button:hover {
								background-color: #ddd;
							}
							</style>
							<button class="numpad-button one">1</button>
							<button class="numpad-button two">2</button>
							<button class="numpad-button three">3</button>
							<button class="numpad-button four">4</button>
							<button class="numpad-button five">5</button>
							<button class="numpad-button six">6</button>
							<button class="numpad-button seven">7</button>
							<button class="numpad-button eight">8</button>
							<button class="numpad-button nine">9</button>
							<button class="numpad-button delete" style="color: red">x</button>
							<button class="numpad-button zero">0</button>
							<button class="numpad-button clear">C</button>
						</div>
					</div>`
          }
        ],
        size: "small",
        primary_action_label: "Continue",
        primary_action: callback
      });
      const numpad = dialog.wrapper.find(".custom-numpad");
      const numbers = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "zero"];
      numbers.forEach((num) => {
        numpad.on("click", "." + num, function() {
          const current_value = dialog.get_value("secret_key") || "";
          dialog.set_value("secret_key", current_value + $(this).text());
        });
      });
      numpad.on("click", ".clear", () => dialog.set_value("secret_key", ""));
      numpad.on("click", ".delete", function() {
        const current_value = dialog.get_value("secret_key") || "";
        dialog.set_value("secret_key", current_value.slice(0, -1));
      });
      return dialog;
    }
    async create_customer_and_proceed(mobile_number, next_action) {
      const me = this;
      try {
        await frappe.call({
          method: "posnext.posnext.page.posnext.point_of_sale.create_customer",
          args: { customer: mobile_number },
          freeze: true,
          freeze_message: "Processing..."
        });
        const frm = me.events.get_frm();
        frappe.model.set_value(frm.doc.doctype, frm.doc.name, "customer", mobile_number);
        await frm.script_manager.trigger("customer", frm.doc.doctype, frm.doc.name);
        await me.fetch_customer_details(mobile_number);
        me.events.customer_details_updated(me.customer_info);
        me.update_customer_section();
        if (next_action)
          await next_action(mobile_number);
      } catch (error) {
        frappe.show_alert({ message: __("Failed to process customer"), indicator: "red" });
        throw error;
      }
    }
    bind_events() {
      const me = this;
      this.$customer_section.on("click", ".reset-customer-btn", function() {
        me.reset_customer_selector();
      });
      this.$customer_section.on("click", ".close-details-btn", function() {
        me.toggle_customer_info(false);
      });
      this.$customer_section.on("click", ".customer-display", function(e) {
        if ($(e.target).closest(".reset-customer-btn").length)
          return;
        const show = me.$cart_container.is(":visible");
        me.toggle_customer_info(show);
      });
      this.$cart_items_wrapper.on("click", ".cart-item-wrapper", function() {
        const $cart_item = $(this);
        me.toggle_item_highlight(this);
        const payment_section_hidden = !me.$totals_section.find(".edit-cart-btn").is(":visible");
        if (!payment_section_hidden) {
          me.$totals_section.find(".edit-cart-btn").click();
        }
        const item_row_name = unescape($cart_item.attr("data-row-name"));
        me.events.cart_item_clicked({ name: item_row_name });
        this.numpad_value = "";
      });
      this.$component.on("click", ".checkout-btn:not(.checkout-btn-held):not(.checkout-btn-order)", async function() {
        if ($(this).attr("style").indexOf("--blue-500") == -1)
          return;
        console.log("Checkout button clicked");
        try {
          if (!cur_frm.doc.customer && me.mobile_number_based_customer) {
            const dialog = me.create_mobile_dialog(async function(values) {
              if (values["mobile_number"].length !== me.settings.custom_mobile_number_length) {
                frappe.throw("Mobile Number Length is " + me.settings.custom_mobile_number_length.toString());
                return;
              }
              try {
                await me.create_customer_and_proceed(values["mobile_number"]);
                await me.events.checkout();
                me.toggle_checkout_btn(false);
                me.allow_discount_change && me.$add_discount_elem.removeClass("d-none");
                dialog.hide();
              } catch (error) {
                console.error("Error in mobile dialog checkout:", error);
              }
            });
            dialog.show();
          } else {
            if (!cur_frm.doc.customer && !me.mobile_number_based_customer) {
              frappe.throw("Please Select a customer and add items first");
              return;
            }
            await me.events.checkout();
            me.toggle_checkout_btn(false);
            me.allow_discount_change && me.$add_discount_elem.removeClass("d-none");
          }
        } catch (error) {
          console.error("Error in checkout:", error);
          frappe.msgprint(__("Error during checkout. Please try again."));
        }
      });
      this.$component.on("click", ".checkout-btn-held", function() {
        if ($(this).attr("style").indexOf("--blue-500") == -1)
          return;
        if (!cur_frm.doc.items.length) {
          frappe.throw("Cannot save empty invoice");
          return;
        }
        console.log("Hold button clicked");
        const show_secret_key_popup = (mobile_number = null) => {
          const secret_dialog = me.create_secret_dialog(function(values) {
            const frm = me.events.get_frm();
            const invoice_name = frm.doc.name;
            frm.doc.created_by_name = frm.doc.created_by_name || frappe.session.user;
            console.log("Setting created_by_name before hold:", frm.doc.created_by_name);
            if (!me.events.save_draft_invoice) {
              console.error("save_draft_invoice is undefined");
              frappe.show_alert({
                message: __("Save draft invoice function is not available. Please check POS configuration."),
                indicator: "red"
              });
              secret_dialog.hide();
              return;
            }
            if (invoice_name && !frm.doc.__islocal) {
              frappe.call({
                method: "posnext.posnext.page.posnext.point_of_sale.check_edit_permission",
                args: {
                  invoice_name,
                  secret_key: values["secret_key"]
                },
                freeze: true,
                freeze_message: "Validating Secret Key...",
                callback: function(r) {
                  if (r.message.can_edit) {
                    frappe.model.set_value(frm.doc.doctype, frm.doc.name, "created_by_name", r.message.created_by_name || frappe.session.user);
                    frm.script_manager.trigger("created_by_name", frm.doc.doctype, frm.doc.name).then(() => {
                      console.log("Calling save_draft_invoice for existing invoice:", invoice_name);
                      me.events.save_draft_invoice().then((result) => {
                        const saved_invoice_name = result.invoice_name || frm.doc.name;
                        const creator_name = result.created_by_name || r.message.created_by_name || frappe.session.user;
                        console.log("Hold successful, invoice:", saved_invoice_name, "creator:", creator_name);
                        me.handle_successful_hold(saved_invoice_name, creator_name);
                      }).catch((error) => {
                        console.error("Error saving draft invoice (existing):", error);
                        frappe.show_alert({
                          message: __("Failed to save draft invoice: {0}", [error.message]),
                          indicator: "red"
                        });
                      });
                    }).catch((error) => {
                      console.error("Error triggering created_by_name (existing):", error);
                    });
                    secret_dialog.hide();
                  } else {
                    frappe.show_alert({
                      message: __(`You did not create this invoice, hence you cannot edit it. Only the creator (${r.message.created_by_name}) can edit it.`),
                      indicator: "red"
                    });
                    secret_dialog.hide();
                  }
                },
                error: (xhr, status, error) => {
                  console.error("Error validating secret key (existing):", error);
                  frappe.show_alert({
                    message: __("Failed to validate secret key. Please try again or contact support."),
                    indicator: "red"
                  });
                  secret_dialog.hide();
                }
              });
            } else {
              frappe.call({
                method: "posnext.posnext.page.posnext.point_of_sale.get_user_name_from_secret_key",
                args: {
                  secret_key: values["secret_key"]
                },
                freeze_message: "Validating Secret Key...",
                callback: function(r) {
                  if (r.message) {
                    const created_by_name = r.message;
                    frappe.model.set_value(frm.doc.doctype, frm.doc.name, "created_by_name", created_by_name);
                    frm.script_manager.trigger("created_by_name", frm.doc.doctype, frm.doc.name).then(() => {
                      console.log("Calling save_draft_invoice for new invoice:", frm.doc.name);
                      me.events.save_draft_invoice().then((result) => {
                        const saved_invoice_name = result.invoice_name || frm.doc.name;
                        console.log("Hold successful, invoice:", saved_invoice_name, "creator:", created_by_name);
                        me.handle_successful_hold(saved_invoice_name, created_by_name);
                      }).catch((error) => {
                        console.error("Error saving draft invoice (new):", error);
                        frappe.show_alert({
                          message: __("Failed to save draft invoice: {0}", [error.message]),
                          indicator: "red"
                        });
                      });
                    }).catch((error) => {
                      console.error("Error triggering created_by_name (new):", error);
                    });
                    secret_dialog.hide();
                  } else {
                    frappe.show_alert({
                      message: __("Invalid secret key"),
                      indicator: "red"
                    });
                    secret_dialog.hide();
                  }
                },
                error: (xhr, status, error) => {
                  console.error("Error validating secret key (new):", error);
                  frappe.show_alert({
                    message: __("Failed to validate secret key. Please try again or contact support."),
                    indicator: "red"
                  });
                  secret_dialog.hide();
                }
              });
            }
          });
          secret_dialog.show();
        };
        if (!cur_frm.doc.customer && me.mobile_number_based_customer) {
          const mobile_dialog = me.create_mobile_dialog(function(values) {
            if (values["mobile_number"].length !== me.settings.custom_mobile_number_length) {
              frappe.throw("Mobile Number Length is " + me.settings.custom_mobile_number_length.toString());
              return;
            }
            frappe.call({
              method: "posnext.posnext.page.posnext.point_of_sale.create_customer",
              args: {
                customer: values["mobile_number"]
              },
              freeze: true,
              freeze_message: "Creating Customer....",
              callback: function() {
                const frm = me.events.get_frm();
                frappe.model.set_value(frm.doc.doctype, frm.doc.name, "customer", values["mobile_number"]);
                frm.script_manager.trigger("customer", frm.doc.doctype, frm.doc.name).then(() => {
                  frappe.run_serially([
                    () => me.fetch_customer_details(values["mobile_number"]),
                    () => me.events.customer_details_updated(me.customer_info),
                    () => me.update_customer_section(),
                    () => show_secret_key_popup(values["mobile_number"])
                  ]);
                });
                mobile_dialog.hide();
              }
            });
          });
          mobile_dialog.show();
        } else {
          if (!cur_frm.doc.customer && !me.mobile_number_based_customer) {
            frappe.throw("Please select a customer before holding the invoice");
            return;
          }
          show_secret_key_popup();
        }
      });
      this.$component.on("click", ".checkout-btn-order", () => {
        me.events.toggle_recent_order();
      });
      this.$totals_section.on("click", ".edit-cart-btn", () => {
        me.events.edit_cart();
        me.toggle_checkout_btn(true);
      });
      this.$component.on("click", ".add-discount-wrapper", () => {
        const can_edit_discount = this.$add_discount_elem.find(".edit-discount-btn").length;
        if (!this.discount_field || can_edit_discount)
          this.show_discount_control();
      });
      frappe.ui.form.on("Sales Invoice", "paid_amount", (frm) => {
        this.update_totals_section(frm);
      });
    }
    async handle_successful_hold(invoice_name, creator_name) {
      console.log("Handling successful hold:", invoice_name, creator_name);
      try {
        await this.events.show_recent_order_list();
        if (posnext.PointOfSale.PastOrderList.current_instance) {
          await posnext.PointOfSale.PastOrderList.current_instance.set_filter_and_refresh_with_held_invoice(creator_name, invoice_name);
          if (posnext.PointOfSale.PastOrderSummary.current_instance) {
            await frappe.db.get_doc("Sales Invoice", invoice_name).then((doc) => {
              posnext.PointOfSale.PastOrderSummary.current_instance.load_summary_of(doc);
            });
          }
        } else {
          console.warn("PastOrderList not initialized");
          frappe.show_alert({
            message: __("Recent order list is not available. Please refresh the page."),
            indicator: "orange"
          });
        }
        await this.reset_cart_state(true);
      } catch (error) {
        console.error("Error in handle_successful_hold:", error);
        frappe.show_alert({
          message: __("Failed to show the held invoice in the orders list: {0}", [error.message]),
          indicator: "red"
        });
        frappe.utils.play_sound("error");
      }
    }
    reset_cart_state(from_held = false) {
      this.$cart_items_wrapper.html("");
      this.update_totals_section();
      this.toggle_checkout_btn(true);
      this.toggle_numpad(false);
      this.events.load_new_invoice(from_held);
    }
    attach_shortcuts() {
      for (let row of this.number_pad.keys) {
        for (let btn of row) {
          if (typeof btn !== "string")
            continue;
          let shortcut_key = `ctrl+${frappe.scrub(String(btn))[0]}`;
          if (btn === "Delete")
            shortcut_key = "ctrl+backspace";
          if (btn === "Remove")
            shortcut_key = "shift+ctrl+backspace";
          if (btn === ".")
            shortcut_key = "ctrl+>";
          const fieldname = this.number_pad.fieldnames[btn] ? this.number_pad.fieldnames[btn] : typeof btn === "string" ? frappe.scrub(btn) : btn;
          let shortcut_label = shortcut_key.split("+").map(frappe.utils.to_title_case).join("+");
          shortcut_label = frappe.utils.is_mac() ? shortcut_label.replace("Ctrl", "\u2318") : shortcut_label;
          this.$numpad_section.find(`.numpad-btn[data-button-value="${fieldname}"]`).attr("title", shortcut_label);
          frappe.ui.keys.on(`${shortcut_key}`, () => {
            const cart_is_visible = this.$component.is(":visible");
            if (cart_is_visible && this.item_is_selected && this.$numpad_section.is(":visible")) {
              this.$numpad_section.find(`.numpad-btn[data-button-value="${fieldname}"]`).click();
            }
          });
        }
      }
      const ctrl_label = frappe.utils.is_mac() ? "\u2318" : "Ctrl";
      this.$component.find(".checkout-btn").attr("title", `${ctrl_label}+Enter`);
      frappe.ui.keys.add_shortcut({
        shortcut: "ctrl+enter",
        action: () => this.$component.find(".checkout-btn").click(),
        condition: () => this.$component.is(":visible") && !this.$totals_section.find(".edit-cart-btn").is(":visible"),
        description: __("Checkout Order / Submit Order / New Order"),
        ignore_inputs: true,
        page: cur_page.page.page
      });
      this.$component.find(".edit-cart-btn").attr("title", `${ctrl_label}+E`);
      frappe.ui.keys.on("ctrl+e", () => {
        const item_cart_visible = this.$component.is(":visible");
        const checkout_btn_invisible = !this.$totals_section.find(".checkout-btn").is("visible");
        if (item_cart_visible && checkout_btn_invisible) {
          this.$component.find(".edit-cart-btn").click();
        }
      });
      this.$component.find(".add-discount-wrapper").attr("title", `${ctrl_label}+D`);
      frappe.ui.keys.add_shortcut({
        shortcut: "ctrl+d",
        action: () => this.$component.find(".add-discount-wrapper").click(),
        condition: () => this.$add_discount_elem.is(":visible"),
        description: __("Add Order Discount"),
        ignore_inputs: true,
        page: cur_page.page.page
      });
      frappe.ui.keys.on("escape", () => {
        const item_cart_visible = this.$component.is(":visible");
        if (item_cart_visible && this.discount_field && this.discount_field.parent.is(":visible")) {
          this.discount_field.set_value(0);
        }
      });
    }
    toggle_item_highlight(item) {
      const $cart_item = $(item);
      const item_is_highlighted = $cart_item.attr("style") == "background-color:var(--gray-50);";
      if (!item || item_is_highlighted) {
        this.item_is_selected = false;
        this.$cart_container.find(".cart-item-wrapper").css("background-color", "");
      } else {
        $cart_item.css("background-color", "var(--control-bg)");
        this.item_is_selected = true;
        this.$cart_container.find(".cart-item-wrapper").not(item).css("background-color", "");
      }
    }
    make_customer_selector() {
      this.$customer_section.html(`
        <div class="customer-field"></div>
    `);
      const me = this;
      const query = { query: "posnext.controllers.queries.customer_query" };
      const allowed_customer_group = this.allowed_customer_groups || [];
      if (allowed_customer_group.length) {
        query.filters = {
          customer_group: ["in", allowed_customer_group]
        };
      }
      this.customer_field = frappe.ui.form.make_control({
        df: {
          label: __("Customer"),
          fieldtype: "Link",
          options: "Customer",
          placeholder: __("Search by customer name, phone, email."),
          read_only: this.mobile_number_based_customer,
          get_query: () => query,
          onchange: function() {
            if (this.value) {
              const frm = me.events.get_frm();
              frappe.dom.freeze();
              frappe.model.set_value(frm.doc.doctype, frm.doc.name, "customer", this.value);
              frm.script_manager.trigger("customer", frm.doc.doctype, frm.doc.name).then(() => {
                frappe.run_serially([
                  () => me.fetch_customer_details(this.value),
                  () => me.events.customer_details_updated(me.customer_info),
                  () => me.update_customer_section(),
                  () => me.update_totals_section(),
                  () => frappe.dom.unfreeze()
                ]);
              });
            }
          }
        },
        parent: this.$customer_section.find(".customer-field"),
        render_input: true
      });
      this.customer_field.toggle_label(false);
    }
    fetch_customer_details(customer) {
      if (customer) {
        return new Promise((resolve) => {
          frappe.db.get_value("Customer", customer, ["email_id", "mobile_no", "image", "loyalty_program"]).then(({ message }) => {
            const { loyalty_program } = message;
            if (loyalty_program) {
              frappe.call({
                method: "erpnext.accounts.doctype.loyalty_program.loyalty_program.get_loyalty_program_details_with_points",
                args: { customer, loyalty_program, "silent": true },
                callback: (r) => {
                  const { loyalty_points, conversion_factor } = r.message;
                  if (!r.exc) {
                    this.customer_info = __spreadProps(__spreadValues({}, message), { customer, loyalty_points, conversion_factor });
                    resolve();
                  }
                }
              });
            } else {
              this.customer_info = __spreadProps(__spreadValues({}, message), { customer });
              resolve();
            }
          });
        });
      } else {
        return new Promise((resolve) => {
          this.customer_info = {};
          resolve();
        });
      }
    }
    show_discount_control() {
      this.$add_discount_elem.css({ "padding": "0px", "border": "none" });
      this.$add_discount_elem.html(
        `<div class="add-discount-field"></div>`
      );
      const me = this;
      const frm = me.events.get_frm();
      let discount = frm.doc.additional_discount_percentage;
      this.discount_field = frappe.ui.form.make_control({
        df: {
          label: __("Discount"),
          fieldtype: "Data",
          placeholder: discount ? discount + "%" : __("Enter discount percentage."),
          input_class: "input-xs",
          onchange: function() {
            if (flt(this.value) != 0) {
              frappe.model.set_value(frm.doc.doctype, frm.doc.name, "additional_discount_percentage", flt(this.value));
              me.hide_discount_control(this.value);
            } else {
              frappe.model.set_value(frm.doc.doctype, frm.doc.name, "additional_discount_percentage", 0);
              me.$add_discount_elem.css({
                "border": "1px dashed var(--gray-500)",
                "padding": "var(--padding-sm) var(--padding-md)"
              });
              me.$add_discount_elem.html(`${me.get_discount_icon()} ${__("Add Discount")}`);
              me.discount_field = void 0;
            }
          }
        },
        parent: this.$add_discount_elem.find(".add-discount-field"),
        render_input: true
      });
      this.discount_field.toggle_label(false);
      this.discount_field.set_focus();
    }
    hide_discount_control(discount) {
      if (!discount) {
        this.$add_discount_elem.css({ "padding": "0px", "border": "none" });
        this.$add_discount_elem.html(
          `<div class="add-discount-field"></div>`
        );
      } else {
        this.$add_discount_elem.css({
          "border": "1px dashed var(--dark-green-500)",
          "padding": "var(--padding-sm) var(--padding-md)"
        });
        this.$add_discount_elem.html(
          `<div class="edit-discount-btn">
					${this.get_discount_icon()} ${__("Additional")}&nbsp;${String(discount).bold()}% ${__("discount applied")}
				</div>`
        );
      }
    }
    update_customer_section() {
      const me = this;
      const { customer, email_id = "", mobile_no = "", image } = this.customer_info || {};
      if (customer) {
        this.$customer_section.html(
          `<div class="customer-details">
					<div class="customer-display">
						${this.get_customer_image()}
						<div class="customer-name-desc">
							<div class="customer-name">${customer}</div>
							${get_customer_description()}
						</div>
						<div class="reset-customer-btn" data-customer="${escape(customer)}">
							<svg width="32" height="32" viewBox="0 0 14 14" fill="none">
								<path d="M4.93764 4.93759L7.00003 6.99998M9.06243 9.06238L7.00003 6.99998M7.00003 6.99998L4.93764 9.06238L9.06243 4.93759" stroke="#8D99A6"/>
							</svg>
						</div>
					</div>
				</div>`
        );
        if (this.mobile_number_based_customer) {
          this.$customer_section.find(".reset-customer-btn").css("display", "none");
        } else {
          this.$customer_section.find(".reset-customer-btn").css("display", "flex");
        }
      } else {
        this.reset_customer_selector();
      }
      function get_customer_description() {
        if (!email_id && !mobile_no) {
          return `<div class="customer-desc">${__("Click to add email / phone")}</div>`;
        } else if (email_id && !mobile_no) {
          return `<div class="customer-desc">${email_id}</div>`;
        } else if (mobile_no && !email_id) {
          return `<div class="customer-desc">${mobile_no}</div>`;
        } else {
          return `<div class="customer-desc">${email_id} - ${mobile_no}</div>`;
        }
      }
    }
    get_customer_image() {
      const { customer, image } = this.customer_info || {};
      if (image) {
        return `<div class="customer-image"><img src="${image}" alt="${image}""></div>`;
      } else {
        return `<div class="customer-image customer-abbr">${frappe.get_abbr(customer)}</div>`;
      }
    }
    update_totals_section(frm) {
      if (!frm)
        frm = this.events.get_frm();
      this.render_net_total(frm.doc.net_total);
      this.render_total_item_qty(frm.doc.items);
      const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? frm.doc.grand_total : frm.doc.rounded_total;
      this.render_grand_total(grand_total);
      this.render_taxes(frm.doc.taxes);
    }
    render_net_total(value) {
      const currency = this.events.get_frm().doc.currency;
      this.$totals_section.find(".net-total-container").html(
        `<div>${__("Net Total")}</div><div>${format_currency(value, currency)}</div>`
      );
      this.$numpad_section.find(".numpad-net-total").html(
        `<div>${__("Net Total")}: <span>${format_currency(value, currency)}</span></div>`
      );
    }
    render_total_item_qty(items) {
      var total_item_qty = 0;
      items.map((item) => {
        total_item_qty = total_item_qty + item.qty;
      });
      this.$totals_section.find(".item-qty-total-container").html(
        `<div>${__("Total Quantity")}</div><div>${total_item_qty}</div>`
      );
      this.$numpad_section.find(".numpad-item-qty-total").html(
        `<div>${__("Total Quantity")}: <span>${total_item_qty}</span></div>`
      );
    }
    render_grand_total(value) {
      const currency = this.events.get_frm().doc.currency;
      this.$totals_section.find(".grand-total-container").html(
        `<div>${__("Grand Total")}</div><div>${format_currency(value, currency)}</div>`
      );
      this.$numpad_section.find(".numpad-grand-total").html(
        `<div>${__("Grand Total")}: <span>${format_currency(value, currency)}</span></div>`
      );
    }
    render_taxes(taxes) {
      if (taxes && taxes.length) {
        const currency = this.events.get_frm().doc.currency;
        const taxes_html = taxes.map((t) => {
          if (t.tax_amount_after_discount_amount == 0)
            return;
          const description = /[0-9]+/.test(t.description) ? t.description : t.rate != 0 ? `${t.description} @ ${t.rate}%` : t.description;
          return `<div class="tax-row">
					<div class="tax-label">${description}</div>
					<div class="tax-value">${format_currency(t.tax_amount_after_discount_amount, currency)}</div>
				</div>`;
        }).join("");
        this.$totals_section.find(".taxes-container").css("display", "flex").html(taxes_html);
      } else {
        this.$totals_section.find(".taxes-container").css("display", "none").html("");
      }
    }
    get_cart_item({ name }) {
      const item_selector = `.cart-item-wrapper[data-row-name="${escape(name)}"]`;
      return this.$cart_items_wrapper.find(item_selector);
    }
    get_item_from_frm(item) {
      const doc = this.events.get_frm().doc;
      return doc.items.find((i) => i.name == item.name);
    }
    update_item_html(item, remove_item) {
      const $item = this.get_cart_item(item);
      if (remove_item) {
        $item && $item.next().remove() && $item.remove();
      } else {
        const item_row = this.get_item_from_frm(item);
        this.render_cart_item(item_row, $item);
      }
      const no_of_cart_items = this.$cart_items_wrapper.find(".cart-item-wrapper").length;
      this.highlight_checkout_btn(true);
      this.update_empty_cart_section(no_of_cart_items);
    }
    render_cart_item(item_data, $item_to_update) {
      const currency = this.events.get_frm().doc.currency;
      const me = this;
      if (!$item_to_update.length) {
        this.$cart_items_wrapper.append(
          `<div class="cart-item-wrapper" data-row-name="${escape(item_data.name)}"></div>
				<div class="seperator"></div>`
        );
        $item_to_update = this.get_cart_item(item_data);
      }
      $item_to_update.html(
        `${get_item_image_html()}
			<div class="item-name-desc">
				<div class="item-name">
					${item_data.item_name}
				</div>
				${get_description_html()}
			</div>
			${get_rate_discount_html()}`
      );
      set_dynamic_rate_header_width();
      function set_dynamic_rate_header_width() {
        const rate_cols = Array.from(me.$cart_items_wrapper.find(".item-rate-amount"));
        me.$cart_header.find(".rate-amount-header").css("width", "");
        me.$cart_items_wrapper.find(".item-rate-amount").css("width", "");
        let max_width = rate_cols.reduce((max_width2, elm) => {
          if ($(elm).width() > max_width2)
            max_width2 = $(elm).width();
          return max_width2;
        }, 0);
        max_width += 1;
        if (max_width == 1)
          max_width = "";
        me.$cart_header.find(".rate-amount-header").css("width", max_width);
        me.$cart_items_wrapper.find(".item-rate-amount").css("width", max_width);
      }
      function get_rate_discount_html() {
        if (item_data.rate && item_data.amount && item_data.rate !== item_data.amount) {
          return `
					<div class="item-qty-rate">
						<div class="item-qty"><span>${item_data.qty || 0} ${item_data.uom}</span></div>
						<div class="item-rate-amount">
							<div class="item-rate">${format_currency(item_data.amount, currency)}</div>
							<div class="item-amount">${format_currency(item_data.rate, currency)}</div>
						</div>
					</div>`;
        } else {
          return `
					<div class="item-qty-rate">
						<div class="item-qty"><span>${item_data.qty || 0} ${item_data.uom}</span></div>
						<div class="item-rate-amount">
							<div class="item-rate">${format_currency(item_data.rate, currency)}</div>
						</div>
					</div>`;
        }
      }
      function get_description_html() {
        if (item_data.description) {
          if (item_data.description.indexOf("<div>") != -1) {
            try {
              item_data.description = $(item_data.description).text();
            } catch (error) {
              item_data.description = item_data.description.replace(/<div>/g, " ").replace(/<\/div>/g, " ").replace(/ +/g, " ");
            }
          }
          item_data.description = frappe.ellipsis(item_data.description, 45);
          return `<div class="item-desc">${item_data.description}</div>`;
        }
        return ``;
      }
      function get_item_image_html() {
        const { image, item_name } = item_data;
        if (!me.hide_images && image) {
          return `
					<div class="item-image">
						<img
							onerror="cur_pos.cart.handle_broken_image(this)"
							src="${image}" alt="${frappe.get_abbr(item_name)}"">
					</div>`;
        } else {
          return `<div class="item-image item-abbr">${frappe.get_abbr(item_name)}</div>`;
        }
      }
    }
    handle_broken_image($img) {
      const item_abbr = $($img).attr("alt");
      $($img).parent().replaceWith(`<div class="item-image item-abbr">${item_abbr}</div>`);
    }
    update_selector_value_in_cart_item(selector, value, item) {
      const $item_to_update = this.get_cart_item(item);
      $item_to_update.attr(`data-${selector}`, escape(value));
    }
    toggle_checkout_btn(show_checkout) {
      if (show_checkout) {
        if (this.show_checkout_button) {
          this.$totals_section.find(".checkout-btn").css("display", "flex");
        } else {
          this.$totals_section.find(".checkout-btn").css("display", "none");
        }
        if (this.show_held_button) {
          this.$totals_section.find(".checkout-btn-held").css("display", "flex");
        } else {
          this.$totals_section.find(".checkout-btn-held").css("display", "none");
        }
        if (this.show_order_list_button) {
          this.$totals_section.find(".checkout-btn-order").css("display", "flex");
        } else {
          this.$totals_section.find(".checkout-btn-order").css("display", "none");
        }
        this.$totals_section.find(".edit-cart-btn").css("display", "none");
      } else {
        this.$totals_section.find(".checkout-btn").css("display", "none");
        this.$totals_section.find(".checkout-btn-held").css("display", "none");
        this.$totals_section.find(".checkout-btn-held").css("display", "none");
        this.$totals_section.find(".checkout-btn-order").css("display", "none");
        this.$totals_section.find(".edit-cart-btn").css("display", "flex");
      }
    }
    highlight_checkout_btn(toggle) {
      if (toggle) {
        this.$add_discount_elem.css("display", "flex");
        this.$cart_container.find(".checkout-btn").css({
          "background-color": "var(--blue-500)"
        });
        if (this.show_held_button) {
          this.$cart_container.find(".checkout-btn-held").css({
            "background-color": "var(--blue-500)"
          });
        } else {
          this.$cart_container.find(".checkout-btn-held").css({
            "background-color": "var(--blue-200)"
          });
        }
        if (this.show_order_list_button) {
          this.$cart_container.find(".checkout-btn-order").css({
            "background-color": "var(--blue-500)"
          });
        } else {
          this.$cart_container.find(".checkout-btn-order").css({
            "background-color": "var(--blue-500)"
          });
        }
      } else {
        this.$add_discount_elem.css("display", "none");
        this.$cart_container.find(".checkout-btn").css({
          "background-color": "var(--blue-200)"
        });
        this.$cart_container.find(".checkout-btn-held").css({
          "background-color": "var(--blue-200)"
        });
        this.$cart_container.find(".checkout-btn-order").css({
          "background-color": "var(--blue-500)"
        });
      }
    }
    update_empty_cart_section(no_of_cart_items) {
      const $no_item_element = this.$cart_items_wrapper.find(".no-item-wrapper");
      no_of_cart_items > 0 && $no_item_element && $no_item_element.remove() && this.$cart_header.css("display", "flex");
      no_of_cart_items === 0 && !$no_item_element.length && this.make_no_items_placeholder();
    }
    on_numpad_event($btn) {
      const current_action = $btn.attr("data-button-value");
      const action_is_field_edit = ["qty", "discount_percentage", "rate"].includes(current_action);
      const action_is_allowed = action_is_field_edit ? current_action == "rate" && this.allow_rate_change || current_action == "discount_percentage" && this.allow_discount_change || current_action == "qty" : true;
      const action_is_pressed_twice = this.prev_action === current_action;
      const first_click_event = !this.prev_action;
      const field_to_edit_changed = this.prev_action && this.prev_action != current_action;
      if (action_is_field_edit) {
        if (!action_is_allowed) {
          const label = current_action == "rate" ? "Rate".bold() : "Discount".bold();
          const message = __("Editing {0} is not allowed as per POS Profile settings", [label]);
          frappe.show_alert({
            indicator: "red",
            message
          });
          frappe.utils.play_sound("error");
          return;
        }
        if (first_click_event || field_to_edit_changed) {
          this.prev_action = current_action;
        } else if (action_is_pressed_twice) {
          this.prev_action = void 0;
        }
        this.numpad_value = "";
      } else if (current_action === "checkout") {
        this.prev_action = void 0;
        this.toggle_item_highlight();
        this.events.numpad_event(void 0, current_action);
        return;
      } else if (current_action === "remove") {
        this.prev_action = void 0;
        this.toggle_item_highlight();
        this.events.numpad_event(void 0, current_action);
        return;
      } else {
        this.numpad_value = current_action === "delete" ? this.numpad_value.slice(0, -1) : this.numpad_value + current_action;
        this.numpad_value = this.numpad_value || 0;
      }
      const first_click_event_is_not_field_edit = !action_is_field_edit && first_click_event;
      if (first_click_event_is_not_field_edit) {
        frappe.show_alert({
          indicator: "red",
          message: __("Please select a field to edit from numpad")
        });
        frappe.utils.play_sound("error");
        return;
      }
      if (flt(this.numpad_value) > 100 && this.prev_action === "discount_percentage") {
        frappe.show_alert({
          message: __("Discount cannot be greater than 100%"),
          indicator: "orange"
        });
        frappe.utils.play_sound("error");
        this.numpad_value = current_action;
      }
      this.highlight_numpad_btn($btn, current_action);
      this.events.numpad_event(this.numpad_value, this.prev_action);
    }
    highlight_numpad_btn($btn, curr_action) {
      const curr_action_is_highlighted = $btn.hasClass("highlighted-numpad-btn");
      const curr_action_is_action = ["qty", "discount_percentage", "rate", "done"].includes(curr_action);
      if (!curr_action_is_highlighted) {
        $btn.addClass("highlighted-numpad-btn");
      }
      if (this.prev_action === curr_action && curr_action_is_highlighted) {
        $btn.removeClass("highlighted-numpad-btn");
      }
      if (this.prev_action && this.prev_action !== curr_action && curr_action_is_action) {
        const prev_btn = $(`[data-button-value='${this.prev_action}']`);
        prev_btn.removeClass("highlighted-numpad-btn");
      }
      if (!curr_action_is_action || curr_action === "done") {
        setTimeout(() => {
          $btn.removeClass("highlighted-numpad-btn");
        }, 200);
      }
    }
    toggle_numpad(show) {
      if (show) {
        this.$totals_section.css("display", "none");
        this.$numpad_section.css("display", "flex");
      } else {
        this.$totals_section.css("display", "flex");
        this.$numpad_section.css("display", "none");
      }
      this.reset_numpad();
    }
    reset_numpad() {
      this.numpad_value = "";
      this.prev_action = void 0;
      this.$numpad_section.find(".highlighted-numpad-btn").removeClass("highlighted-numpad-btn");
    }
    toggle_numpad_field_edit(fieldname) {
      if (["qty", "discount_percentage", "rate"].includes(fieldname)) {
        this.$numpad_section.find(`[data-button-value="${fieldname}"]`).click();
      }
    }
    toggle_customer_info(show) {
      if (show) {
        const { customer } = this.customer_info || {};
        this.$cart_container.css("display", "none");
        this.$customer_section.css({
          "height": "100%",
          "padding-top": "0px"
        });
        this.$customer_section.find(".customer-details").html(
          `<div class="header">
					<div class="label">Contact Details</div>
					<div class="close-details-btn">
						<svg width="32" height="32" viewBox="0 0 14 14" fill="none">
							<path d="M4.93764 4.93759L7.00003 6.99998M9.06243 9.06238L7.00003 6.99998M7.00003 6.99998L4.93764 9.06238L9.06243 4.93759" stroke="#8D99A6"/>
						</svg>
					</div>
				</div>
				<div class="customer-display">
					${this.get_customer_image()}
					<div class="customer-name-desc">
						<div class="customer-name">${customer}</div>
						<div class="customer-desc"></div>
					</div>
				</div>
				<div class="customer-fields-container">
					<div class="email_id-field"></div>
					<div class="mobile_no-field"></div>
					<div class="loyalty_program-field"></div>
					<div class="loyalty_points-field"></div>
				</div>
				<div class="transactions-label">Recent Transactions</div>`
        );
        this.$customer_section.append(`<div class="customer-transactions"></div>`);
        if (this.mobile_number_based_customer) {
          this.$customer_section.find(".mobile_no-field").css("display", "none");
          this.$customer_section.find(".close-details-btn").css("display", "none");
        } else {
          this.$customer_section.find(".mobile_no-field").css("display", "flex");
          this.$customer_section.find(".close-details-btn").css("display", "flex");
        }
        this.render_customer_fields();
        this.fetch_customer_transactions();
      } else {
        this.$cart_container.css("display", "flex");
        this.$customer_section.css({
          "height": "",
          "padding-top": ""
        });
        this.update_customer_section();
      }
    }
    render_customer_fields() {
      const $customer_form = this.$customer_section.find(".customer-fields-container");
      const dfs = [{
        fieldname: "email_id",
        label: __("Email"),
        fieldtype: "Data",
        options: "email",
        placeholder: __("Enter customer's email")
      }, {
        fieldname: "mobile_no",
        label: __("Phone Number"),
        fieldtype: "Data",
        placeholder: __("Enter customer's phone number")
      }, {
        fieldname: "loyalty_program",
        label: __("Loyalty Program"),
        fieldtype: "Link",
        options: "Loyalty Program",
        placeholder: __("Select Loyalty Program")
      }, {
        fieldname: "loyalty_points",
        label: __("Loyalty Points"),
        fieldtype: "Data",
        read_only: 1
      }];
      const me = this;
      dfs.forEach((df) => {
        this[`customer_${df.fieldname}_field`] = frappe.ui.form.make_control({
          df: __spreadProps(__spreadValues({}, df), {
            onchange: handle_customer_field_change
          }),
          parent: $customer_form.find(`.${df.fieldname}-field`),
          render_input: true
        });
        this[`customer_${df.fieldname}_field`].set_value(this.customer_info[df.fieldname]);
      });
      function handle_customer_field_change() {
        const current_value = me.customer_info[this.df.fieldname];
        const current_customer = me.customer_info.customer;
        if (this.value && current_value != this.value && this.df.fieldname != "loyalty_points") {
          frappe.call({
            method: "erpnext.selling.page.point_of_sale.point_of_sale.set_customer_info",
            args: {
              fieldname: this.df.fieldname,
              customer: current_customer,
              value: this.value
            },
            callback: (r) => {
              if (!r.exc) {
                me.customer_info[this.df.fieldname] = this.value;
                frappe.show_alert({
                  message: __("Customer contact updated successfully."),
                  indicator: "green"
                });
                frappe.utils.play_sound("submit");
              }
            }
          });
        }
      }
    }
    fetch_customer_transactions() {
      frappe.db.get_list("Sales Invoice", {
        filters: { customer: this.customer_info.customer, docstatus: 1 },
        fields: ["name", "grand_total", "status", "posting_date", "posting_time", "currency"],
        limit: 20
      }).then((res) => {
        const transaction_container = this.$customer_section.find(".customer-transactions");
        if (!res.length) {
          transaction_container.html(
            `<div class="no-transactions-placeholder">No recent transactions found</div>`
          );
          return;
        }
        const elapsed_time = moment(res[0].posting_date + " " + res[0].posting_time).fromNow();
        this.$customer_section.find(".customer-desc").html(`Last transacted ${elapsed_time}`);
        res.forEach((invoice) => {
          const posting_datetime = moment(invoice.posting_date + " " + invoice.posting_time).format("Do MMMM, h:mma");
          let indicator_color = {
            "Paid": "green",
            "Draft": "red",
            "Return": "gray",
            "Consolidated": "blue"
          };
          transaction_container.append(
            `<div class="invoice-wrapper" data-invoice-name="${escape(invoice.name)}">
						<div class="invoice-name-date">
							<div class="invoice-name">${invoice.name}</div>
							<div class="invoice-date">${posting_datetime}</div>
						</div>
						<div class="invoice-total-status">
							<div class="invoice-total">
								${format_currency(invoice.grand_total, invoice.currency, 0) || 0}
							</div>
							<div class="invoice-status">
								<span class="indicator-pill whitespace-nowrap ${indicator_color[invoice.status]}">
									<span>${invoice.status}</span>
								</span>
							</div>
						</div>
					</div>
					<div class="seperator"></div>`
          );
        });
      });
    }
    attach_refresh_field_event(frm) {
      $(frm.wrapper).off("refresh-fields");
      $(frm.wrapper).on("refresh-fields", () => {
        if (frm.doc.items.length) {
          this.$cart_items_wrapper.html("");
          frm.doc.items.forEach((item) => {
            this.update_item_html(item);
          });
        }
        this.update_totals_section(frm);
      });
    }
    load_invoice() {
      const frm = this.events.get_frm();
      this.attach_refresh_field_event(frm);
      this.fetch_customer_details(frm.doc.customer).then(() => {
        this.events.customer_details_updated(this.customer_info);
        this.update_customer_section();
      });
      this.$cart_items_wrapper.html("");
      if (frm.doc.items.length) {
        frm.doc.items.forEach((item) => {
          this.update_item_html(item);
        });
      } else {
        this.make_no_items_placeholder();
        this.highlight_checkout_btn(true);
      }
      this.update_totals_section(frm);
      if (frm.doc.docstatus === 1) {
        this.$totals_section.find(".checkout-btn").css("display", "none");
        this.$totals_section.find(".checkout-btn-held").css("display", "none");
        if (this.show_order_list_button) {
          this.$totals_section.find(".checkout-btn-order").css("display", "flex");
        } else {
          this.$totals_section.find(".checkout-btn-order").css("display", "none");
        }
        this.$totals_section.find(".edit-cart-btn").css("display", "none");
      } else {
        if (this.show_checkout_button) {
          this.$totals_section.find(".checkout-btn").css("display", "flex");
        } else {
          this.$totals_section.find(".checkout-btn").css("display", "none");
        }
        if (this.show_held_button) {
          this.$totals_section.find(".checkout-btn-held").css("display", "flex");
        } else {
          this.$totals_section.find(".checkout-btn-held").css("display", "none");
        }
        if (this.show_order_list_button) {
          this.$totals_section.find(".checkout-btn-order").css("display", "flex");
        } else {
          this.$totals_section.find(".checkout-btn-order").css("display", "none");
        }
        this.$totals_section.find(".edit-cart-btn").css("display", "none");
      }
      this.toggle_component(true);
    }
    toggle_component(show) {
      show ? this.$component.css("display", "flex") : this.$component.css("display", "none");
    }
  };
  $(document).ready(function() {
    if (!$("#pos-ui-enhancements").length) {
      $("head").append(`
			<style id="pos-ui-enhancements">
				/* Shortcut feedback animation */
				@keyframes shortcut-feedback {
					0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
					20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
					80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
					100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
				}

				.shortcut-feedback {
					animation: shortcut-feedback 0.8s ease-out forwards;
					pointer-events: none;
				}

				/* Button press effects */
				.btn-pressed {
					transform: scale(0.95) !important;
					transition: transform 0.1s ease !important;
				}

				/* Enhanced numpad button effects */
				.numpad-btn {
					transition: all 0.2s ease;
					position: relative;
					overflow: hidden;
				}

				.numpad-btn:before {
					content: '';
					position: absolute;
					top: 50%;
					left: 50%;
					width: 0;
					height: 0;
					border-radius: 50%;
					background: rgba(255, 255, 255, 0.3);
					transition: width 0.6s, height 0.6s;
					transform: translate(-50%, -50%);
				}

				.numpad-btn:active:before {
					width: 300px;
					height: 300px;
				}

				/* Cart item hover effects */
				.cart-item-wrapper {
					transition: all 0.2s ease;
					border-radius: 4px;
				}

				.cart-item-wrapper:hover {
					background-color: rgba(0, 123, 255, 0.05);
					transform: translateX(2px);
				}

				/* Input focus effects */
				.cart-item-wrapper input:focus {
					box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
					border-color: #007bff;
				}

				/* Loading animation for async operations */
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}

				.loading-spinner {
					display: inline-block;
					width: 20px;
					height: 20px;
					border: 3px solid rgba(255, 255, 255, 0.3);
					border-radius: 50%;
					border-top-color: #fff;
					animation: spin 1s ease-in-out infinite;
					margin-right: 8px;
				}

				/* Success/Error animations */
				@keyframes success-bounce {
					0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
					40% { transform: translateY(-10px); }
					60% { transform: translateY(-5px); }
				}

				.success-animation {
					animation: success-bounce 1s ease;
				}

				@keyframes error-shake {
					0%, 100% { transform: translateX(0); }
					10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
					20%, 40%, 60%, 80% { transform: translateX(5px); }
				}

				.error-animation {
					animation: error-shake 0.5s ease;
				}

				/* Enhanced mobile input display */
				.mobile-input-display.has-value {
					background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
					border-color: #2196f3;
				}

				.mobile-input-display.valid {
					background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
					border-color: #4caf50;
					color: #2e7d32;
				}

				.mobile-input-display.invalid {
					background: linear-gradient(135deg, #ffebee 0%, #fce4ec 100%);
					border-color: #f44336;
					color: #c62828;
				}

				/* Numpad button press effect */
				.numpad-button.pressed {
					transform: scale(0.95);
					transition: transform 0.1s ease;
				}

				/* Smooth transitions for cart updates */
				.cart-items-section {
					transition: all 0.3s ease;
				}

				/* Enhanced checkout button */
				.checkout-btn {
					position: relative;
					overflow: hidden;
				}

				.checkout-btn:before {
					content: '';
					position: absolute;
					top: 0;
					left: -100%;
					width: 100%;
					height: 100%;
					background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
					transition: left 0.5s;
				}

				.checkout-btn:hover:before {
					left: 100%;
				}

				/* Tooltip styles for better UX */
				.tooltip {
					position: relative;
					display: inline-block;
				}

				.tooltip .tooltiptext {
					visibility: hidden;
					width: 120px;
					background-color: #555;
					color: #fff;
					text-align: center;
					border-radius: 6px;
					padding: 5px 0;
					position: absolute;
					z-index: 1;
					bottom: 125%;
					left: 50%;
					margin-left: -60px;
					opacity: 0;
					transition: opacity 0.3s;
				}

				.tooltip:hover .tooltiptext {
					visibility: visible;
					opacity: 1;
				}
			</style>
		`);
    }
  });

  // ../posnext/posnext/public/js/pos_item_details.js
  frappe.provide("posnext.PointOfSale");
  posnext.PointOfSale.ItemDetails = class {
    constructor({ wrapper, events, settings }) {
      this.wrapper = wrapper;
      this.events = events;
      this.hide_images = settings.hide_images;
      this.allow_rate_change = settings.allow_rate_change;
      this.allow_discount_change = settings.allow_discount_change;
      this.custom_edit_rate_and_uom = settings.custom_edit_rate_and_uom;
      this.current_item = {};
      this.init_component();
    }
    init_component() {
      this.prepare_dom();
      this.init_child_components();
      this.bind_events();
      this.attach_shortcuts();
    }
    prepare_dom() {
      this.wrapper.append(
        `<section class="item-details-container" id="item-details-container"></section>`
      );
      this.$component = this.wrapper.find(".item-details-container");
    }
    init_child_components() {
      this.$component.html(
        `<div class="item-details-header">
				<div class="label">${__("Item Detailss")}</div>
				<div class="close-btn">
					<svg width="32" height="32" viewBox="0 0 14 14" fill="none">
						<path d="M4.93764 4.93759L7.00003 6.99998M9.06243 9.06238L7.00003 6.99998M7.00003 6.99998L4.93764 9.06238L9.06243 4.93759" stroke="#8D99A6"/>
					</svg>
				</div>
			</div>
			<div class="item-display">
				<div class="item-name-desc-price">
					<div class="item-name"></div>
					<div class="item-desc"></div>
					<div class="item-price"></div>
				</div>
				<div class="item-image"></div>
			</div>
			<div class="discount-section"></div>
			<div class="form-container"></div>
			<div class="serial-batch-container"></div>`
      );
      this.$item_name = this.$component.find(".item-name");
      this.$item_description = this.$component.find(".item-desc");
      this.$item_price = this.$component.find(".item-price");
      this.$item_image = this.$component.find(".item-image");
      this.$form_container = this.$component.find(".form-container");
      this.$dicount_section = this.$component.find(".discount-section");
      this.$serial_batch_container = this.$component.find(".serial-batch-container");
    }
    compare_with_current_item(item) {
      return item && item.name == this.current_item.name;
    }
    async toggle_item_details_section(item) {
      const current_item_changed = !this.compare_with_current_item(item);
      const hide_item_details = !Boolean(item) || !current_item_changed;
      if (!hide_item_details && current_item_changed || hide_item_details) {
        await this.validate_serial_batch_item();
      }
      if (!this.custom_edit_rate_and_uom) {
        this.events.toggle_item_selector(!hide_item_details);
        this.toggle_component(!hide_item_details);
      }
      if (item && current_item_changed) {
        this.doctype = item.doctype;
        this.item_meta = frappe.get_meta(this.doctype);
        this.name = item.name;
        this.item_row = item;
        this.currency = this.events.get_frm().doc.currency;
        this.current_item = item;
        this.render_dom(item);
        this.render_discount_dom(item);
        this.render_form(item);
        this.events.highlight_cart_item(item);
      } else {
        this.current_item = {};
      }
    }
    validate_serial_batch_item() {
      try {
        const doc = this.events.get_frm().doc;
        const item_row = doc.items.find((item) => item.name === this.name);
        if (!item_row) {
          console.warn("Item row not found for validation");
          return;
        }
        const serialized = item_row.has_serial_no;
        const batched = item_row.has_batch_no;
        const no_bundle_selected = !item_row.serial_and_batch_bundle;
        if (serialized && no_bundle_selected || batched && no_bundle_selected) {
          frappe.show_alert({
            message: __("Item is removed since no serial / batch no selected."),
            indicator: "orange"
          });
          frappe.utils.play_sound("cancel");
          return this.events.remove_item_from_cart();
        }
      } catch (error) {
        console.error("Error in validate_serial_batch_item:", error);
        frappe.show_alert({
          message: __("Error validating serial/batch item"),
          indicator: "red"
        });
      }
    }
    render_dom(item) {
      let { item_name, description, image, price_list_rate } = item;
      function get_description_html() {
        if (description) {
          description = description.indexOf("...") === -1 && description.length > 140 ? description.substr(0, 139) + "..." : description;
          return description;
        }
        return ``;
      }
      this.$item_name.html(item_name);
      this.$item_description.html(get_description_html());
      this.$item_price.html(format_currency(price_list_rate, this.currency));
      if (!this.hide_images && image) {
        this.$item_image.html(
          `<img
					onerror="cur_pos.item_details.handle_broken_image(this)"
					class="h-full" src="${image}"
					alt="${frappe.get_abbr(item_name)}"
					style="object-fit: cover;">`
        );
      } else {
        this.$item_image.html(`<div class="item-abbr">${frappe.get_abbr(item_name)}</div>`);
      }
    }
    handle_broken_image($img) {
      const item_abbr = $($img).attr("alt");
      $($img).replaceWith(`<div class="item-abbr">${item_abbr}</div>`);
    }
    render_discount_dom(item) {
      if (item.discount_percentage) {
        this.$dicount_section.html(
          `<div class="item-rate">${format_currency(item.price_list_rate, this.currency)}</div>
				<div class="item-discount">${item.discount_percentage}% off</div>`
        );
        this.$item_price.html(format_currency(item.rate, this.currency));
      } else {
        this.$dicount_section.html(``);
      }
    }
    render_form(item) {
      const fields_to_display = this.get_form_fields(item);
      this.$form_container.html("");
      fields_to_display.forEach(async (fieldname, idx) => {
        this.$form_container.append(
          `<div class="${fieldname}-control" data-fieldname="${fieldname}"></div>`
        );
        const field_meta = this.item_meta.fields.find((df) => df.fieldname === fieldname);
        fieldname === "discount_percentage" ? field_meta.label = __("Discount (%)") : "";
        const me = this;
        let uoms = [];
        if (fieldname === "uom") {
          try {
            const doc = await frappe.db.get_doc("Item", me.current_item.item_code);
            uoms = doc.uoms ? doc.uoms.map((item2) => item2.uom) : [];
          } catch (error) {
            console.warn("Failed to fetch UOMs for item:", me.current_item.item_code, error);
          }
        }
        this[`${fieldname}_control`] = frappe.ui.form.make_control({
          df: __spreadProps(__spreadValues({}, field_meta), {
            onchange: function() {
              me.events.form_updated(me.current_item, fieldname, this.value);
            },
            get_query: function() {
              if (fieldname === "uom") {
                return {
                  filters: {
                    name: ["in", uoms]
                  }
                };
              }
              return;
            }
          }),
          parent: this.$form_container.find(`.${fieldname}-control`),
          render_input: true
        });
        this[`${fieldname}_control`].set_value(item[fieldname]);
      });
      this.make_auto_serial_selection_btn(item);
      this.bind_custom_control_change_event();
    }
    get_form_fields(item) {
      const fields = ["qty", "uom", "rate", "conversion_factor", "discount_percentage", "warehouse", "actual_qty", "price_list_rate"];
      if (item.has_serial_no)
        fields.push("serial_no");
      if (item.has_batch_no)
        fields.push("batch_no");
      return fields;
    }
    make_auto_serial_selection_btn(item) {
      if (item.has_serial_no || item.has_batch_no) {
        const label = item.has_serial_no ? __("Select Serial No") : __("Select Batch No");
        this.$form_container.append(
          `<div class="btn btn-sm btn-secondary auto-fetch-btn">${label}</div>`
        );
        this.$form_container.find(".serial_no-control").find("textarea").css("height", "6rem");
      }
    }
    bind_custom_control_change_event() {
      const me = this;
      if (this.rate_control) {
        this.rate_control.df.onchange = function() {
          if (this.value || flt(this.value) === 0) {
            me.events.form_updated(me.current_item, "rate", this.value).then(() => {
              const item_row = frappe.get_doc(me.doctype, me.name);
              const doc = me.events.get_frm().doc;
              me.$item_price.html(format_currency(item_row.rate, doc.currency));
              me.render_discount_dom(item_row);
            });
          }
        };
        this.rate_control.df.read_only = !this.allow_rate_change;
        this.rate_control.refresh();
      }
      if (this.discount_percentage_control && !this.allow_discount_change) {
        this.discount_percentage_control.df.read_only = 1;
        this.discount_percentage_control.refresh();
      }
      if (this.warehouse_control) {
        this.warehouse_control.df.reqd = 1;
        this.warehouse_control.df.onchange = function() {
          if (this.value) {
            me.events.form_updated(me.current_item, "warehouse", this.value).then(() => {
              try {
                me.item_stock_map = me.events.get_item_stock_map();
                if (!me.item_stock_map || !me.item_stock_map[me.item_row.item_code]) {
                  console.warn("Stock map not available for item:", me.item_row.item_code);
                  me.events.get_available_stock(me.item_row.item_code, this.value).then(() => {
                    me.warehouse_control.set_value(this.value);
                  });
                  return;
                }
                let stock_info = me.item_stock_map[me.item_row.item_code][this.value];
                if (stock_info === void 0 || stock_info === null) {
                  me.events.get_available_stock(me.item_row.item_code, this.value).then(() => {
                    me.warehouse_control.set_value(this.value);
                  });
                  return;
                }
                let available_qty, is_stock_item;
                if (Array.isArray(stock_info)) {
                  if (typeof stock_info[0] === "object" && stock_info[0] !== null) {
                    const warehouse_qty_obj = stock_info[0];
                    available_qty = warehouse_qty_obj[this.value] || warehouse_qty_obj[warehouse] || 0;
                    is_stock_item = Boolean(stock_info[1]);
                  } else {
                    available_qty = stock_info[0];
                    is_stock_item = Boolean(stock_info[1]);
                  }
                } else if (typeof stock_info === "object" && stock_info !== null) {
                  available_qty = stock_info.qty !== void 0 ? stock_info.qty : stock_info.actual_qty !== void 0 ? stock_info.actual_qty : stock_info.available_qty !== void 0 ? stock_info.available_qty : 0;
                  is_stock_item = Boolean(stock_info.is_stock_item || stock_info.has_stock || stock_info.stock_item);
                } else if (typeof stock_info === "number") {
                  available_qty = stock_info;
                  is_stock_item = true;
                } else {
                  available_qty = 0;
                  is_stock_item = false;
                }
                if (isNaN(available_qty) || available_qty === null || available_qty === void 0) {
                  console.warn("Invalid available_qty:", available_qty, "for stock_info:", stock_info);
                  available_qty = 0;
                }
                if (available_qty === 0 && is_stock_item) {
                  me.warehouse_control.set_value("");
                  const bold_item_code = me.item_row.item_code.bold();
                  const bold_warehouse = this.value.bold();
                  frappe.throw(
                    __("Item Code: {0} is not available under warehouse {1}.", [bold_item_code, bold_warehouse])
                  );
                }
                const qty_to_set = typeof available_qty === "number" ? available_qty : parseFloat(available_qty) || 0;
                if (me.actual_qty_control) {
                  me.actual_qty_control.set_value(qty_to_set);
                }
              } catch (error) {
                console.error("Error updating warehouse stock info:", error);
                if (me.actual_qty_control) {
                  me.actual_qty_control.set_value(0);
                }
              }
            });
          }
        };
        this.warehouse_control.df.get_query = () => {
          return {
            filters: { company: this.events.get_frm().doc.company }
          };
        };
        this.warehouse_control.refresh();
      }
      if (this.serial_no_control) {
        this.serial_no_control.df.reqd = 1;
        this.serial_no_control.df.onchange = async function() {
          !me.current_item.batch_no && await me.auto_update_batch_no();
          me.events.form_updated(me.current_item, "serial_no", this.value);
        };
        this.serial_no_control.refresh();
      }
      if (this.batch_no_control) {
        this.batch_no_control.df.reqd = 1;
        this.batch_no_control.df.get_query = () => {
          return {
            query: "erpnext.controllers.queries.get_batch_no",
            filters: {
              item_code: me.item_row.item_code,
              warehouse: me.item_row.warehouse,
              posting_date: me.events.get_frm().doc.posting_date
            }
          };
        };
        this.batch_no_control.refresh();
      }
      if (this.uom_control) {
        this.uom_control.df.onchange = function() {
          me.events.form_updated(me.current_item, "uom", this.value);
          const item_row = frappe.get_doc(me.doctype, me.name);
          me.conversion_factor_control.df.read_only = item_row.stock_uom == this.value;
          me.conversion_factor_control.refresh();
        };
      }
      frappe.model.on("POS Invoice Item", "*", (fieldname, value, item_row) => {
        const field_control = this[`${fieldname}_control`];
        const item_row_is_being_edited = this.compare_with_current_item(item_row);
        if (item_row_is_being_edited && field_control && field_control.get_value() !== value) {
          field_control.set_value(value);
          cur_pos.update_cart_html(item_row);
        }
      });
    }
    async auto_update_batch_no() {
      if (this.serial_no_control && this.batch_no_control) {
        const selected_serial_nos = this.serial_no_control.get_value().split(`
`).filter((s) => s);
        if (!selected_serial_nos.length)
          return;
        try {
          const serials_with_batch_no = await frappe.db.get_list("Serial No", {
            filters: { "name": ["in", selected_serial_nos] },
            fields: ["batch_no", "name"]
          });
          if (!serials_with_batch_no || serials_with_batch_no.length === 0) {
            console.warn("No serial numbers found with batch information");
            return;
          }
          const batch_serial_map = serials_with_batch_no.reduce((acc, r) => {
            if (!acc[r.batch_no]) {
              acc[r.batch_no] = [];
            }
            acc[r.batch_no] = [...acc[r.batch_no], r.name];
            return acc;
          }, {});
          const batch_no = Object.keys(batch_serial_map)[0];
          const batch_serial_nos = batch_serial_map[batch_no].join(`
`);
          const serial_nos_belongs_to_other_batch = selected_serial_nos.length !== batch_serial_map[batch_no].length;
          const current_batch_no = this.batch_no_control.get_value();
          if (current_batch_no != batch_no) {
            await this.batch_no_control.set_value(batch_no);
          }
          if (serial_nos_belongs_to_other_batch) {
            this.serial_no_control.set_value(batch_serial_nos);
            this.qty_control.set_value(batch_serial_map[batch_no].length);
            delete batch_serial_map[batch_no];
            this.events.clone_new_batch_item_in_frm(batch_serial_map, this.current_item);
          }
        } catch (error) {
          console.error("Error in auto_update_batch_no:", error);
          frappe.show_alert({
            message: __("Error updating batch information"),
            indicator: "red"
          });
        }
      }
    }
    bind_events() {
      this.bind_auto_serial_fetch_event();
      this.bind_fields_to_numpad_fields();
      this.$component.on("click", ".close-btn", () => {
        this.events.close_item_details();
      });
    }
    attach_shortcuts() {
      this.wrapper.find(".close-btn").attr("title", "Esc");
      frappe.ui.keys.on("escape", () => {
        const item_details_visible = this.$component.is(":visible");
        if (item_details_visible) {
          this.events.close_item_details();
        }
      });
    }
    bind_fields_to_numpad_fields() {
      const me = this;
      this.$form_container.on("click", ".input-with-feedback", function() {
        const fieldname = $(this).attr("data-fieldname");
        if (this.last_field_focused != fieldname) {
          me.events.item_field_focused(fieldname);
          this.last_field_focused = fieldname;
        }
      });
    }
    bind_auto_serial_fetch_event() {
      this.$form_container.on("click", ".auto-fetch-btn", () => {
        try {
          frappe.require("assets/erpnext/js/utils/serial_no_batch_selector.js", () => {
            let frm = this.events.get_frm();
            let item_row = this.item_row;
            item_row.type_of_transaction = "Outward";
            new erpnext.SerialBatchPackageSelector(frm, item_row, (r) => {
              if (r) {
                try {
                  frappe.model.set_value(item_row.doctype, item_row.name, {
                    "serial_and_batch_bundle": r.name,
                    "qty": Math.abs(r.total_qty)
                  });
                } catch (error) {
                  console.error("Error setting serial/batch bundle:", error);
                  frappe.show_alert({
                    message: __("Error setting serial/batch information"),
                    indicator: "red"
                  });
                }
              }
            });
          });
        } catch (error) {
          console.error("Error in auto serial fetch:", error);
          frappe.show_alert({
            message: __("Error opening serial/batch selector"),
            indicator: "red"
          });
        }
      });
    }
    toggle_component(show) {
      show ? this.$component.css("display", "flex") : this.$component.css("display", "none");
    }
  };

  // ../posnext/posnext/public/js/pos_number_pad.js
  frappe.provide("posnext.PointOfSale");
  posnext.PointOfSale.NumberPad = class {
    constructor({ wrapper, events, cols, keys, css_classes, fieldnames_map }) {
      this.wrapper = wrapper;
      this.events = events;
      this.cols = cols;
      this.keys = keys;
      this.css_classes = css_classes || [];
      this.fieldnames = fieldnames_map || {};
      this.init_component();
    }
    init_component() {
      this.prepare_dom();
      this.bind_events();
    }
    prepare_dom() {
      const { cols, keys, css_classes, fieldnames } = this;
      function get_keys() {
        return keys.reduce((a, row, i) => {
          return a + row.reduce((a2, number, j) => {
            const class_to_append = css_classes && css_classes[i] ? css_classes[i][j] : "";
            const fieldname = fieldnames && fieldnames[number] ? fieldnames[number] : typeof number === "string" ? frappe.scrub(number) : number;
            return a2 + `<div class="numpad-btn ${class_to_append}" data-button-value="${fieldname}">${__(number)}</div>`;
          }, "");
        }, "");
      }
      this.wrapper.html(
        `<div class="numpad-container">
				${get_keys()}
			</div>`
      );
    }
    bind_events() {
      const me = this;
      this.wrapper.on("click", ".numpad-btn", function() {
        const $btn = $(this);
        me.events.numpad_event($btn);
      });
    }
  };

  // ../posnext/posnext/public/js/pos_payment.js
  frappe.provide("posnext.PointOfSale");
  posnext.PointOfSale.Payment = class {
    constructor({ events, wrapper }) {
      this.wrapper = wrapper;
      this.events = events;
      this.init_component();
    }
    init_component() {
      this.prepare_dom();
      this.initialize_numpad();
      this.bind_events();
      this.attach_shortcuts();
    }
    prepare_dom() {
      this.wrapper.append(
        `<style>
				.action-buttons {
					display: flex;
					gap: 12px;
					margin-top: 16px;
				}
				.send-kot-btn, .submit-order-btn {
					flex: 1;
					padding: 12px 16px;
					border-radius: 6px;
					text-align: center;
					font-weight: 600;
					cursor: pointer;
					transition: all 0.2s;
					font-size: 14px;
				}
				.send-kot-btn {
					background: #f59e0b;
					color: #fff;
					border: 2px solid #f59e0b;
				}
				.send-kot-btn:hover:not(:disabled) {
					background: #d97706;
					border-color: #d97706;
				}
				.submit-order-btn {
					background: #4CAF50;
					color: #fff;
					border: 2px solid #4CAF50;
				}
				.submit-order-btn:hover:not(:disabled) {
					background: #3d8b40;
					border-color: #3d8b40;
				}
				.send-kot-btn:disabled, .submit-order-btn:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}
			</style>
			<section class="payment-container">
				<div class="section-label payment-section">${__("Payment Method")}</div>
				<div class="payment-modes"></div>
				<div class="fields-numpad-container">
					<div class="fields-section">
						<div class="section-label">${__("Additional Information")}</div>
						<div class="invoice-fields"></div>
					</div>
					<div class="number-pad"></div>
				</div>
				<div class="totals-section">
					<div class="totals"></div>
				</div>
				<div class="action-buttons">
					<div class="send-kot-btn">${__("Send to Kitchen")}</div>
					<div class="submit-order-btn">${__("Complete Order")}</div>
				</div>
			</section>`
      );
      this.$component = this.wrapper.find(".payment-container");
      this.$payment_modes = this.$component.find(".payment-modes");
      this.$totals_section = this.$component.find(".totals-section");
      this.$totals = this.$component.find(".totals");
      this.$numpad = this.$component.find(".number-pad");
      this.$invoice_fields_section = this.$component.find(".fields-section");
    }
    make_invoice_fields_control() {
      frappe.db.get_doc("POS Settings", void 0).then((doc) => {
        const fields = doc.invoice_fields;
        if (!fields.length)
          return;
        this.$invoice_fields = this.$invoice_fields_section.find(".invoice-fields");
        this.$invoice_fields.html("");
        const frm = this.events.get_frm();
        fields.forEach((df) => {
          this.$invoice_fields.append(
            `<div class="invoice_detail_field ${df.fieldname}-field" data-fieldname="${df.fieldname}"></div>`
          );
          let df_events = {
            onchange: function() {
              frm.set_value(this.df.fieldname, this.get_value());
            }
          };
          if (df.fieldtype == "Button") {
            df_events = {
              click: function() {
                if (frm.script_manager.has_handlers(df.fieldname, frm.doc.doctype)) {
                  frm.script_manager.trigger(df.fieldname, frm.doc.doctype, frm.doc.docname);
                }
              }
            };
          }
          this[`${df.fieldname}_field`] = frappe.ui.form.make_control({
            df: __spreadValues(__spreadValues({}, df), df_events),
            parent: this.$invoice_fields.find(`.${df.fieldname}-field`),
            render_input: true
          });
          this[`${df.fieldname}_field`].set_value(frm.doc[df.fieldname]);
        });
      });
    }
    initialize_numpad() {
      const me = this;
      this.number_pad = new posnext.PointOfSale.NumberPad({
        wrapper: this.$numpad,
        events: {
          numpad_event: function($btn) {
            me.on_numpad_clicked($btn);
          }
        },
        cols: 3,
        keys: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [".", 0, "Delete"]
        ]
      });
      this.numpad_value = "";
    }
    on_numpad_clicked($btn) {
      const button_value = $btn.attr("data-button-value");
      highlight_numpad_btn($btn);
      this.numpad_value = button_value === "delete" ? this.numpad_value.slice(0, -1) : this.numpad_value + button_value;
      this.selected_mode.$input.get(0).focus();
      this.selected_mode.set_value(this.numpad_value);
      function highlight_numpad_btn($btn2) {
        $btn2.addClass("shadow-base-inner bg-selected");
        setTimeout(() => {
          $btn2.removeClass("shadow-base-inner bg-selected");
        }, 100);
      }
    }
    bind_events() {
      const me = this;
      this.$payment_modes.on("click", ".mode-of-payment", function(e) {
        const mode_clicked = $(this);
        if (!$(e.target).is(mode_clicked))
          return;
        const scrollLeft = mode_clicked.offset().left - me.$payment_modes.offset().left + me.$payment_modes.scrollLeft();
        me.$payment_modes.animate({ scrollLeft });
        const mode = mode_clicked.attr("data-mode");
        $(`.mode-of-payment-control`).css("display", "none");
        $(`.cash-shortcuts`).css("display", "none");
        me.$payment_modes.find(`.pay-amount`).css("display", "inline");
        me.$payment_modes.find(`.loyalty-amount-name`).css("display", "none");
        $(".mode-of-payment").removeClass("border-primary");
        if (mode_clicked.hasClass("border-primary")) {
          mode_clicked.removeClass("border-primary");
          me.selected_mode = "";
        } else {
          mode_clicked.addClass("border-primary");
          mode_clicked.find(".mode-of-payment-control").css("display", "flex");
          mode_clicked.find(".cash-shortcuts").css("display", "grid");
          me.$payment_modes.find(`.${mode}-amount`).css("display", "none");
          me.$payment_modes.find(`.${mode}-name`).css("display", "inline");
          me.selected_mode = me[`${mode}_control`];
          me.selected_mode && me.selected_mode.$input.get(0).focus();
          me.auto_set_remaining_amount();
        }
      });
      frappe.ui.form.on("POS Invoice", "contact_mobile", (frm) => {
        var _a;
        const contact = frm.doc.contact_mobile;
        const request_button = $((_a = this.request_for_payment_field) == null ? void 0 : _a.$input[0]);
        if (contact) {
          request_button.removeClass("btn-default").addClass("btn-primary");
        } else {
          request_button.removeClass("btn-primary").addClass("btn-default");
        }
      });
      frappe.ui.form.on("POS Invoice", "coupon_code", (frm) => {
        if (frm.doc.coupon_code && !frm.applying_pos_coupon_code) {
          if (!frm.doc.ignore_pricing_rule) {
            frm.applying_pos_coupon_code = true;
            frappe.run_serially([
              () => frm.doc.ignore_pricing_rule = 1,
              () => frm.trigger("ignore_pricing_rule"),
              () => frm.doc.ignore_pricing_rule = 0,
              () => frm.trigger("apply_pricing_rule"),
              () => frm.save(),
              () => this.update_totals_section(frm.doc),
              () => frm.applying_pos_coupon_code = false
            ]);
          } else if (frm.doc.ignore_pricing_rule) {
            frappe.show_alert({
              message: __("Ignore Pricing Rule is enabled. Cannot apply coupon code."),
              indicator: "orange"
            });
          }
        }
      });
      this.setup_listener_for_payments();
      this.$payment_modes.on("click", ".shortcut", function() {
        const value = $(this).attr("data-value");
        me.selected_mode.set_value(value);
      });
      this.$component.on("click", ".submit-order-btn", () => {
        const doc = this.events.get_frm().doc;
        const paid_amount = doc.paid_amount;
        const items = doc.items;
        if (paid_amount == 0 || !items.length) {
          const message = items.length ? __("You cannot submit the order without payment.") : __("You cannot submit empty order.");
          frappe.show_alert({ message, indicator: "orange" });
          frappe.utils.play_sound("error");
          return;
        }
        this.events.submit_invoice();
      });
      this.$component.on("click", ".send-kot-btn", () => {
        const doc = this.events.get_frm().doc;
        const items = doc.items;
        if (!items.length) {
          frappe.show_alert({ message: __("You cannot send empty order to kitchen."), indicator: "orange" });
          frappe.utils.play_sound("error");
          return;
        }
        this.send_to_kitchen(doc);
      });
      frappe.ui.form.on("POS Invoice", "paid_amount", (frm) => {
        this.update_totals_section(frm.doc);
        const is_cash_shortcuts_invisible = !this.$payment_modes.find(".cash-shortcuts").is(":visible");
        this.attach_cash_shortcuts(frm.doc);
        !is_cash_shortcuts_invisible && this.$payment_modes.find(".cash-shortcuts").css("display", "grid");
        this.render_payment_mode_dom();
      });
      frappe.ui.form.on("POS Invoice", "loyalty_amount", (frm) => {
        const formatted_currency = format_currency(frm.doc.loyalty_amount, frm.doc.currency);
        this.$payment_modes.find(`.loyalty-amount-amount`).html(formatted_currency);
      });
      frappe.ui.form.on("Sales Invoice Payment", "amount", (frm, cdt, cdn) => {
        const default_mop = locals[cdt][cdn];
        const mode = default_mop.mode_of_payment.replace(/ +/g, "_").toLowerCase();
        if (this[`${mode}_control`] && this[`${mode}_control`].get_value() != default_mop.amount) {
          this[`${mode}_control`].set_value(default_mop.amount);
        }
      });
    }
    setup_listener_for_payments() {
      frappe.realtime.on("process_phone_payment", (data) => {
        const doc = this.events.get_frm().doc;
        const { response, amount, success, failure_message } = data;
        let message, title;
        if (success) {
          title = __("Payment Received");
          const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
          if (amount >= grand_total) {
            frappe.dom.unfreeze();
            message = __("Payment of {0} received successfully.", [format_currency(amount, doc.currency, 0)]);
            this.events.submit_invoice();
            cur_frm.reload_doc();
          } else {
            message = __("Payment of {0} received successfully. Waiting for other requests to complete...", [format_currency(amount, doc.currency, 0)]);
          }
        } else if (failure_message) {
          message = failure_message;
          title = __("Payment Failed");
        }
        frappe.msgprint({ "message": message, "title": title });
      });
    }
    auto_set_remaining_amount() {
      const doc = this.events.get_frm().doc;
      const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
      const remaining_amount = grand_total - doc.paid_amount;
      const current_value = this.selected_mode ? this.selected_mode.get_value() : void 0;
      if (!current_value && remaining_amount > 0 && this.selected_mode) {
        this.selected_mode.set_value(remaining_amount);
      }
    }
    attach_shortcuts() {
      const ctrl_label = frappe.utils.is_mac() ? "\u2318" : "Ctrl";
      this.$component.find(".submit-order-btn").attr("title", `${ctrl_label}+Enter`);
      frappe.ui.keys.on("ctrl+enter", () => {
        const payment_is_visible = this.$component.is(":visible");
        const active_mode = this.$payment_modes.find(".border-primary");
        if (payment_is_visible && active_mode.length) {
          this.$component.find(".submit-order-btn").click();
        }
      });
      frappe.ui.keys.add_shortcut({
        shortcut: "tab",
        action: () => {
          const payment_is_visible = this.$component.is(":visible");
          let active_mode = this.$payment_modes.find(".border-primary");
          active_mode = active_mode.length ? active_mode.attr("data-mode") : void 0;
          if (!active_mode)
            return;
          const mode_of_payments = Array.from(this.$payment_modes.find(".mode-of-payment")).map((m) => $(m).attr("data-mode"));
          const mode_index = mode_of_payments.indexOf(active_mode);
          const next_mode_index = (mode_index + 1) % mode_of_payments.length;
          const next_mode_to_be_clicked = this.$payment_modes.find(`.mode-of-payment[data-mode="${mode_of_payments[next_mode_index]}"]`);
          if (payment_is_visible && mode_index != next_mode_index) {
            next_mode_to_be_clicked.click();
          }
        },
        condition: () => this.$component.is(":visible") && this.$payment_modes.find(".border-primary").length,
        description: __("Switch Between Payment Modes"),
        ignore_inputs: true,
        page: cur_page.page.page
      });
    }
    toggle_numpad() {
    }
    render_payment_section() {
      this.render_payment_mode_dom();
      this.make_invoice_fields_control();
      this.update_totals_section();
      this.focus_on_default_mop();
    }
    after_render() {
      const frm = this.events.get_frm();
      frm.script_manager.trigger("after_payment_render", frm.doc.doctype, frm.doc.docname);
    }
    edit_cart() {
      this.events.toggle_other_sections(false);
      this.toggle_component(false);
    }
    checkout() {
      this.events.toggle_other_sections(true);
      this.toggle_component(true);
      this.render_payment_section();
      this.after_render();
    }
    toggle_remarks_control() {
      if (this.$remarks.find(".frappe-control").length) {
        this.$remarks.html("+ Add Remark");
      } else {
        this.$remarks.html("");
        this[`remark_control`] = frappe.ui.form.make_control({
          df: {
            label: __("Remark"),
            fieldtype: "Data",
            onchange: function() {
            }
          },
          parent: this.$totals_section.find(`.remarks`),
          render_input: true
        });
        this[`remark_control`].set_value("");
      }
    }
    render_payment_mode_dom() {
      const doc = this.events.get_frm().doc;
      const payments = doc.payments;
      const currency = doc.currency;
      this.$payment_modes.html(`${payments.map((p, i) => {
        const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
        const payment_type = p.type;
        const margin = i % 2 === 0 ? "pr-2" : "pl-2";
        const amount = p.amount > 0 ? format_currency(p.amount, currency) : "";
        return `
					<div class="payment-mode-wrapper">
						<div class="mode-of-payment" data-mode="${mode}" data-payment-type="${payment_type}">
							${p.mode_of_payment}
							<div class="${mode}-amount pay-amount">${amount}</div>
							<div class="${mode} mode-of-payment-control"></div>
						</div>
					</div>
				`;
      }).join("")}`);
      payments.forEach((p) => {
        const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
        const me = this;
        this[`${mode}_control`] = frappe.ui.form.make_control({
          df: {
            label: p.mode_of_payment,
            fieldtype: "Currency",
            placeholder: __("Enter {0} amount.", [p.mode_of_payment]),
            onchange: function() {
              const current_value = frappe.model.get_value(p.doctype, p.name, "amount");
              if (current_value != this.value) {
                frappe.model.set_value(p.doctype, p.name, "amount", flt(this.value)).then(() => me.update_totals_section());
                const formatted_currency = format_currency(this.value, currency);
                me.$payment_modes.find(`.${mode}-amount`).html(formatted_currency);
              }
            }
          },
          parent: this.$payment_modes.find(`.${mode}.mode-of-payment-control`),
          render_input: true
        });
        this[`${mode}_control`].toggle_label(false);
        this[`${mode}_control`].set_value(p.amount);
      });
      this.render_loyalty_points_payment_mode();
      this.attach_cash_shortcuts(doc);
    }
    focus_on_default_mop() {
      const doc = this.events.get_frm().doc;
      const payments = doc.payments;
      payments.forEach((p) => {
        const mode = p.mode_of_payment.replace(/ +/g, "_").toLowerCase();
        if (p.default) {
          setTimeout(() => {
            this.$payment_modes.find(`.${mode}.mode-of-payment-control`).parent().click();
          }, 500);
        }
      });
    }
    attach_cash_shortcuts(doc) {
      const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
      const currency = doc.currency;
      const shortcuts = this.get_cash_shortcuts(flt(grand_total));
      this.$payment_modes.find(".cash-shortcuts").remove();
      let shortcuts_html = shortcuts.map((s) => {
        return `<div class="shortcut" data-value="${s}">${format_currency(s, currency, 0)}</div>`;
      }).join("");
      this.$payment_modes.find('[data-payment-type="Cash"]').find(".mode-of-payment-control").after(`<div class="cash-shortcuts">${shortcuts_html}</div>`);
    }
    get_cash_shortcuts(grand_total) {
      let steps = [1, 5, 10];
      const digits = String(Math.round(grand_total)).length;
      steps = steps.map((x) => x * 10 ** (digits - 2));
      const get_nearest = (amount, x) => {
        let nearest_x = Math.ceil(amount / x) * x;
        return nearest_x === amount ? nearest_x + x : nearest_x;
      };
      return steps.reduce((finalArr, x) => {
        let nearest_x = get_nearest(grand_total, x);
        nearest_x = finalArr.indexOf(nearest_x) != -1 ? nearest_x + x : nearest_x;
        return [...finalArr, nearest_x];
      }, []);
    }
    render_loyalty_points_payment_mode() {
      const me = this;
      const doc = this.events.get_frm().doc;
      const { loyalty_program, loyalty_points, conversion_factor } = this.events.get_customer_details();
      this.$payment_modes.find(`.mode-of-payment[data-mode="loyalty-amount"]`).parent().remove();
      if (!loyalty_program)
        return;
      let description, read_only, max_redeemable_amount;
      if (!loyalty_points) {
        description = __("You don't have enough points to redeem.");
        read_only = true;
      } else {
        max_redeemable_amount = flt(flt(loyalty_points) * flt(conversion_factor), precision("loyalty_amount", doc));
        description = __("You can redeem upto {0}.", [format_currency(max_redeemable_amount)]);
        read_only = false;
      }
      const margin = this.$payment_modes.children().length % 2 === 0 ? "pr-2" : "pl-2";
      const amount = doc.loyalty_amount > 0 ? format_currency(doc.loyalty_amount, doc.currency) : "";
      this.$payment_modes.append(
        `<div class="payment-mode-wrapper">
				<div class="mode-of-payment loyalty-card" data-mode="loyalty-amount" data-payment-type="loyalty-amount">
					Redeem Loyalty Points
					<div class="loyalty-amount-amount pay-amount">${amount}</div>
					<div class="loyalty-amount-name">${loyalty_program}</div>
					<div class="loyalty-amount mode-of-payment-control"></div>
				</div>
			</div>`
      );
      this["loyalty-amount_control"] = frappe.ui.form.make_control({
        df: {
          label: __("Redeem Loyalty Points"),
          fieldtype: "Currency",
          placeholder: __("Enter amount to be redeemed."),
          options: "company:currency",
          read_only,
          onchange: async function() {
            if (!loyalty_points)
              return;
            if (this.value > max_redeemable_amount) {
              frappe.show_alert({
                message: __("You cannot redeem more than {0}.", [format_currency(max_redeemable_amount)]),
                indicator: "red"
              });
              frappe.utils.play_sound("submit");
              me["loyalty-amount_control"].set_value(0);
              return;
            }
            const redeem_loyalty_points = this.value > 0 ? 1 : 0;
            await frappe.model.set_value(doc.doctype, doc.name, "redeem_loyalty_points", redeem_loyalty_points);
            frappe.model.set_value(doc.doctype, doc.name, "loyalty_points", parseInt(this.value / conversion_factor));
          },
          description
        },
        parent: this.$payment_modes.find(`.loyalty-amount.mode-of-payment-control`),
        render_input: true
      });
      this["loyalty-amount_control"].toggle_label(false);
    }
    render_add_payment_method_dom() {
      const docstatus = this.events.get_frm().doc.docstatus;
      if (docstatus === 0)
        this.$payment_modes.append(
          `<div class="w-full pr-2">
					<div class="add-mode-of-payment w-half text-grey mb-4 no-select pointer">+ Add Payment Method</div>
				</div>`
        );
    }
    update_totals_section(doc) {
      if (!doc)
        doc = this.events.get_frm().doc;
      const paid_amount = doc.paid_amount;
      const grand_total = cint(frappe.sys_defaults.disable_rounded_total) ? doc.grand_total : doc.rounded_total;
      const remaining = grand_total - doc.paid_amount;
      const change = doc.change_amount || remaining <= 0 ? -1 * remaining : void 0;
      const currency = doc.currency;
      const label = change ? __("Change") : __("To Be Paid");
      this.$totals.html(
        `<div class="col">
				<div class="total-label">${__("Grand Total")}</div>
				<div class="value">${format_currency(grand_total, currency)}</div>
			</div>
			<div class="seperator-y"></div>
			<div class="col">
				<div class="total-label">${__("Paid Amount")}</div>
				<div class="value">${format_currency(paid_amount, currency)}</div>
			</div>
			<div class="seperator-y"></div>
			<div class="col">
				<div class="total-label">${label}</div>
				<div class="value">${format_currency(change || remaining, currency)}</div>
			</div>`
      );
    }
    send_to_kitchen(doc) {
      const current_items = doc.items.map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty: item.qty,
        comments: item.comments || ""
      }));
      this.$component.find(".send-kot-btn").prop("disabled", true).text(__("Sending..."));
      frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.kot_execute",
        args: {
          invoice_id: doc.name,
          customer: doc.customer,
          restaurant_table: doc.pos_table,
          current_items,
          previous_items: [],
          comments: doc.order_comments || ""
        },
        callback: (r) => {
          this.$component.find(".send-kot-btn").prop("disabled", false).text(__("Send to Kitchen"));
          if (r.exc) {
            frappe.show_alert({
              message: __("Failed to send order to kitchen. Please try again."),
              indicator: "red"
            });
            frappe.utils.play_sound("error");
          } else {
            frappe.show_alert({
              message: __("Order sent to kitchen successfully!"),
              indicator: "green"
            });
            frappe.utils.play_sound("success");
          }
        }
      });
    }
    toggle_component(show) {
      show ? this.$component.css("display", "flex") : this.$component.css("display", "none");
    }
  };

  // ../posnext/posnext/public/js/pos_past_order_list.js
  frappe.provide("posnext.PointOfSale");
  var invoicess = [];
  posnext.PointOfSale.PastOrderList = class {
    constructor({ wrapper, events }) {
      this.wrapper = wrapper;
      this.events = events;
      this.selected_invoices = /* @__PURE__ */ new Set();
      this.can_merge_invoices = this.check_merge_permission();
      this.user_list = [];
      posnext.PointOfSale.PastOrderList.current_instance = this;
      this._just_held_invoice = null;
      this._pending_created_by = null;
      this.init_component();
    }
    init_component() {
      this.prepare_dom();
      this.make_filter_section();
      this.bind_events();
      this.load_user_list();
    }
    check_merge_permission() {
      const user_roles = frappe.user_roles || [];
      return !user_roles.includes("Waiter");
    }
    prepare_dom() {
      this.wrapper.append(
        `<section class="past-order-list">
				<div class="filter-section">
					<div class="label back" style="font-size: 13px ">
						<a>
							<svg class="es-line" style="width: 13px;height: 13px">
								<use class="" href="#es-line-left-chevron"></use></svg> Back
						</a>
					</div>
					<br>
					<div class="label">${__("Recent Orders")}</div>
					<div class="search-field"></div>
					<div class="status-field"></div>
					<div class="created-by-field"></div>
				</div>
				<div class="invoices-container"></div>
				<div class="merge-section" style="display: none; padding: 15px; border-top: 1px solid #d1d8dd; background-color: #f8f9fa;">
					<div class="selected-count" style="margin-bottom: 10px; font-size: 12px; color: #6c757d;">
						<span class="count">0</span> invoices selected
					</div>
					<button class="btn btn-primary btn-sm merge-btn" disabled>
						<svg style="width: 14px; height: 14px; margin-right: 5px;" viewBox="0 0 24 24" fill="currentColor">
							<path d="M17,20.5V19H7V20.5L3,16.5L7,12.5V14H17V12.5L21,16.5L17,20.5M7,3.5V5H17V3.5L21,7.5L17,11.5V10H7V11.5L3,7.5L7,3.5Z"/>
						</svg>
						${__("Merge Selected Invoices")}
					</button>
				</div>
			</section>`
      );
      this.$component = this.wrapper.find(".past-order-list");
      this.$invoices_container = this.$component.find(".invoices-container");
      this.$merge_section = this.$component.find(".merge-section");
      this.$merge_btn = this.$component.find(".merge-btn");
      this.$selected_count = this.$component.find(".selected-count .count");
    }
    bind_events() {
      this.search_field.$input.on("input", (e) => {
        clearTimeout(this.last_search);
        this.last_search = setTimeout(() => {
          const search_term = e.target.value;
          console.log("Search input changed to:", search_term);
          this.refresh_list(search_term, this.status_field.get_value(), this.created_by_field.get_value());
        }, 300);
      });
      const me = this;
      this.$invoices_container.on("click", ".invoice-wrapper", function(e) {
        if (!$(e.target).closest(".invoice-checkbox-container").length) {
          const invoice_name = unescape($(this).attr("data-invoice-name"));
          me.events.open_invoice_data(invoice_name);
        }
      });
      this.$invoices_container.on("change", ".invoice-checkbox", function(e) {
        e.stopPropagation();
        const invoice_name = unescape($(this).closest(".invoice-wrapper").attr("data-invoice-name"));
        if ($(this).is(":checked")) {
          me.selected_invoices.add(invoice_name);
        } else {
          me.selected_invoices.delete(invoice_name);
        }
        me.update_merge_section();
      });
      this.$merge_btn.on("click", function() {
        me.merge_selected_invoices();
      });
      this.$component.on("click", ".back", function() {
        me.events.reset_summary();
        me.events.previous_screen();
      });
      this.$component.on("change", ".status-field select", function() {
        console.log("Status select changed via DOM event");
        me.refresh_list(
          me.search_field.get_value(),
          $(this).val(),
          me.created_by_field.get_value()
        );
      });
      this.$component.on("change", ".created-by-field select", function() {
        console.log("Created by select changed via DOM event");
        me.refresh_list(
          me.search_field.get_value(),
          me.status_field.get_value(),
          $(this).val()
        );
      });
    }
    load_user_list() {
      frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "User Secret Key",
          fields: ["name", "user_name"],
          filters: [["user_name", "!=", ""]],
          order_by: "modified desc"
        },
        callback: (response) => {
          if (response.message) {
            this.user_list = response.message;
            this.setup_created_by_field();
          }
        }
      });
    }
    setup_created_by_field() {
      let options = "All\n" + this.user_list.map((user) => user.user_name).join("\n");
      this.created_by_field.df.options = options;
      this.created_by_field.refresh();
      this.get_most_recent_creator();
    }
    get_most_recent_creator() {
      frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.get_past_order_list",
        args: {
          search_term: "",
          status: "Draft",
          limit: 1
        },
        callback: (response) => {
          if (response.message && response.message.length > 0) {
            const most_recent_creator = response.message[0].created_by_name;
            if (most_recent_creator) {
              this.created_by_field.set_value(most_recent_creator);
            }
          }
        }
      });
    }
    make_filter_section() {
      const me = this;
      this.search_field = frappe.ui.form.make_control({
        df: {
          label: __("Search"),
          fieldtype: "Data",
          placeholder: __("Search by invoice id or customer name")
        },
        parent: this.$component.find(".search-field"),
        render_input: true
      });
      this.status_field = frappe.ui.form.make_control({
        df: {
          label: __("Invoice Status"),
          fieldtype: "Select",
          options: `Draft
Paid
Partly Paid
Unpaid
Overdue
Return`,
          placeholder: __("Filter by invoice status"),
          onchange: function() {
            console.log("Status field changed to:", me.status_field.get_value());
            if (me.$component.is(":visible")) {
              me.refresh_list(
                me.search_field.get_value(),
                me.status_field.get_value(),
                me.created_by_field.get_value()
              );
            }
          }
        },
        parent: this.$component.find(".status-field"),
        render_input: true
      });
      this.created_by_field = frappe.ui.form.make_control({
        df: {
          label: __("Created By"),
          fieldtype: "Select",
          options: "All",
          placeholder: __("Filter by creator"),
          onchange: function() {
            console.log("Created by field changed to:", me.created_by_field.get_value());
            if (me.$component.is(":visible")) {
              me.refresh_list(
                me.search_field.get_value(),
                me.status_field.get_value(),
                me.created_by_field.get_value()
              );
            }
          }
        },
        parent: this.$component.find(".created-by-field"),
        render_input: true
      });
      this.search_field.toggle_label(false);
      this.status_field.toggle_label(false);
      this.created_by_field.toggle_label(false);
      this.status_field.set_value("Draft");
    }
    refresh_list(search_term = "", status = "Draft", created_by = "") {
      this.$invoices_container.html("");
      frappe.dom.freeze();
      this.events.reset_summary();
      if (this._pending_created_by) {
        created_by = this._pending_created_by;
        this.created_by_field.set_value(created_by);
        this._pending_created_by = null;
      }
      if (!search_term && this.search_field) {
        search_term = this.search_field.get_value() || "";
      }
      if (!status && this.status_field) {
        status = this.status_field.get_value() || "Draft";
      }
      if (!created_by && this.created_by_field) {
        created_by = this.created_by_field.get_value() || "";
      }
      this.selected_invoices.clear();
      this.update_merge_section();
      return frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.get_past_order_list",
        freeze: true,
        args: {
          search_term: search_term || "",
          status: status || "Draft",
          created_by: created_by === "All" ? "" : created_by,
          _force_refresh: this._just_held_invoice ? Date.now() : void 0
        },
        callback: (response) => {
          frappe.dom.unfreeze();
          console.log("Server response:", response.message);
          this.$invoices_container.empty();
          this.invoices = response.message || [];
          invoicess = response.message || [];
          if (response.message && response.message.length > 0) {
            const fragment = document.createDocumentFragment();
            response.message.forEach((invoice) => {
              const invoice_html = this.get_invoice_html(invoice);
              const temp_div = document.createElement("div");
              temp_div.innerHTML = invoice_html;
              fragment.appendChild(temp_div.firstChild);
            });
            this.$invoices_container.append(fragment);
          } else {
            this.$invoices_container.html('<div style="padding: 20px; text-align: center; color: #999;">No invoices found matching the current filters.</div>');
          }
          this.auto_load_most_recent_summary(response.message);
        },
        error: (error) => {
          frappe.dom.unfreeze();
          console.error("Error fetching past orders:", error);
          this.$invoices_container.html('<div style="padding: 20px; text-align: center; color: #f56565;">Error loading past orders. Please try again.</div>');
          frappe.msgprint(__("Error loading past orders. Please try again."));
        }
      });
    }
    auto_load_most_recent_summary(invoices) {
      if (!invoices || invoices.length === 0) {
        this.events.reset_summary();
        return;
      }
      const most_recent_invoice = this._just_held_invoice ? invoices.find((inv) => inv.name === this._just_held_invoice) || invoices[0] : invoices[0];
      if (most_recent_invoice) {
        this.events.open_invoice_data(most_recent_invoice.name);
        this.highlight_invoice_in_list(most_recent_invoice.name);
        if (this._just_held_invoice && this._just_held_invoice === most_recent_invoice.name) {
          frappe.show_alert({
            message: __("Invoice held successfully: ") + most_recent_invoice.name,
            indicator: "green"
          });
        }
      }
      this._just_held_invoice = null;
    }
    highlight_invoice_in_list(invoice_name) {
      this.$invoices_container.find(".invoice-wrapper").removeClass("highlighted");
      this.$invoices_container.find(`[data-invoice-name="${escape(invoice_name)}"]`).addClass("highlighted");
    }
    set_filter_and_refresh_with_held_invoice(created_by_name, held_invoice_name = null) {
      if (held_invoice_name) {
        this._just_held_invoice = held_invoice_name;
      }
      this._pending_created_by = created_by_name;
      return this.toggle_component(true);
    }
    get_invoice_html(invoice) {
      const posting_date = typeof invoice.posting_date === "string" ? invoice.posting_date : moment(invoice.posting_date).format("YYYY-MM-DD");
      const posting_time = typeof invoice.posting_time === "string" ? invoice.posting_time : moment(invoice.posting_time).format("HH:mm:ss");
      const posting_datetime = moment(posting_date + " " + posting_time).format("Do MMMM, h:mma");
      const checkbox_html = this.can_merge_invoices ? `<div class="invoice-checkbox-container" style="margin-right: 10px; display: flex; align-items: center;">
				<input type="checkbox" class="invoice-checkbox" style="margin: 0;">
			</div>` : "";
      const created_by_html = invoice.created_by_name ? `<div class="invoice-creator" style="font-size: 11px; color: #8d99a6; margin-top: 2px;">
				<svg style="width: 10px; height: 10px; margin-right: 3px;" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
				</svg>
				${frappe.ellipsis(invoice.created_by_name, 15)}
			</div>` : "";
      return `<div class="invoice-wrapper" data-invoice-name="${escape(invoice.name)}" style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #d1d8dd; cursor: pointer;">
				${checkbox_html}
				<div style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
					<div class="invoice-name-date">
						<div class="invoice-name" style="font-weight: 600; margin-bottom: 4px;">${invoice.name}</div>
						<div class="invoice-date" style="font-size: 12px; color: #6c757d; display: flex; align-items: center;">
							<svg class="mr-2" width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
								<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
							</svg>
							${frappe.ellipsis(invoice.customer, 20)}
						</div>
						${created_by_html}
					</div>
					<div class="invoice-total-status" style="text-align: right;">
						<div class="invoice-total" style="font-weight: 600; margin-bottom: 4px;">${format_currency(invoice.grand_total, invoice.currency, 0) || 0}</div>
						<div class="invoice-date" style="font-size: 12px; color: #6c757d;">${posting_datetime}</div>
					</div>
				</div>
			</div>`;
    }
    update_merge_section() {
      if (!this.can_merge_invoices) {
        this.$merge_section.hide();
        return;
      }
      const count = this.selected_invoices.size;
      this.$selected_count.text(count);
      if (count >= 2) {
        this.$merge_section.show();
        this.$merge_btn.prop("disabled", false);
      } else if (count === 1) {
        this.$merge_section.show();
        this.$merge_btn.prop("disabled", true);
      } else {
        this.$merge_section.hide();
      }
    }
    merge_selected_invoices() {
      if (!this.can_merge_invoices) {
        frappe.msgprint(__("You do not have permission to merge invoices."));
        return;
      }
      if (this.selected_invoices.size < 2) {
        frappe.msgprint(__("Please select at least 2 invoices to merge."));
        return;
      }
      const selected_names = Array.from(this.selected_invoices);
      const selected_invoices_data = invoicess.filter((inv) => selected_names.includes(inv.name));
      const customers = [...new Set(selected_invoices_data.map((inv) => inv.customer))];
      if (customers.length > 1) {
        frappe.msgprint(__("Cannot merge invoices with different customers. Please select invoices from the same customer."));
        return;
      }
      frappe.confirm(
        __("Are you sure you want to merge {0} selected invoices? This action cannot be undone.", [selected_names.length]),
        () => {
          this.perform_merge(selected_names, selected_invoices_data[0].customer);
        }
      );
    }
    perform_merge(invoice_names, customer) {
      frappe.dom.freeze(__("Merging invoices..."));
      frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.merge_invoices",
        args: {
          invoice_names,
          customer
        },
        callback: (response) => {
          frappe.dom.unfreeze();
          if (response.message && response.message.success) {
            frappe.show_alert({
              message: __("Invoices merged successfully. New invoice: {0}", [response.message.new_invoice]),
              indicator: "green"
            });
            this.selected_invoices.clear();
            this.refresh_list();
            if (response.message.new_invoice) {
              setTimeout(() => {
                this.events.open_invoice_data(response.message.new_invoice);
              }, 1);
            }
          } else {
            frappe.msgprint(__("Error merging invoices: {0}", [response.message.error || "Unknown error"]));
          }
        },
        error: (error) => {
          frappe.dom.unfreeze();
          frappe.msgprint(__("Error merging invoices. Please try again."));
          console.error("Merge error:", error);
        }
      });
    }
    toggle_component(show) {
      return frappe.run_serially([
        () => {
          if (show) {
            this.$component.css("display", "flex");
            return this.refresh_list();
          } else {
            this.$component.css("display", "none");
            this.selected_invoices.clear();
            this.update_merge_section();
          }
        }
      ]);
    }
  };

  // ../posnext/posnext/public/js/pos_past_order_summary.js
  frappe.provide("posnext.PointOfSale");
  posnext.PointOfSale.PastOrderSummary = class {
    constructor({ wrapper, pos_profile, events }) {
      this.wrapper = wrapper;
      this.pos_profile = pos_profile;
      this.events = events;
      this.init_component();
    }
    init_component() {
      this.prepare_dom();
      this.init_email_print_dialog();
      this.bind_events();
      this.attach_shortcuts();
    }
    prepare_dom() {
      this.wrapper.append(
        `<section class="past-order-summary">
				<div class="no-summary-placeholder">
					${__("Select an invoice to load summary data")}
				</div>
				<div class="invoice-summary-wrapper" >
					<div class="abs-container" >
						<div class="upper-section"></div>
						<div class="label">${__("Items")}</div>
						<div class="items-container summary-container"></div>
						<div class="label">${__("Totals")}</div>
						<div class="totals-container summary-container"></div>
						<div class="label">${__("Payments")}</div>
						<div class="payments-container summary-container"></div>
						<div class="summary-btns"></div>
					</div>
				</div>
			</section>`
      );
      this.$component = this.wrapper.find(".past-order-summary");
      this.$summary_wrapper = this.$component.find(".invoice-summary-wrapper");
      this.$summary_container = this.$component.find(".abs-container");
      this.$upper_section = this.$summary_container.find(".upper-section");
      this.$items_container = this.$summary_container.find(".items-container");
      this.$totals_container = this.$summary_container.find(".totals-container");
      this.$payment_container = this.$summary_container.find(".payments-container");
      this.$summary_btns = this.$summary_container.find(".summary-btns");
    }
    init_email_print_dialog() {
      const email_dialog = new frappe.ui.Dialog({
        title: "Email Receipt",
        fields: [
          { fieldname: "email_id", fieldtype: "Data", options: "Email", label: "Email ID", reqd: 1 },
          { fieldname: "content", fieldtype: "Small Text", label: "Message (if any)" }
        ],
        primary_action: () => {
          this.send_email();
        },
        primary_action_label: __("Send")
      });
      this.email_dialog = email_dialog;
      const payment_dialog = new frappe.ui.Dialog({
        title: "Add Payment",
        fields: [
          {
            fieldname: "mode_of_payment",
            fieldtype: "Link",
            options: "Mode of Payment",
            label: "Mode of Payment",
            reqd: 1
          },
          {
            fieldname: "amount",
            fieldtype: "Currency",
            label: "Amount",
            reqd: 1,
            default: 0
          }
        ],
        primary_action: () => {
          this.create_payment_entry();
        },
        primary_action_label: __("Add-Payment")
      });
      this.payment_dialog = payment_dialog;
      const print_dialog = new frappe.ui.Dialog({
        title: "Print Receipt",
        fields: [
          { fieldname: "print", fieldtype: "Data", label: "Print Preview" }
        ],
        primary_action: () => {
          this.print_receipt();
        },
        primary_action_label: __("Print")
      });
      this.print_dialog = print_dialog;
      const print_order_dialog = new frappe.ui.Dialog({
        title: "Print-Order",
        fields: [
          { fieldname: "print", fieldtype: "Data", label: "Print Preview" }
        ],
        primary_action: () => {
          this.print_order();
        },
        primary_action_label: __("Print")
      });
      this.print_order_dialog = print_order_dialog;
    }
    get_upper_section_html(doc) {
      const { status } = doc;
      let indicator_color = "";
      in_list(["Paid", "Consolidated"], status) && (indicator_color = "green");
      status === "Draft" && (indicator_color = "red");
      status === "Return" && (indicator_color = "grey");
      return `<div class="left-section">
					<div class="customer-name">${doc.customer}</div>
					<div class="customer-email">${this.customer_email}</div>
					<div class="cashier">${__("Sold by")}: ${doc.created_by_name}</div>
				</div>
				<div class="right-section">
					<div class="paid-amount">${format_currency(doc.paid_amount, doc.currency)}</div>
					<div class="invoice-name">${doc.name}</div>
					<span class="indicator-pill whitespace-nowrap ${indicator_color}"><span>${doc.status}</span></span>
				</div>`;
    }
    get_item_html(doc, item_data) {
      return `<div class="item-row-wrapper">
					<div class="item-name">${item_data.item_name}</div>
					<div class="item-qty">${item_data.qty || 0} ${item_data.uom}</div>
					<div class="item-rate-disc">${get_rate_discount_html()}</div>
				</div>`;
      function get_rate_discount_html() {
        if (item_data.rate && item_data.price_list_rate && item_data.rate !== item_data.price_list_rate) {
          return `<span class="item-disc">(${item_data.discount_percentage}% off)</span>
						<div class="item-rate">${format_currency(item_data.rate, doc.currency)}</div>`;
        } else {
          return `<div class="item-rate">${format_currency(item_data.price_list_rate || item_data.rate, doc.currency)}</div>`;
        }
      }
    }
    get_discount_html(doc) {
      if (doc.discount_amount) {
        return `<div class="summary-row-wrapper">
						<div>Discount (${doc.additional_discount_percentage} %)</div>
						<div>${format_currency(doc.discount_amount, doc.currency)}</div>
					</div>`;
      } else {
        return ``;
      }
    }
    get_net_total_html(doc) {
      return `<div class="summary-row-wrapper">
					<div>${__("Net Total")}</div>
					<div>${format_currency(doc.net_total, doc.currency)}</div>
				</div>`;
    }
    get_taxes_html(doc) {
      if (!doc.taxes.length)
        return "";
      let taxes_html = doc.taxes.map((t) => {
        const description = /[0-9]+/.test(t.description) ? t.description : t.rate != 0 ? `${t.description} @ ${t.rate}%` : t.description;
        return `
				<div class="tax-row">
					<div class="tax-label">${description}</div>
					<div class="tax-value">${format_currency(t.tax_amount_after_discount_amount, doc.currency)}</div>
				</div>
			`;
      }).join("");
      return `<div class="taxes-wrapper">${taxes_html}</div>`;
    }
    get_grand_total_html(doc) {
      return `<div class="summary-row-wrapper grand-total">
					<div>${__("Grand Total")}</div>
					<div>${format_currency(doc.grand_total, doc.currency)}</div>
				</div>`;
    }
    get_payment_html(doc, payment) {
      return `<div class="summary-row-wrapper payments">
					<div>${__(payment.mode_of_payment)}</div>
					<div>${format_currency(payment.amount, doc.currency)}</div>
				</div>`;
    }
    bind_events() {
      this.$summary_container.on("click", ".return-btn", () => {
        this.events.process_return(this.doc.name);
        this.toggle_component(false);
        this.$component.find(".no-summary-placeholder").css("display", "flex");
        this.$summary_wrapper.css("display", "none");
      });
      this.$summary_container.on("click", ".edit-btn", () => {
        this.events.edit_order(this.doc.name);
        this.toggle_component(false);
        this.$component.find(".no-summary-placeholder").css("display", "flex");
        this.$summary_wrapper.css("display", "none");
      });
      this.$summary_container.on("click", ".delete-btn", () => {
        this.events.delete_order(this.doc.name);
        this.show_summary_placeholder();
      });
      this.$summary_container.on("click", ".add-payment-btn", () => {
        console.log("Add payment button clicked", this.doc);
        if (!this.doc.outstanding_amount || this.doc.outstanding_amount <= 0) {
          frappe.show_alert({
            message: __("No outstanding amount to pay"),
            indicator: "orange"
          });
          return;
        }
        this.payment_dialog.fields_dict.amount.set_value(this.doc.outstanding_amount);
        this.payment_dialog.show();
      });
      this.$summary_container.on("click", ".send-btn", () => {
        var field_names = this.pos_profile.custom_whatsapp_field_names.map((x) => this.doc[x.field_names.toString()]);
        var message = "https://wa.me/" + this.doc.customer + "?text=";
        message += formatString(this.pos_profile.custom_whatsapp_message, field_names);
        frappe.call({
          method: "posnext.posnext.page.posnext.point_of_sale.generate_pdf_and_save",
          args: {
            docname: this.doc.name,
            doctype: this.doc.doctype,
            print_format: this.pos_profile.print_format
          },
          freeze_message: "Creating file then send to whatsapp thru link....",
          callback: function(r) {
            message += "Please Find your invoice here \n " + window.origin + r.message.file_url;
            window.open(message);
          }
        });
      });
      function formatString(str, args) {
        return str.replace(/{(\d+)}/g, function(match, number) {
          return typeof args[number] !== "undefined" ? args[number] : match;
        });
      }
      this.$summary_container.on("click", ".new-btn", () => {
        this.events.new_order();
        this.toggle_component(false);
        this.$component.find(".no-summary-placeholder").css("display", "flex");
        this.$summary_wrapper.css("display", "none");
      });
      this.$summary_container.on("click", ".email-btn", () => {
        this.email_dialog.fields_dict.email_id.set_value(this.customer_email);
        this.email_dialog.show();
      });
      this.$summary_container.on("click", ".print-order-btn", () => {
        this.print_order();
      });
      this.$summary_container.on("click", ".split-order-btn", () => {
        this.split_order();
      });
      this.$summary_container.on("click", ".print-btn", () => {
        this.print_receipt();
      });
    }
    create_payment_entry() {
      const values = this.payment_dialog.get_values();
      if (!values.mode_of_payment) {
        frappe.show_alert({
          message: __("Please select a mode of payment"),
          indicator: "red"
        });
        return;
      }
      if (values.mode_of_payment.toLowerCase().replace(/ +/g, "_") === "mpesa-tenacity") {
        this.handle_mpesa_paybill_payment(values);
        return;
      }
      if (!values.amount || values.amount <= 0) {
        frappe.show_alert({
          message: __("Please enter a valid amount"),
          indicator: "red"
        });
        return;
      }
      if (values.amount > this.doc.outstanding_amount) {
        frappe.show_alert({
          message: __(
            "Payment amount cannot exceed outstanding amount of {0}",
            [format_currency(this.doc.outstanding_amount, this.doc.currency)]
          ),
          indicator: "red"
        });
        return;
      }
      frappe.dom.freeze(__("Creating Payment Entry..."));
      frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.create_simple_payment_entry",
        args: {
          invoice_name: this.doc.name,
          mode_of_payment: values.mode_of_payment,
          amount: values.amount
        },
        callback: (r) => {
          var _a;
          frappe.dom.unfreeze();
          if (!r.exc && r.message && r.message.success) {
            frappe.show_alert({
              message: __("Payment added successfully"),
              indicator: "green"
            });
            this.payment_dialog.hide();
            frappe.db.get_doc("Sales Invoice", this.doc.name).then((doc) => this.load_summary_of(doc));
          } else {
            frappe.show_alert({
              message: __("Error creating payment: ") + (((_a = r.message) == null ? void 0 : _a.error) || r.exc || "Unknown error"),
              indicator: "red"
            });
          }
        }
      });
    }
    handle_mpesa_paybill_payment(values) {
      const me = this;
      const doc = this.doc;
      const outstanding_amount = doc.outstanding_amount;
      frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.get_available_mpesa_payments",
        callback: function(r) {
          if (r.message && r.message.length > 0) {
            me.create_partial_mpesa_dialog(r.message, doc, outstanding_amount, values);
          } else {
            frappe.msgprint({
              title: __("No Available Payments"),
              message: __("No Mpesa payments with available amounts found."),
              indicator: "orange"
            });
          }
        }
      });
    }
    create_partial_mpesa_dialog(payments, doc, outstanding_amount, payment_values) {
      const me = this;
      const payment_rows = payments.map((payment) => {
        const formatted_amount = format_currency(payment.transamount, doc.currency);
        const available_amount = format_currency(payment.available_amount, doc.currency);
        const formatted_time = frappe.datetime.str_to_user(payment.transtime);
        const status_color = payment.payment_status === "Unapplied" ? "#28a745" : payment.payment_status === "Partly Applied" ? "#ffc107" : "#6c757d";
        return `
            <tr data-payment-id="${payment.name}" data-available="${payment.available_amount}">
                <td style="text-align: center;">
                    <input type="checkbox" class="payment-checkbox" />
                </td>
                <td>${payment.full_name || ""}</td>
                <td>${payment.transid || ""}</td>
                <td style="text-align: right;">${formatted_amount}</td>
                <td style="text-align: right; font-weight: bold;">${available_amount}</td>
                <td>
                    <span style="color: ${status_color}; font-size: 12px; font-weight: bold;">
                        ${__(payment.payment_status)}
                    </span>
                </td>
                <td style="text-align: center;">
                    <input type="number" class="form-control amount-input" 
                           style="width: 100px; font-size: 12px;" 
                           min="0" max="${payment.available_amount}" 
                           step="0.01" placeholder="Amount" disabled />
                </td>
                <td>${formatted_time}</td>
            </tr>
        `;
      }).join("");
      const dialog_html = `
        <div class="mpesa-payment-dialog">
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
                    <strong>${__("Outstanding Amount")}: ${format_currency(outstanding_amount, doc.currency)}</strong>
                    <span id="selected-total" style="color: #28a745; font-weight: bold;">
                        ${__("Selected")}: ${format_currency(0, doc.currency)}
                    </span>
                </div>
            </div>

            <div style="max-height: 500px; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px;">
                <table class="table table-striped" style="margin: 0;">
                    <thead style="background-color: #f8f9fa; position: sticky; top: 0;">
                        <tr>
                            <th style="text-align: center; width: 50px;">${__("Select")}</th>
                            <th>${__("Name")}</th>
                            <th>${__("Trans ID")}</th>
                            <th style="text-align: right;">${__("Original")}</th>
                            <th style="text-align: right;">${__("Available")}</th>
                            <th>${__("Status")}</th>
                            <th style="text-align: center;">${__("Apply Amount")}</th>
                            <th>${__("Time")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payment_rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
      const dialog = new frappe.ui.Dialog({
        title: __("Apply Partial Mpesa Payments"),
        fields: [
          {
            fieldtype: "HTML",
            fieldname: "payment_selection",
            options: dialog_html
          }
        ],
        size: "extra-large",
        primary_action_label: __("Apply Selected Payments"),
        primary_action: function() {
          me.apply_partial_mpesa_payments(dialog, doc, payment_values);
        },
        secondary_action_label: __("Cancel")
      });
      dialog.show();
      setTimeout(() => {
        const dialog_wrapper = dialog.$wrapper;
        dialog_wrapper.find(".payment-checkbox").on("change", function() {
          const row = $(this).closest("tr");
          const amount_input = row.find(".amount-input");
          const available_amount = parseFloat(row.data("available"));
          if ($(this).is(":checked")) {
            amount_input.prop("disabled", false);
            const auto_amount = Math.min(available_amount, outstanding_amount);
            amount_input.val(auto_amount);
          } else {
            amount_input.prop("disabled", true).val("");
          }
          me.update_partial_payment_total(dialog_wrapper, doc.currency);
        });
        dialog_wrapper.find(".amount-input").on("input", function() {
          me.update_partial_payment_total(dialog_wrapper, doc.currency);
        });
      }, 100);
    }
    update_partial_payment_total(dialog_wrapper, currency) {
      let total = 0;
      dialog_wrapper.find(".payment-checkbox:checked").each(function() {
        const row = $(this).closest("tr");
        const amount_input = row.find(".amount-input");
        const amount = parseFloat(amount_input.val()) || 0;
        total += amount;
      });
      dialog_wrapper.find("#selected-total").html(
        `${__("Selected")}: ${format_currency(total, currency)}`
      );
    }
    apply_partial_mpesa_payments(dialog, doc, payment_values) {
      const me = this;
      const selected_payments = [];
      let total_amount = 0;
      let has_error = false;
      dialog.$wrapper.find(".payment-checkbox:checked").each(function() {
        const row = $(this).closest("tr");
        const payment_id = row.data("payment-id");
        const available_amount = parseFloat(row.data("available"));
        const amount_input = row.find(".amount-input");
        const apply_amount = parseFloat(amount_input.val()) || 0;
        if (apply_amount <= 0) {
          frappe.msgprint({
            title: __("Invalid Amount"),
            message: __("Please enter a valid amount for all selected payments."),
            indicator: "red"
          });
          has_error = true;
          return false;
        }
        if (apply_amount > available_amount) {
          frappe.msgprint({
            title: __("Amount Exceeds Available"),
            message: __("Applied amount cannot exceed available amount for payment {0}", [payment_id]),
            indicator: "red"
          });
          has_error = true;
          return false;
        }
        selected_payments.push({
          id: payment_id,
          amount: apply_amount
        });
        total_amount += apply_amount;
      });
      const outstanding_amount = doc.outstanding_amount;
      if (total_amount > outstanding_amount) {
        frappe.msgprint({
          title: __("Amount Exceeds Outstanding"),
          message: __("Total applied amount ({0}) cannot exceed outstanding amount ({1})", [
            format_currency(total_amount, doc.currency),
            format_currency(outstanding_amount, doc.currency)
          ]),
          indicator: "red"
        });
        return;
      }
      if (has_error || selected_payments.length === 0) {
        if (selected_payments.length === 0) {
          frappe.msgprint({
            title: __("No Selection"),
            message: __("Please select at least one payment to apply."),
            indicator: "orange"
          });
        }
        return;
      }
      frappe.confirm(
        __("Apply {0} selected payments totaling {1}?", [
          selected_payments.length,
          format_currency(total_amount, doc.currency)
        ]),
        function() {
          me.process_partial_mpesa_payments(selected_payments, doc, total_amount, payment_values);
          dialog.hide();
        }
      );
    }
    process_partial_mpesa_payments(selected_payments, doc, total_amount, payment_values) {
      const me = this;
      frappe.show_alert({
        message: __("Processing partial Mpesa payments..."),
        indicator: "blue"
      });
      frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.apply_partial_mpesa_payments",
        args: {
          payments_data: selected_payments,
          invoice_name: doc.name
        },
        callback: function(r) {
          var _a;
          if (r.message && r.message.success) {
            frappe.call({
              method: "posnext.posnext.page.posnext.point_of_sale.create_simple_payment_entry",
              args: {
                invoice_name: doc.name,
                mode_of_payment: payment_values.mode_of_payment,
                amount: total_amount
              },
              callback: function(payment_r) {
                var _a2;
                if (payment_r.message && payment_r.message.success) {
                  frappe.show_alert({
                    message: __("Partial Mpesa payments applied successfully!"),
                    indicator: "green"
                  });
                  me.payment_dialog.hide();
                  frappe.db.get_doc("Sales Invoice", doc.name).then((updated_doc) => me.load_summary_of(updated_doc));
                } else {
                  frappe.msgprint({
                    title: __("Payment Entry Error"),
                    message: ((_a2 = payment_r.message) == null ? void 0 : _a2.error) || __("Failed to create payment entry."),
                    indicator: "red"
                  });
                }
              }
            });
          } else {
            frappe.msgprint({
              title: __("Error"),
              message: ((_a = r.message) == null ? void 0 : _a.message) || __("Failed to apply payments. Please try again."),
              indicator: "red"
            });
          }
        },
        error: function(error) {
          console.error("Error applying partial payments:", error);
          frappe.msgprint({
            title: __("Error"),
            message: __("Failed to apply payments. Please try again."),
            indicator: "red"
          });
        }
      });
    }
    print_receipt() {
      const frm = this.events.get_frm();
      const print_format = this.pos_profile.custom_sales_invoice_print_format || frm.pos_print_format;
      const doctype = this.doc.doctype;
      const docname = this.doc.name;
      const letterhead = this.doc.letter_head || __("No Letterhead");
      const lang_code = this.doc.language || frappe.boot.lang;
      frappe.db.get_value("Print Settings", "Print Settings", "enable_raw_printing").then(({ message }) => {
        if (message && message.enable_raw_printing === "1") {
          this._print_via_qz(doctype, docname, print_format, letterhead, lang_code);
        } else {
          frappe.utils.print(
            doctype,
            docname,
            print_format,
            letterhead,
            lang_code
          );
        }
      });
    }
    split_order() {
      if (!this.doc || !this.doc.items || this.doc.items.length === 0) {
        frappe.show_alert({
          message: __("No items available to split."),
          indicator: "red"
        });
        return;
      }
      if (this.doc.docstatus !== 0) {
        frappe.show_alert({
          message: __("Cannot split submitted invoices."),
          indicator: "red"
        });
        return;
      }
      this.show_simple_split_dialog();
    }
    show_simple_split_dialog() {
      const items_data = this.doc.items.map((item, index) => ({
        idx: index + 1,
        item_code: item.item_code,
        item_name: item.item_name || item.item_code,
        available_qty: item.qty,
        split_qty: 0,
        rate: item.rate,
        uom: item.uom,
        invoice_number: 1,
        selected: false
      }));
      const dialog = new frappe.ui.Dialog({
        title: __("Split Order"),
        size: "large",
        fields: [
          {
            fieldtype: "HTML",
            fieldname: "instructions",
            options: `
						<div class="alert alert-info mb-3">
							<strong>How to split:</strong>
							<ol class="mb-0">
								<li>Check items you want to move to new invoices</li>
								<li>Enter quantities to split</li>
								<li>Choose which invoice each item goes to</li>
								<li>Click "Split Order" to complete</li>
							</ol>
						</div>
					`
          },
          {
            fieldtype: "Int",
            fieldname: "number_of_invoices",
            label: __("Number of New Invoices"),
            default: 1,
            reqd: 1,
            description: __("How many new invoices to create (1-5)"),
            change: () => {
              const count = dialog.get_value("number_of_invoices");
              if (count >= 1 && count <= 5) {
                this.update_split_table(dialog, items_data, count);
              }
            }
          },
          {
            fieldtype: "HTML",
            fieldname: "split_table",
            options: this.get_split_table_html(items_data, 1)
          }
        ],
        primary_action: () => {
          this.execute_simple_split(dialog, items_data);
        },
        primary_action_label: __("Split Order"),
        secondary_action_label: __("Cancel")
      });
      this.split_dialog = dialog;
      this.split_items_data = items_data;
      dialog.show();
      setTimeout(() => {
        this.bind_split_events(dialog);
      }, 1);
    }
    get_split_table_html(items_data, invoice_count) {
      let invoice_options = "";
      for (let i = 1; i <= invoice_count; i++) {
        invoice_options += `<option value="${i}">Invoice ${i}</option>`;
      }
      let html = `
			<div class="split-table-container">
				<table class="table table-bordered">
					<thead class="thead-light">
						<tr>
							<th width="5%">
								<input type="checkbox" id="select-all" title="Select All">
							</th>
							<th width="25%">${__("Item")}</th>
							<th width="15%">${__("Available Qty")}</th>
							<th width="15%">${__("Split Qty")}</th>
							<th width="15%">${__("Rate")}</th>
							<th width="15%">${__("Amount")}</th>
							<th width="10%">${__("Invoice")}</th>
						</tr>
					</thead>
					<tbody>
		`;
      items_data.forEach((item, index) => {
        html += `
				<tr data-index="${index}">
					<td>
						<input type="checkbox" class="item-select" data-index="${index}">
					</td>
					<td>
						<div><strong>${item.item_code}</strong></div>
						<small class="text-muted">${item.item_name}</small>
					</td>
					<td>
						<span class="badge badge-secondary">${item.available_qty} ${item.uom}</span>
					</td>
					<td>
						<input type="number" 
							   class="form-control split-qty" 
							   data-index="${index}"
							   min="0" 
							   max="${item.available_qty}" 
							   step="0.01"
							   value="0">
					</td>
					<td>
						${format_currency(item.rate, this.doc.currency)}
					</td>
					<td>
						<span class="split-amount" data-index="${index}">
							${format_currency(0, this.doc.currency)}
						</span>
					</td>
					<td>
						<select class="form-control invoice-select" data-index="${index}">
							${invoice_options}
						</select>
					</td>
				</tr>
			`;
      });
      html += `
					</tbody>
				</table>
				<div class="row mt-3">
					<div class="col-md-6">
						<div class="alert alert-light">
							<strong>Selected Items:</strong> <span id="selected-count">0</span>
						</div>
					</div>
					<div class="col-md-6">
						<div class="alert alert-light">
							<strong>Total Split Amount:</strong> <span id="total-amount">${format_currency(0, this.doc.currency)}</span>
						</div>
					</div>
				</div>
			</div>
		`;
      return html;
    }
    update_split_table(dialog, items_data, invoice_count) {
      if (invoice_count < 1 || invoice_count > 5) {
        frappe.show_alert({
          message: __("Number of invoices must be between 1 and 5"),
          indicator: "orange"
        });
        return;
      }
      const new_html = this.get_split_table_html(items_data, invoice_count);
      dialog.fields_dict.split_table.$wrapper.html(new_html);
      this.restore_selections(dialog, items_data);
      setTimeout(() => {
        this.bind_split_events(dialog);
      }, 1);
    }
    restore_selections(dialog, items_data) {
      const wrapper = dialog.$wrapper;
      items_data.forEach((item, index) => {
        const row = wrapper.find(`tr[data-index="${index}"]`);
        row.find(".item-select").prop("checked", item.selected);
        row.find(".split-qty").val(item.split_qty);
        row.find(".invoice-select").val(item.invoice_number);
        this.update_split_amount(index, item.split_qty, item.rate);
      });
      this.update_summary();
    }
    bind_split_events(dialog) {
      const wrapper = dialog.$wrapper;
      wrapper.find("#select-all").on("change", (e) => {
        const checked = $(e.target).is(":checked");
        wrapper.find(".item-select").prop("checked", checked);
        wrapper.find(".split-qty").each((i, input) => {
          const index = $(input).data("index");
          const max_qty = parseFloat($(input).attr("max"));
          const qty = checked ? max_qty : 0;
          $(input).val(qty);
          this.split_items_data[index].selected = checked;
          this.split_items_data[index].split_qty = qty;
          this.update_split_amount(index, qty, this.split_items_data[index].rate);
        });
        this.update_summary();
      });
      wrapper.find(".item-select").on("change", (e) => {
        const checkbox = $(e.target);
        const index = checkbox.data("index");
        const checked = checkbox.is(":checked");
        const qty_input = wrapper.find(`.split-qty[data-index="${index}"]`);
        this.split_items_data[index].selected = checked;
        if (checked) {
          const max_qty = parseFloat(qty_input.attr("max"));
          qty_input.val(max_qty);
          this.split_items_data[index].split_qty = max_qty;
          this.update_split_amount(index, max_qty, this.split_items_data[index].rate);
        } else {
          qty_input.val(0);
          this.split_items_data[index].split_qty = 0;
          this.update_split_amount(index, 0, this.split_items_data[index].rate);
        }
        this.update_summary();
      });
      wrapper.find(".split-qty").on("input change", (e) => {
        const input = $(e.target);
        const index = input.data("index");
        let qty = parseFloat(input.val()) || 0;
        const max_qty = parseFloat(input.attr("max"));
        if (qty > max_qty) {
          qty = max_qty;
          input.val(qty);
        }
        if (qty < 0) {
          qty = 0;
          input.val(qty);
        }
        const checkbox = wrapper.find(`.item-select[data-index="${index}"]`);
        checkbox.prop("checked", qty > 0);
        this.split_items_data[index].split_qty = qty;
        this.split_items_data[index].selected = qty > 0;
        this.update_split_amount(index, qty, this.split_items_data[index].rate);
        this.update_summary();
      });
      wrapper.find(".invoice-select").on("change", (e) => {
        const select = $(e.target);
        const index = select.data("index");
        const invoice_num = parseInt(select.val());
        this.split_items_data[index].invoice_number = invoice_num;
      });
    }
    update_split_amount(index, qty, rate) {
      const amount = qty * rate;
      this.split_dialog.$wrapper.find(`.split-amount[data-index="${index}"]`).text(format_currency(amount, this.doc.currency));
    }
    update_summary() {
      const selected_items = this.split_items_data.filter((item) => item.selected && item.split_qty > 0);
      const total_amount = selected_items.reduce((sum, item) => sum + item.split_qty * item.rate, 0);
      this.split_dialog.$wrapper.find("#selected-count").text(selected_items.length);
      this.split_dialog.$wrapper.find("#total-amount").text(format_currency(total_amount, this.doc.currency));
    }
    execute_simple_split(dialog, items_data) {
      const selected_items = items_data.filter((item) => item.selected && item.split_qty > 0);
      if (selected_items.length === 0) {
        frappe.show_alert({
          message: __("Please select at least one item to split."),
          indicator: "orange"
        });
        return;
      }
      const invoice_groups = {};
      selected_items.forEach((item) => {
        const invoice_key = item.invoice_number.toString();
        if (!invoice_groups[invoice_key]) {
          invoice_groups[invoice_key] = [];
        }
        invoice_groups[invoice_key].push({
          item_code: item.item_code,
          split_qty: item.split_qty
        });
      });
      const payment_distribution = this.calculate_payment_distribution(selected_items, invoice_groups);
      const invoice_count = Object.keys(invoice_groups).length;
      const total_items = selected_items.length;
      const total_amount = selected_items.reduce((sum, item) => sum + item.split_qty * item.rate, 0);
      frappe.confirm(
        __(`This will create ${invoice_count} new invoice(s) with ${total_items} items (${format_currency(total_amount, this.doc.currency)}). Continue?`),
        () => {
          this.process_split_order(invoice_groups, payment_distribution);
          dialog.hide();
        }
      );
    }
    calculate_payment_distribution(selected_items, invoice_groups) {
      const total_split_amount = selected_items.reduce((sum, item) => sum + item.split_qty * item.rate, 0);
      const original_total_paid = this.doc.paid_amount || 0;
      const payment_distribution = {};
      Object.keys(invoice_groups).forEach((invoice_key) => {
        const group_items = invoice_groups[invoice_key];
        const group_amount = group_items.reduce((sum, group_item) => {
          const item_data = selected_items.find((item) => item.item_code === group_item.item_code);
          return sum + group_item.split_qty * item_data.rate;
        }, 0);
        const payment_ratio = group_amount / total_split_amount;
        const allocated_payment = original_total_paid * payment_ratio;
        payment_distribution[invoice_key] = {
          amount: group_amount,
          payment_amount: allocated_payment,
          payment_ratio
        };
      });
      return payment_distribution;
    }
    process_split_order(invoice_groups, payment_distribution) {
      frappe.dom.freeze(__("Splitting order..."));
      frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.split_pos_invoice",
        args: {
          original_invoice: this.doc.name,
          invoice_groups,
          payment_distribution,
          distribute_evenly: false
        },
        callback: (r) => {
          var _a;
          frappe.dom.unfreeze();
          if (!r.exc && r.message && r.message.success) {
            const result = r.message;
            const first_invoice_name = result.new_invoices && result.new_invoices.length > 0 ? result.new_invoices[0].name : null;
            const operations = [];
            frappe.show_alert({
              message: __("Order split successfully. Created {0} new invoice(s)", [result.new_invoices.length]),
              indicator: "green"
            });
            if (posnext.PointOfSale.PastOrderList.current_instance) {
              operations.push(
                posnext.PointOfSale.PastOrderList.current_instance.refresh_list()
              );
            }
            if (first_invoice_name && ((_a = posnext.PointOfSale.PastOrderList.current_instance) == null ? void 0 : _a.events.open_invoice_data)) {
              operations.push(
                frappe.db.get_doc("Sales Invoice", first_invoice_name).then((doc) => {
                  if (posnext.PointOfSale.PastOrderList.current_instance.events.reset_summary) {
                    posnext.PointOfSale.PastOrderList.current_instance.events.reset_summary();
                  }
                  this.load_summary_of(doc);
                })
              );
            }
            Promise.all(operations).catch(() => {
            });
          } else {
            frappe.show_alert({
              message: __("Failed to split order: ") + (r.message || r.exc),
              indicator: "red"
            });
          }
        },
        error: (r) => {
          frappe.dom.unfreeze();
          frappe.show_alert({
            message: __("Error occurred while splitting order."),
            indicator: "red"
          });
        }
      });
    }
    print_order() {
      const doctype = this.doc.doctype;
      const docname = this.doc.name;
      const print_format = "Captain Order 2";
      const letterhead = this.doc.letter_head || __("No Letterhead");
      const lang_code = this.doc.language || frappe.boot.lang;
      const _print_via_qz = (doctype2, docname2, print_format2, letterhead2, lang_code2) => {
        const print_format_printer_map = _get_print_format_printer_map();
        const mapped_printer = _get_mapped_printer(print_format_printer_map, doctype2, print_format2);
        if (mapped_printer.length === 1) {
          _print_with_mapped_printer(doctype2, docname2, print_format2, letterhead2, lang_code2, mapped_printer[0]);
        } else if (_is_raw_printing(print_format2)) {
          frappe.show_alert({
            message: __("Printer mapping not set."),
            subtitle: __("Please set a printer mapping for this print format in the Printer Settings"),
            indicator: "warning"
          }, 14);
          _printer_setting_dialog(doctype2, print_format2);
        } else {
          _render_pdf_or_regular_print(doctype2, docname2, print_format2, letterhead2, lang_code2);
        }
      };
      const _print_with_mapped_printer = (doctype2, docname2, print_format2, letterhead2, lang_code2, printer_map) => {
        if (_is_raw_printing(print_format2)) {
          _get_raw_commands(doctype2, docname2, print_format2, lang_code2, (out) => {
            if (out.message === "No new items to print") {
              frappe.show_alert({
                message: __("No new items to print for this captain order."),
                indicator: "info"
              }, 10);
              return;
            }
            frappe.ui.form.qz_connect().then(() => {
              let config = qz.configs.create(printer_map.printer);
              let data = [out.raw_commands];
              return qz.print(config, data);
            }).then(frappe.ui.form.qz_success).catch((err) => {
              frappe.ui.form.qz_fail(err);
              frappe.show_alert({
                message: __("Failed to print: " + (err.message || err)),
                indicator: "red"
              });
              frappe.utils.play_sound("error");
            });
          });
        } else {
          frappe.show_alert({
            message: __('PDF printing via "Raw Print" is not supported.'),
            subtitle: __("Please remove the printer mapping in Printer Settings and try again."),
            indicator: "info"
          }, 14);
          _render_pdf_or_regular_print(doctype2, docname2, print_format2, letterhead2, lang_code2);
        }
      };
      const _get_raw_commands = (doctype2, docname2, print_format2, lang_code2, callback) => {
        const items_to_print = this.doc.items.map((item) => ({
          item_code: item.item_code,
          item_name: item.item_name || item.item_code,
          qty: item.qty,
          uom: item.uom,
          rate: item.rate,
          name: item.name
        }));
        frappe.call({
          method: "posnext.posnext.page.posnext.point_of_sale.print_captain_order",
          args: {
            invoice_name: docname2,
            current_items: items_to_print,
            print_format: print_format2,
            _lang: lang_code2
          },
          callback: (r) => {
            var _a;
            if (!r.exc && r.message && r.message.success) {
              if (r.message.new_items_count === 0) {
                callback({ message: "No new items to print" });
                return;
              }
              if (!r.message.data || !r.message.data.items || r.message.data.items.length === 0) {
                callback({ message: "No new items to print" });
                return;
              }
              _render_print_format(r.message.data, print_format2, (raw_commands) => {
                callback({ raw_commands, message: r.message.message });
              });
            } else {
              frappe.show_alert({
                message: __("Failed to generate print data: " + (((_a = r.message) == null ? void 0 : _a.error) || "Unknown error")),
                indicator: "red"
              });
              frappe.utils.play_sound("error");
            }
          }
        });
      };
      const _render_print_format = (doc_data, print_format2, callback) => {
        if (!doc_data || !doc_data.items || !doc_data.items.length) {
          callback("");
          return;
        }
        frappe.call({
          method: "frappe.client.get",
          args: {
            doctype: "Print Format",
            name: print_format2
          },
          callback: (r) => {
            if (!r.exc && r.message) {
              const print_format_doc = r.message;
              if (print_format_doc.raw_printing !== 1) {
                frappe.show_alert({
                  message: __("Print format is not set for raw printing."),
                  indicator: "red"
                });
                frappe.utils.play_sound("error");
                return;
              }
              const template = print_format_doc.raw_commands || "";
              if (!template) {
                frappe.show_alert({
                  message: __("No raw commands defined in the print format."),
                  indicator: "red"
                });
                frappe.utils.play_sound("error");
                return;
              }
              try {
                const context = { doc: doc_data };
                const raw_commands = frappe.render_template(template, context);
                callback(raw_commands);
              } catch (error) {
                frappe.show_alert({
                  message: __("Error rendering print format: " + (error.message || error)),
                  indicator: "red"
                });
                frappe.utils.play_sound("error");
                callback("");
              }
            } else {
              frappe.show_alert({
                message: __("Failed to fetch print format."),
                indicator: "red"
              });
              frappe.utils.play_sound("error");
              callback("");
            }
          }
        });
      };
      const _is_raw_printing = (format) => {
        let print_format2 = {};
        if (locals["Print Format"] && locals["Print Format"][format]) {
          print_format2 = locals["Print Format"][format];
        }
        return print_format2.raw_printing === 1;
      };
      const _get_print_format_printer_map = () => {
        try {
          return JSON.parse(localStorage.print_format_printer_map || "{}");
        } catch (e) {
          return {};
        }
      };
      const _get_mapped_printer = (print_format_printer_map, doctype2, print_format2) => {
        if (print_format_printer_map[doctype2]) {
          return print_format_printer_map[doctype2].filter(
            (printer_map) => printer_map.print_format === print_format2
          );
        }
        return [];
      };
      const _render_pdf_or_regular_print = (doctype2, docname2, print_format2, letterhead2, lang_code2) => {
        frappe.utils.print(
          doctype2,
          docname2,
          print_format2,
          letterhead2,
          lang_code2
        );
      };
      const _printer_setting_dialog = (doctype2, current_print_format) => {
        let print_format_printer_map = _get_print_format_printer_map();
        let data = print_format_printer_map[doctype2] || [];
        frappe.ui.form.qz_get_printer_list().then((printer_list) => {
          if (!(printer_list && printer_list.length)) {
            frappe.throw(__("No Printer is Available."));
            return;
          }
          const dialog = new frappe.ui.Dialog({
            title: __("Printer Settings"),
            fields: [
              { fieldtype: "Section Break" },
              {
                fieldname: "printer_mapping",
                fieldtype: "Table",
                label: __("Printer Mapping"),
                in_place_edit: true,
                data,
                get_data: () => data,
                fields: [
                  {
                    fieldtype: "Select",
                    fieldname: "print_format",
                    default: 0,
                    options: frappe.meta.get_print_formats(doctype2),
                    read_only: 0,
                    in_list_view: 1,
                    label: __("Print Format")
                  },
                  {
                    fieldtype: "Select",
                    fieldname: "printer",
                    default: 0,
                    options: printer_list,
                    read_only: 0,
                    in_list_view: 1,
                    label: __("Printer")
                  }
                ]
              }
            ],
            primary_action: () => {
              let printer_mapping = dialog.get_values()["printer_mapping"];
              if (printer_mapping && printer_mapping.length) {
                let print_format_list = printer_mapping.map((a) => a.print_format);
                let has_duplicate = print_format_list.some(
                  (item, idx) => print_format_list.indexOf(item) != idx
                );
                if (has_duplicate) {
                  frappe.throw(__("Cannot have multiple printers mapped to a single print format."));
                  return;
                }
              } else {
                printer_mapping = [];
              }
              let saved_print_format_printer_map = _get_print_format_printer_map();
              saved_print_format_printer_map[doctype2] = printer_mapping;
              localStorage.print_format_printer_map = JSON.stringify(saved_print_format_printer_map);
              dialog.hide();
              _print_via_qz(doctype2, docname, current_print_format, letterhead, lang_code);
            },
            primary_action_label: __("Save")
          });
          dialog.show();
        });
      };
      if (!this.doc.items.length) {
        frappe.show_alert({
          message: __("No items in the invoice to print."),
          indicator: "red"
        });
        return frappe.utils.play_sound("error");
      }
      frappe.db.get_value("Print Settings", "Print Settings", "enable_raw_printing").then(({ message }) => {
        if (message && message.enable_raw_printing === "1") {
          _print_via_qz(doctype, docname, print_format, letterhead, lang_code);
        } else {
          _render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code);
        }
      }).catch(() => {
        frappe.show_alert({
          message: __("Failed to check Print Settings."),
          indicator: "red"
        });
        frappe.utils.play_sound("error");
      });
    }
    _print_via_qz(doctype, docname, print_format, letterhead, lang_code) {
      const print_format_printer_map = this._get_print_format_printer_map();
      const mapped_printer = this._get_mapped_printer(print_format_printer_map, doctype, print_format);
      if (mapped_printer.length === 1) {
        this._print_with_mapped_printer(doctype, docname, print_format, letterhead, lang_code, mapped_printer[0]);
      } else if (this._is_raw_printing(print_format)) {
        frappe.show_alert({
          message: __("Printer mapping not set."),
          subtitle: __("Please set a printer mapping for this print format in the Printer Settings"),
          indicator: "warning"
        }, 14);
        this._printer_setting_dialog(doctype, print_format);
      } else {
        this._render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code);
      }
    }
    _print_with_mapped_printer(doctype, docname, print_format, letterhead, lang_code, printer_map) {
      if (this._is_raw_printing(print_format)) {
        this._get_raw_commands(doctype, docname, print_format, lang_code, (out) => {
          frappe.ui.form.qz_connect().then(() => {
            let config = qz.configs.create(printer_map.printer);
            let data = [out.raw_commands];
            return qz.print(config, data);
          }).then(frappe.ui.form.qz_success).catch((err) => {
            frappe.ui.form.qz_fail(err);
          });
        });
      } else {
        frappe.show_alert({
          message: __('PDF printing via "Raw Print" is not supported.'),
          subtitle: __("Please remove the printer mapping in Printer Settings and try again."),
          indicator: "info"
        }, 14);
        this._render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code);
      }
    }
    _get_raw_commands(doctype, docname, print_format, lang_code, callback) {
      frappe.call({
        method: "frappe.www.printview.get_rendered_raw_commands",
        args: {
          doc: frappe.get_doc(doctype, docname),
          print_format,
          _lang: lang_code
        },
        callback: (r) => {
          if (!r.exc) {
            callback(r.message);
          }
        }
      });
    }
    _is_raw_printing(format) {
      let print_format = {};
      if (locals["Print Format"] && locals["Print Format"][format]) {
        print_format = locals["Print Format"][format];
      }
      return print_format.raw_printing === 1;
    }
    _get_print_format_printer_map() {
      try {
        return JSON.parse(localStorage.print_format_printer_map || "{}");
      } catch (e) {
        return {};
      }
    }
    _get_mapped_printer(print_format_printer_map, doctype, print_format) {
      if (print_format_printer_map[doctype]) {
        return print_format_printer_map[doctype].filter(
          (printer_map) => printer_map.print_format === print_format
        );
      }
      return [];
    }
    _render_pdf_or_regular_print(doctype, docname, print_format, letterhead, lang_code) {
      frappe.utils.print(
        doctype,
        docname,
        print_format,
        letterhead,
        lang_code
      );
    }
    _printer_setting_dialog(doctype, current_print_format) {
      let print_format_printer_map = this._get_print_format_printer_map();
      let data = print_format_printer_map[doctype] || [];
      frappe.ui.form.qz_get_printer_list().then((printer_list) => {
        if (!(printer_list && printer_list.length)) {
          frappe.throw(__("No Printer is Available."));
          return;
        }
        const dialog = new frappe.ui.Dialog({
          title: __("Printer Settings"),
          fields: [
            {
              fieldtype: "Section Break"
            },
            {
              fieldname: "printer_mapping",
              fieldtype: "Table",
              label: __("Printer Mapping"),
              in_place_edit: true,
              data,
              get_data: () => {
                return data;
              },
              fields: [
                {
                  fieldtype: "Select",
                  fieldname: "print_format",
                  default: 0,
                  options: frappe.meta.get_print_formats(doctype),
                  read_only: 0,
                  in_list_view: 1,
                  label: __("Print Format")
                },
                {
                  fieldtype: "Select",
                  fieldname: "printer",
                  default: 0,
                  options: printer_list,
                  read_only: 0,
                  in_list_view: 1,
                  label: __("Printer")
                }
              ]
            }
          ],
          primary_action: () => {
            let printer_mapping = dialog.get_values()["printer_mapping"];
            if (printer_mapping && printer_mapping.length) {
              let print_format_list = printer_mapping.map((a) => a.print_format);
              let has_duplicate = print_format_list.some(
                (item, idx) => print_format_list.indexOf(item) != idx
              );
              if (has_duplicate) {
                frappe.throw(__("Cannot have multiple printers mapped to a single print format."));
                return;
              }
            } else {
              printer_mapping = [];
            }
            let saved_print_format_printer_map = this._get_print_format_printer_map();
            saved_print_format_printer_map[doctype] = printer_mapping;
            localStorage.print_format_printer_map = JSON.stringify(saved_print_format_printer_map);
            dialog.hide();
            this._print_via_qz(doctype, this.doc.name, current_print_format, this.doc.letter_head, this.doc.language || frappe.boot.lang);
          },
          primary_action_label: __("Save")
        });
        dialog.show();
      });
    }
    attach_shortcuts() {
      const ctrl_label = frappe.utils.is_mac() ? "\u2318" : "Ctrl";
      this.$summary_container.find(".print-btn").attr("title", `${ctrl_label}+P`);
      frappe.ui.keys.add_shortcut({
        shortcut: "ctrl+p",
        action: () => this.$summary_container.find(".print-btn").click(),
        condition: () => this.$component.is(":visible") && this.$summary_container.find(".print-btn").is(":visible"),
        description: __("Print Receipt"),
        page: cur_page.page.page
      });
      this.$summary_container.find(".print-order-btn").attr("title", `${ctrl_label}+O`);
      frappe.ui.keys.add_shortcut({
        shortcut: "ctrl+o",
        action: () => this.$summary_container.find(".print-order-btn").click(),
        condition: () => this.$component.is(":visible") && this.$summary_container.find(".print-order-btn").is(":visible"),
        description: __("Print-Order"),
        page: cur_page.page.page
      });
      this.$summary_container.find(".new-btn").attr("title", `${ctrl_label}+Enter`);
      frappe.ui.keys.on("ctrl+enter", () => {
        const summary_is_visible = this.$component.is(":visible");
        if (summary_is_visible && this.$summary_container.find(".new-btn").is(":visible")) {
          this.$summary_container.find(".new-btn").click();
        }
      });
      this.$summary_container.find(".edit-btn").attr("title", `${ctrl_label}+E`);
      frappe.ui.keys.add_shortcut({
        shortcut: "ctrl+e",
        action: () => this.$summary_container.find(".edit-btn").click(),
        condition: () => this.$component.is(":visible") && this.$summary_container.find(".edit-btn").is(":visible"),
        description: __("Edit Receipt"),
        page: cur_page.page.page
      });
    }
    send_email() {
      const frm = this.events.get_frm();
      const recipients = this.email_dialog.get_values().email_id;
      const content = this.email_dialog.get_values().content;
      const doc = this.doc || frm.doc;
      const print_format = frm.pos_print_format;
      frappe.call({
        method: "frappe.core.doctype.communication.email.make",
        args: {
          recipients,
          subject: __(frm.meta.name) + ": " + doc.name,
          content: content ? content : __(frm.meta.name) + ": " + doc.name,
          doctype: doc.doctype,
          name: doc.name,
          send_email: 1,
          print_format,
          sender_full_name: frappe.user.full_name(),
          _lang: doc.language
        },
        callback: (r) => {
          if (!r.exc) {
            frappe.utils.play_sound("email");
            if (r.message["emails_not_sent_to"]) {
              frappe.msgprint(__(
                "Email not sent to {0} (unsubscribed / disabled)",
                [frappe.utils.escape_html(r.message["emails_not_sent_to"])]
              ));
            } else {
              frappe.show_alert({
                message: __("Email sent successfully."),
                indicator: "green"
              });
            }
            this.email_dialog.hide();
          } else {
            frappe.msgprint(__("There were errors while sending email. Please try again."));
          }
        }
      });
    }
    add_summary_btns(map) {
      this.$summary_btns.html("");
      map.forEach((m) => {
        if (m.condition) {
          m.visible_btns.forEach((b) => {
            const class_name = b.split(" ")[0].toLowerCase();
            const btn = __(b);
            this.$summary_btns.append(
              `<div class="summary-btn btn btn-default ${class_name}-btn">${btn}</div>`
            );
          });
        }
      });
      this.$summary_btns.children().last().removeClass("mr-4");
    }
    toggle_summary_placeholder(show) {
      if (show) {
        this.$summary_wrapper.css("display", "none");
        this.$component.find(".no-summary-placeholder").css("display", "flex");
      } else {
        this.$summary_wrapper.css("display", "flex");
        this.$component.find(".no-summary-placeholder").css("display", "none");
      }
    }
    get_condition_btn_map(after_submission) {
      if (after_submission)
        return [{ condition: true, visible_btns: ["Print Receipt", "New Order"] }];
      const hasWaiterRole = frappe.user_roles.includes("Waiter");
      const draftButtons = hasWaiterRole ? ["Print Receipt", "Edit Order", "Print-Order"] : ["Print Receipt", "Edit Order", "Print-Order", "Split-Order"];
      const submitButtons = hasWaiterRole ? ["Print Receipt"] : this.doc.outstanding_amount > 0 ? ["Print Receipt", "Add-Payment", "Return"] : ["Print Receipt", "Return"];
      return [
        { condition: this.doc.docstatus === 0, visible_btns: draftButtons },
        { condition: !this.doc.is_return && this.doc.docstatus === 1, visible_btns: submitButtons },
        { condition: this.doc.is_return && this.doc.docstatus === 1, visible_btns: ["Print Receipt"] }
      ];
    }
    load_summary_of(doc, after_submission = false) {
      after_submission ? this.$component.css("grid-column", "span 10 / span 10") : this.$component.css("grid-column", "span 6 / span 6");
      this.toggle_summary_placeholder(false);
      this.doc = doc;
      this.attach_document_info(doc);
      this.attach_items_info(doc);
      this.attach_totals_info(doc);
      this.attach_payments_info(doc);
      const condition_btns_map = this.get_condition_btn_map(after_submission);
      this.add_summary_btns(condition_btns_map);
      this.$summary_wrapper.css("width", after_submission ? "35%" : "60%");
      if (after_submission && this.print_receipt_on_order_complete) {
        this.print_receipt();
      }
    }
    attach_document_info(doc) {
      frappe.db.get_value("Customer", this.doc.customer, "email_id").then(({ message }) => {
        this.customer_email = message.email_id || "";
        const upper_section_dom = this.get_upper_section_html(doc);
        this.$upper_section.html(upper_section_dom);
      });
    }
    attach_items_info(doc) {
      this.$items_container.html("");
      doc.items.forEach((item) => {
        const item_dom = this.get_item_html(doc, item);
        this.$items_container.append(item_dom);
        this.set_dynamic_rate_header_width();
      });
    }
    set_dynamic_rate_header_width() {
      const rate_cols = Array.from(this.$items_container.find(".item-rate-disc"));
      this.$items_container.find(".item-rate-disc").css("width", "");
      let max_width = rate_cols.reduce((max_width2, elm) => {
        if ($(elm).width() > max_width2)
          max_width2 = $(elm).width();
        return max_width2;
      }, 0);
      max_width += 1;
      if (max_width == 1)
        max_width = "";
      this.$items_container.find(".item-rate-disc").css("width", max_width);
    }
    attach_payments_info(doc) {
      this.$payment_container.html("");
      doc.payments.forEach((p) => {
        if (p.amount) {
          const payment_dom = this.get_payment_html(doc, p);
          this.$payment_container.append(payment_dom);
        }
      });
      if (doc.redeem_loyalty_points && doc.loyalty_amount) {
        const payment_dom = this.get_payment_html(doc, {
          mode_of_payment: "Loyalty Points",
          amount: doc.loyalty_amount
        });
        this.$payment_container.append(payment_dom);
      }
    }
    attach_totals_info(doc) {
      this.$totals_container.html("");
      const net_total_dom = this.get_net_total_html(doc);
      const taxes_dom = this.get_taxes_html(doc);
      const discount_dom = this.get_discount_html(doc);
      const grand_total_dom = this.get_grand_total_html(doc);
      this.$totals_container.append(net_total_dom);
      this.$totals_container.append(taxes_dom);
      this.$totals_container.append(discount_dom);
      this.$totals_container.append(grand_total_dom);
    }
    toggle_component(show) {
      show ? this.$component.css("display", "flex") : this.$component.css("display", "none");
    }
    show_summary_placeholder() {
      this.toggle_summary_placeholder(true);
    }
  };

  // ../posnext/posnext/public/js/pos_table_selector.js
  frappe.provide("posnext.PointOfSale");
  posnext.PointOfSale.TableSelector = class {
    constructor({ wrapper, events, pos_profile }) {
      console.log("Wrapper check:", wrapper, wrapper.length, wrapper.is(":visible"));
      if (!wrapper || !wrapper.length) {
        console.error("Invalid wrapper: Element not found or not provided");
        return;
      }
      this.wrapper = wrapper;
      this.events = events;
      this.pos_profile = pos_profile;
      this.selected_table = null;
      this.init_component();
    }
    init_component() {
      this.prepare_dom();
      this.load_tables();
      this.bind_events();
    }
    prepare_dom() {
      this.wrapper.html(`
            <style>
                .table-selector {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 90vw; /* Wider layout, 90% of viewport width */
                    max-width: 1200px; /* Cap width for very large screens */
                    margin: 0 auto; /* Center the container */
                    padding: 16px;
                    background: #f9fafb;
                    font-family: 'Inter', sans-serif;
                    box-sizing: border-box;
                }

                .table-selector-header {
                    text-align: center;
                    margin-bottom: 24px;
                    position: relative;
                }

                .header-actions {
                    position: absolute;
                    top: 0;
                    right: 0;
                }

                .order-list-btn {
                    font-size: 0.875rem;
                    padding: 6px 12px;
                }

                .restaurant-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #1f2a44;
                    margin: 0;
                }

                .restaurant-subtitle {
                    font-size: 0.875rem;
                    color: #4CAF50;
                    margin: 4px 0 0;
                }

                .table-search-container {
                    max-width: 400px; /* Slightly wider search bar */
                    margin: 0 auto 24px;
                    position: relative;
                }

                .table-search-input {
                    width: 100%;
                    padding: 8px 36px 8px 12px;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    color: #1f2a44;
                    transition: border-color 0.2s;
                }

                .table-search-input:focus {
                    border-color: #4CAF50;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
                }

                .table-search-input::placeholder {
                    color: #9ca3af;
                }

                .search-icon {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #9ca3af;
                    font-size: 0.875rem;
                }

                .table-grid {
                    display: grid;
                    grid-template-columns: repeat(6, minmax(160px, 1fr)); /* Wider columns */
                    grid-template-rows: repeat(5, minmax(0, auto));
                    gap: 16px;
                    max-height: calc(5 * (110px + 16px)); /* Adjusted for 5 rows */
                    overflow-y: auto;
                    padding: 8px 0;
                    scrollbar-width: thin;
                }

                .table-card {
                    background: #fff;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                    min-height: 110px; /* Slightly taller for wider layout */
                    visibility: visible;
                }

                .table-card.available {
                    border-color: #4CAF50;
                    background: linear-gradient(135deg, #4CAF50, #6cc070);
                    color: #fff;
                }

                .table-card.occupied-with-orders {
                    border-color: #f59e0b;
                    background: linear-gradient(135deg, #f59e0b, #fbbf24);
                    color: #fff;
                }

                .table-card.occupied-urgent {
                    border-color: #dc2626;
                    background: linear-gradient(135deg, #dc2626, #ef4444);
                    color: #fff;
                }

                .table-card.empty {
                    border-color: #4CAF50;
                    background: #fff;
                    color: #4CAF50;
                }

                .table-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .table-card.selected {
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
                }

                .table-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }

                .table-name {
                    font-size: 1rem;
                    font-weight: 600;
                    margin: 0;
                }

                .table-time {
                    font-size: 0.75rem;
                    opacity: 0.9;
                    margin: 0;
                }

                .table-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .order-status {
                    font-size: 0.75rem;
                    font-weight: 500;
                    margin: 0;
                }

                .table-details {
                    font-size: 0.6875rem;
                    opacity: 0.8;
                    margin: 0;
                }

                .table-card.empty .table-time {
                    display: none;
                }

                .table-selector-footer {
                    text-align: center;
                    padding-top: 16px;
                    margin-top: 16px;
                    border-top: 1px solid #e5e7eb;
                }

                .proceed-btn {
                    padding: 8px 16px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    border-radius: 6px;
                    border: none;
                    background: #4CAF50;
                    color: #fff;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .proceed-btn:hover:not(:disabled) {
                    background: #3d8b40;
                }

                .proceed-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .no-tables {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 32px;
                    color: #6b7280;
                    font-size: 0.875rem;
                }

                .no-tables i {
                    font-size: 1.5rem;
                    margin-bottom: 8px;
                    opacity: 0.5;
                }

                .table-card-skeleton {
                    background: #fff;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 12px;
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 0.7; }
                    50% { opacity: 1; }
                }

                .skeleton-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }

                .skeleton-text {
                    background: #e5e7eb;
                    border-radius: 4px;
                }

                .skeleton-text.large { width: 60px; height: 16px; }
                .skeleton-text.medium { width: 40px; height: 16px; }
                .skeleton-text.small { width: 80px; height: 12px; margin-top: 4px; }

                @media (max-width: 768px) {
                    .table-selector {
                        padding: 12px;
                        width: 100%; /* Full width on smaller screens */
                        max-width: none;
                    }

                    .restaurant-title {
                        font-size: 1.25rem;
                    }

                    .restaurant-subtitle {
                        font-size: 0.75rem;
                    }

                    .table-grid {
                        grid-template-columns: repeat(4, minmax(140px, 1fr));
                        gap: 12px;
                    }

                    .table-card {
                        padding: 10px;
                        min-height: 90px;
                    }

                    .table-name {
                        font-size: 0.875rem;
                    }

                    .table-time, .order-status {
                        font-size: 0.6875rem;
                    }

                    .table-details {
                        font-size: 0.625rem;
                    }
                }

                @media (max-width: 480px) {
                    .table-grid {
                        grid-template-columns: repeat(2, minmax(120px, 1fr));
                        gap: 8px;
                    }

                    .table-card {
                        padding: 8px;
                        min-height: 80px;
                    }
                }
            </style>
            <div class="table-selector">
                <div class="table-selector-header">
                    <div class="header-actions">
                        <button class="btn btn-secondary btn-sm order-list-btn">
                            <i class="fa fa-list"></i> ${__("Order List")}
                        </button>
                    </div>
                    <h1 class="restaurant-title">${__("Table Selection")}</h1>
                    <p class="restaurant-subtitle">${__("Choose a table to start taking orders")}</p>
                </div>
                <div class="table-search-container">
                    <input type="text" class="table-search-input" placeholder="${__("Search tables...")}" />
                    <i class="fa fa-search search-icon"></i>
                </div>
                <div class="table-grid"></div>
                <div class="table-selector-footer">
                    <button class="btn btn-primary btn-sm proceed-btn" disabled aria-label="${__("Proceed to order for selected table")}">
                        ${__("Proceed to Order")}
                    </button>
                </div>
            </div>
        `);
    }
    load_tables() {
      const $grid = this.wrapper.find(".table-grid");
      $grid.empty();
      this.show_loading_skeleton();
      frappe.call({
        method: "posnext.posnext.page.posnext.point_of_sale.get_tables",
        callback: (r) => {
          console.log("frappe.call response:", r);
          $grid.empty();
          if (r.exc) {
            frappe.msgprint(__("Error loading tables. Please try again."));
            this.render_tables([]);
          } else {
            this.all_tables = r.message || [];
            this.render_tables(this.all_tables);
          }
        }
      });
    }
    show_loading_skeleton() {
      const $grid = this.wrapper.find(".table-grid");
      for (let i = 0; i < 6; i++) {
        $grid.append(`
                <div class="table-card-skeleton">
                    <div class="skeleton-header">
                        <div class="skeleton-text large"></div>
                        <div class="skeleton-text medium"></div>
                    </div>
                    <div class="skeleton-text small"></div>
                </div>
            `);
      }
    }
    render_tables(tables) {
      console.log("Rendering tables:", tables);
      const $grid = this.wrapper.find(".table-grid");
      $grid.empty();
      if (!tables.length) {
        $grid.append(`
                <div class="no-tables">
                    <i class="fa fa-table"></i>
                    <p>${__("No tables available")}</p>
                    <small>${__("Please check back later")}</small>
                </div>
            `);
        return;
      }
      tables.forEach((table) => {
        const minutes = table.elapsed_time ? parseInt(table.elapsed_time.split(":")[0]) : 0;
        const statusClass = table.status === "Available" ? "empty" : minutes >= 8 ? "occupied-urgent" : minutes >= 4 ? "occupied-with-orders" : "available";
        const orderText = table.status === "Available" ? "No Order" : `Ordered ${table.order_count || 0} items`;
        $grid.append(`
                <div class="table-card ${statusClass} ${this.selected_table === table.name ? "selected" : ""}"
                     data-table="${table.name}" 
                     tabindex="0" 
                     role="button" 
                     aria-label="${__("Table")} ${table.table_name}, ${orderText}">
                    <div class="table-header">
                        <h3 class="table-name">${table.table_name}</h3>
                        ${table.elapsed_time ? `<p class="table-time">${table.elapsed_time}</p>` : ""}
                    </div>
                    <div class="table-info">
                        <p class="order-status">${orderText}</p>
                        <p class="table-details">${__("Capacity")}: ${table.seating_capacity} ${__("seats")}</p>
                    </div>
                </div>
            `);
      });
      console.log("Table cards appended:", $grid.find(".table-card").length);
    }
    filter_tables(searchTerm) {
      if (!this.all_tables)
        return;
      const filteredTables = searchTerm ? this.all_tables.filter(
        (table) => table.table_name.toLowerCase().includes(searchTerm) || table.seating_capacity.toString().includes(searchTerm) || table.status.toLowerCase().includes(searchTerm)
      ) : this.all_tables;
      console.log("Filtered tables:", filteredTables);
      this.render_tables(filteredTables);
    }
    bind_events() {
      const me = this;
      this.wrapper.on("input", ".table-search-input", frappe.utils.debounce(function() {
        const searchTerm = $(this).val().toLowerCase().trim();
        me.filter_tables(searchTerm);
      }, 300));
      this.wrapper.on("click", ".table-card", function() {
        me.wrapper.find(".table-card").removeClass("selected");
        $(this).addClass("selected");
        me.selected_table = $(this).data("table");
        me.wrapper.find(".proceed-btn").prop("disabled", false);
      });
      this.wrapper.on("keydown", ".table-card", function(e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          $(this).click();
        }
      });
      this.wrapper.on("click", ".proceed-btn", function() {
        var _a, _b;
        if (me.selected_table) {
          (_b = (_a = me.events).table_selected) == null ? void 0 : _b.call(_a, me.selected_table);
        }
      });
      this.wrapper.on("click", ".order-list-btn", function() {
        var _a, _b;
        (_b = (_a = me.events).toggle_recent_order) == null ? void 0 : _b.call(_a);
      });
    }
    get_selected_table() {
      return this.selected_table;
    }
    toggle_component(show) {
      if (show) {
        this.wrapper.show();
      } else {
        this.wrapper.hide();
      }
    }
  };
})();
//# sourceMappingURL=posnext.bundle.DGHJG6AE.js.map
