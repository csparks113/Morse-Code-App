package com.csparks113.MorseCodeApp

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.NativeModule
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class FlashOverlayPackage : TurboReactPackage() {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(
      FlashOverlayModule(reactContext),
      TorchModule(reactContext),
    )
  }

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      FlashOverlayModule.NAME -> FlashOverlayModule(reactContext)
      TorchModule.NAME -> TorchModule(reactContext)
      else -> null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    val moduleInfos = mapOf(
      FlashOverlayModule.NAME to ReactModuleInfo(
        FlashOverlayModule.NAME,
        FlashOverlayModule::class.java.name,
        false, // canOverrideExistingModule
        false, // needsEagerInit
        false, // hasConstants
        false, // isCxxModule
        true, // isTurboModule
      ),
      TorchModule.NAME to ReactModuleInfo(
        TorchModule.NAME,
        TorchModule::class.java.name,
        false, // canOverrideExistingModule
        false, // needsEagerInit
        false, // hasConstants
        false, // isCxxModule
        true, // isTurboModule
      ),
    )
    return ReactModuleInfoProvider { moduleInfos }
  }
}
