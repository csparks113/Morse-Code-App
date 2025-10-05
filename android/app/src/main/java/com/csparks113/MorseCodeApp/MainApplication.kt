package com.csparks113.MorseCodeApp

import android.app.Application
import android.content.res.Configuration
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import java.io.IOException
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  private val newArchitectureController = NewArchitectureController()

  override val reactNativeHost: ReactNativeHost =
      ReactNativeHostWrapper(
          this,
          object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                  // Packages that cannot be autolinked yet can be added manually here, for example:
                  // add(MyReactNativePackage())
                }

            override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean
              get() = newArchitectureController.isEnabled()
          })

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    System.loadLibrary("morseNitro")
    try {
      SoLoader.init(this, OpenSourceMergedSoMapping)
    } catch (error: IOException) {
      throw RuntimeException("Unable to initialize SoLoader", error)
    }

    var usingNewArchitecture = newArchitectureController.isEnabled()

    if (usingNewArchitecture) {
      DefaultNewArchitectureEntryPoint.releaseLevel =
          try {
            ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
          } catch (e: IllegalArgumentException) {
            ReleaseLevel.STABLE
          }
    }

    setRuntimeNewArchitectureEnabled(usingNewArchitecture)

    try {
      loadReactNative(this)
      if (usingNewArchitecture) {
        Log.i(TAG, "New Architecture native libraries loaded successfully.")
      }
    } catch (error: RuntimeException) {
      val rootCause = error.cause ?: error
      if (usingNewArchitecture && rootCause is UnsatisfiedLinkError) {
        newArchitectureController.disableDueTo(rootCause)
        usingNewArchitecture = false
        Log.w(TAG, "Disabling New Architecture after native library load failure.", rootCause)
        loadReactNative(this)
      } else {
        throw error
      }
    }

    Log.i(TAG, "Runtime New Architecture enabled: ${isRuntimeNewArchitectureEnabled()}")
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }

  private inner class NewArchitectureController {
    private var cachedValue: Boolean? = null

    fun isEnabled(): Boolean {
      cachedValue?.let { return it }
      val resolved = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      cachedValue = resolved
      return resolved
    }

    fun disableDueTo(error: Throwable? = null) {
      if (cachedValue == false) {
        return
      }
      cachedValue = false
      Log.w(TAG, "Disabling New Architecture at runtime due to missing native libraries.", error)
      setRuntimeNewArchitectureEnabled(false)
    }
  }

  companion object {
    private const val TAG = "MainApplication"
    @Volatile private var runtimeNewArchitectureEnabled: Boolean =
        BuildConfig.IS_NEW_ARCHITECTURE_ENABLED

    @JvmStatic
    fun isRuntimeNewArchitectureEnabled(): Boolean = runtimeNewArchitectureEnabled
  }

  private fun setRuntimeNewArchitectureEnabled(enabled: Boolean) {
    Companion.runtimeNewArchitectureEnabled = enabled
  }
}






