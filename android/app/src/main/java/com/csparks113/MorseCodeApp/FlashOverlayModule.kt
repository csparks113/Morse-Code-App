package com.csparks113.MorseCodeApp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReactModuleWithSpec
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import android.util.Log

@ReactModule(name = FlashOverlayModule.NAME)
class FlashOverlayModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext),
  ReactModuleWithSpec,
  TurboModule {
  init {
    Log.i(TAG, "FlashOverlayModule instantiated")
  }

  override fun getName(): String = NAME

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun setFlashOverlayStateSync(enabled: Boolean, brightnessPercent: Double): Boolean {
    return NativeOutputsDispatcher.setFlashOverlayState(enabled, brightnessPercent)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun setScreenBrightnessBoostSync(enabled: Boolean) {
    NativeOutputsDispatcher.setScreenBrightnessBoost(enabled)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun getOverlayAvailabilityDebugStringSync(): String {
    return NativeOutputsDispatcher.getOverlayAvailabilityDebugString()
  }

  companion object {
    const val NAME = "FlashOverlayModule"
    private const val TAG = "FlashOverlayModule"
  }
}
