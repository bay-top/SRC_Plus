[CmdletBinding()]
param(
    [string]$AiRoot = 'D:\AI'
)

$ErrorActionPreference = 'Stop'
$paths = @(
    (Join-Path $AiRoot 'Models\Ollama'),
    (Join-Path $AiRoot 'Models\StableDiffusion'),
    (Join-Path $AiRoot 'Apps\ComfyUI'),
    (Join-Path $AiRoot 'Projects\SRCPlus')
)

foreach ($path in $paths) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
}

$ollamaModels = $paths[0]
[Environment]::SetEnvironmentVariable('OLLAMA_MODELS', $ollamaModels, 'User')

Write-Host "Global AI storage prepared at $AiRoot" -ForegroundColor Green
Write-Host "OLLAMA_MODELS=$ollamaModels"
Write-Host 'Quit and restart Ollama (or sign out and back in) before pulling additional models.'
