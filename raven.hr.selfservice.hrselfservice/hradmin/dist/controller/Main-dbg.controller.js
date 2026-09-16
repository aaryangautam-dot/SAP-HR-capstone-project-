sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/SelectDialog",
    "sap/m/StandardListItem",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/Label",
    "sap/ui/layout/form/SimpleForm"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageToast,
    MessageBox,
    SelectDialog,
    StandardListItem,
    Dialog,
    Button,
    Input,
    Label,
    SimpleForm
) {
    "use strict";

    return Controller.extend("hradmin.controller.Main", {
        onInit: function () {
            const oAdminModel = new JSONModel({
                layout: "OneColumn",
                selected: false
            });
            this.getView().setModel(oAdminModel, "adminModel");

            // Filter approvals table by status 'Submitted'
            const oApprovalsTable = this.byId("approvalsTable");
            if (oApprovalsTable) {
                const oBinding = oApprovalsTable.getBinding("items");
                if (oBinding) {
                    oBinding.filter([new Filter("status", FilterOperator.EQ, "Submitted")]);
                }
            }

            // Attach router route matched listener
            const oRouter = this.getOwnerComponent().getRouter();
            if (oRouter) {
                oRouter.attachRouteMatched(this._onRouteMatched, this);
            }
            this._applyTabSelection();
        },

        _applyTabSelection: function () {
            try {
                const oComponent = this.getOwnerComponent();
                const oStartupParams = oComponent && oComponent.getComponentData() && oComponent.getComponentData().startupParameters;
                const sTab = oStartupParams && oStartupParams.tab && oStartupParams.tab[0];
                const sRoute = oStartupParams && oStartupParams.route && oStartupParams.route[0];
                const sHash = window.location.hash || "";

                const oTabs = this.byId("adminTabs");
                if (oTabs) {
                    if (sTab === "overview" || sRoute === "leaveRequests" || sHash.indexOf("HRAdmin-overview") > -1) {
                        oTabs.setSelectedKey("overview");
                    } else if (sTab === "approvals" || sRoute === "pendingApprovals" || sHash.indexOf("HRAdmin-approvals") > -1) {
                        oTabs.setSelectedKey("approvals");
                    } else {
                        oTabs.setSelectedKey("employees");
                    }
                }
            } catch (e) {
                // fallback
            }
        },

        _onRouteMatched: function (oEvent) {
            const sRouteName = oEvent.getParameter("name");
            const oTabs = this.byId("adminTabs");
            if (!oTabs) {
                return;
            }
            if (sRouteName === "leaveRequests") {
                oTabs.setSelectedKey("overview");
            } else if (sRouteName === "pendingApprovals") {
                oTabs.setSelectedKey("approvals");
            } else if (sRouteName === "employeeDirectory" || sRouteName === "employees") {
                oTabs.setSelectedKey("employees");
            } else if (sRouteName === "main") {
                this._applyTabSelection();
            }
        },

        onTabSelect: function (oEvent) {
            const sKey = oEvent.getParameter("key");
            const oRouter = this.getOwnerComponent().getRouter();
            if (!oRouter) {
                return;
            }
            if (sKey === "overview") {
                oRouter.navTo("leaveRequests");
            } else if (sKey === "approvals") {
                oRouter.navTo("pendingApprovals");
            } else if (sKey === "employees") {
                oRouter.navTo("employeeDirectory");
            }
        },

        // =========================================================================
        // TAB 1: EMPLOYEE MASTER (FlexibleColumnLayout & CRUD)
        // =========================================================================

        onEmployeeSelect: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                return;
            }

            const oDetail = this.byId("employeeDetailPanel");
            if (oDetail) {
                oDetail.setBindingContext(oContext);
            }

            const sDept = oContext.getProperty("department_ID");
            const sStatus = oContext.getProperty("status");
            const sManager = oContext.getProperty("manager_ID");

            if (this.byId("departmentSelect")) {
                this.byId("departmentSelect").setSelectedKey(sDept);
            }
            if (this.byId("statusSelect")) {
                this.byId("statusSelect").setSelectedKey(sStatus);
            }
            if (this.byId("managerInput")) {
                this.byId("managerInput").setValue(sManager || "");
            }

            const oAdminModel = this.getView().getModel("adminModel");
            oAdminModel.setProperty("/selected", true);
        },

        onCloseDetail: function () {
            const oAdminModel = this.getView().getModel("adminModel");
            oAdminModel.setProperty("/selected", false);
        },

        onSearchEmployees: function (oEvent) {
            const sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue");
            const oTable = this.byId("employeeTable");
            const oBinding = oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            if (sQuery && sQuery.trim()) {
                const aFilters = [
                    new Filter("employeeCode", FilterOperator.Contains, sQuery),
                    new Filter("firstName", FilterOperator.Contains, sQuery),
                    new Filter("lastName", FilterOperator.Contains, sQuery),
                    new Filter("email", FilterOperator.Contains, sQuery)
                ];
                oBinding.filter(new Filter({ filters: aFilters, and: false }));
            } else {
                oBinding.filter([]);
            }
        },

        formatEmployeeStatusState: function (sStatus) {
            return sStatus === "Active" ? "Success" : "Warning";
        },

        onDepartmentChange: function (oEvent) {
            const oDetail = this.byId("employeeDetailPanel");
            const oContext = oDetail ? oDetail.getBindingContext() : null;
            if (oContext) {
                oContext.setProperty("department_ID", oEvent.getSource().getSelectedKey());
            }
        },

        onStatusChange: function (oEvent) {
            const oDetail = this.byId("employeeDetailPanel");
            const oContext = oDetail ? oDetail.getBindingContext() : null;
            if (oContext) {
                oContext.setProperty("status", oEvent.getSource().getSelectedKey());
            }
        },

        onOpenAddEmployee: function () {
            const oView = this.getView();
            const oTable = this.byId("employeeTable");
            const oBinding = oTable ? oTable.getBinding("items") : null;
            const that = this;

            const oCodeInput = new Input({ placeholder: "e.g. EMP003" });
            const oFirstNameInput = new Input({ placeholder: "First name" });
            const oLastNameInput = new Input({ placeholder: "Last name" });
            const oEmailInput = new Input({ placeholder: "email@company.com" });

            const oDialog = new Dialog({
                title: "Add New Employee",
                contentWidth: "400px",
                content: [
                    new SimpleForm({
                        editable: true,
                        layout: "ResponsiveGridLayout",
                        content: [
                            new Label({ text: "Employee Code" }),
                            oCodeInput,
                            new Label({ text: "First Name" }),
                            oFirstNameInput,
                            new Label({ text: "Last Name" }),
                            oLastNameInput,
                            new Label({ text: "Email" }),
                            oEmailInput
                        ]
                    })
                ],
                beginButton: new Button({
                    text: "Create",
                    type: "Emphasized",
                    press: async function () {
                        const sCode = oCodeInput.getValue();
                        const sFirst = oFirstNameInput.getValue();
                        const sLast = oLastNameInput.getValue();
                        const sEmail = oEmailInput.getValue();

                        if (!sCode || !sFirst || !sLast || !sEmail) {
                            MessageBox.error("Please fill in all mandatory fields.");
                            return;
                        }

                        if (!oBinding) {
                            MessageBox.error("Table binding not available.");
                            return;
                        }

                        try {
                            const oContext = oBinding.create({
                                employeeCode: sCode,
                                firstName: sFirst,
                                lastName: sLast,
                                email: sEmail,
                                department_ID: "8a2ceb3c-2a6c-3adc-8acc-1a0c6a2cba5c",
                                status: "Active"
                            });

                            oDialog.setBusy(true);
                            await oContext.created();
                            oDialog.setBusy(false);
                            MessageToast.show("Employee created successfully");
                            oDialog.close();
                            oDialog.destroy();
                        } catch (err) {
                            oDialog.setBusy(false);
                            MessageBox.error(err.message || "Failed to create employee.");
                        }
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                        oDialog.destroy();
                    }
                })
            });

            oView.addDependent(oDialog);
            oDialog.open();
        },

        onDeleteEmployee: function () {
            const oDetail = this.byId("employeeDetailPanel");
            const oContext = oDetail ? oDetail.getBindingContext() : null;
            if (!oContext) {
                return;
            }

            const that = this;
            MessageBox.confirm("Are you sure you want to delete this employee?", {
                onClose: async function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        try {
                            await oContext.delete();
                            MessageToast.show("Employee deleted");
                            that.onCloseDetail();
                        } catch (err) {
                            MessageBox.error(err.message || "Failed to delete employee.");
                        }
                    }
                }
            });
        },

        onManagerValueHelp: function () {
            const that = this;
            const oSelectDialog = new SelectDialog({
                title: "Select Manager",
                items: {
                    path: "/Employees",
                    template: new StandardListItem({
                        title: "{firstName} {lastName}",
                        description: "{employeeCode} ({email})"
                    })
                },
                confirm: function (oEvent) {
                    const oSelectedItem = oEvent.getParameter("selectedItem");
                    if (oSelectedItem) {
                        const oCtx = oSelectedItem.getBindingContext();
                        const sManagerID = oCtx.getProperty("ID");
                        that.byId("managerInput").setValue(sManagerID);
                        const oDetail = that.byId("employeeDetailPanel");
                        const oContext = oDetail ? oDetail.getBindingContext() : null;
                        if (oContext) {
                            oContext.setProperty("manager_ID", sManagerID);
                        }
                        MessageToast.show("Manager assigned");
                    }
                }
            });

            this.getView().addDependent(oSelectDialog);
            oSelectDialog.open();
        },

        // =========================================================================
        // TAB 2: LEAVE REQUESTS OVERVIEW (Reporting & Filters)
        // =========================================================================

        onOverviewStatusFilter: function (oEvent) {
            const sKey = oEvent.getParameter("key");
            const oTable = this.byId("overviewTable");
            const oBinding = oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            if (sKey === "ALL") {
                oBinding.filter([]);
            } else {
                oBinding.filter([new Filter("status", FilterOperator.EQ, sKey)]);
            }
        },

        onOverviewSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("query");
            const oTable = this.byId("overviewTable");
            const oBinding = oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            if (sQuery && sQuery.trim()) {
                const aFilters = [
                    new Filter("firstName", FilterOperator.Contains, sQuery),
                    new Filter("lastName", FilterOperator.Contains, sQuery),
                    new Filter("departmentName", FilterOperator.Contains, sQuery),
                    new Filter("leaveTypeName", FilterOperator.Contains, sQuery)
                ];
                oBinding.filter(new Filter({ filters: aFilters, and: false }));
            } else {
                oBinding.filter([]);
            }
        },

        onRefreshOverview: function () {
            const oBinding = this.byId("overviewTable").getBinding("items");
            if (oBinding) {
                oBinding.refresh();
                MessageToast.show("Overview refreshed");
            }
        },

        formatStatusState: function (sStatus) {
            switch (sStatus) {
                case "Approved":
                    return "Success";
                case "Rejected":
                    return "Error";
                case "Submitted":
                    return "Information";
                case "Cancelled":
                    return "Warning";
                case "Draft":
                default:
                    return "None";
            }
        },

        // =========================================================================
        // TAB 3: PENDING APPROVALS (Manager Queue & Actions)
        // =========================================================================

        onRefreshApprovals: function () {
            const oBinding = this.byId("approvalsTable").getBinding("items");
            if (oBinding) {
                oBinding.filter([new Filter("status", FilterOperator.EQ, "Submitted")]);
                oBinding.refresh();
                MessageToast.show("Approvals queue refreshed");
            }
        },

        onApproveRequest: async function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                return;
            }

            const sID = oContext.getProperty("ID");
            const oModel = this.getView().getModel();

            try {
                const oAction = oModel.bindContext("/approveCallback(...)");
                oAction.setParameter("requestID", sID);
                oAction.setParameter("comment", "Approved by manager");
                await oAction.execute();

                MessageToast.show("Leave request approved");
                this.onRefreshApprovals();
                this.onRefreshOverview();
            } catch (err) {
                MessageBox.error(err.message || "Failed to approve leave request.");
            }
        },

        onRejectRequest: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                return;
            }

            const sID = oContext.getProperty("ID");
            const oModel = this.getView().getModel();
            const that = this;

            const oRejectInput = new Input({
                width: "100%",
                placeholder: "Provide reason for rejection..."
            });

            const oDialog = new Dialog({
                title: "Reject Leave Request",
                type: "Message",
                content: [
                    new Label({ text: "Rejection Reason" }),
                    oRejectInput
                ],
                beginButton: new Button({
                    type: "Reject",
                    text: "Reject",
                    press: async function () {
                        const sComment = oRejectInput.getValue();
                        if (!sComment || !sComment.trim()) {
                            MessageBox.warning("Please provide a rejection comment.");
                            return;
                        }

                        try {
                            const oAction = oModel.bindContext("/rejectCallback(...)");
                            oAction.setParameter("requestID", sID);
                            oAction.setParameter("comment", sComment.trim());
                            await oAction.execute();

                            MessageToast.show("Leave request rejected");
                            oDialog.close();
                            oDialog.destroy();
                            that.onRefreshApprovals();
                            that.onRefreshOverview();
                        } catch (err) {
                            MessageBox.error(err.message || "Failed to reject leave request.");
                        }
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                        oDialog.destroy();
                    }
                })
            });

            this.getView().addDependent(oDialog);
            oDialog.open();
        }
    });
});
