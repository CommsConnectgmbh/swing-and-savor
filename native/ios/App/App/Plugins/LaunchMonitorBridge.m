#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LaunchMonitorBridgePlugin, "LaunchMonitorBridge",
    CAP_PLUGIN_METHOD(isSupported, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(present, CAPPluginReturnPromise);
)
