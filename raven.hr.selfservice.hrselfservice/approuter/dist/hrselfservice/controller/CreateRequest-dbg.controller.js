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
                this._aPendingFiles = [];
                this._isSubmitting = false;

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

            onNextStep: function () {
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

                // Advance wizard to step 2 without persisting draft to DB prematurely
                this.byId("leaveWizard").validateStep(this.byId("step1"));
                this.byId("leaveWizard").nextStep();
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
                if (this._isSubmitting) {
                    return;
                }

                const oLeaveType = this.byId("leaveTypeSelect").getSelectedItem();
                const oFromDate = this.byId("fromDate").getDateValue();
                const oToDate = this.byId("toDate").getDateValue();

                if (!oLeaveType || !oFromDate || !oToDate) {
                    MessageBox.error("Please complete the required fields in Step 1.");
                    return;
                }

                const iDays = Math.floor((oToDate.getTime() - oFromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                const oModel = this.getOwnerComponent().getModel();
                if (!oModel) {
                    MessageBox.error("OData model is not available.");
                    return;
                }

                this._isSubmitting = true;
                this.getView().setBusy(true);

                try {
                    // 1. Create Draft leave request atomically on submission
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
                    const sRequestID = oContext.getProperty("ID");

                    // 2. Upload any attachments collected in Step 2
                    const aPendingFiles = this._aPendingFiles || [];
                    if (aPendingFiles.length > 0) {
                        let sServiceUrl = (oModel && oModel.getServiceUrl) ? oModel.getServiceUrl() : "odata/v4/hr/";
                        const oOwnerComponent = this.getOwnerComponent();
                        if (oOwnerComponent && oOwnerComponent.getManifestObject && typeof oOwnerComponent.getManifestObject().resolvePath === "function") {
                            sServiceUrl = oOwnerComponent.getManifestObject().resolvePath(sServiceUrl);
                        }

                        let sCsrfToken = "";
                        try {
                            const oTokenRes = await fetch(sServiceUrl, {
                                method: "HEAD",
                                headers: { "X-CSRF-Token": "Fetch" },
                                credentials: "include"
                            });
                            sCsrfToken = oTokenRes.headers.get("X-CSRF-Token") || "";
                        } catch (tokenErr) {
                            // ignore token fetch error
                        }

                        for (const item of aPendingFiles) {
                            const oFile = item.file;
                            const oPostRes = await fetch(sServiceUrl.replace(/\/$/, "") + "/LeaveRequests(" + sRequestID + ")/attachments", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    ...(sCsrfToken ? { "X-CSRF-Token": sCsrfToken } : {})
                                },
                                credentials: "include",
                                body: JSON.stringify({
                                    fileName: oFile.name,
                                    mediaType: oFile.type || "application/octet-stream"
                                })
                            });

                            if (oPostRes.ok) {
                                const oPostData = await oPostRes.json();
                                await fetch(sServiceUrl.replace(/\/$/, "") + "/LeaveRequestAttachments(" + oPostData.ID + ")/content", {
                                    method: "PUT",
                                    headers: {
                                        "Content-Type": oFile.type || "application/octet-stream",
                                        ...(sCsrfToken ? { "X-CSRF-Token": sCsrfToken } : {})
                                    },
                                    credentials: "include",
                                    body: oFile
                                });
                            }
                        }
                    }

                    // 3. Submit request for approval
                    const sPath = oContext.getPath();
                    const oAction = oModel.bindContext(sPath + "/HRService.submit(...)");
                    await oAction.execute();

                    // 4. Reset form state
                    this._aPendingFiles = [];
                    const oAttModel = this.getView().getModel("attachmentModel");
                    if (oAttModel) {
                        oAttModel.setProperty("/items", []);
                    }
                    this.byId("fromDate").setValue("");
                    this.byId("toDate").setValue("");
                    this.byId("dayPreview").setNumber("0");
                    this.byId("leaveWizard").discardProgress(this.byId("step1"));

                    MessageToast.show("Leave request submitted for approval");
                    this.getOwnerComponent().getRouter().navTo("myRequests");
                } catch (e) {
                    MessageBox.error(e.message || "Failed to submit leave request.");
                } finally {
                    this._isSubmitting = false;
                    this.getView().setBusy(false);
                }
            },

            onFileSizeExceeded: function (oEvent) {
                const oItem = oEvent.getParameter("item");
                const sFileName = oItem ? oItem.getFileName() : "Selected file";
                MessageBox.error("The file '" + sFileName + "' exceeds the maximum allowed size of 10 MB. Please upload a smaller file.");
            },

            onAfterItemAdded: function (oEvent) {
                const oItem = oEvent.getParameter("item");
                const oFile = oItem.getFileObject();
                if (!oFile) {
                    return;
                }

                const oUploadSet = this.byId("attachmentSet");

                // Enforce 10 MB file size limit
                if (oFile.size > 10 * 1024 * 1024) {
                    MessageBox.error("The file '" + oFile.name + "' exceeds the maximum allowed size of 10 MB. Please upload a smaller file.");
                    if (oUploadSet && oUploadSet.removeItem) {
                        oUploadSet.removeItem(oItem);
                    }
                    return;
                }

                this._aPendingFiles = this._aPendingFiles || [];
                const sTempId = "temp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                this._aPendingFiles.push({
                    tempId: sTempId,
                    file: oFile
                });

                const oAttachmentModel = this.getView().getModel("attachmentModel");
                const aItems = oAttachmentModel.getProperty("/items") || [];
                aItems.push({
                    ID: sTempId,
                    fileName: oFile.name,
                    mediaType: oFile.type || "application/octet-stream",
                    url: ""
                });
                oAttachmentModel.setProperty("/items", aItems);

                // Remove the unmanaged UploadSetItem so only the bound model item renders
                if (oUploadSet && oUploadSet.removeItem) {
                    oUploadSet.removeItem(oItem);
                }
                MessageToast.show("Attachment added: " + oFile.name);
            },

            onAttachmentRemoved: function (oEvent) {
                const oItem = oEvent.getParameter("item");
                const oContext = oItem.getBindingContext("attachmentModel");
                const oAttachmentModel = this.getView().getModel("attachmentModel");

                if (!oContext) {
                    return;
                }

                const sID = oContext.getProperty("ID");
                if (this._aPendingFiles) {
                    this._aPendingFiles = this._aPendingFiles.filter(function (f) {
                        return f.tempId !== sID;
                    });
                }

                const aItems = (oAttachmentModel.getProperty("/items") || []).filter(function (it) {
                    return it.ID !== sID;
                });
                oAttachmentModel.setProperty("/items", aItems);
                MessageToast.show("Attachment removed");
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