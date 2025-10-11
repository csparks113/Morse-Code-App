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
$audioToTone = New-Object System.Collections.Generic.List[double]
$audioToTorchReset = New-Object System.Collections.Generic.List[double]

$symbolSamples = @()
$symbolByCorrelation = @{}
$symbolQueue = New-Object System.Collections.Generic.Queue[pscustomobject]
$highOffsetEvents = New-Object System.Collections.Generic.List[pscustomobject]
$highOffsetThresholdMs = 80.0

$lastAudioStart = $null
$lastHaptic = $null
$lastFlash = $null
$currentRunUnit = $null
$currentSymbol = $null

function Try-ParseJsonPayload {
    param([string]$message)
    $braceIndex = $message.IndexOf('{')
    if ($braceIndex -lt 0) {
        return $null
    }
    $jsonText = $message.Substring($braceIndex)
    try {
        return ConvertFrom-Json -InputObject $jsonText -ErrorAction Stop
    } catch {
        return $null
    }
}

function Parse-TimestampMs {
    param([string]$message, $jsonPayload)
    if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'timestamp') {
        $value = $jsonPayload.timestamp
        if ($null -ne $value) {
            return [double]$value
        }
    }
    $match = [regex]::Match($message, 'timestamp:\s*([0-9\.]+)')
    if ($match.Success) {
        return [double]$match.Groups[1].Value
    }
    return $null
}

function Parse-UnitMs {
    param([string]$message, $jsonPayload)
    if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'unitMs') {
        $value = $jsonPayload.unitMs
        if ($null -ne $value) {
            return [double]$value
        }
    }
    $match = [regex]::Match($message, 'unitMs:\s*([0-9\.]+)')
    if ($match.Success) {
        return [double]$match.Groups[1].Value
    }
    return $null
}

function Parse-NativeField {
    param([string]$message, $jsonPayload, [string]$field)
    if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains $field) {
        $value = $jsonPayload.$field
        if ($null -ne $value -and $value -ne 'null') {
            return [double]$value
        }
        return $null
    }
    $pattern = "${field}:\s*(?<value>null|[-0-9\.]+)"
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
    $jsonPayload = Try-ParseJsonPayload $message

if ($tag -eq 'OutputsAudio') {
    if ($message -match '\[outputs-audio\]\s+start') {
        $lastAudioStart = $logTime
    }
    continue
}

    if ($tag -ne 'ReactNativeJS') { continue }

    if ($message -match '\[outputs\]\s+playMorse\.start') {
        $parsedUnit = Parse-UnitMs $message $jsonPayload
        if ($parsedUnit -ne $null) {
            $currentRunUnit = $parsedUnit
        }
        continue
    }

    if ($message -match '\[outputs\]\s+(outputs\.hapticSymbol|keyer\.haptics\.start)') {
        $timestampMs = Parse-TimestampMs $message $jsonPayload
        $correlationId = $null
        if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'correlationId') {
            $value = $jsonPayload.correlationId
            if ($value -ne $null -and $value -ne '') {
                $correlationId = [string]$value
            }
        }
        $symbolInfo = $null
        if ($correlationId -and $symbolByCorrelation.ContainsKey($correlationId)) {
            $symbolInfo = $symbolByCorrelation[$correlationId]
        } else {
            while ($symbolQueue.Count -gt 0) {
                $candidate = $symbolQueue.Peek()
                if (-not $candidate.UsedForHaptic) {
                    $symbolInfo = $candidate
                    break
                }
                if ($candidate.UsedForHaptic -and $candidate.UsedForFlash) {
                    $removed = $symbolQueue.Dequeue()
                    if ($removed.CorrelationId) {
                        $symbolByCorrelation.Remove($removed.CorrelationId) | Out-Null
                    }
                    continue
                }
                break
            }
        }
        $delta = $null
        if ($symbolInfo -and $null -ne $timestampMs) {
            if ($symbolInfo.NativeTimestampMs -ne $null) {
                $delta = $timestampMs - $symbolInfo.NativeTimestampMs
            } elseif ($symbolInfo.JsTimestampMs -ne $null) {
                $delta = $timestampMs - $symbolInfo.JsTimestampMs
            }
        }
        if ($delta -eq $null) {
            $timelineOffset = Parse-NativeField $message $jsonPayload 'timelineOffsetMs'
            if ($timelineOffset -ne $null) {
                $delta = $timelineOffset
            }
        }
        if ($delta -eq $null -and $jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'latencyMs') {
            $value = $jsonPayload.latencyMs
            if ($null -ne $value -and $value -ne 'null') {
                $delta = [double]$value
            }
        }
        if ($delta -eq $null -and $lastAudioStart) {
            $delta = ($logTime - $lastAudioStart).TotalMilliseconds
        }
        if ($delta -ne $null) {
            Add-Stat $audioToHaptic $delta
        }
        if ($symbolInfo) {
            $symbolInfo.UsedForHaptic = $true
            if ($null -ne $timestampMs) {
                $symbolInfo.HapticTimestampMs = $timestampMs
            }
        }
        $lastHaptic = [pscustomobject]@{
            TimestampMs = $timestampMs
            LogTime = $logTime
            CorrelationId = $correlationId
        }
        while ($symbolQueue.Count -gt 0) {
            $front = $symbolQueue.Peek()
            if ($front.UsedForHaptic -and $front.UsedForFlash) {
                $removed = $symbolQueue.Dequeue()
                if ($removed.CorrelationId) {
                    $symbolByCorrelation.Remove($removed.CorrelationId) | Out-Null
                }
                continue
            }
            break
        }
        continue
    }

    if ($message -match '\[outputs\]\s+(outputs\.flashPulse(?!\.commit)|keyer\.flash\.start)') {
        $timestampMs = Parse-TimestampMs $message $jsonPayload
        $correlationId = $null
        if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'correlationId') {
            $value = $jsonPayload.correlationId
            if ($value -ne $null -and $value -ne '') {
                $correlationId = [string]$value
            }
        }
        $symbolInfo = $null
        if ($correlationId -and $symbolByCorrelation.ContainsKey($correlationId)) {
            $symbolInfo = $symbolByCorrelation[$correlationId]
        } else {
            while ($symbolQueue.Count -gt 0) {
                $candidate = $symbolQueue.Peek()
                if (-not $candidate.UsedForFlash) {
                    $symbolInfo = $candidate
                    break
                }
                if ($candidate.UsedForHaptic -and $candidate.UsedForFlash) {
                    $removed = $symbolQueue.Dequeue()
                    if ($removed.CorrelationId) {
                        $symbolByCorrelation.Remove($removed.CorrelationId) | Out-Null
                    }
                    continue
                }
                break
            }
        }
        $delta = $null
        if ($symbolInfo -and $null -ne $timestampMs) {
            if ($symbolInfo.NativeTimestampMs -ne $null) {
                $delta = $timestampMs - $symbolInfo.NativeTimestampMs
            } elseif ($symbolInfo.JsTimestampMs -ne $null) {
                $delta = $timestampMs - $symbolInfo.JsTimestampMs
            }
        }
        if ($delta -eq $null) {
            $timelineOffset = Parse-NativeField $message $jsonPayload 'timelineOffsetMs'
            if ($timelineOffset -ne $null) {
                $delta = $timelineOffset
            }
        }
        if ($delta -eq $null -and $jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'latencyMs') {
            $value = $jsonPayload.latencyMs
            if ($null -ne $value -and $value -ne 'null') {
                $delta = [double]$value
            }
        }
        if ($delta -eq $null -and $lastAudioStart) {
            $delta = ($logTime - $lastAudioStart).TotalMilliseconds
        }
        if ($delta -ne $null) {
            Add-Stat $audioToFlash $delta
        }
        if ($symbolInfo) {
            $symbolInfo.UsedForFlash = $true
            if ($null -ne $timestampMs) {
                $symbolInfo.FlashTimestampMs = $timestampMs
            }
        }
        if ($lastHaptic) {
            $deltaHF = $null
            if ($symbolInfo -and $symbolInfo.HapticTimestampMs -ne $null -and $null -ne $timestampMs) {
                $deltaHF = $timestampMs - $symbolInfo.HapticTimestampMs
            } elseif ($null -ne $timestampMs -and $null -ne $lastHaptic.TimestampMs -and $lastHaptic.CorrelationId -eq $correlationId) {
                $deltaHF = $timestampMs - $lastHaptic.TimestampMs
            } elseif ($lastHaptic.LogTime) {
                $deltaHF = ($logTime - $lastHaptic.LogTime).TotalMilliseconds
            }
            if ($deltaHF -ne $null -and [math]::Abs($deltaHF) -le 500) {
                Add-Stat $hapticToFlash $deltaHF
            }
        }
        $lastFlash = [pscustomobject]@{
            TimestampMs = $timestampMs
            LogTime = $logTime
            CorrelationId = $correlationId
        }
        while ($symbolQueue.Count -gt 0) {
            $front = $symbolQueue.Peek()
            if ($front.UsedForHaptic -and $front.UsedForFlash) {
                $removed = $symbolQueue.Dequeue()
                if ($removed.CorrelationId) {
                    $symbolByCorrelation.Remove($removed.CorrelationId) | Out-Null
                }
                continue
            }
            break
        }
        continue
    }

    if ($message -match '\[outputs\]\s+(outputs\.flashPulse\.commit|keyer\.torch\.reset)') {
        $timestampMs = Parse-TimestampMs $message $jsonPayload
        $isTorchReset = $message -match 'keyer\.torch\.reset'
        if ($lastAudioStart) {
            Add-Stat $audioToCommit (($logTime - $lastAudioStart).TotalMilliseconds)
            if ($isTorchReset) {
                Add-Stat $audioToTorchReset (($logTime - $lastAudioStart).TotalMilliseconds)
            }
        }
        if ($lastFlash -and $null -ne $timestampMs -and $null -ne $lastFlash.TimestampMs) {
            Add-Stat $flashToCommit ($timestampMs - $lastFlash.TimestampMs)
        }
        continue
    }

    if ($message -match '\[outputs\]\s+keyer\.tone\.start') {
        if ($lastAudioStart) {
            Add-Stat $audioToTone (($logTime - $lastAudioStart).TotalMilliseconds)
        }
        continue
    }

    if ($message -match '\[outputs\]\s+playMorse\.symbol') {
        $jsTimestamp = Parse-TimestampMs $message $jsonPayload
        $nativeTimestamp = Parse-NativeField $message $jsonPayload 'nativeTimestampMs'
        $nativeOffset = Parse-NativeField $message $jsonPayload 'nativeOffsetMs'
        $nativeDuration = Parse-NativeField $message $jsonPayload 'nativeDurationMs'
        $symbolIndex = $null
        $correlationId = $null
        if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'correlationId') {
            $value = $jsonPayload.correlationId
            if ($value -ne $null -and $value -ne '') {
                $correlationId = [string]$value
            }
        }
        if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'index') {
            $symbolIndex = [int]$jsonPayload.index
        }
        if ($nativeOffset -ne $null -and $nativeOffset -ge $highOffsetThresholdMs) {
            $highOffsetEvents.Add([pscustomobject]@{
                UnitMs = $currentRunUnit
                Index = $symbolIndex
                NativeOffsetMs = [math]::Round($nativeOffset, 3)
                CorrelationId = $correlationId
                NativeSequence = Parse-NativeField $message $jsonPayload 'nativeSequence'
            })
        }
        $symbolInfo = [pscustomobject]@{
            UnitMs = $currentRunUnit
            JsTimestampMs = $jsTimestamp
            NativeTimestampMs = $nativeTimestamp
            NativeOffsetMs = $nativeOffset
            NativeDurationMs = $nativeDuration
            CorrelationId = $correlationId
            UsedForHaptic = $false
            UsedForFlash = $false
            HapticTimestampMs = $null
            FlashTimestampMs = $null
        }
        $symbolSamples += $symbolInfo
        if ($correlationId) {
            $symbolByCorrelation[$correlationId] = $symbolInfo
        }
        $symbolQueue.Enqueue($symbolInfo)
        continue
    }

    if ($currentSymbol) {
        $nativeTimestamp = Parse-NativeField $message $jsonPayload 'nativeTimestampMs'
        if ($nativeTimestamp -ne $null) {
            $currentSymbol.NativeTimestampMs = $nativeTimestamp
        }

        $nativeDuration = Parse-NativeField $message $jsonPayload 'nativeDurationMs'
        if ($nativeDuration -ne $null) {
            $currentSymbol.NativeDurationMs = $nativeDuration
        }

        $nativeOffset = Parse-NativeField $message $jsonPayload 'nativeOffsetMs'
        if ($nativeOffset -ne $null) {
            $currentSymbol.NativeOffsetMs = $nativeOffset
        }

        $correlationId = $currentSymbol.CorrelationId
        if ($correlationId -and $symbolByCorrelation.ContainsKey($correlationId)) {
            $symbolByCorrelation[$correlationId] = $currentSymbol
        }

        if (($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'nativeSequence') -or ($message -match 'nativeSequence:\s*(\d+)')) {
            $currentSymbol = $null
        }
    }
}

$stats = @()
$stats += Get-Stats 'audio -> haptic (ms)' $audioToHaptic
$stats += Get-Stats 'audio -> flash (ms)' $audioToFlash
$stats += Get-Stats 'audio -> flash commit (ms)' $audioToCommit
$stats += Get-Stats 'audio -> tone (ms)' $audioToTone
$stats += Get-Stats 'audio -> torch reset (ms)' $audioToTorchReset
$stats += Get-Stats 'haptic -> flash (ms)' $hapticToFlash
$stats += Get-Stats 'flash -> commit (ms)' $flashToCommit

$table = $stats | Format-Table -AutoSize | Out-String -Width 200
Write-Host $table
Write-Host ("Raw counts: audio->flash={0} haptic->flash={1} audio->tone={2} audio->torchReset={3}" -f $audioToFlash.Count, $hapticToFlash.Count, $audioToTone.Count, $audioToTorchReset.Count)

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

if ($highOffsetEvents.Count -gt 0) {
    Write-Host ''
    Write-Host ("High native offsets (>= {0} ms):" -f $highOffsetThresholdMs) -ForegroundColor Yellow
    Write-Host (
        $highOffsetEvents |
        Sort-Object NativeOffsetMs -Descending |
        Format-Table -AutoSize |
        Out-String -Width 200
    )
}
