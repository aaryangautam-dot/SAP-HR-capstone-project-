sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], function (
    Controller,
    Filter,
    FilterOperator,
    MessageToast
) {
    "use strict";

    return Controller.extend(
        "hrselfservice.controller.MainView",
        {

            onStatusFilter: function (oEvent) {

                const sKey =
                    oEvent.getParameter("key");

                const oTable =
                    this.byId("leaveTable");

                const oBinding =
                    oTable.getBinding("items");

                if (sKey === "ALL") {
                    oBinding.filter([]);
                    return;
                }

                const oFilter =
                    new Filter(
                        "status",
                        FilterOperator.EQ,
                        sKey
                    );

                oBinding.filter([oFilter]);
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

            onCreateRequest: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("createRequest");
            },

            onNavToBalance: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("balance");
            },

            onNavToTeamCalendar: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("teamCalendar");
            },

            onRequestPress: function (oEvent) {

                const oContext =
                    oEvent.getSource()
                        .getBindingContext();

                if (!oContext) {
                    return;
                }

                const sID =
                    oContext.getProperty("ID");

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("leaveDetail", {
                        ID: sID
                    });
            }
        }
    );
});