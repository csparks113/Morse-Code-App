package com.csparks113.MorseCodeApp

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.csparks113.MorseCodeApp.specs.NativeFlashOverlayModuleSpec

@ReactModule(name = FlashOverlayModule.NAME)
class FlashOverlayModule(reactContext: ReactApplicationContext) :
  NativeFlashOverlayModuleSpec(reactContext) {
  init {
    Log.i(TAG, "FlashOverlayModule instantiated")
  }

  override fun getName(): String = NAME

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun setFlashOverlayStateSync(enabled: Boolean, brightnessPercent: Double) {
    val success = NativeOutputsDispatcher.setFlashOverlayState(enabled, brightnessPercent)
    if (!success) {
      throw RuntimeException("Native overlay unavailable for state=$enabled")
    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun setFlashOverlayAppearanceSync(brightnessPercent: Double, colorArgb: Double) {
    NativeOutputsDispatcher.setFlashOverlayAppearance(
      brightnessPercent,
      colorArgb.toLong().toInt(),
    )
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun setFlashOverlayOverrideSync(brightnessPercent: Double?, colorArgb: Double?) {
    NativeOutputsDispatcher.setFlashOverlayOverride(
      brightnessPercent,
      colorArgb?.toLong()?.toInt(),
    )
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun setScreenBrightnessBoostSync(enabled: Boolean) {
    NativeOutputsDispatcher.setScreenBrightnessBoost(enabled)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun getOverlayAvailabilityDebugStringSync(): String {
    return NativeOutputsDispatcher.getOverlayAvailabilityDebugString()
  }

  companion object {
    const val NAME = "FlashOverlayModule"
    private const val TAG = "FlashOverlayModule"
  }
}
