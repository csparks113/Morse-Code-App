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
$nativeDispatches = New-Object System.Collections.Generic.List[pscustomobject]
$nativeGaps = New-Object System.Collections.Generic.List[pscustomobject]
$nativeActuals = New-Object System.Collections.Generic.List[pscustomobject]
$nativeDispatchBySequence = @{}
$nativeActualBySequence = @{}
$flashPhaseCounts = @{
    scheduled = 0
    actual = 0
}
$hapticPhaseCounts = @{
    scheduled = 0
    actual = 0
}
$nativeFallbackEvents = New-Object System.Collections.Generic.List[pscustomobject]
$overlayAvailabilityEvents = New-Object System.Collections.Generic.List[pscustomobject]

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

$linePattern = '^(?<md>\d\d-\d\d)\s+(?<time>\d\d:\d\d:\d\d\.\d+)\s+\d+\s+\d+\s+\w\s+(?<tag>OutputsAudio|NativeOutputsDispatcher|ReactNativeJS):\s+(?<message>.*)$'

foreach ($line in Get-Content -Path $LogFile -Encoding Unicode) {
    $match = [regex]::Match($line, $linePattern)
    if (!$match.Success) { continue }

    $md = $match.Groups['md'].Value
    $time = $match.Groups['time'].Value
    $tag = $match.Groups['tag'].Value
    $message = $match.Groups['message'].Value

    $logTime = [datetime]::ParseExact("$year $md $time", 'yyyy MM-dd HH:mm:ss.fff', [System.Globalization.CultureInfo]::InvariantCulture)
    $jsonPayload = Try-ParseJsonPayload $message

if ($tag -eq 'OutputsAudio') {
    if ($message -match '\[outputs-audio\]\s+playMorse\.dispatch\s+sequence=(?<seq>\d+)\s+symbol=(?<sym>[-\.])\s+offset=(?<offset>[-0-9\.]+)\s+lead=(?<lead>[-0-9\.]+)\s+dispatchAt=(?<dispatch>[-0-9\.]+)(?:\s+gapLead=(?<gap>[-0-9\.]+))?') {
        $seq = [int]$matches['seq']
        $sym = $matches['sym']
        $offsetVal = [double]$matches['offset']
        $leadVal = [double]$matches['lead']
        $dispatchVal = [double]$matches['dispatch']
        $gapVal = $null
        if ($matches.ContainsKey('gap') -and -not [string]::IsNullOrEmpty($matches['gap'])) {
            $gapVal = [double]$matches['gap']
        }
        $entry = [pscustomobject]@{
            Sequence = $seq
            Symbol = $sym
            OffsetMs = $offsetVal
            LeadMs = $leadVal
            DispatchAtMs = $dispatchVal
            GapLeadMs = $gapVal
        }
        $nativeDispatches.Add($entry) | Out-Null
        if (-not $nativeDispatchBySequence.ContainsKey($seq)) {
            $nativeDispatchBySequence[$seq] = New-Object System.Collections.ArrayList
        }
        $null = $nativeDispatchBySequence[$seq].Add($entry)
        continue
    }
    if ($message -match '\[outputs-audio\]\s+playMorse\.symbol\.start\s+sequence=(?<seq>\d+)\s+symbol=(?<sym>[-\.])\s+expected=(?<expected>[-0-9\.]+)\s+actual=(?<actual>[-0-9\.]+)\s+skew=(?<skew>[-0-9\.]+)\s+batchElapsed=(?<batch>[-0-9\.]+)') {
        $seq = [int]$matches['seq']
        $sym = $matches['sym']
        $expectedVal = [double]$matches['expected']
        $actualVal = [double]$matches['actual']
        $skewVal = [double]$matches['skew']
        $batchVal = [double]$matches['batch']
        $entry = [pscustomobject]@{
            Sequence = $seq
            Symbol = $sym
            ExpectedMs = $expectedVal
            ActualMs = $actualVal
            SkewMs = $skewVal
            BatchElapsedMs = $batchVal
        }
        $nativeActuals.Add($entry) | Out-Null
        $nativeActualBySequence[$seq] = $entry
        $lastAudioStart = $logTime
        continue
    }
    if ($message -match '\[outputs-audio\]\s+playMorse\.gap\s+sequence=(?<seq>\d+)\s+nextOffset=(?<offset>[-0-9\.]+)\s+gapTarget=(?<target>[-0-9\.]+)') {
        $seq = [int]$matches['seq']
        $offsetVal = [double]$matches['offset']
        $targetVal = [double]$matches['target']
        $nativeGaps.Add([pscustomobject]@{
            Sequence = $seq
            NextOffsetMs = $offsetVal
            GapTargetMs = $targetVal
        }) | Out-Null
        continue
    }
    if ($message -match '\[outputs-audio\]\s+start') {
        $lastAudioStart = $logTime
    }
    continue
}

    if ($tag -eq 'NativeOutputsDispatcher') {
        if ($message -match '\[outputs-native\]\s+overlay\.availability\s+state=(?<state>\w+)\s+reason=(?<reason>\S+)') {
            $stateValue = $matches['state']
            $reasonValue = $matches['reason']
            $overlayAvailabilityEvents.Add([pscustomobject]@{
                Timestamp = $logTime
                State = $stateValue
                Reason = $reasonValue
            }) | Out-Null
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
        $dispatchPhaseValue = 'actual'
        if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'dispatchPhase') {
            $phaseRaw = $jsonPayload.dispatchPhase
            if ($phaseRaw -ne $null -and $phaseRaw -ne '') {
                $dispatchPhaseValue = [string]$phaseRaw
            }
        }
        $phaseKey = $dispatchPhaseValue.ToLower()
        if (-not $hapticPhaseCounts.ContainsKey($phaseKey)) {
            $hapticPhaseCounts[$phaseKey] = 0
        }
        $hapticPhaseCounts[$phaseKey] += 1
        if ($dispatchPhaseValue -eq 'scheduled') {
            continue
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

    $flashMatch = [regex]::Match($message, '\[outputs\]\s+(?<event>outputs\.flashPulse(?:\.nativeHandled|\.nativeFallback)?(?!\.commit)|keyer\.flash\.start)')
    if ($flashMatch.Success) {
        $eventName = $flashMatch.Groups['event'].Value
        $timestampMs = Parse-TimestampMs $message $jsonPayload
        $correlationId = $null
        if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'correlationId') {
            $value = $jsonPayload.correlationId
            if ($value -ne $null -and $value -ne '') {
                $correlationId = [string]$value
            }
        }
        $dispatchPhaseValue = 'actual'
        if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'dispatchPhase') {
            $phaseRaw = $jsonPayload.dispatchPhase
            if ($phaseRaw -ne $null -and $phaseRaw -ne '') {
                $dispatchPhaseValue = [string]$phaseRaw
            }
        }
        $phaseKey = $dispatchPhaseValue.ToLower()
        if (-not $flashPhaseCounts.ContainsKey($phaseKey)) {
            $flashPhaseCounts[$phaseKey] = 0
        }
        $flashPhaseCounts[$phaseKey] += 1
        if ($dispatchPhaseValue -eq 'scheduled') {
            continue
        }
        $nativeFlashHandledFlag = $false
        $nativeFlashAvailableFlag = $null
        if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'nativeFlashAvailable') {
            $value = $jsonPayload.nativeFlashAvailable
            if ($value -ne $null -and $value -ne '') {
                $nativeFlashAvailableFlag = [bool]$value
            }
        }
        if ($eventName -eq 'outputs.flashPulse.nativeHandled') {
            $nativeFlashHandledFlag = $true
            if ($nativeFlashAvailableFlag -eq $null) {
                $nativeFlashAvailableFlag = $true
            }
        } elseif ($eventName -eq 'outputs.flashPulse.nativeFallback') {
            $nativeFlashHandledFlag = $false
            if ($nativeFlashAvailableFlag -eq $null) {
                $nativeFlashAvailableFlag = $false
            }
            $fallbackReason = $null
            if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'reason') {
                $reasonValue = $jsonPayload.reason
                if ($reasonValue -ne $null -and $reasonValue -ne '') {
                    $fallbackReason = [string]$reasonValue
                }
            }
            $sourceValue = $null
            if ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'source') {
                $sourceValue = [string]$jsonPayload.source
            }
            $nativeFallbackEvents.Add([pscustomobject]@{
                Timestamp = $logTime
                Reason = $fallbackReason
                Source = $sourceValue
                CorrelationId = $correlationId
            }) | Out-Null
        } elseif ($jsonPayload -and $jsonPayload.PSObject.Properties.Name -contains 'nativeFlashHandled') {
            $nativeFlashHandledFlag = [bool]$jsonPayload.nativeFlashHandled
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
        if ($symbolInfo) {
            $symbolInfo.UsedForFlash = $true
            if ($null -ne $timestampMs) {
                $symbolInfo.FlashTimestampMs = $timestampMs
            }
            $symbolInfo.NativeFlashHandled = $nativeFlashHandledFlag
            if ($nativeFlashAvailableFlag -ne $null) {
                $symbolInfo.NativeFlashAvailable = $nativeFlashAvailableFlag
            }
        }
        if (-not $nativeFlashHandledFlag) {
            $delta = $null
            if ($symbolInfo -and $null -ne $timestampMs) {
                if ($symbolInfo.NativeTimestampMs -ne $null) {
                    $delta = $timestampMs - $symbolInfo.NativeTimestampMs
                } elseif ($symbolInfo.JsTimestampMs -ne $null) {
                    $delta = $timestampMs - $symbolInfo.JsTimestampMs
                }
            }
            if ($delta -ne $null) {
                Add-Stat $audioToFlash $delta
            } else {
                continue
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
        } else {
            $lastFlash = $null
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
        $monotonicTimestamp = Parse-NativeField $message $jsonPayload 'monotonicTimestampMs'
        $nativeExpectedTimestamp = Parse-NativeField $message $jsonPayload 'nativeExpectedTimestampMs'
        $nativeSequenceField = Parse-NativeField $message $jsonPayload 'nativeSequence'
        $nativeStartSkew = Parse-NativeField $message $jsonPayload 'nativeStartSkewMs'
        $nativeBatchElapsed = Parse-NativeField $message $jsonPayload 'nativeBatchElapsedMs'
        $nativeExpectedSincePrior = Parse-NativeField $message $jsonPayload 'nativeExpectedSincePriorMs'
        $nativeSincePrior = Parse-NativeField $message $jsonPayload 'nativeSincePriorMs'
        $nativePatternStart = Parse-NativeField $message $jsonPayload 'nativePatternStartMs'
        $nativeAge = Parse-NativeField $message $jsonPayload 'nativeAgeMs'
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
        MonotonicTimestampMs = $monotonicTimestamp
            NativeExpectedTimestampMs = $nativeExpectedTimestamp
            NativeSequence = $null
            NativeStartSkewMs = $nativeStartSkew
            NativeBatchElapsedMs = $nativeBatchElapsed
            NativeExpectedSincePriorMs = $nativeExpectedSincePrior
        NativeSincePriorMs = $nativeSincePrior
        NativePatternStartMs = $nativePatternStart
        NativeAgeMs = $nativeAge
        NativeFlashHandled = $false
        NativeFlashAvailable = $null
        }
        $nativeSequenceValue = $null
        if ($nativeSequenceField -ne $null) {
            $nativeSequenceValue = [int][math]::Round($nativeSequenceField)
            $symbolInfo.NativeSequence = $nativeSequenceValue
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

$nativeTimingStats = @()
$monotonicDiffs = @(
    $symbolSamples |
    Where-Object { $_.MonotonicTimestampMs -ne $null -and $_.NativeExpectedTimestampMs -ne $null } |
    ForEach-Object { $_.MonotonicTimestampMs - $_.NativeExpectedTimestampMs }
)
if ($monotonicDiffs.Count -gt 0) {
    $nativeTimingStats += Get-Stats 'monotonic - expected (ms)' $monotonicDiffs
}
$nativeStartSkewValues = @(
    $symbolSamples |
    Where-Object { $_.NativeStartSkewMs -ne $null } |
    ForEach-Object { $_.NativeStartSkewMs }
)
if ($nativeStartSkewValues.Count -gt 0) {
    $nativeTimingStats += Get-Stats 'native start skew (ms)' $nativeStartSkewValues
}
$sincePriorDiffs = @(
    $symbolSamples |
    Where-Object { $_.NativeSincePriorMs -ne $null -and $_.NativeExpectedSincePriorMs -ne $null } |
    ForEach-Object { $_.NativeSincePriorMs - $_.NativeExpectedSincePriorMs }
)
if ($sincePriorDiffs.Count -gt 0) {
    $nativeTimingStats += Get-Stats 'sincePrior delta (ms)' $sincePriorDiffs
}
if ($nativeTimingStats.Count -gt 0) {
    Write-Host ''
    Write-Host 'Native dispatcher deltas:' -ForegroundColor Cyan
    $nativeTimingStats | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
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

if ($nativeDispatches.Count -gt 0) {
    Write-Host ''
    Write-Host 'Native dispatch telemetry:' -ForegroundColor Cyan
    $dispatchLeadStats = Get-Stats 'dispatch lead (ms)' ($nativeDispatches | ForEach-Object { $_.LeadMs })
    $dispatchOffsetStats = Get-Stats 'dispatch offset (ms)' ($nativeDispatches | ForEach-Object { $_.OffsetMs })
    ($dispatchLeadStats, $dispatchOffsetStats) | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
    Write-Host ("  Entries captured: {0}" -f $nativeDispatches.Count)
    $nativeDispatches | Select-Object -First 12 | Format-Table Sequence,Symbol,OffsetMs,LeadMs,DispatchAtMs -AutoSize | Out-String -Width 200 | Write-Host
} else {
    Write-Host ''
    Write-Host 'Native dispatch telemetry not captured (ensure logcat includes OutputsAudio:D).' -ForegroundColor Yellow
}

if ($nativeActuals.Count -gt 0) {
    $dispatchToActual = New-Object System.Collections.Generic.List[double]
    $dispatchLeadErrors = New-Object System.Collections.Generic.List[double]
    $actualToExpected = New-Object System.Collections.Generic.List[double]
    $batchElapsedValues = New-Object System.Collections.Generic.List[double]
    $combinedRows = @()
    $missingDispatchSeq = @()
    foreach ($actual in $nativeActuals) {
        if ($actual.SkewMs -ne $null) {
            Add-Stat $actualToExpected $actual.SkewMs
        } elseif ($actual.ExpectedMs -ne $null -and $actual.ActualMs -ne $null) {
            Add-Stat $actualToExpected ($actual.ActualMs - $actual.ExpectedMs)
        }
        if ($actual.BatchElapsedMs -ne $null) {
            Add-Stat $batchElapsedValues $actual.BatchElapsedMs
        }
        $dispatchList = $null
        if ($nativeDispatchBySequence.ContainsKey($actual.Sequence)) {
            $dispatchList = $nativeDispatchBySequence[$actual.Sequence]
        }
        $dispatch = $null
        if ($dispatchList -and $dispatchList.Count -gt 0) {
            $dispatch = $dispatchList[0]
            $dispatchList.RemoveAt(0)
        } else {
            $missingDispatchSeq += $actual.Sequence
        }
        if ($dispatch) {
            $deltaActualDispatch = $actual.ActualMs - $dispatch.DispatchAtMs
            Add-Stat $dispatchToActual $deltaActualDispatch
            if ($dispatch.LeadMs -ne $null) {
                Add-Stat $dispatchLeadErrors ($deltaActualDispatch - $dispatch.LeadMs)
            }
        }
        $combinedRows += [pscustomobject]@{
            Sequence = $actual.Sequence
            Symbol = $actual.Symbol
            DispatchAtMs = if ($dispatch) { $dispatch.DispatchAtMs } else { $null }
            LeadMs = if ($dispatch) { $dispatch.LeadMs } else { $null }
            ActualMs = $actual.ActualMs
            ExpectedMs = $actual.ExpectedMs
            ActualMinusDispatchMs = if ($dispatch) { [math]::Round($actual.ActualMs - $dispatch.DispatchAtMs, 3) } else { $null }
            SkewMs = $actual.SkewMs
        }
    }
    $dispatcherAlignmentStats = @()
    if ($dispatchToActual.Count -gt 0) {
        $dispatcherAlignmentStats += Get-Stats 'actual - dispatchAt (ms)' $dispatchToActual
    }
    if ($dispatchLeadErrors.Count -gt 0) {
        $dispatcherAlignmentStats += Get-Stats 'dispatch lead error (ms)' $dispatchLeadErrors
    }
    if ($actualToExpected.Count -gt 0) {
        $dispatcherAlignmentStats += Get-Stats 'actual - expected (ms)' $actualToExpected
    }
    if ($batchElapsedValues.Count -gt 0) {
        $dispatcherAlignmentStats += Get-Stats 'batch elapsed (ms)' $batchElapsedValues
    }
    if ($dispatcherAlignmentStats.Count -gt 0) {
        Write-Host ''
        Write-Host 'Native dispatch vs actual:' -ForegroundColor Cyan
        $dispatcherAlignmentStats | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
    }
    if ($combinedRows.Count -gt 0) {
        $combinedRows |
            Sort-Object Sequence |
            Select-Object -First 12 |
            Format-Table Sequence,Symbol,DispatchAtMs,LeadMs,ActualMs,ExpectedMs,ActualMinusDispatchMs,SkewMs -AutoSize |
            Out-String -Width 200 | Write-Host
    }
    if ($missingDispatchSeq.Count -gt 0) {
        $uniqueMissing = ($missingDispatchSeq | Sort-Object | Select-Object -Unique)
        Write-Host ("  Warning: missing dispatch telemetry for sequences [{0}]" -f ($uniqueMissing -join ', ')) -ForegroundColor Yellow
    }
} else {
    Write-Host ''
    Write-Host 'Native dispatch vs actual: no symbol start telemetry captured.' -ForegroundColor Yellow
}

if ($nativeGaps.Count -gt 0) {
    Write-Host ''
    Write-Host 'Native gap telemetry:' -ForegroundColor Cyan
    $nativeGaps | Select-Object -First 12 | Format-Table Sequence,NextOffsetMs,GapTargetMs -AutoSize | Out-String -Width 200 | Write-Host
}

Write-Host ''
Write-Host 'Dispatch phase coverage:' -ForegroundColor Cyan
Write-Host ("  Flash pulses  - scheduled: {0} actual: {1}" -f $flashPhaseCounts['scheduled'], $flashPhaseCounts['actual'])
Write-Host ("  Haptic pulses - scheduled: {0} actual: {1}" -f $hapticPhaseCounts['scheduled'], $hapticPhaseCounts['actual'])

$nativeHandledSamples = $symbolSamples | Where-Object { $_.NativeFlashHandled }
$flashActualSamples = $symbolSamples | Where-Object { $_.FlashTimestampMs -ne $null }
if ($flashActualSamples.Count -gt 0) {
    Write-Host ("  Native overlay handled flashes: {0} / {1}" -f $nativeHandledSamples.Count, $flashActualSamples.Count)
    if ($nativeHandledSamples.Count -gt 0) {
        $nativeHandledSamples |
            Where-Object { $_.NativeSequence -ne $null } |
            Select-Object -First 12 NativeSequence,FlashTimestampMs,MonotonicTimestampMs |
            Format-Table -AutoSize | Out-String -Width 200 | Write-Host
    }
}
$availabilitySamples = $symbolSamples | Where-Object { $_.NativeFlashAvailable -ne $null -and $_.UsedForFlash }
if ($availabilitySamples.Count -gt 0) {
    $availableCount = ($availabilitySamples | Where-Object { $_.NativeFlashAvailable }).Count
    Write-Host ("  Native overlay availability (actual flashes): {0} / {1}" -f $availableCount, $availabilitySamples.Count)
    $unavailableSamples = $availabilitySamples | Where-Object { -not $_.NativeFlashAvailable }
    if ($unavailableSamples.Count -gt 0) {
        $unavailableSamples |
            Where-Object { $_.NativeSequence -ne $null } |
            Select-Object -First 12 NativeSequence,FlashTimestampMs,MonotonicTimestampMs |
            Format-Table -AutoSize | Out-String -Width 200 | Write-Host
    }
}

if ($nativeFallbackEvents.Count -gt 0) {
    Write-Host ''
    Write-Host 'Native flash fallbacks:' -ForegroundColor Yellow
    $nativeFallbackEvents |
        Select-Object -First 12 @{
            Name = 'Time'
            Expression = { $_.Timestamp.ToString('HH:mm:ss.fff') }
        }, Reason, Source, CorrelationId |
        Format-Table -AutoSize | Out-String -Width 200 | Write-Host
}

if ($overlayAvailabilityEvents.Count -gt 0) {
    Write-Host ''
    Write-Host 'Overlay availability events:' -ForegroundColor Cyan
    $overlayAvailabilityEvents |
        Select-Object -First 12 @{
            Name = 'Time'
            Expression = { $_.Timestamp.ToString('HH:mm:ss.fff') }
        }, State, Reason |
        Format-Table -AutoSize | Out-String -Width 200 | Write-Host
}

