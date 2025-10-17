package com.csparks113.MorseCodeApp.specs

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.turbomodule.core.interfaces.TurboModule

abstract class NativeFlashOverlayModuleSpec(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), TurboModule {

  @ReactMethod(isBlockingSynchronousMethod = true)
  abstract fun setFlashOverlayStateSync(enabled: Boolean, brightnessPercent: Double)

  @ReactMethod(isBlockingSynchronousMethod = true)
  abstract fun setFlashOverlayAppearanceSync(brightnessPercent: Double, colorArgb: Double)

  @ReactMethod(isBlockingSynchronousMethod = true)
  abstract fun setFlashOverlayOverrideSync(brightnessPercent: Double?, colorArgb: Double?)

  @ReactMethod(isBlockingSynchronousMethod = true)
  abstract fun setScreenBrightnessBoostSync(enabled: Boolean)

  @ReactMethod(isBlockingSynchronousMethod = true)
  abstract fun getOverlayAvailabilityDebugStringSync(): String
}
