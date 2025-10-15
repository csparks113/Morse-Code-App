package com.csparks113.MorseCodeApp

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.ViewGroup
import com.facebook.react.bridge.ReactApplicationContext
import java.lang.ref.WeakReference
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

object NativeOutputsDispatcher {
  private const val TAG = "NativeOutputsDispatcher"
  private const val BRIGHTNESS_BOOST_TARGET = 0.8f
  private const val MAIN_THREAD_TIMEOUT_MS = 120L

  private enum class OverlayAvailabilityState {
    UNKNOWN,
    AVAILABLE,
    UNAVAILABLE,
  }

  @Volatile private var applicationContext: Context? = null
  @Volatile private var reactContext: ReactApplicationContext? = null
  @Volatile private var cameraManager: CameraManager? = null
  @Volatile private var torchCameraId: String? = null
  @Volatile private var vibrator: Vibrator? = null

  private val mainHandler = Handler(Looper.getMainLooper())
  private val torchUnavailableLogged = AtomicBoolean(false)
  private val vibrateUnavailableLogged = AtomicBoolean(false)
  private val activityCallbacksRegistered = AtomicBoolean(false)
  private val overlayBrightnessBoosted = AtomicBoolean(false)

  @Volatile private var currentActivityRef: WeakReference<Activity>? = null
  @Volatile private var currentActivityStrong: Activity? = null
  @Volatile private var overlayViewRef: WeakReference<ScreenFlasherView>? = null
  @Volatile private var originalBrightness: Float? = null
  @Volatile private var overlayAvailabilityState = OverlayAvailabilityState.UNKNOWN
  @Volatile private var overlayAvailabilityReason: String? = null

  private val overlayLock = Any()

  private fun recordOverlayAvailability(available: Boolean, reason: String) {
    val newState = if (available) {
      OverlayAvailabilityState.AVAILABLE
    } else {
      OverlayAvailabilityState.UNAVAILABLE
    }
    val previousState = overlayAvailabilityState
    val previousReason = overlayAvailabilityReason
    val shouldLog = when {
      previousState != newState -> true
      !available && previousReason != reason -> true
      else -> false
    }
    overlayAvailabilityState = newState
    overlayAvailabilityReason = reason
    if (!shouldLog) {
      return
    }
    if (available) {
      Log.i(TAG, "[outputs-native] overlay.availability state=available reason=$reason")
    } else {
      Log.w(TAG, "[outputs-native] overlay.availability state=unavailable reason=$reason")
    }
  }

  @JvmStatic
  fun initialize(context: ReactApplicationContext) {
    reactContext = context
    val appContext = context.applicationContext
    applicationContext = appContext
    cameraManager = appContext.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
    torchCameraId = resolveTorchCameraId(cameraManager, appContext.packageManager)
    vibrator = resolveVibrator(appContext)
    registerActivityCallbacks(appContext)
    context.currentActivity?.let {
      currentActivityRef = WeakReference(it)
      currentActivityStrong = it
    }
  }

  @JvmStatic
  fun setTorchEnabled(enabled: Boolean) {
    val manager = cameraManager
    val cameraId = torchCameraId
    if (manager == null || cameraId == null) {
      if (torchUnavailableLogged.compareAndSet(false, true)) {
        Log.w(TAG, "Torch unavailable; ignoring setTorchEnabled($enabled)")
      }
      return
    }
    val runnable = Runnable {
      try {
        manager.setTorchMode(cameraId, enabled)
      } catch (error: CameraAccessException) {
        Log.w(TAG, "Camera access failure while toggling torch", error)
      } catch (error: SecurityException) {
        Log.w(TAG, "Missing permission while toggling torch", error)
      } catch (error: RuntimeException) {
        Log.w(TAG, "Unexpected error while toggling torch", error)
      }
    }
    if (Looper.myLooper() == mainHandler.looper) {
      runnable.run()
    } else {
      mainHandler.post(runnable)
    }
  }

  @JvmStatic
  fun vibrate(durationMs: Long) {
    if (durationMs <= 0) {
      return
    }
    val localVibrator = vibrator ?: resolveVibrator(applicationContext).also { vibrator = it }
    if (localVibrator == null) {
      if (vibrateUnavailableLogged.compareAndSet(false, true)) {
        Log.w(TAG, "Vibrator unavailable; ignoring vibrate($durationMs)")
      }
      return
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val effect = VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE)
        localVibrator.vibrate(effect)
      } else {
        @Suppress("DEPRECATION")
        localVibrator.vibrate(durationMs)
      }
    } catch (error: SecurityException) {
      Log.w(TAG, "Missing permission while triggering vibration", error)
    } catch (error: RuntimeException) {
      Log.w(TAG, "Unexpected error while triggering vibration", error)
    }
  }

  @JvmStatic
  fun setFlashOverlayState(enabled: Boolean, brightnessPercent: Double): Boolean {
    if (!enabled) {
      val result = runOnMainSync {
        val previousState = overlayAvailabilityState
        val previousReason = overlayAvailabilityReason
        var view = overlayViewRef?.get()
        if (view == null) {
          val activity = currentActivity()
          if (activity == null) {
            Log.d(
              TAG,
              "[outputs-native] overlay.reset.no_view activity=null prevState=$previousState prevReason=$previousReason",
            )
          } else {
            Log.d(
              TAG,
              "[outputs-native] overlay.reset.no_view activity=${activity::class.java.simpleName} prevState=$previousState prevReason=$previousReason",
            )
            view = ensureOverlayView(activity)
            if (view != null) {
              Log.d(TAG, "[outputs-native] overlay.reset.recovered view=${view::class.java.simpleName}")
            }
          }
          if (view == null) {
            Log.w(
              TAG,
              "[outputs-native] overlay.reset.attach_failed prevState=$previousState prevReason=$previousReason",
            )
          }
        }
        view?.setIntensity(0f)
        // If the overlay view isn't attached yet we treat this as a no-op reset
        // and preserve the previous availability state so subsequent enable attempts can retry.
        true
      }
      return result == true
    }
    val scalar = (brightnessPercent / 100.0).coerceIn(0.0, 1.0).toFloat()
    val result = runOnMainSync {
      val activity = currentActivity()
      if (activity == null) {
        Log.w(
          TAG,
          "[outputs-native] overlay.enable.no_activity state=$overlayAvailabilityState reason=$overlayAvailabilityReason",
        )
        recordOverlayAvailability(false, "activity_missing")
        false
      } else if (activity.isFinishing) {
        Log.w(
          TAG,
          "[outputs-native] overlay.enable.finishing activity=${activity::class.java.simpleName}",
        )
        recordOverlayAvailability(false, "activity_finishing")
        false
      } else {
        val view = ensureOverlayView(activity)
        if (view != null) {
          view.setIntensity(scalar)
          recordOverlayAvailability(true, "ensure_overlay_ready")
          true
        } else {
          recordOverlayAvailability(false, "ensure_overlay_failed")
          false
        }
      }
    }
    if (result == null) {
      recordOverlayAvailability(false, "main_thread_timeout")
      return false
    }
    return result == true
  }

  @JvmStatic
  fun setScreenBrightnessBoost(enabled: Boolean) {
    runOnMainSync {
      val activity = currentActivity() ?: return@runOnMainSync
      val window = activity.window ?: return@runOnMainSync
      val params = window.attributes
      if (enabled) {
        if (!overlayBrightnessBoosted.get()) {
          originalBrightness = params.screenBrightness
        }
        params.screenBrightness = BRIGHTNESS_BOOST_TARGET
        overlayBrightnessBoosted.set(true)
      } else {
        if (overlayBrightnessBoosted.get()) {
          val previous = originalBrightness
          params.screenBrightness = previous ?: -1f
          originalBrightness = null
          overlayBrightnessBoosted.set(false)
        }
      }
      window.attributes = params
    }
  }

  @JvmStatic
  fun getOverlayAvailabilityDebugString(): String {
    val state = overlayAvailabilityState
    val reason = overlayAvailabilityReason
    return buildString {
      append("state=")
      append(state.name.lowercase(Locale.ROOT))
      if (!reason.isNullOrEmpty()) {
        append(" reason=")
        append(reason)
      }
    }
  }

  private fun registerActivityCallbacks(context: Context) {
    if (!activityCallbacksRegistered.compareAndSet(false, true)) {
      return
    }
    val application = context as? Application ?: return
    application.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
      override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        currentActivityRef = WeakReference(activity)
        currentActivityStrong = activity
      }

      override fun onActivityStarted(activity: Activity) {
        currentActivityRef = WeakReference(activity)
        currentActivityStrong = activity
      }

      override fun onActivityResumed(activity: Activity) {
        currentActivityRef = WeakReference(activity)
        currentActivityStrong = activity
      }

      override fun onActivityPaused(activity: Activity) {
        runOnMainSync {
          overlayViewRef?.get()?.setIntensity(0f)
        }
      }

      override fun onActivityStopped(activity: Activity) {}

      override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

      override fun onActivityDestroyed(activity: Activity) {
        detachOverlayFor(activity)
        if (currentActivityRef?.get() === activity) {
          currentActivityRef = null
        }
        if (currentActivityStrong === activity) {
          currentActivityStrong = null
        }
      }
    })
  }

  @JvmStatic
  fun updateCurrentActivity(activity: Activity?) {
    if (activity != null) {
      currentActivityRef = WeakReference(activity)
      currentActivityStrong = activity
    } else {
      currentActivityRef = null
      currentActivityStrong = null
    }
  }

  private fun currentActivity(): Activity? {
    currentActivityStrong?.let { strong ->
      return strong
    }
    currentActivityRef?.get()?.let { cached ->
      currentActivityStrong = cached
      return cached
    }
    val contextCurrent = reactContext?.currentActivity
    if (contextCurrent != null) {
      currentActivityRef = WeakReference(contextCurrent)
      currentActivityStrong = contextCurrent
      return contextCurrent
    }
    Log.v(
      TAG,
      "[outputs-native] overlay.current_activity.missing state=$overlayAvailabilityState reason=$overlayAvailabilityReason",
    )
    return null
  }

  private fun ensureOverlayView(activity: Activity): ScreenFlasherView? {
    val window = activity.window ?: run {
      recordOverlayAvailability(false, "window_missing")
      return null
    }
    val decor = window.decorView as? ViewGroup ?: run {
      recordOverlayAvailability(false, "decor_missing")
      return null
    }
    synchronized(overlayLock) {
      var view = overlayViewRef?.get()
      if (view != null && view.context !== activity) {
        (view.parent as? ViewGroup)?.removeView(view)
        view = null
      }
      if (view == null) {
        view = ScreenFlasherView(activity)
        overlayViewRef = WeakReference(view)
        val params = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT,
        )
        decor.addView(view, 0, params)
        recordOverlayAvailability(true, "overlay_attached")
      } else if (view.parent != decor) {
        (view.parent as? ViewGroup)?.removeView(view)
        val params = view.layoutParams
          ?: ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
          )
        decor.addView(view, 0, params)
        view.bringToFront()
        recordOverlayAvailability(true, "overlay_reparented")
      } else {
        recordOverlayAvailability(true, "overlay_reused")
      }
      return view
    }
  }

  private fun detachOverlayFor(activity: Activity) {
    synchronized(overlayLock) {
      val view = overlayViewRef?.get() ?: return
      if (view.context === activity) {
        (view.parent as? ViewGroup)?.removeView(view)
        overlayViewRef = null
        recordOverlayAvailability(false, "overlay_detached")
      }
    }
  }

  private fun resolveTorchCameraId(
    manager: CameraManager?,
    packageManager: PackageManager,
  ): String? {
    if (manager == null) {
      return null
    }
    if (!packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH)) {
      return null
    }
    return try {
      val backFacing = manager.cameraIdList.firstOrNull { id ->
        val characteristics = manager.getCameraCharacteristics(id)
        val flashAvailable =
          characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
        val lensFacing = characteristics.get(CameraCharacteristics.LENS_FACING)
        flashAvailable && lensFacing == CameraCharacteristics.LENS_FACING_BACK
      }
      backFacing ?: manager.cameraIdList.firstOrNull { id ->
        manager.getCameraCharacteristics(id)
          .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
      }
    } catch (error: CameraAccessException) {
      Log.w(TAG, "Unable to query camera characteristics", error)
      null
    } catch (error: RuntimeException) {
      Log.w(TAG, "Unexpected error while querying camera characteristics", error)
      null
    }
  }

  private fun resolveVibrator(context: Context?): Vibrator? {
    if (context == null) {
      return null
    }
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val manager =
        context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
      manager?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
  }

  private fun <T> runOnMainSync(timeoutMs: Long = MAIN_THREAD_TIMEOUT_MS, block: () -> T): T? {
    return if (Looper.myLooper() == mainHandler.looper) {
      block()
    } else {
      val latch = CountDownLatch(1)
      var result: T? = null
      mainHandler.post {
        try {
          result = block()
        } finally {
          latch.countDown()
        }
      }
      if (latch.await(timeoutMs, TimeUnit.MILLISECONDS)) {
        result
      } else {
        null
      }
    }
  }
}










