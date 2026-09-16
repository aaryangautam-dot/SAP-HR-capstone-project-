sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History"
], function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    History
) {
    "use strict";

    return Controller.extend(
        "hrselfservice.controller.CreateRequest",
        {
            _employeeID: "65c65f04-4c72-4df2-ab07-a7e1aafe889b",

            onInit: function () {
                const oAttachmentModel = new JSONModel({ items: [] });
                this.getView().setModel(oAttachmentModel, "attachmentModel");

                const oRouter = this.getOwnerComponent().getRouter();
                if (oRouter) {
                    oRouter.getRoute("createRequest").attachPatternMatched(this._onRouteMatched, this);
                }
            },

            _onRouteMatched: function () {
                const oSelect = this.byId("leaveTypeSelect");
                if (oSelect) {
                    const oBinding = oSelect.getBinding("items");
                    if (oBinding) {
                        oBinding.refresh();
                    }
                }
            },

            onDateChange: function () {
                const oFromDate = this.byId("fromDate").getDateValue();
                const oToDate = this.byId("toDate").getDateValue();
                const oPreview = this.byId("dayPreview");
                const oWizard = this.byId("leaveWizard");
                const oStep1 = this.byId("step1");

                if (!oFromDate || !oToDate) {
                    oPreview.setNumber("0");
                    oWizard.invalidateStep(oStep1);
                    return;
                }

                if (oToDate < oFromDate) {
                    this.byId("toDate").setValueState("Error");
                    this.byId("toDate").setValueStateText("To Date cannot be before From Date");
                    oPreview.setNumber("0");
                    oWizard.invalidateStep(oStep1);
                    return;
                }

                this.byId("toDate").setValueState("None");
                const iDays = Math.floor((oToDate.getTime() - oFromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                oPreview.setNumber(String(iDays));
                oWizard.validateStep(oStep1);
            },

            onLeaveTypeChange: function (oEvent) {
                const oItem = oEvent.getSource().getSelectedItem();
                if (oItem) {
                    MessageToast.show("Selected: " + oItem.getText());
                }
            },

            onNextStep: async function () {
                const oModel = this.getOwnerComponent().getModel();
                const oLeaveType = this.byId("leaveTypeSelect").getSelectedItem();
                const oFromDate = this.byId("fromDate").getDateValue();
                const oToDate = this.byId("toDate").getDateValue();

                if (!oLeaveType) {
                    MessageBox.error("Please select a leave type.");
                    return;
                }

                if (!oFromDate || !oToDate) {
                    MessageBox.error("Please select From Date and To Date.");
                    return;
                }

                if (oToDate < oFromDate) {
                    MessageBox.error("To Date cannot be before From Date.");
                    return;
                }

                if (!oModel) {
                    MessageBox.error("OData model is not available.");
                    return;
                }

                const iDays = Math.floor((oToDate.getTime() - oFromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                try {
                    const oListBinding = oModel.bindList("/LeaveRequests");
                    const oContext = oListBinding.create({
                        employee_ID: this._employeeID,
                        leaveType_ID: oLeaveType.getKey(),
                        fromDate: this._formatDate(oFromDate),
                        toDate: this._formatDate(oToDate),
                        numberOfDays: iDays,
                        status: "Draft"
                    });

                    await oContext.created();
                    this._oLeaveRequestContext = oContext;

                    if (this.getView().getModel("attachmentModel")) {
                        this.getView().getModel("attachmentModel").setProperty("/items", []);
                    }

                    MessageToast.show("Draft leave request created");
                    this.byId("leaveWizard").validateStep(this.byId("step1"));
                    this.byId("leaveWizard").nextStep();
                } catch (oError) {
                    MessageBox.error(oError.message || "Unable to create draft leave request.");
                }
            },

            onGoToReview: function () {
                this.byId("leaveWizard").validateStep(this.byId("step2"));
                this.byId("leaveWizard").nextStep();
            },

            onReviewStepActivate: function () {
                const oLeaveType = this.byId("leaveTypeSelect").getSelectedItem();
                const oFromDate = this.byId("fromDate").getValue();
                const oToDate = this.byId("toDate").getValue();
                const sDays = this.byId("dayPreview").getNumber();

                this.byId("reviewLeaveType").setText(oLeaveType ? oLeaveType.getText() : "");
                this.byId("reviewFromDate").setText(oFromDate);
                this.byId("reviewToDate").setText(oToDate);
                this.byId("reviewDays").setText(sDays + " Days");
            },

            onSubmitRequest: async function () {
                if (!this._oLeaveRequestContext) {
                    MessageBox.error("No draft leave request exists.");
                    return;
                }

                const oModel = this.getView().getModel();
                const sPath = this._oLeaveRequestContext.getPath();

                try {
                    const oAction = oModel.bindContext(sPath + "/HRService.submit(...)");
                    await oAction.execute();

                    MessageToast.show("Leave request submitted for approval");
                    this.getOwnerComponent().getRouter().navTo("myRequests");
                } catch (e) {
                    MessageBox.error(e.message || "Failed to submit leave request.");
                }
            },

            onAfterItemAdded: async function (oEvent) {
                const oItem = oEvent.getParameter("item");
                const oFile = oItem.getFileObject();
                if (!oFile) {
                    return;
                }

                if (!this._oLeaveRequestContext) {
                    MessageBox.error("Please complete Step 1 first.");
                    return;
                }

                const sRequestID = this._oLeaveRequestContext.getProperty("ID");
                const oUploadSet = this.byId("attachmentSet");
                const oAttachmentModel = this.getView().getModel("attachmentModel");

                oUploadSet.setBusy(true);

                try {
                    // Step 1: Create attachment record in CAP
                    const oPostRes = await fetch("/odata/v4/hr/LeaveRequests(" + sRequestID + ")/attachments", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            fileName: oFile.name,
                            mediaType: oFile.type || "application/octet-stream"
                        })
                    });

                    if (!oPostRes.ok) {
                        const sErrText = await oPostRes.text();
                        throw new Error("Failed to register attachment: " + sErrText);
                    }

                    const oPostData = await oPostRes.json();

                    // Step 2: Stream binary file into attachment content
                    const oPutRes = await fetch("/odata/v4/hr/LeaveRequestAttachments(" + oPostData.ID + ")/content", {
                        method: "PUT",
                        headers: {
                            "Content-Type": oFile.type || "application/octet-stream"
                        },
                        body: oFile
                    });

                    if (!oPutRes.ok) {
                        const sErrText = await oPutRes.text();
                        throw new Error("Failed to stream attachment: " + sErrText);
                    }

                    // Step 3: Add to model to display in the UploadSet list immediately
                    const aItems = oAttachmentModel.getProperty("/items") || [];
                    aItems.push({
                        ID: oPostData.ID,
                        fileName: oFile.name,
                        mediaType: oFile.type || "application/octet-stream",
                        url: "/odata/v4/hr/LeaveRequestAttachments(" + oPostData.ID + ")/content"
                    });
                    oAttachmentModel.setProperty("/items", aItems);

                    MessageToast.show("Attachment uploaded successfully");
                } catch (err) {
                    MessageBox.error(err.message || "Failed to upload attachment.");
                } finally {
                    oUploadSet.setBusy(false);
                }
            },

            onAttachmentRemoved: async function (oEvent) {
                const oItem = oEvent.getParameter("item");
                const oContext = oItem.getBindingContext("attachmentModel");
                const oAttachmentModel = this.getView().getModel("attachmentModel");

                if (!oContext) {
                    return;
                }

                const sID = oContext.getProperty("ID");
                if (sID) {
                    try {
                        await fetch("/odata/v4/hr/LeaveRequestAttachments(" + sID + ")", {
                            method: "DELETE"
                        });
                        MessageToast.show("Attachment removed");
                    } catch (e) {
                        // ignore delete error
                    }
                }

                const aItems = (oAttachmentModel.getProperty("/items") || []).filter(function (it) {
                    return it.ID !== sID;
                });
                oAttachmentModel.setProperty("/items", aItems);
            },

            onNavBack: function () {
                const oHistory = History.getInstance();
                const sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    window.history.go(-1);
                } else {
                    this.getOwnerComponent().getRouter().navTo("myRequests", {}, true);
                }
            },

            _formatDate: function (oDate) {
                const iYear = oDate.getFullYear();
                const iMonth = String(oDate.getMonth() + 1).padStart(2, "0");
                const iDay = String(oDate.getDate()).padStart(2, "0");
                return iYear + "-" + iMonth + "-" + iDay;
            }
        }
    );
});