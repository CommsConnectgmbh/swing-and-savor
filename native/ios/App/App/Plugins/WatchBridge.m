#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(WatchBridgePlugin, "WatchBridge",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(publishMatch, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(clearMatch, CAPPluginReturnPromise);
)
