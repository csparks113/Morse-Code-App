package com.margelo.nitro.com.morsecode.generated

internal object OutputsAudioLoader {
  @Volatile
  private var initialized = false

  @JvmStatic
  @Synchronized
  fun ensureInitialized() {
    if (initialized) return
    morseNitroOnLoad.initializeNative()
    initialized = true
  }
}
