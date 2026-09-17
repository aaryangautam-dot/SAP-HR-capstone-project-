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

            // Handle Work Zone / FLP initial intent routing
            try {
                const oComponentData = this.getComponentData();
                const oStartupParams = oComponentData && oComponentData.startupParameters;
                const sRouteParam = oStartupParams && oStartupParams.route && oStartupParams.route[0];

                const sCurrentHash = this.getRouter().getHashChanger().getHash();
                if (!sCurrentHash && sRouteParam && this.getRouter().getRoute(sRouteParam)) {
                    this.getRouter().navTo(sRouteParam, {}, true /* bReplace */);
                }
            } catch (e) {
                // router fallback
            }
        }
    });
});