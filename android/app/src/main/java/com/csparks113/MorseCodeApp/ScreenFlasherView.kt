package com.csparks113.MorseCodeApp

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.util.Log
import android.view.View
import android.view.MotionEvent
import android.os.Looper

class ScreenFlasherView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : View(context, attrs) {

  @Volatile private var pulseIntensity: Float = 0f
  @Volatile private var userBrightness: Float = DEFAULT_BRIGHTNESS_SCALAR
  @Volatile private var tintColor: Int = DEFAULT_TINT_COLOR
  @Volatile private var backgroundColor: Int = DEFAULT_BACKGROUND_COLOR
  @Volatile private var fallbackBackgroundLogged = false
  private val overlayPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = DEFAULT_TINT_COLOR
    alpha = 0
    style = Paint.Style.FILL
  }

  init {
    setWillNotDraw(false)
    isClickable = false
    isFocusable = false
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    contentDescription = null
    visibility = INVISIBLE
  }

  fun setPulseIntensity(percentScalar: Float) {
    val clamped = percentScalar.coerceIn(0f, 1f)
    if (Looper.myLooper() == Looper.getMainLooper()) {
      applyPulseIntensity(clamped)
    } else {
      post { applyPulseIntensity(clamped) }
    }
  }

  fun setBrightnessScalar(brightnessScalar: Float) {
    val clamped = brightnessScalar.coerceIn(MIN_BRIGHTNESS_SCALAR, MAX_BRIGHTNESS_SCALAR)
    if (Looper.myLooper() == Looper.getMainLooper()) {
      applyBrightnessScalar(clamped)
    } else {
      post { applyBrightnessScalar(clamped) }
    }
  }

  fun setTintColor(color: Int) {
    val normalized = color or 0xFF000000.toInt()
    if (Looper.myLooper() == Looper.getMainLooper()) {
      applyTintColor(normalized)
    } else {
      post { applyTintColor(normalized) }
    }
  }

  fun setHostBackgroundColor(color: Int?, hostName: String?) {
    val resolved = color ?: run {
      if (!fallbackBackgroundLogged) {
        Log.i(
          TAG,
          "overlay.background.unknown host=${hostName ?: "unknown"} default=#000000",
        )
      }
      fallbackBackgroundLogged = true
      DEFAULT_BACKGROUND_COLOR
    }
    val normalized = resolved or 0xFF000000.toInt()
    if (Looper.myLooper() == Looper.getMainLooper()) {
      applyBackgroundColor(normalized)
    } else {
      post { applyBackgroundColor(normalized) }
    }
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val blendFactor = (pulseIntensity * userBrightness).coerceIn(0f, 1f)
    if (blendFactor <= 0f) {
      return
    }
    val alpha = (blendFactor * 255f).toInt().coerceIn(0, 255)
    overlayPaint.color = tintColor or 0xFF000000.toInt()
    overlayPaint.alpha = alpha
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), overlayPaint)
  }

  override fun onTouchEvent(event: MotionEvent?): Boolean {
    return false
  }

  private fun applyPulseIntensity(clamped: Float) {
    if (clamped == pulseIntensity) {
      return
    }
    pulseIntensity = clamped
    visibility = if (pulseIntensity > 0f && userBrightness > 0f) VISIBLE else INVISIBLE
    invalidate()
  }

  private fun applyBrightnessScalar(brightness: Float) {
    if (brightness == userBrightness) {
      return
    }
    userBrightness = brightness
    visibility = if (pulseIntensity > 0f && userBrightness > 0f) VISIBLE else INVISIBLE
    invalidate()
  }

  private fun applyTintColor(color: Int) {
    if (color == tintColor) {
      return
    }
    tintColor = color
    invalidate()
  }

  private fun applyBackgroundColor(color: Int) {
    if (color == backgroundColor) {
      return
    }
    backgroundColor = color
    invalidate()
  }
  companion object {
    private const val TAG = "ScreenFlasherView"
    private const val DEFAULT_TINT_COLOR = 0xFFFFFFFF.toInt()
    private const val DEFAULT_BACKGROUND_COLOR = Color.BLACK
    private const val DEFAULT_BRIGHTNESS_SCALAR = 0.8f
    private const val MIN_BRIGHTNESS_SCALAR = 0.25f
    private const val MAX_BRIGHTNESS_SCALAR = 1.0f
  }
}
