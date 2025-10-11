# Freeform Send-Lesson Regression Sweep

Detailed checklist for running the manual “freeform” regression validation on a connected Android device. Follow the steps in order so every chat session has the same context, artifacts, and cleanup routine.

## Prerequisites

- Android device/emulator connected over `adb` (developer options enabled).
- Expo dev client already running (`npx expo start --dev-client`) in another shell.
- Repository root opened in the current PowerShell window (`C:\dev\Morse`).
- Latest code pulled and Metro bundler ready to serve the app.

## 1. Prepare Logging

1. **Ensure audio tracing is verbose**
   ```powershell
   adb shell setprop log.tag.OutputsAudio D
   ```
2. **Clear existing logcat buffer**
   ```powershell
   adb logcat -c
   ```
3. **Create a fresh capture path** (replace `<STAMP>` if you want a custom name):
   ```powershell
   $stamp = (Get-Date -Format 'yyyy-MM-ddTHH-mm-ss-fffZ')
   $env:REGRESSION_LOG = "docs/logs/send-regression-logcat-$stamp.txt"
   ```
4. **Start the filtered capture** (leave this PowerShell tab running):
   ```powershell
   adb logcat ReactNativeJS:D OutputsAudio:D ReactNative:W *:S `
     | Select-String -Pattern 'keyer\.', 'outputs', '\[outputs-audio\]' `
     | Tee-Object -FilePath $env:REGRESSION_LOG
   ```

## 2. Execute the Freeform Sweep

_Work from a second shell or the device itself while the capture runs._

1. Alternate lesson speeds (e.g., 12 → 18 → 22 WPM) and glyph types (A/N/R plus challenge mode).
2. Mix correctness: intentionally miss patterns, trigger force-cutoffs, complete reveals, etc.
3. Note timestamps or scenario highlights as you go (optional but helpful). Example template:
   ```markdown
   - 20:05:12Z – 18 WPM alternating A/N/R, 70% accuracy, torch behaved correctly.
   - 20:07:40Z – Challenge mode, forced two heart drops, torch reset slow (~350 ms).
   ```

## 3. Stop Capture

1. When finished, stop the running `adb logcat` command with `Ctrl+C`.
2. Record the final capture path (PowerShell prompt should echo it via `$env:REGRESSION_LOG`).

## 4. Analyze Results

1. Run the analyzer on the captured file:
   ```powershell
   scripts\analyze-logcat.ps1 -LogFile $env:REGRESSION_LOG
   ```
2. Review the printed table. Expect audio to lead haptic/flash/tone by only a few milliseconds and torch resets in ~150–350 ms.
3. Check the “Raw counts” and the `[outputs-audio]` total to ensure the sweep covered enough samples.

## 5. Summarize in this Repository

1. Open/create a dated entry (suggested: append to `docs/logs/send-regression-notes-<STAMP>.md` or add a new section in your working log).
2. Include:
   - Timestamp window of the sweep.
   - Analyzer highlights (any regressions or noteworthy deltas).
   - Optional: direct links to commits/builds under test.

## 6. Cleanup

1. **Archive summary:** Save your Markdown notes at the bottom of this file.
2. **Delete the raw capture once logged:**
   ```powershell
   Remove-Item $env:REGRESSION_LOG -Force
   ```
3. **Reset audio logging (optional, keeps logcat quieter for other tasks):**
   ```powershell
   adb shell setprop log.tag.OutputsAudio I
   ```
4. **Clear environment variable (optional):**
   ```powershell
   Remove-Item Env:\REGRESSION_LOG -ErrorAction SilentlyContinue
   ```
5. Confirm `docs/logs/` is empty or only contains deliberately archived summaries.

---

Following this checklist ensures every freeform sweep captures the right signals, produces consistent analyzer output, and leaves the workspace clean for the next session. When starting a new chat, reference this document so the agent can jump directly into Step 1 with full context.
