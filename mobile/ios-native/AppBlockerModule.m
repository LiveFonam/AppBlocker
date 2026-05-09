#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppBlockerModule, NSObject)

RCT_EXTERN_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(showAppPicker)

RCT_EXTERN_METHOD(startBlocking:(double)startMinutes
                  endMinutes:(double)endMinutes)

RCT_EXTERN_METHOD(stopBlocking)

RCT_EXTERN_METHOD(isBlocking:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getSelectedCount:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
