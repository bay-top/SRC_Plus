[CmdletBinding()]
param(
    [string]$ModelRoot = 'D:\AI\Models\Ollama',
    [int]$MinimumSystemDiskGB = 10,
    [int]$MinimumModelDiskGB = 30,
    [int]$RecommendedModelDiskGB = 50,
    [version]$MinimumNvidiaDriver = '527.41'
)

$ErrorActionPreference = 'Stop'
$results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
    param([string]$Item, [bool]$Ready, [string]$Current, [string]$Required)
    $script:results.Add([pscustomobject]@{
        Item = $Item
        Ready = if ($Ready) { 'OK' } else { 'BLOCKED' }
        Current = $Current
        Required = $Required
    })
}

$systemDrive = $env:SystemDrive
$drive = Get-PSDrive -Name $systemDrive.TrimEnd(':')
$freeGB = [math]::Round($drive.Free / 1GB, 1)
Add-Result 'System disk' ($freeGB -ge $MinimumSystemDiskGB) "$freeGB GB on $systemDrive" "$MinimumSystemDiskGB GB minimum"

$modelDriveName = [System.IO.Path]::GetPathRoot($ModelRoot).TrimEnd('\').TrimEnd(':')
$modelDrive = Get-PSDrive -Name $modelDriveName -ErrorAction SilentlyContinue
if ($modelDrive) {
    $modelFreeGB = [math]::Round($modelDrive.Free / 1GB, 1)
    Add-Result 'Model disk' ($modelFreeGB -ge $MinimumModelDiskGB) "$modelFreeGB GB on $($modelDriveName):" "$MinimumModelDiskGB GB minimum; $RecommendedModelDiskGB GB recommended"
} else {
    Add-Result 'Model disk' $false "$($modelDriveName): is not connected" "external SSD containing $ModelRoot"
}

$os = Get-CimInstance Win32_OperatingSystem
$ramGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
Add-Result 'System RAM' ($ramGB -ge 14) "$ramGB GB" '16 GB class'

$nvidiaSmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($nvidiaSmi) {
    $gpuLine = (& $nvidiaSmi.Source --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>$null | Select-Object -First 1)
    $gpuParts = @($gpuLine -split ',').ForEach({ $_.Trim() })
    $driver = if ($gpuParts.Count -ge 2) { [version]$gpuParts[1] } else { [version]'0.0' }
    $vramText = if ($gpuParts.Count -ge 3) { $gpuParts[2] } else { 'unknown' }
    $vramMB = if ($vramText -match '(\d+)') { [int]$Matches[1] } else { 0 }
    Add-Result 'NVIDIA GPU' ($vramMB -ge 6000) "$($gpuParts[0]); $vramText" '6 GB VRAM minimum for the selected profiles'
    Add-Result 'NVIDIA driver' ($driver -ge $MinimumNvidiaDriver) "$driver" "$MinimumNvidiaDriver or newer"
} else {
    Add-Result 'NVIDIA GPU' $false 'nvidia-smi not found' 'NVIDIA GPU and current driver'
    Add-Result 'NVIDIA driver' $false 'not detected' "$MinimumNvidiaDriver or newer"
}

foreach ($tool in @('git', 'node', 'npm')) {
    $command = Get-Command $tool -ErrorAction SilentlyContinue
    Add-Result $tool ([bool]$command) $(if ($command) { $command.Source } else { 'not installed' }) 'installed and on PATH'
}

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
Add-Result 'Ollama' ([bool]$ollama) $(if ($ollama) { $ollama.Source } else { 'not installed' }) 'install after disk and driver gates pass'

$ollamaReachable = $false
try {
    $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2
    $ollamaReachable = $true
} catch { }
Add-Result 'Ollama API' $ollamaReachable $(if ($ollamaReachable) { 'http://127.0.0.1:11434 reachable' } else { 'not running' }) 'reachable when the local runner starts'

$comfyReachable = $false
try {
    $null = Invoke-RestMethod -Uri 'http://127.0.0.1:8188/system_stats' -TimeoutSec 2
    $comfyReachable = $true
} catch { }
Add-Result 'ComfyUI API' $comfyReachable $(if ($comfyReachable) { 'http://127.0.0.1:8188 reachable' } else { 'not installed or not running' }) 'reachable when the local runner starts'

$results | Format-Table -AutoSize
$blocking = @($results | Where-Object { $_.Ready -eq 'BLOCKED' -and $_.Item -in @('System disk', 'Model disk', 'System RAM', 'NVIDIA GPU', 'NVIDIA driver', 'git', 'node', 'npm') })
if ($blocking.Count -gt 0) {
    Write-Host "`nInstallation is intentionally stopped. Resolve the BLOCKED hardware prerequisites first." -ForegroundColor Yellow
    exit 2
}

Write-Host "`nHardware prerequisites pass. Ollama and ComfyUI can now be installed." -ForegroundColor Green
exit 0
