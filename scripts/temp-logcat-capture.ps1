param(
    [int]$DurationSeconds = 120,
    [string]$LogFile = 'latest-logcat-play-pattern.txt'
)

Set-StrictMode -Version Latest
$patterns = @(
    '\[outputs-audio\]',
    'outputs\.flashPulse(\.commit)?',
    'outputs\.hapticSymbol',
    'outputs\.playMorse\.symbol',
    'keyer\.(prepare|tone)'
)

Set-Location -Path 'C:\dev\Morse'

adb logcat -c | Out-Null

$job = Start-Job -ArgumentList (Get-Location).Path, (Join-Path (Get-Location) $LogFile), $patterns -ScriptBlock {
    param($workingDir, $capturePath, $patternList)
    Set-Location -Path $workingDir
    adb logcat ReactNativeJS:D OutputsAudio:D ReactNative:W *:S |
        Tee-Object -FilePath $capturePath |
        Select-String -Pattern $patternList
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
while ($true) {
    if (Wait-Job -Job $job -Timeout 1) { break }
    $chunk = Receive-Job -Job $job -Keep -ErrorAction SilentlyContinue
    if ($chunk) { $chunk | Write-Output }
    if ($stopwatch.Elapsed.TotalSeconds -ge $DurationSeconds) {
        Write-Host "Stopping logcat after $DurationSeconds seconds..."
        Stop-Job -Job $job -ErrorAction SilentlyContinue
        break
    }
}

Receive-Job -Job $job -ErrorAction SilentlyContinue | Write-Output
Remove-Job -Job $job -ErrorAction SilentlyContinue
