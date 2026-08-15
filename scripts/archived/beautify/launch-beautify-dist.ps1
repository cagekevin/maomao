# =====================================================================
# Yimao AI Canvas - one-click dist beautifier
# [Windows / PowerShell]
# ---------------------------------------------------------------------
# Full 4-step pipeline (auto, zero manual check, zero behavior change):
#   1) esbuild + babel structure-expand + prettier reformat
#   2) Add chunk role-header comments to each .js
#   3) Backtick templates -> string literals (pure equivalence)
#   4) Extract top-level symbols -> dist/assets/symbols.json
#
# Original dist/ is backed up to dist-orig/ (skipped if already exists).
#
# 注意：本脚本已随根目录移入 scripts/，工作目录需切回仓库根，
#       且 beautify-dist.cjs 与脚本同目录（不再多包一层 scripts/）。
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\launch-beautify-dist.ps1
# =====================================================================
$ErrorActionPreference = "Continue"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
Set-Location -Path (Split-Path $ScriptDir -Parent)  # 仓库根，beautify-dist.cjs 按 WORKSPACE=.. 取 dist/

function Write-Log {
    param([string]$Message, [string]$Level = "Info")
    $colors = @{ "Info"="Cyan"; "Success"="Green"; "Warn"="Yellow"; "Error"="Red"; "Dim"="DarkGray" }
    Write-Host $Message -ForegroundColor $colors[$Level]
}

Write-Log "========================================" "Info"
Write-Log "   Full beautify dist/ (4 steps auto)" "Info"
Write-Log "========================================" "Info"

$nodeScript = Join-Path $ScriptDir "beautify-dist.cjs"  # 与脚本同目录
if (-not (Test-Path $nodeScript)) {
    Write-Log "ERROR: script not found: $nodeScript" "Error"
    Read-Host "`nPress Enter to close"
    exit 1
}

try {
    node $nodeScript
    if ($LASTEXITCODE -ne 0) { throw "node exited with code $LASTEXITCODE" }
    Write-Log "`nSUCCESS! dist/ fully beautified (4 steps done)" "Success"
    Write-Log "   Read:  open dist\assets\*.js in editor" "Dim"
    Write-Log "   Index: dist\assets\symbols.json" "Dim"
    Write-Log "   Backup: dist-orig/ (original)" "Dim"
} catch {
    Write-Log "`nFAILED: $_" "Error"
    Write-Log "   Check: esbuild / prettier / @babel/core are installed" "Warn"
}

Read-Host "`nPress Enter to close"
