# start-claude.ps1
# Launch Claude Code using OpenRouter credentials from .env
# Usage: .\start-claude.ps1
# Usage with custom model: .\start-claude.ps1 -Model "openai/gpt-4o"

param(
    [string]$Model = $null
)

$EnvFile = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $EnvFile)) {
    Write-Error "❌ .env file not found. Copy .env.example to .env and add your OpenRouter API key."
    exit 1
}

# Parse .env file
$envVars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$apiKey   = $envVars["OPENROUTER_API_KEY"]
$baseUrl  = $envVars["OPENROUTER_BASE_URL"]
$model    = if ($Model) { $Model } else { $envVars["OPENROUTER_MODEL"] }

if (-not $apiKey -or $apiKey -eq "sk-or-v1-YOUR_NEW_KEY_HERE") {
    Write-Error "❌ OPENROUTER_API_KEY is not set in .env. Please add your real key."
    exit 1
}

Write-Host "🚀 Starting Claude Code via OpenRouter" -ForegroundColor Cyan
Write-Host "   Model : $model" -ForegroundColor Gray
Write-Host "   Base  : $baseUrl" -ForegroundColor Gray
Write-Host ""

$env:ANTHROPIC_API_KEY  = $apiKey
$env:ANTHROPIC_BASE_URL = $baseUrl
$env:CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT = "1"

claude --model $model
