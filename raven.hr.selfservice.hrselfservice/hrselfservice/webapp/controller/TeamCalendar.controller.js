sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/routing/History"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    History
) {
    "use strict";

    return Controller.extend(
        "hrselfservice.controller.TeamCalendar",
        {
            onInit: function () {
                const oCalendarModel = new JSONModel({
                    startDate: new Date(2026, 2, 1)
                });
                this.getView().setModel(oCalendarModel, "calendar");

                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("teamCalendar").attachPatternMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: function () {
                this.onDepartmentChange();
            },

            formatDate: function (sDate) {
                if (!sDate) {
                    return new Date();
                }
                return new Date(sDate);
            },

            onDepartmentChange: function () {
                const sDept = this.byId("departmentFilter").getSelectedKey();
                const oCalendar = this.byId("teamPlanningCalendar");
                const oBinding = oCalendar.getBinding("rows");

                if (oBinding) {
                    const aFilters = [];
                    if (sDept) {
                        aFilters.push(new Filter("departmentName", FilterOperator.EQ, sDept));
                    }
                    oBinding.filter(aFilters);
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
