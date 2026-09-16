sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], function (UIComponent, JSONModel, Device) {
    "use strict";

    return UIComponent.extend("hradmin.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            const oDeviceModel = new JSONModel(Device);
            oDeviceModel.setDefaultBindingMode("OneWay");
            this.setModel(oDeviceModel, "device");

            this.getRouter().initialize();

            // Handle Work Zone / FLP intent routing
            const fnHandleNavigation = () => {
                try {
                    const sHash = window.location.hash || "";
                    const oComponentData = this.getComponentData();
                    const oStartupParams = oComponentData && oComponentData.startupParameters;
                    const sRoute = oStartupParams && oStartupParams.route && oStartupParams.route[0];
                    const sTab = oStartupParams && oStartupParams.tab && oStartupParams.tab[0];

                    if (sRoute === "leaveRequests" || sTab === "overview" || sHash.indexOf("HRAdmin-overview") > -1) {
                        this.getRouter().navTo("leaveRequests");
                    } else if (sRoute === "pendingApprovals" || sTab === "approvals" || sHash.indexOf("HRAdmin-approvals") > -1) {
                        this.getRouter().navTo("pendingApprovals");
                    } else if (sRoute === "employeeDirectory" || sRoute === "employees" || sTab === "employees" || sHash.indexOf("HRAdmin-manage") > -1) {
                        this.getRouter().navTo("employeeDirectory");
                    }
                } catch (e) {
                    // router fallback
                }
            };

            fnHandleNavigation();
            window.addEventListener("hashchange", fnHandleNavigation);
        }
    });
});
