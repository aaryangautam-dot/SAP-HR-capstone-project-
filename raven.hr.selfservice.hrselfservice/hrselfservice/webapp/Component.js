sap.ui.define([
    "sap/ui/core/UIComponent",
    "hrselfservice/model/models"
], function (UIComponent, models) {
    "use strict";

    return UIComponent.extend("hrselfservice.Component", {

        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(
                models.createDeviceModel(),
                "device"
            );

            this.getRouter().initialize();

            // Handle Work Zone / FLP intent routing
            const fnHandleNavigation = () => {
                try {
                    const sHash = window.location.hash || "";
                    const oComponentData = this.getComponentData();
                    const oStartupParams = oComponentData && oComponentData.startupParameters;
                    const sRoute = oStartupParams && oStartupParams.route && oStartupParams.route[0];

                    if (sRoute === "balance" || sHash.indexOf("LeaveRequest-balance") > -1) {
                        this.getRouter().navTo("balance");
                    } else if (sRoute === "createRequest" || sHash.indexOf("LeaveRequest-create") > -1) {
                        this.getRouter().navTo("createRequest");
                    } else if (sRoute === "myRequests" || sHash.indexOf("LeaveRequest-manage") > -1) {
                        this.getRouter().navTo("myRequests");
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