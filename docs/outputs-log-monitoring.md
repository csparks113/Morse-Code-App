# Outputs Log Monitoring

Use this checklist to capture React Native output timings from an Android device and keep the raw logcat stream for later comparison.

## Prerequisites
- Android device or emulator connected over `adb` with developer options enabled.
- Expo dev client already running (`npx expo start --dev-client`) in another terminal.
- Repository root opened in this PowerShell session (`C:\dev\Morse`).

## Record a Focused Log Capture
1. Open a new PowerShell terminal and run the block below from the repository root.
2. Interact with the device (e.g., press **Play Pattern**) while the capture runs.
3. When the timer reaches the configured duration, the script stops `adb logcat`, writes any remaining lines, and leaves the filtered output in the console.

```powershell
Set-Location -Path 'C:\dev\Morse'

$logDurationSeconds = 120
$logFile = Join-Path (Get-Location) 'latest-logcat-play-pattern.txt'

adb logcat -c | Out-Null

$patterns = @(
    '\[outputs-audio\]',
    'outputs\.flashPulse(\.commit)?',
    'outputs\.hapticSymbol',
    'outputs\.playMorse\.symbol',
    'keyer\.(prepare|tone)'
)

$logJob = Start-Job -ArgumentList (Get-Location).Path, $logFile, $patterns -ScriptBlock {
    param($workingDir, $capturePath, $patternList)

    Set-Location -Path $workingDir

    adb logcat ReactNativeJS:D OutputsAudio:D ReactNative:W *:S |
        Tee-Object -FilePath $capturePath |
        Select-String -Pattern $patternList
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
while ($true) {
    if (Wait-Job -Job $logJob -Timeout 1) { break }

    $chunk = Receive-Job -Job $logJob -ErrorAction SilentlyContinue
    if ($chunk) { $chunk | Write-Output }

    if ($stopwatch.Elapsed.TotalSeconds -ge $logDurationSeconds) {
        Write-Host "Stopping logcat after $logDurationSeconds seconds..."
        Stop-Job -Job $logJob -ErrorAction SilentlyContinue
        break
    }
}

Wait-Job -Job $logJob -Timeout 5 | Out-Null
Receive-Job -Job $logJob -ErrorAction SilentlyContinue | Write-Output
Remove-Job -Job $logJob -ErrorAction SilentlyContinue
```

### Adjustments
- Keep `OutputsAudio:D` in the allow list so native `[outputs-audio]` logs stream alongside the JS events.
- Increase `$logDurationSeconds` for longer captures when testing extended sessions.
- Add or remove entries in `$patterns` to refine which log lines surface in real time.
- The capture overwrites `latest-logcat-play-pattern.txt`; rename the file after each run to keep historical traces.

## Inspect the Saved Log
After a run, verify the capture size and timestamp:

```powershell
Get-Item 'latest-logcat-play-pattern.txt' | Select-Object Name, Length, LastWriteTime
```

## Summarize Output Timings
Run the analyzer script to compute both the classic JS timing deltas and the new native-alignment metrics:

```powershell
Set-Location -Path 'C:\dev\Morse'

# Point to the capture you'd like to inspect
.cscripts\analyze-logcat.ps1 -LogFile latest-logcat-play-pattern.txt
```

The script prints:
- audio?haptic/flash deltas (ms) with min/mean/P95 like before.
- Native symbol sample counts, offsets, and durations.
- Overall and per-unit JS vs native timestamp delays so you can confirm playback is aligned to the audio clock.

Capture files archived under `docs/logs/` make it easy to diff analyzer output between runs.


### Analyze Captures Automatically
Run `scripts/analyze-logcat.ps1 -Path docs/logs/<file>` to produce the native vs JS timing summary (updated to parse the multi-line symbol metadata). Record the aggregate table in `docs/android-dev-client-testing.md` after every capture so improvements stay traceable.
### Export Runs for Diffing
Rename or copy `latest-logcat-play-pattern.txt` into `docs/logs/` (or another archive folder) after each capture so you can diff runs and track improvements over time.






