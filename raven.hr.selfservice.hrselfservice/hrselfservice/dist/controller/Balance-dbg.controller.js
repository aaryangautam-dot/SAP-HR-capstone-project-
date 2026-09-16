sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History"
], function (
    Controller,
    MessageToast,
    History
) {
    "use strict";

    return Controller.extend(
        "hrselfservice.controller.Balance",
        {
            _employeeID: "65c65f04-4c72-4df2-ab07-a7e1aafe889b",

            onInit: function () {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("balance").attachPatternMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: function () {
                this.onRefreshBalance();
            },

            onLoadBalance: async function (sLeaveTypeID) {
                const oModel = this.getView().getModel();
                if (!oModel) {
                    return null;
                }
                try {
                    const result = await oModel.bindContext(
                        `/getLeaveBalance(employeeID=${this._employeeID},leaveTypeID=${sLeaveTypeID},year=${new Date().getFullYear()})`
                    ).execute();
                    const oContext = result.getBoundContext();
                    return oContext ? oContext.getObject().value : null;
                } catch (e) {
                    return null;
                }
            },

            onRefreshBalance: async function () {
                const clID = "f124a46d-09de-400c-b24e-0d6abdb57331";
                const slID = "a234b56c-10ef-411d-b35f-1e7bceb68442";
                const alID = "b345c67d-21fa-422e-c46a-2f8cdf079553";

                const clBal = await this.onLoadBalance(clID);
                if (clBal !== null && clBal !== undefined) {
                    this.byId("casualLeaveBalance").setValue(String(clBal));
                }

                const slBal = await this.onLoadBalance(slID);
                if (slBal !== null && slBal !== undefined) {
                    this.byId("sickLeaveBalance").setValue(String(slBal));
                }

                const alBal = await this.onLoadBalance(alID);
                if (alBal !== null && alBal !== undefined) {
                    this.byId("annualLeaveBalance").setValue(String(alBal));
                }

                MessageToast.show("Leave balances updated");
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