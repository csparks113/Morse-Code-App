param(
    [string]$LogFile = 'latest-logcat-play-pattern.txt'
)

if (-not (Test-Path $LogFile)) {
    Write-Error "Log file '$LogFile' not found."
    exit 1
}

$year = (Get-Date).Year

$audioToHaptic = New-Object System.Collections.Generic.List[double]
$audioToFlash = New-Object System.Collections.Generic.List[double]
$audioToCommit = New-Object System.Collections.Generic.List[double]
$hapticToFlash = New-Object System.Collections.Generic.List[double]
$flashToCommit = New-Object System.Collections.Generic.List[double]

$symbolSamples = @()

$lastAudioStart = $null
$lastHaptic = $null
$lastFlash = $null
$currentRunUnit = $null
$currentSymbol = $null

function Parse-TimestampMs {
    param([string]$message)
    $match = [regex]::Match($message, 'timestamp:\s*([0-9\.]+)')
    if ($match.Success) {
        return [double]$match.Groups[1].Value
    }
    return $null
}

function Parse-UnitMs {
    param([string]$message)
    $match = [regex]::Match($message, 'unitMs:\s*([0-9\.]+)')
    if ($match.Success) {
        return [double]$match.Groups[1].Value
    }
    return $null
}

function Parse-NativeField {
    param([string]$message, [string]$field)
    $pattern = "${field}:\\s*(?<value>null|[-0-9\.]+)"
    $match = [regex]::Match($message, $pattern)
    if ($match.Success) {
        $value = $match.Groups['value'].Value
        if ($value -ne 'null') {
            return [double]$value
        }
    }
    return $null
}

function Add-Stat {
    param($list, [double]$value)
    if ($null -ne $value -and -not [double]::IsNaN($value) -and -not [double]::IsInfinity($value)) {
        $list.Add($value) | Out-Null
    }
}

function Get-Stats {
    param([string]$label, $values)
    if ($values.Count -eq 0) {
        return [pscustomobject]@{ Metric = $label; Count = 0; Min = ''; Max = ''; Mean = ''; P95 = '' }
    }
    $sorted = $values | Sort-Object
    $mean = ($values | Measure-Object -Average).Average
    $min = $sorted[0]
    $max = $sorted[-1]
    $p95Index = [math]::Min([math]::Floor(0.95 * ($sorted.Count - 1)), $sorted.Count - 1)
    $p95 = $sorted[$p95Index]
    return [pscustomobject]@{
        Metric = $label
        Count  = $values.Count
        Min    = '{0:N3}' -f $min
        Max    = '{0:N3}' -f $max
        Mean   = '{0:N3}' -f $mean
        P95    = '{0:N3}' -f $p95
    }
}

$linePattern = '^(?<md>\d\d-\d\d)\s+(?<time>\d\d:\d\d:\d\d\.\d+)\s+\d+\s+\d+\s+\w\s+(?<tag>OutputsAudio|ReactNativeJS):\s+(?<message>.*)$'

foreach ($line in Get-Content -Path $LogFile) {
    $match = [regex]::Match($line, $linePattern)
    if (!$match.Success) { continue }

    $md = $match.Groups['md'].Value
    $time = $match.Groups['time'].Value
    $tag = $match.Groups['tag'].Value
    $message = $match.Groups['message'].Value

    $logTime = [datetime]::ParseExact("$year $md $time", 'yyyy MM-dd HH:mm:ss.fff', [System.Globalization.CultureInfo]::InvariantCulture)

    if ($tag -eq 'OutputsAudio' -and $message -match '\[outputs-audio\]\s+start') {
        $lastAudioStart = $logTime
        continue
    }

    if ($tag -ne 'ReactNativeJS') { continue }

    if ($message -match '\[outputs\]\s+playMorse\.start') {
        $parsedUnit = Parse-UnitMs $message
        if ($parsedUnit -ne $null) {
            $currentRunUnit = $parsedUnit
        }
        continue
    }

    if ($message -match '\[outputs\]\s+outputs\.hapticSymbol') {
        $timestampMs = Parse-TimestampMs $message
        if ($lastAudioStart) {
            Add-Stat $audioToHaptic (($logTime - $lastAudioStart).TotalMilliseconds)
        }
        $lastHaptic = [pscustomobject]@{ TimestampMs = $timestampMs; LogTime = $logTime }
        continue
    }

    if ($message -match '\[outputs\]\s+outputs\.flashPulse' -and $message -notmatch 'outputs\.flashPulse\.commit') {
        $timestampMs = Parse-TimestampMs $message
        if ($lastAudioStart) {
            Add-Stat $audioToFlash (($logTime - $lastAudioStart).TotalMilliseconds)
        }
        if ($lastHaptic -and $null -ne $timestampMs -and $null -ne $lastHaptic.TimestampMs) {
            Add-Stat $hapticToFlash ($timestampMs - $lastHaptic.TimestampMs)
        }
        $lastFlash = [pscustomobject]@{ TimestampMs = $timestampMs; LogTime = $logTime }
        continue
    }

    if ($message -match '\[outputs\]\s+outputs\.flashPulse\.commit') {
        $timestampMs = Parse-TimestampMs $message
        if ($lastAudioStart) {
            Add-Stat $audioToCommit (($logTime - $lastAudioStart).TotalMilliseconds)
        }
        if ($lastFlash -and $null -ne $timestampMs -and $null -ne $lastFlash.TimestampMs) {
            Add-Stat $flashToCommit ($timestampMs - $lastFlash.TimestampMs)
        }
        continue
    }

    if ($message -match '\[outputs\]\s+playMorse\.symbol') {
        $jsTimestamp = Parse-TimestampMs $message
        $currentSymbol = [pscustomobject]@{
            UnitMs = $currentRunUnit
            JsTimestampMs = $jsTimestamp
            NativeTimestampMs = $null
            NativeOffsetMs = $null
            NativeDurationMs = $null
        }
        $symbolSamples += $currentSymbol
        continue
    }

    if ($currentSymbol) {
        $nativeTimestamp = Parse-NativeField $message 'nativeTimestampMs'
        if ($nativeTimestamp -ne $null) {
            $currentSymbol.NativeTimestampMs = $nativeTimestamp
        }

        $nativeDuration = Parse-NativeField $message 'nativeDurationMs'
        if ($nativeDuration -ne $null) {
            $currentSymbol.NativeDurationMs = $nativeDuration
        }

        $nativeOffset = Parse-NativeField $message 'nativeOffsetMs'
        if ($nativeOffset -ne $null) {
            $currentSymbol.NativeOffsetMs = $nativeOffset
        }

        if ($message -match 'nativeSequence:\s*(\d+)') {
            $currentSymbol = $null
        }
    }
}

$stats = @()
$stats += Get-Stats 'audio -> haptic (ms)' $audioToHaptic
$stats += Get-Stats 'audio -> flash (ms)' $audioToFlash
$stats += Get-Stats 'audio -> flash commit (ms)' $audioToCommit
$stats += Get-Stats 'haptic -> flash (ms)' $hapticToFlash
$stats += Get-Stats 'flash -> commit (ms)' $flashToCommit

$table = $stats | Format-Table -AutoSize | Out-String -Width 200
Write-Host $table
Write-Host ("Raw counts: audio->flash={0} haptic->flash={1}" -f $audioToFlash.Count, $hapticToFlash.Count)

$nonNullSamples = $symbolSamples | Where-Object { $_.NativeTimestampMs -ne $null }
$nativeSymbolCount = $nonNullSamples.Count
$nativeSymbolNullCount = $symbolSamples.Count - $nativeSymbolCount
$nativeOffsetValues = $nonNullSamples | ForEach-Object { $_.NativeOffsetMs } | Where-Object { $_ -ne $null }

Write-Host ''
Write-Host 'Native symbol payload stats:' -ForegroundColor Cyan
Write-Host ("  Non-null nativeTimestampMs count: {0}" -f $nativeSymbolCount)
Write-Host ("  Null nativeTimestampMs count: {0}" -f $nativeSymbolNullCount)
if ($nativeOffsetValues.Count -gt 0) {
    $offsetMean = ($nativeOffsetValues | Measure-Object -Average).Average
    $offsetMax = ($nativeOffsetValues | Measure-Object -Maximum).Maximum
    Write-Host ("  nativeOffsetMs mean/max: {0:N3} / {1:N3}" -f $offsetMean, $offsetMax)
} else {
    Write-Host '  nativeOffsetMs values: none'
}

$delaySamples = $nonNullSamples | Where-Object { $_.JsTimestampMs -ne $null -and $_.UnitMs -ne $null }
if ($delaySamples.Count -gt 0) {
    $overallDelays = $delaySamples | ForEach-Object { $_.JsTimestampMs - $_.NativeTimestampMs }
    $sortedOverall = $overallDelays | Sort-Object
    $overallMean = ($overallDelays | Measure-Object -Average).Average
    $overallP95 = $sortedOverall[[math]::Floor([math]::Min(0.95 * ($sortedOverall.Count - 1), $sortedOverall.Count - 1))]
    Write-Host ''
    Write-Host ("Native alignment (ms): overall count={0} mean={1:N3} p95={2:N3}" -f $overallDelays.Count, $overallMean, $overallP95)

    $perUnit = @()
    foreach ($group in $delaySamples | Group-Object UnitMs) {
        $delays = $group.Group | ForEach-Object { $_.JsTimestampMs - $_.NativeTimestampMs }
        if ($delays.Count -eq 0) { continue }
        $sorted = $delays | Sort-Object
        $mean = ($delays | Measure-Object -Average).Average
        $p95 = $sorted[[math]::Floor([math]::Min(0.95 * ($sorted.Count - 1), $sorted.Count - 1))]
        $perUnit += [pscustomobject]@{
            UnitMs = $group.Name
            Count = $delays.Count
            Mean = '{0:N3}' -f $mean
            P95  = '{0:N3}' -f $p95
        }
    }
    if ($perUnit.Count -gt 0) {
        Write-Host ''
        Write-Host 'Per-unit native delay stats:' -ForegroundColor Cyan
        $perUnit | Sort-Object {[double]$_.'UnitMs'} | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
    }
} else {
    Write-Host ''
    Write-Host 'Native alignment: no samples with both JS and native timestamps.'
}
