# =====================================================================
# 猫猫AI画布 — 一键启动器 (launch-all)  [Windows / PowerShell]
# ---------------------------------------------------------------------
# 依次拉起：本地服务 localTool (:18080，托管【原型】前端)
# 说明：localTool 在 18080 同时托管【原型构建产物】(根目录 dist/) 与后端 API，
#       打开 http://127.0.0.1:18080 即为【原型画布】（API 同源，无需跨端口）。
#
# 运行方式（Windows）：
#   powershell -ExecutionPolicy Bypass -File .\launch-all.ps1
#   本启动器每次运行都会【重启】localTool：先清理 18080 旧进程，再重新拉起，
#   进入守护模式（掉线自动重启），并打开画布。
# =====================================================================

$ErrorActionPreference = "Continue"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
Set-Location -Path $ScriptDir

# ── ⚙️ 全局配置 ──
$Config = @{
    LocalTool = @{ Port = 18080; Dir = "localTool";       Name = "本地工具" }
}

$script:WatchdogLockFile = Join-Path $ScriptDir "logs\watchdog.pid"

# =====================================================================
# ── 🛠️ 核心辅助函数 ──
# =====================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "Info")
    $colors = @{ "Info"="Cyan"; "Success"="Green"; "Warn"="Yellow"; "Error"="Red"; "Dim"="DarkGray" }
    Write-Host $Message -ForegroundColor $colors[$Level]
}

# ── 🔒 守护进程单实例锁 ──
function Acquire-WatchdogLock {
    $lockDir = Split-Path $script:WatchdogLockFile -Parent
    if (-not (Test-Path $lockDir)) { New-Item -ItemType Directory -Force -Path $lockDir | Out-Null }

    if (Test-Path $script:WatchdogLockFile) {
        try {
            $oldPid = [int](Get-Content $script:WatchdogLockFile -Raw).Trim()
            if ($oldPid -gt 0) {
                $oldProc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
                if ($oldProc -and $oldProc.ProcessName -match "^(powershell|pwsh)$") {
                    Write-Log "❌ 已有守护进程在运行 (PID=$oldPid)，拒绝重复启动。" "Error"
                    Write-Log "   如需强制重启，请先退出原守护进程（按 Ctrl+C）。" "Warn"
                    return $false
                } else {
                    Write-Log "  ⚠️ 锁文件 PID=$oldPid 已失效或被非守护进程复用，正在清理..." "Warn"
                    Remove-Item $script:WatchdogLockFile -Force -ErrorAction SilentlyContinue
                }
            }
        } catch {
            Remove-Item $script:WatchdogLockFile -Force -ErrorAction SilentlyContinue
        }
    }

    try { 
        Set-Content -Path $script:WatchdogLockFile -Value "$PID" -Encoding UTF8 
        return $true
    } catch {
        Write-Log "  ⚠️ 写入守护锁失败，继续启动：$($_.Exception.Message)" "Warn"
        return $true
    }
}

function Release-WatchdogLock {
    if (-not (Test-Path $script:WatchdogLockFile)) { return }
    try {
        $curPid = [int](Get-Content $script:WatchdogLockFile -Raw).Trim()
        if ($curPid -eq $PID) { Remove-Item $script:WatchdogLockFile -Force -ErrorAction SilentlyContinue }
    } catch { }
}

function Stop-Watchdog {
    param([switch]$Quiet)
    if (-not (Test-Path $script:WatchdogLockFile)) {
        if (-not $Quiet) { Write-Log "  ℹ️ 未发现守护进程锁文件，无需清理。" "Dim" }
        return
    }
    try {
        $watchdogPid = [int](Get-Content $script:WatchdogLockFile -Raw).Trim()
        if ($watchdogPid -gt 0 -and $watchdogPid -ne $PID) {
            $proc = Get-Process -Id $watchdogPid -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Log "  🛑 正在结束原守护进程 (PID=$watchdogPid)..." "Warn"
                Stop-Process -Id $watchdogPid -Force -ErrorAction SilentlyContinue
            }
        }
        Remove-Item $script:WatchdogLockFile -Force -ErrorAction SilentlyContinue
    } catch { }
}

$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Release-WatchdogLock }

# ── 📡 网络与端口探测 ──
function Clear-Port {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connections) {
        Write-Log "  🧹 端口 $Port 被占用，正在清理旧进程..." "Warn"
        $connections.OwningProcess | Sort-Object -Unique | ForEach-Object {
            try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch { }
        }
        $deadline = (Get-Date).AddSeconds(5)
        while ((Get-Date) -lt $deadline -and (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) {
            Start-Sleep -Milliseconds 200
        }
    }
}

function Test-PortStatus {
    param([int]$Port, [string]$Name, [switch]$Quiet)
    $isAlive = [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if (-not $Quiet) {
        if ($isAlive) { Write-Log "  ● $Name (端口 $Port): 运行中" "Success" }
        else { Write-Log "  ○ $Name (端口 $Port): 已关闭" "Dim" }
    }
    return $isAlive
}

function Wait-PortReady {
    param([int]$Port, [int]$TimeoutSec = 20)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortStatus -Port $Port -Quiet) { return $true }
        Start-Sleep -Milliseconds 300
    }
    return $false
}

# ── 📦 环境就绪检测 ──
function Ensure-NodeEnvironment {
    param([string]$Path, [switch]$NeedsBuild)
    Push-Location $Path
    try {
        if (-not (Test-Path "node_modules")) {
            Write-Log "  📦 [$Path] 首次运行，正在安装依赖..." "Info"
            npm install 2>&1 | Out-Null
        }
        if ($NeedsBuild) {
            $distIndex = Join-Path $Path "dist\index.js"
            # 短路径加速：产物已存在时只做一次时间戳比较，遇首个更新源码即判定（提前退出），
            # 避免枚举整个 src 树后再筛选（src 文件多时可明显缩短启动耗时）。
            $distTime = (Get-Item $distIndex -ErrorAction SilentlyContinue).LastWriteTime
            $srcHasNewer = $false
            if ($null -eq $distTime) {
                $srcHasNewer = [bool](Get-ChildItem (Join-Path $Path "src") -Recurse -File -Filter "*.ts" -ErrorAction SilentlyContinue | Select-Object -First 1)
            } else {
                foreach ($f in (Get-ChildItem (Join-Path $Path "src") -Recurse -File -Filter "*.ts" -ErrorAction SilentlyContinue)) {
                    if ($f.LastWriteTime -gt $distTime) { $srcHasNewer = $true; break }
                }
            }
            
            if ($srcHasNewer) {
                Write-Log "  🛠️ [$Path] 检测到源码更新，正在编译 TypeScript..." "Info"
                $buildOutput = npm run build 2>&1
                if ($LASTEXITCODE -ne 0) {
                    Write-Log "  ❌ [$Path] TypeScript 编译失败，中止启动。" "Error"
                    Write-Log "     输出：$($buildOutput -join ' | ')" "Error"
                    return $false
                }
            }
            if (-not (Test-Path $distIndex)) {
                Write-Log "  ❌ [$Path] 编译产物 dist\index.js 不存在，中止启动。" "Error"
                return $false
            }
        }
        return $true
    } finally {
        Pop-Location
    }
}

function Open-Canvas {
    $url = "http://127.0.0.1:$($Config.LocalTool.Port)"
    Write-Log "  🌐 打开画布 $url" "Info"
    Start-Process $url
}

# =====================================================================
# ── 🚀 业务功能模块 ──
# =====================================================================

# ── 🖥️ 构建【原型】前端（npm run build → 根目录 dist/，供 localTool 在 18080 托管）──
# [已注释] 前端已提前手动 build，启动流程不再自动构建
<# function Build-Prototype {
    Write-Log "`n🛠️ 正在构建原型前端（npm run build → dist/）..." "Info"
    Push-Location $ScriptDir
    try {
        $out = npm run build 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Log "  ❌ 原型构建失败，中止启动。" "Error"
            Write-Log "     输出：$($out -join ' | ')" "Error"
            return $false
        }
    } finally {
        Pop-Location
    }
    $distIndex = Join-Path $ScriptDir "dist\index.html"
    if (-not (Test-Path $distIndex)) {
        Write-Log "  ❌ 原型构建产物 dist\index.html 不存在，中止启动。" "Error"
        return $false
    }
    Write-Log "  ✅ 原型已构建（dist\index.html）" "Success"
    return $true
} #>

function Start-LocalTool {
    $dir = Join-Path $ScriptDir $Config.LocalTool.Dir
    if (-not (Test-Path $dir)) { Write-Log "❌ 未找到 localTool 目录: $dir" "Error"; return $false }

    if (-not (Ensure-NodeEnvironment -Path $dir -NeedsBuild)) {
        Write-Log "  ❌ LocalTool 环境准备失败，已中止启动（保留原服务不动）。" "Error"
        return $false
    }
    
    Clear-Port -Port $Config.LocalTool.Port

    # 日志改由 localTool 进程内接管（logWriter.ts 按天轮转 + 自动删 7 天前），
    # 不再用 Start-Process 重定向 stdout/err，避免双写单文件。
    Start-Process -FilePath "node" -ArgumentList (Join-Path $dir "dist\index.js") `
        -WindowStyle Hidden -WorkingDirectory $dir

    if (Wait-PortReady -Port $Config.LocalTool.Port -TimeoutSec 25) {
        Write-Log "  ✅ LocalTool 已启动 (日志: localTool\logs\localtool_18080_YYYY-MM-DD.log，自动轮转)" "Success"
        return $true
    }
    Write-Log "  ❌ LocalTool 启动超时，请查看 localTool\logs\ 下当日日志" "Error"
    return $false
}

function Start-Watchdog {
    # Quiet：首次启动无锁时不在启动流程里打印"无需清理"噪音
    Stop-Watchdog -Quiet
    if (-not (Acquire-WatchdogLock)) { exit 1 }

    Write-Log "`n📡 正在启动服务..." "Info"
    # [已注释] 前端已提前手动 build，启动流程不再调用 Build-Prototype
    # if (-not (Build-Prototype)) { Release-WatchdogLock; exit 1 }
    $null = Start-LocalTool   # Start-LocalTool 内部已等端口就绪，无需再固定 sleep
    Open-Canvas

    Write-Log "`n🛡️ 进入守护模式 (5秒轮询，掉线自动重启)... [按 Ctrl+C 退出控制台则关闭所有]" "Info"
    Write-Log "   🔒 本守护进程 PID=$PID (全局唯一)" "Dim"
    
    try {
        while ($true) {
            if (-not (Test-PortStatus -Port $Config.LocalTool.Port -Name $Config.LocalTool.Name -Quiet)) {
                Write-Log "  ⚠️ $(Get-Date -Format 'HH:mm:ss') 本地工具掉线，正在重启..." "Warn"
                $null = Start-LocalTool
            }
            Start-Sleep -Seconds 5
        }
    } finally {
        Release-WatchdogLock
    }
}

# ── 入口：直接进入守护模式（后台启动 localTool + 打开画布，掉线自动重启）──
Start-Watchdog