package com.csparks113.MorseCodeApp.specs

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.turbomodule.core.interfaces.TurboModule

abstract class NativeTorchModuleSpec(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), TurboModule {

  @ReactMethod(isBlockingSynchronousMethod = true)
  abstract fun setTorchEnabledSync(enabled: Boolean): Boolean

  @ReactMethod(isBlockingSynchronousMethod = true)
  abstract fun isTorchAvailableSync(): Boolean
}
