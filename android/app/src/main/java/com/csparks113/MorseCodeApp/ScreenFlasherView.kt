package com.csparks113.MorseCodeApp

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.util.Log
import android.view.View
import android.view.MotionEvent
import kotlin.math.max
import kotlin.math.min

class ScreenFlasherView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : View(context, attrs) {

  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    alpha = 0
    style = Paint.Style.FILL
  }

  @Volatile
  private var intensity: Float = 0f

  init {
    setWillNotDraw(false)
    isClickable = false
    isFocusable = false
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    contentDescription = null
    visibility = INVISIBLE
  }

  fun setIntensity(percentScalar: Float) {
    val clamped = max(0f, min(1f, percentScalar))
    if (clamped == intensity) {
      return
    }
    intensity = clamped
    val alpha = (clamped * 255f).toInt().coerceIn(0, 255)
    paint.alpha = alpha
    visibility = if (alpha > 0) VISIBLE else INVISIBLE
    Log.d(
      TAG,
      "overlay.intensity clamped=$clamped alpha=$alpha visibility=$visibility " +
        "attached=$isAttachedToWindow size=${width}x$height",
    )
    if (isAttachedToWindow) {
      postInvalidateOnAnimation()
    } else {
      invalidate()
    }
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (intensity <= 0f) {
      return
    }
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
  }

  override fun onTouchEvent(event: MotionEvent?): Boolean {
    return false
  }
  companion object {
    private const val TAG = "ScreenFlasherView"
  }
}
