sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History"
], function (
    Controller,
    MessageToast,
    MessageBox,
    History
) {
    "use strict";

    return Controller.extend(
        "hrselfservice.controller.LeaveDetail",
        {
            onInit: function () {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("leaveDetail").attachPatternMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: function (oEvent) {
                const sID = oEvent.getParameter("arguments").ID;
                this.getView().bindElement({
                    path: "/LeaveRequests(" + sID + ")",
                    parameters: {
                        $expand: "attachments"
                    }
                });
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

            formatWorkflowStep: function (sStatus) {
                switch (sStatus) {
                    case "Approved":
                        return "Step 4 of 4: Approved & Balance Updated";
                    case "Rejected":
                        return "Step 4 of 4: Rejected by Manager";
                    case "Submitted":
                        return "Step 3 of 4: Under Review in SAP Build My Inbox";
                    case "Cancelled":
                        return "Workflow Terminated: Cancelled by Employee";
                    case "Draft":
                    default:
                        return "Step 1 of 4: Draft Saved (Awaiting Submission)";
                }
            },

            formatWorkflowPercent: function (sStatus) {
                switch (sStatus) {
                    case "Approved":
                    case "Rejected":
                    case "Cancelled":
                        return 100;
                    case "Submitted":
                        return 75;
                    case "Draft":
                    default:
                        return 25;
                }
            },

            formatWorkflowProgressState: function (sStatus) {
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

            onCancelRequest: async function () {
                const oContext = this.getView().getBindingContext();
                if (!oContext) {
                    return;
                }

                const sStatus = oContext.getProperty("status");
                if (sStatus !== "Draft" && sStatus !== "Submitted") {
                    MessageBox.warning("Only Draft or Submitted requests can be cancelled.");
                    return;
                }

                const oModel = this.getView().getModel();
                const sPath = oContext.getPath();

                try {
                    const oAction = oModel.bindContext(sPath + "/HRService.cancel(...)");
                    await oAction.execute();

                    MessageToast.show("Leave request cancelled successfully");
                    oContext.refresh();
                } catch (e) {
                    MessageBox.error(e.message || "Failed to cancel leave request.");
                }
            },

            onNavBack: function () {
                const oHistory = History.getInstance();
                const sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    window.history.go(-1);
                } else {
                    this.getOwnerComponent().getRouter().navTo("myRequests", {}, true);
                }
            }
        }
    );
});
