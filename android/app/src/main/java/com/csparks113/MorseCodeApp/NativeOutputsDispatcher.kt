package com.csparks113.MorseCodeApp

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.drawable.ColorDrawable
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.R as ReactR
import java.lang.ref.WeakReference
import java.util.Locale
import java.util.ArrayDeque
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.pow

object NativeOutputsDispatcher {
  private const val TAG = "NativeOutputsDispatcher"
  private const val BRIGHTNESS_BOOST_TARGET = 0.8f
  private const val MAIN_THREAD_TIMEOUT_MS = 120L
  private const val FLASH_OVERLAY_HOST_NATIVE_ID = "flash-overlay-background"
  private const val DEFAULT_FLASH_BRIGHTNESS_PERCENT = 80.0
  private const val MIN_FLASH_BRIGHTNESS_PERCENT = 25.0
  private const val MAX_FLASH_BRIGHTNESS_PERCENT = 100.0
  private const val BRIGHTNESS_RESPONSE_GAMMA = 0.45f
  private const val BRIGHTNESS_SCALAR_MIN = 0.25f
  private const val BRIGHTNESS_SCALAR_MAX = 1.0f
  private const val DEFAULT_TINT_COLOR = 0xFFFFFFFF.toInt()
  private const val APPEARANCE_EVENT = "flashAppearanceApplied"

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
  private val overlayHostMissingLogged = AtomicBoolean(false)
  private val overlayHostPendingLogged = AtomicBoolean(false)

  @Volatile private var currentActivityRef: WeakReference<Activity>? = null
  @Volatile private var currentActivityStrong: Activity? = null
  @Volatile private var overlayHostRef: WeakReference<ViewGroup>? = null
  @Volatile private var overlayViewRef: WeakReference<ScreenFlasherView>? = null
  @Volatile private var overlayLayoutListenerRef: WeakReference<View.OnLayoutChangeListener>? = null
  @Volatile private var overlayLayoutParentRef: WeakReference<ViewGroup>? = null
  @Volatile private var overlayHostAttachListenerRef: WeakReference<View.OnAttachStateChangeListener>? = null
  @Volatile private var overlayHostAttachViewRef: WeakReference<ViewGroup>? = null
  @Volatile private var originalBrightness: Float? = null
  @Volatile private var overlayAvailabilityState = OverlayAvailabilityState.UNKNOWN
  @Volatile private var overlayAvailabilityReason: String? = null
  @Volatile private var overlayBaseBrightnessPercent = DEFAULT_FLASH_BRIGHTNESS_PERCENT
  @Volatile private var overlayBaseBrightnessScalar =
    brightnessScalarFromPercent(DEFAULT_FLASH_BRIGHTNESS_PERCENT)
  @Volatile private var overlayBaseTintColor: Int = DEFAULT_TINT_COLOR
  @Volatile private var overlayOverrideBrightnessPercent: Double? = null
  @Volatile private var overlayOverrideBrightnessScalar: Float? = null
  @Volatile private var overlayOverrideTintColor: Int? = null
  @Volatile private var overlayAppearanceVersion: Long = 0L

  private val overlayLock = Any()
  private val overlayAppearanceLock = Any()
  private val overlayReapplyCount = AtomicInteger(0)

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
  fun setFlashOverlayState(enabled: Boolean, pulsePercent: Double): Boolean {
    val currentState = overlayAvailabilityState
    val currentReason = overlayAvailabilityReason
    Log.d(
      TAG,
      "[outputs-native] overlay.request enabled=$enabled pulse=${
        String.format(Locale.US, "%.1f", pulsePercent)
      } state=${currentState.name.lowercase(Locale.ROOT)} reason=${currentReason ?: "none"}",
    )
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
        view?.setPulseIntensity(0f)
        // If the overlay view isn't attached yet we treat this as a no-op reset
        // and preserve the previous availability state so subsequent enable attempts can retry.
        val attached = view?.isAttachedToWindow == true
        Log.d(
          TAG,
          "[outputs-native] overlay.disable.completed prevState=$previousState prevReason=$previousReason view=${view != null} attached=$attached",
        )
        true
      }
      return result == true
    }
    val pulseScalar = (pulsePercent / 100.0).coerceIn(0.0, 1.0).toFloat()
    val awaitTimeoutMs = 196L
    if (!awaitOverlayReady(awaitTimeoutMs)) {
      Log.w(
        TAG,
        "[outputs-native] overlay.enable.await_timeout pulse=${String.format(Locale.US, "%.3f", pulseScalar)} timeoutMs=$awaitTimeoutMs",
      )
      recordOverlayAvailability(false, "await_ready_timeout")
      return false
    }
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
          val parent = view.parent
          val host = overlayHostRef?.get()
          val viewAttached = view.isAttachedToWindow
          val hostAttached = host?.isAttachedToWindow ?: false
          Log.d(
            TAG,
            "[outputs-native] overlay.enable.state viewAttached=$viewAttached parent=${parent?.javaClass?.simpleName ?: "null"} " +
              "hostAttached=$hostAttached hostParent=${host?.parent?.javaClass?.simpleName ?: "null"} hostToken=${host?.windowToken}",
          )
          if (!viewAttached || parent == null) {
            Log.w(
              TAG,
              "[outputs-native] overlay.enable.not_attached viewAttached=$viewAttached parent=${parent?.javaClass?.simpleName ?: "null"}",
            )
            recordOverlayAvailability(false, "view_not_attached")
            false
          } else {
            view.setPulseIntensity(pulseScalar)
            val hostParent = overlayHostRef?.get()
            val debugReason =
              if (hostParent != null && hostParent === parent) "pulse_host"
              else if (hostParent == null) "pulse_decor_host_missing"
              else "pulse_decor_fallback"
            recordOverlayAvailability(true, debugReason)
            true
          }
        } else {
          recordOverlayAvailability(false, "ensure_overlay_failed")
          false
        }
      }
    }
    if (result == true) {
      Log.d(
        TAG,
        "[outputs-native] overlay.enable.completed pulse=${String.format(Locale.US, "%.3f", pulseScalar)} " +
          "userBrightness=${String.format(Locale.US, "%.3f", resolveAppliedBrightnessScalar())}",
      )
    } else {
      val debug = getOverlayAvailabilityDebugString()
      Log.w(
        TAG,
        "[outputs-native] overlay.enable.failed pulse=${String.format(Locale.US, "%.3f", pulseScalar)} debug=$debug",
      )
    }
    if (result == null) {
      recordOverlayAvailability(false, "main_thread_timeout")
      return false
    }
    return result == true
  }

  @JvmStatic
  fun awaitOverlayReady(timeoutMs: Long): Boolean {
    val clampedTimeout = timeoutMs.coerceAtLeast(0L)
    val deadline = SystemClock.elapsedRealtime() + clampedTimeout
    while (SystemClock.elapsedRealtime() <= deadline) {
      val ready = runOnMainSync {
        val activity = currentActivity() ?: return@runOnMainSync false
        val view = ensureOverlayView(activity) ?: return@runOnMainSync false
        val attached = view.isAttachedToWindow && view.parent === overlayHostRef?.get()
        val hasSize = view.width > 0 && view.height > 0
        if (!hasSize) {
          view.post {
            updateOverlayBounds(view, view.width, view.height)
          }
        }
        attached && hasSize
      } ?: false
      if (ready) {
        Log.d(TAG, "[outputs-native] overlay.await_ready success timeoutMs=$clampedTimeout")
        return true
      }
      SystemClock.sleep(12)
    }
    val debug = getOverlayAvailabilityDebugString()
    Log.w(
      TAG,
      "[outputs-native] overlay.await_ready timeout timeoutMs=$clampedTimeout debug=$debug",
    )
    return false
  }

  @JvmStatic
  fun setFlashOverlayAppearance(brightnessPercent: Double, colorArgb: Int): Boolean {
    val normalizedPercent = normalizeBrightnessPercent(brightnessPercent)
    val brightnessScalar = brightnessScalarFromPercent(normalizedPercent)
    val tintColor = colorArgb or 0xFF000000.toInt()
    synchronized(overlayAppearanceLock) {
      overlayBaseBrightnessPercent = normalizedPercent
      overlayBaseBrightnessScalar = brightnessScalar
      overlayBaseTintColor = tintColor
      overlayAppearanceVersion += 1
      overlayReapplyCount.set(0)
    }
    val applied = applyAppearanceOnMainThread()
    emitAppearanceApplied(
      resolveAppliedBrightnessPercent(),
      resolveAppliedBrightnessScalar(),
      resolveAppliedTintColor(),
      if (applied) "persist_applied" else "persist_cached",
      applied,
    )
    return true
  }

  @JvmStatic
  fun setFlashOverlayOverride(brightnessPercent: Double?, colorArgb: Int?): Boolean {
    val normalizedPercent = brightnessPercent?.let { normalizeBrightnessPercent(it) }
    val brightnessScalar = normalizedPercent?.let { brightnessScalarFromPercent(it) }
    val tintColor = colorArgb?.or(0xFF000000.toInt())
    synchronized(overlayAppearanceLock) {
      overlayOverrideBrightnessPercent = normalizedPercent
      overlayOverrideBrightnessScalar = brightnessScalar
      overlayOverrideTintColor = tintColor
      overlayAppearanceVersion += 1
      overlayReapplyCount.set(0)
    }
    val applied = applyAppearanceOnMainThread()
    val source = when {
      normalizedPercent == null && tintColor == null -> "override_cleared"
      else -> "override_updated"
    }
    emitAppearanceApplied(
      resolveAppliedBrightnessPercent(),
      resolveAppliedBrightnessScalar(),
      resolveAppliedTintColor(),
      if (applied) source else "${source}_cached",
      applied,
    )
    return true
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
        mainHandler.post {
          ensureOverlayView(activity)
        }
      }

      override fun onActivityPaused(activity: Activity) {
        runOnMainSync {
          overlayViewRef?.get()?.setPulseIntensity(0f)
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
      val (targetParent, attachedToHost) = resolveOverlayParent(decor)
      var view = overlayViewRef?.get()
      if (view != null && view.context !== activity) {
        (view.parent as? ViewGroup)?.removeView(view)
        Log.d(
          TAG,
          "[outputs-native] overlay.ensure.context_mismatch oldContext=${view.context.javaClass.simpleName} activity=${activity::class.java.simpleName}",
        )
        view = null
      }
      if (view == null) {
        view = ScreenFlasherView(activity)
        overlayViewRef = WeakReference(view)
      }
      val currentParent = view!!.parent as? ViewGroup
      if (currentParent !== targetParent) {
        currentParent?.removeView(view)
      }
      if (view.parent !== targetParent) {
        (view.parent as? ViewGroup)?.removeView(view)
        val layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT,
        )
        val addToParent: () -> Unit = {
          targetParent.addView(view, 0, layoutParams)
          if (!attachedToHost) {
            view.bringToFront()
          }
        }
        var attachSuccess = false
        try {
          addToParent()
          attachSuccess = true
        } catch (error: IllegalStateException) {
          Log.w(
            TAG,
            "[outputs-native] overlay.attach.retry reason=${error.message}",
          )
          (view.parent as? ViewGroup)?.removeView(view)
          try {
            addToParent()
            attachSuccess = true
          } catch (secondError: IllegalStateException) {
            Log.e(
              TAG,
              "[outputs-native] overlay.attach.failed reason=${secondError.message} target=${targetParent.javaClass.simpleName}",
            )
            overlayViewRef = null
            recordOverlayAvailability(false, "attach_failed")
            return null
          }
        }
        if (!attachSuccess) {
          overlayViewRef = null
          recordOverlayAvailability(false, "attach_failed")
          return null
        }
        if (attachedToHost) {
          recordOverlayAvailability(true, "overlay_attached_host")
          Log.d(
            TAG,
            "[outputs-native] overlay.attach host=${targetParent::class.java.simpleName} activity=${activity::class.java.simpleName}",
          )
        } else {
          recordOverlayAvailability(true, "overlay_attached_decor")
          Log.w(
            TAG,
            "[outputs-native] overlay.attach.decor fallback=${decor::class.java.simpleName} activity=${activity::class.java.simpleName}",
          )
        }
      } else {
        val reason = if (attachedToHost) {
          "overlay_reused_host"
        } else {
          "overlay_reused_decor"
        }
        if (!attachedToHost) {
          view.bringToFront()
        }
        recordOverlayAvailability(true, reason)
      }
      if (attachedToHost) {
        ensureOverlayLayout(targetParent, view)
      }
      val parent = view.parent
      val host = overlayHostRef?.get()
      Log.d(
        TAG,
        "[outputs-native] overlay.ensure.state viewAttached=${view.isAttachedToWindow} parent=${parent?.javaClass?.simpleName ?: "null"} " +
          "hostAttached=${host?.isAttachedToWindow ?: false} hostParent=${host?.parent?.javaClass?.simpleName ?: "null"} hostToken=${host?.windowToken}",
      )
      val backgroundSource = if (attachedToHost) targetParent else parent as? ViewGroup
      applyOverlayAppearance(view, backgroundSource)
      return view
    }
  }

  private fun resolveOverlayParent(decor: ViewGroup): Pair<ViewGroup, Boolean> {
    overlayHostRef?.get()?.let { cached ->
      if (cached.parent != null) {
        if (cached.isAttachedToWindow) {
          overlayHostPendingLogged.set(false)
          return Pair(cached, true)
        }
      }
      overlayHostRef = null
    }
    val host = findFlashOverlayHost(decor)
    if (host != null) {
      overlayHostRef = WeakReference(host)
      overlayHostMissingLogged.set(false)
      val attached = host.isAttachedToWindow && host.parent != null
      if (attached) {
        overlayHostPendingLogged.set(false)
        overlayHostAttachListenerRef?.get()?.let { listener ->
          overlayHostAttachViewRef?.get()?.removeOnAttachStateChangeListener(listener)
        }
        overlayHostAttachListenerRef = null
        overlayHostAttachViewRef = null
        return Pair(host, true)
      }
      if (overlayHostPendingLogged.compareAndSet(false, true)) {
        Log.w(
          TAG,
          "[outputs-native] overlay.host.pending host=${host::class.java.simpleName} attached=${host.isAttachedToWindow} parent=${host.parent?.javaClass?.simpleName ?: "null"}",
        )
      }
      val currentListener = overlayHostAttachListenerRef?.get()
      val currentView = overlayHostAttachViewRef?.get()
      if (currentView !== host || currentListener == null) {
        currentListener?.let { existing ->
          currentView?.removeOnAttachStateChangeListener(existing)
        }
        val listener = object : View.OnAttachStateChangeListener {
          override fun onViewAttachedToWindow(v: View) {
            v.removeOnAttachStateChangeListener(this)
            overlayHostAttachListenerRef = null
            overlayHostAttachViewRef = null
            overlayHostPendingLogged.set(false)
            val activity = currentActivity()
            if (activity != null) {
              mainHandler.post {
                ensureOverlayView(activity)
              }
            }
          }

          override fun onViewDetachedFromWindow(v: View) {}
        }
        host.addOnAttachStateChangeListener(listener)
        overlayHostAttachListenerRef = WeakReference(listener)
        overlayHostAttachViewRef = WeakReference(host)
      }
      return Pair(decor, false)
    }
    if (overlayHostMissingLogged.compareAndSet(false, true)) {
      Log.w(TAG, "[outputs-native] overlay.host.missing fallback=decor_view")
    }
    overlayHostPendingLogged.set(false)
    overlayHostAttachListenerRef?.get()?.let { listener ->
      overlayHostAttachViewRef?.get()?.removeOnAttachStateChangeListener(listener)
    }
    overlayHostAttachListenerRef = null
    overlayHostAttachViewRef = null
    return Pair(decor, false)
  }

  private fun findFlashOverlayHost(root: ViewGroup): ViewGroup? {
    val queue: ArrayDeque<View> = ArrayDeque()
    queue.add(root)
    while (queue.isNotEmpty()) {
      val candidate = queue.removeFirst()
      val nativeId = candidate.getTag(ReactR.id.view_tag_native_id)
      if (nativeId is String && nativeId == FLASH_OVERLAY_HOST_NATIVE_ID && candidate is ViewGroup) {
        return candidate
      }
      if (candidate is ViewGroup) {
        for (index in 0 until candidate.childCount) {
          queue.addLast(candidate.getChildAt(index))
        }
      }
    }
    return null
  }

  private fun detachOverlayFor(activity: Activity) {
    synchronized(overlayLock) {
      val view = overlayViewRef?.get() ?: return
      if (view.context === activity) {
        val parent = view.parent as? ViewGroup
        parent?.removeView(view)
        if (overlayHostRef?.get() === parent) {
          overlayHostRef = null
        }
        Log.d(
          TAG,
          "[outputs-native] overlay.detach activity=${activity::class.java.simpleName} parent=${parent?.javaClass?.simpleName}",
        )
        overlayLayoutListenerRef?.get()?.let { listener ->
          overlayLayoutParentRef?.get()?.removeOnLayoutChangeListener(listener)
        }
        overlayLayoutListenerRef = null
        overlayLayoutParentRef = null
        overlayHostMissingLogged.set(false)
        overlayViewRef = null
        recordOverlayAvailability(false, "overlay_detached")
      }
    }
  }

  private fun applyAppearanceOnMainThread(): Boolean {
    val applied = runOnMainSync {
      val view = overlayViewRef?.get()
      if (view != null) {
        val host = overlayHostRef?.get()
        val parent = view.parent as? ViewGroup
        val backgroundSource = host ?: parent
        applyOverlayAppearance(view, backgroundSource)
        true
      } else {
        false
      }
    }
    return applied == true
  }

  private fun applyOverlayAppearance(view: ScreenFlasherView, host: ViewGroup?) {
    val brightnessScalar = resolveAppliedBrightnessScalar()
    val tintColor = resolveAppliedTintColor()
    val hostName = host?.javaClass?.simpleName
    view.setTintColor(tintColor)
    view.setBrightnessScalar(brightnessScalar)
    view.setHostBackgroundColor(resolveHostBackgroundColor(host), hostName)
    overlayReapplyCount.incrementAndGet()
  }

  private fun resolveHostBackgroundColor(host: ViewGroup?): Int? {
    val background = host?.background ?: return null
    return if (background is ColorDrawable) background.color else null
  }

  private fun resolveAppliedBrightnessPercent(): Double {
    return overlayOverrideBrightnessPercent ?: overlayBaseBrightnessPercent
  }

  private fun resolveAppliedBrightnessScalar(): Float {
    return overlayOverrideBrightnessScalar ?: overlayBaseBrightnessScalar
  }

  private fun resolveAppliedTintColor(): Int {
    return overlayOverrideTintColor ?: overlayBaseTintColor
  }

  private fun normalizeBrightnessPercent(percent: Double): Double {
    if (percent.isNaN() || percent.isInfinite()) {
      return DEFAULT_FLASH_BRIGHTNESS_PERCENT
    }
    return percent.coerceIn(MIN_FLASH_BRIGHTNESS_PERCENT, MAX_FLASH_BRIGHTNESS_PERCENT)
  }

  private fun brightnessScalarFromPercent(percent: Double): Float {
    val clamped = normalizeBrightnessPercent(percent)
    val slider = (clamped / 100.0).coerceIn(0.0, 1.0).toFloat()
    val curved = slider.toDouble().pow(BRIGHTNESS_RESPONSE_GAMMA.toDouble()).toFloat()
    val scalar =
      BRIGHTNESS_SCALAR_MIN + (BRIGHTNESS_SCALAR_MAX - BRIGHTNESS_SCALAR_MIN) * curved
    return scalar.coerceIn(BRIGHTNESS_SCALAR_MIN, BRIGHTNESS_SCALAR_MAX)
  }

  private fun emitAppearanceApplied(
    brightnessPercent: Double,
    brightnessScalar: Float,
    tintColor: Int,
    source: String,
    applied: Boolean,
  ) {
    val context = reactContext ?: return
    val reapplyCount = overlayReapplyCount.get()
    Log.d(
      TAG,
      "[outputs-native] overlay.appearance.applied brightness=${
        String.format(Locale.US, "%.1f", brightnessPercent)
      } scalar=${
        String.format(Locale.US, "%.3f", brightnessScalar)
      } tint=${String.format(Locale.US, "0x%08X", tintColor)} source=$source applied=$applied reapplyCount=$reapplyCount frameJank=${reapplyCount > 1}",
    )
    try {
      val map = Arguments.createMap().apply {
        putDouble("brightnessPercent", brightnessPercent)
        putDouble("brightnessScalar", brightnessScalar.toDouble())
        putInt("tintColor", tintColor)
        putString("source", source)
        putBoolean("viewApplied", applied)
        putInt("reapplyCount", reapplyCount)
        putBoolean("frameJankSuspected", reapplyCount > 1)
      }
      context
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(APPEARANCE_EVENT, map)
    } catch (error: RuntimeException) {
      Log.w(TAG, "[outputs-native] overlay.appearance.emit_failed source=$source", error)
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

  private fun ensureOverlayLayout(parent: ViewGroup, view: ScreenFlasherView) {
    overlayLayoutListenerRef?.get()?.let { listener ->
      overlayLayoutParentRef?.get()?.removeOnLayoutChangeListener(listener)
    }
    val layoutListener = View.OnLayoutChangeListener { _, left, top, right, bottom, _, _, _, _ ->
      updateOverlayBounds(view, right - left, bottom - top)
    }
    parent.addOnLayoutChangeListener(layoutListener)
    overlayLayoutListenerRef = WeakReference(layoutListener)
    overlayLayoutParentRef = WeakReference(parent)
    val width = parent.width
    val height = parent.height
    if (width == 0 || height == 0) {
      parent.post {
        updateOverlayBounds(view, parent.width, parent.height)
      }
    } else {
      updateOverlayBounds(view, width, height)
    }
  }

  private fun updateOverlayBounds(view: ScreenFlasherView, width: Int, height: Int) {
    if (width <= 0 || height <= 0) {
      return
    }
    val layoutParams = view.layoutParams
      ?: ViewGroup.LayoutParams(width, height)
    layoutParams.width = ViewGroup.LayoutParams.MATCH_PARENT
    layoutParams.height = ViewGroup.LayoutParams.MATCH_PARENT
    view.layoutParams = layoutParams
    val widthSpec = View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY)
    val heightSpec = View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)
    view.measure(widthSpec, heightSpec)
    view.layout(0, 0, width, height)
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
