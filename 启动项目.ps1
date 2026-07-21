# 一毛AI画布 — 本地工具 启动/构建 脚本
# 双击运行进入菜单；也可带参数: .\启动项目.ps1 1 (启动) | 2 (构建)

$ErrorActionPreference = "Continue"

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
Set-Location -Path $ScriptDir

# ── 构建主项目 dist (v1) ──
function Build-Dist {
    Write-Host "🔨 正在构建 dist (v1)..." -ForegroundColor Cyan
    Set-Location -Path $ScriptDir
    # 首次运行自动安装依赖（主项目根目录）
    if (-not (Test-Path (Join-Path $ScriptDir "node_modules"))) {
        Write-Host "📦 首次运行，正在安装主项目依赖..." -ForegroundColor Cyan
        npm install
        Write-Host ""
    }
    # 双平台：package.json 的 build 脚本是 bash 内联环境变量写法，Windows 下无法直接 npm run build
    # 改为直接用 npx vite build 并自行设置内存参数，Mac 端仍用 npm run build 不受影响
    $env:NODE_OPTIONS = "--max-old-space-size=1024"
    npx vite build
    Write-Host "✅ dist 构建完成" -ForegroundColor Green
}

# ── 端口状态检测 ──
function Show-PortStatus {
    param(
        [int]$Port,
        [string]$Name
    )
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "  ● ${Name} (端口 ${Port}): 开启" -ForegroundColor Green
    } else {
        Write-Host "  ○ ${Name} (端口 ${Port}): 关闭" -ForegroundColor Red
    }
}

# ── 启动 localTool 服务 ──
function Start-Service {
    # 启动前显示端口状态
    Write-Host "📡 当前端口状态：" -ForegroundColor Cyan
    Show-PortStatus -Port 9004 -Name "AI 网关 (apimart-gateway)"
    Show-PortStatus -Port 18080 -Name "本地工具 (localTool)"
    Write-Host ""

    $localToolDir = Join-Path $ScriptDir "localTool"
    if (-not (Test-Path $localToolDir)) {
        Write-Host "❌ 未找到 localTool 目录: $localToolDir" -ForegroundColor Red
        return
    }
    Set-Location -Path $localToolDir

    # 首次运行自动安装依赖
    if (-not (Test-Path (Join-Path $localToolDir "node_modules"))) {
        Write-Host "📦 首次运行，正在安装依赖..." -ForegroundColor Cyan
        npm install
        Write-Host ""
    }

    # 首次运行自动编译
    if (-not (Test-Path (Join-Path $localToolDir "dist\index.js"))) {
        Write-Host "📦 正在编译 TypeScript..." -ForegroundColor Cyan
        npm run build
        Write-Host ""
    }

    # 端口冲突自动清理
    $PORT = 18080
    $conn = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "⚠️  端口 $PORT 被占用，正在关闭旧进程..." -ForegroundColor Yellow
        $conn.OwningProcess | Sort-Object -Unique | ForEach-Object {
            Write-Host "      终止旧进程 (PID: $_)..." -ForegroundColor Yellow
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
        # 若仍未释放，强制 -9 等效处理
        $conn2 = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
        if ($conn2) {
            $conn2.OwningProcess | Sort-Object -Unique | ForEach-Object {
                Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
            }
            Start-Sleep -Seconds 0.5
        }
        Write-Host "✅ 旧进程已关闭" -ForegroundColor Green
        Write-Host ""
    }

    Write-Host "🚀 启动 localTool 服务 (端口 $PORT)..." -ForegroundColor Green
    Write-Host "   按 Ctrl+C 停止" -ForegroundColor DarkGray
    Write-Host ""
    node dist/index.js
}

# ── 带参数直接执行（非交互）──
if ($args.Count -gt 0) {
    switch ($args[0]) {
        "1" { Start-Service; exit 0 }
        "2" { Build-Dist; exit 0 }
    }
}

# ── 进入菜单前先显示端口状态（双击打开即可见）──
Write-Host "📡 当前端口状态：" -ForegroundColor Cyan
Show-PortStatus -Port 9004 -Name "AI 网关 (apimart-gateway)"
Show-PortStatus -Port 18080 -Name "本地工具 (localTool)"
Write-Host ""

# ── 交互菜单 ──
Write-Host "=================================="
Write-Host "   一毛AI画布 — 本地工具"
Write-Host "=================================="
Write-Host "   [1] 启动 localTool 服务"
Write-Host "   [2] 构建 dist (v1)"
Write-Host "   [q] 退出"
Write-Host "=================================="
$CHOICE = Read-Host "请选择 (1/2/q)"
switch ($CHOICE) {
    "1" { Start-Service }
    "2" { Build-Dist }
    { $_ -eq "q" -or $_ -eq "Q" } { Write-Host "已退出"; exit 0 }
    default { Write-Host "❌ 无效选择" -ForegroundColor Red; exit 1 }
}

# 防止双击运行时窗口秒关
Read-Host "按回车键退出..."
