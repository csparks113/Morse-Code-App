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
Use the helper snippet below to compute timing deltas between key output events. It expects the latest capture file and prints aggregate statistics in milliseconds.

```powershell
Set-Location -Path 'C:\dev\Morse'

$patterns = @(
    '\[outputs-audio\]',
    'outputs\.flashPulse(\.commit)?',
    'outputs\.hapticSymbol',
    'outputs\.playMorse\.symbol',
    'keyer\.(prepare|tone)'
)

$lines = Select-String -Path 'latest-logcat-play-pattern.txt' -Pattern $patterns
$year = (Get-Date).Year
$events = [System.Collections.Generic.List[object]]::new()

foreach ($item in $lines) {
    $line = $item.Line.Trim()
    if ($line -match "^(?<md>\d\d-\d\d)\s+(?<time>\d\d:\d\d:\d\d\.\d+)\s+\d+\s+\d+\s+\w\s+ReactNativeJS:\s+'\[outputs\]\s+(?<event>[^']+)'") {
        $dateString = "$year $($matches['md']) $($matches['time'])"
        $logTime = [datetime]::ParseExact($dateString, 'yyyy MM-dd HH:mm:ss.fff', [System.Globalization.CultureInfo]::InvariantCulture)
        $tsMatch = [regex]::Match($line, 'timestamp:\s*([0-9\.]+)')
        $timestamp = if ($tsMatch.Success) { [double]$tsMatch.Groups[1].Value } else { $null }
        $events.Add([pscustomobject]@{
            LogTime   = $logTime
            Event     = $matches['event']
            Timestamp = $timestamp
        })
    }
}

$hapticToFlash = @()
$flashToCommit = @()
$prepareDurations = @()
$toneDurations = @()
$toneGaps = @()
$lastHaptic = $null
$lastFlash = $null
$lastPrepare = $null
$lastToneStart = $null
$lastToneStop = $null

foreach ($event in $events) {
    switch ($event.Event) {
        'outputs.hapticSymbol' {
            $lastHaptic = $event
        }
        'outputs.flashPulse' {
            if ($lastHaptic) { $hapticToFlash += ($event.Timestamp - $lastHaptic.Timestamp) }
            $lastFlash = $event
        }
        'outputs.flashPulse.commit' {
            if ($lastFlash) { $flashToCommit += ($event.Timestamp - $lastFlash.Timestamp) }
        }
        'keyer.prepare' {
            $lastPrepare = $event
        }
        'keyer.prepare.complete' {
            if ($lastPrepare) { $prepareDurations += ($event.Timestamp - $lastPrepare.Timestamp) }
            $lastPrepare = $null
        }
        'keyer.tone.start' {
            if ($lastToneStop) { $toneGaps += ($event.Timestamp - $lastToneStop.Timestamp) }
            $lastToneStart = $event
        }
        'keyer.tone.stop' {
            if ($lastToneStart) { $toneDurations += ($event.Timestamp - $lastToneStart.Timestamp) }
            $lastToneStop = $event
            $lastToneStart = $null
        }
    }
}

function Get-Stats($label, $values) {
    if (!$values -or $values.Count -eq 0) {
        return [pscustomobject]@{ Metric = $label; Count = 0; Min = ''; Max = ''; Mean = ''; P95 = '' }
    }

    $sorted = $values | Sort-Object
    $mean = ($values | Measure-Object -Average).Average
    $min = $sorted[0]
    $max = $sorted[-1]
    $p95Index = [math]::Min([math]::Floor(0.95 * ($sorted.Count - 1)), $sorted.Count - 1)
    $p95 = $sorted[$p95Index]

    [pscustomobject]@{
        Metric = $label
        Count  = $values.Count
        Min    = '{0:N3}' -f $min
        Max    = '{0:N3}' -f $max
        Mean   = '{0:N3}' -f $mean
        P95    = '{0:N3}' -f $p95
    }
}

$stats = @()
$stats += Get-Stats 'haptic -> flashPulse (ms)' $hapticToFlash
$stats += Get-Stats 'flashPulse -> commit (ms)' $flashToCommit
$stats += Get-Stats 'keyer.prepare duration (ms)' $prepareDurations
$stats += Get-Stats 'keyer tone on duration (ms)' $toneDurations
$stats += Get-Stats 'tone gap between stop/start (ms)' $toneGaps

$stats | Format-Table -AutoSize
```

### Export Runs for Diffing
Rename or copy `latest-logcat-play-pattern.txt` into `docs/logs/` (or another archive folder) after each capture so you can diff runs and track improvements over time.




