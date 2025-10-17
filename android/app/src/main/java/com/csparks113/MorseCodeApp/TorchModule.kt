package com.csparks113.MorseCodeApp

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.csparks113.MorseCodeApp.specs.NativeTorchModuleSpec

@ReactModule(name = TorchModule.NAME)
class TorchModule(reactContext: ReactApplicationContext) :
  NativeTorchModuleSpec(reactContext) {

  init {
    Log.i(TAG, "TorchModule instantiated")
  }

  override fun getName(): String = NAME

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun setTorchEnabledSync(enabled: Boolean): Boolean {
    return NativeOutputsDispatcher.setTorchEnabledSync(enabled)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun isTorchAvailableSync(): Boolean {
    return NativeOutputsDispatcher.isTorchAvailable()
  }

  companion object {
    const val NAME = "TorchModule"
    private const val TAG = "TorchModule"
  }
}
