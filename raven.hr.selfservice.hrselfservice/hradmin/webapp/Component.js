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

            // Handle Work Zone / FLP initial intent routing
            try {
                const oComponentData = this.getComponentData();
                const oStartupParams = oComponentData && oComponentData.startupParameters;
                const sRouteParam = (oStartupParams && oStartupParams.route && oStartupParams.route[0]) ||
                                    (oStartupParams && oStartupParams.tab && oStartupParams.tab[0]);

                const sCurrentHash = this.getRouter().getHashChanger().getHash();
                if (!sCurrentHash && sRouteParam) {
                    const sTargetRoute = sRouteParam === "overview" ? "leaveRequests" :
                                         sRouteParam === "approvals" ? "pendingApprovals" :
                                         sRouteParam === "employees" ? "employeeDirectory" : sRouteParam;
                    if (this.getRouter().getRoute(sTargetRoute)) {
                        this.getRouter().navTo(sTargetRoute, {}, true /* bReplace */);
                    }
                }
            } catch (e) {
                // router fallback
            }
        }
    });
});
