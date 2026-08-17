[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Missing $ConfigPath. Copy config.example.json to config.json and keep secrets only in config.json."
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) { throw 'Ollama is not installed or is not on PATH.' }

try {
    $null = Invoke-RestMethod -Uri "$($config.ollama.baseUrl)/api/tags" -TimeoutSec 2
} catch {
    Start-Process -FilePath $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

$models = Invoke-RestMethod -Uri "$($config.ollama.baseUrl)/api/tags" -TimeoutSec 5
if ($models.models.name -notcontains $config.ollama.model) {
    throw "Ollama model '$($config.ollama.model)' is missing. Run: ollama pull $($config.ollama.model)"
}

$openCodex = Get-Command opencodex -ErrorAction SilentlyContinue
if ($openCodex) {
    & $openCodex.Source ensure | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'OpenCodex could not be started.' }
}

try {
    $null = Invoke-RestMethod -Uri "$($config.comfyui.baseUrl)/system_stats" -TimeoutSec 2
} catch {
    throw 'ComfyUI is not running on 127.0.0.1:8188. Start the NVIDIA portable build first.'
}

Write-Host 'Local text and image services are ready.' -ForegroundColor Green
Write-Host "Text: $($config.ollama.model) at $($config.ollama.baseUrl)"
if ($openCodex) { Write-Host "Agent gateway: OpenCodex at $($config.opencodex.baseUrl)" }
Write-Host "Image: $($config.comfyui.checkpoint) at $($config.comfyui.baseUrl)"
Write-Host 'The outbound polling runner will be added after the Worker claim/complete contract is implemented.'
