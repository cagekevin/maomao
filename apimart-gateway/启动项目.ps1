# 启动 Lovart 网关：先清理 9004 端口残留进程，再启动（关窗口不停止）。
$ErrorActionPreference = "Continue"

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
Set-Location -Path $ScriptDir

$PORT = 9004
$HostIP = "127.0.0.1"
$LOG = Join-Path $ScriptDir "apimart_$PORT.log"

# 1. 清理：先按 uvicorn 进程名杀，再按端口杀（对齐 .command）
Write-Host "  🔪 关闭端口 $PORT 上的旧进程（如有）..." -ForegroundColor Yellow
Get-Process -Name python*, python3* -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*uvicorn main:app*"
} | ForEach-Object {
    Write-Host "      终止旧 uvicorn 进程 (PID: $($_.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
$conn = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    $conn.OwningProcess | Sort-Object -Unique | ForEach-Object {
        Write-Host "      端口 $PORT 仍被占用 (PID: $_)，强制终止..." -ForegroundColor Yellow
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 1
# 等待端口真正释放
for ($i = 1; $i -le 10; $i++) {
    $remain = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
    if (-not $remain) { break }
    Start-Sleep -Seconds 1
}
Write-Host "  ✅ 端口已清理" -ForegroundColor Green

# 2. 加载 .env（对齐 .command 的 source .env）
Write-Host "  📄 加载 .env 配置..." -ForegroundColor Cyan
$envFile = Join-Path $ScriptDir ".env"
if (Test-Path $envFile) {
    Get-Content $envFile -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $kv = $line -split "=", 2
            if ($kv.Count -eq 2) {
                $val = $kv[1].Trim()
                # 去掉 bash 风格的引号（与 source .env 行为一致）
                if ($val.Length -ge 2) {
                    if (($val[0] -eq '"' -and $val[-1] -eq '"') -or ($val[0] -eq "'" -and $val[-1] -eq "'")) {
                        $val = $val.Substring(1, $val.Length - 2)
                    }
                }
                [System.Environment]::SetEnvironmentVariable($kv[0].Trim(), $val)
            }
        }
    }
    Write-Host "      ✅ 已加载 .env" -ForegroundColor Green
} else {
    Write-Host "      ⚠️  未找到 .env，将使用代码内默认值" -ForegroundColor DarkYellow
}

# 3. 启动：确保 venv 存在且依赖已装，再用 venv 的 python 起 uvicorn（后台脱离终端，对齐 nohup）
$venvPython = Join-Path $ScriptDir "venv\Scripts\python.exe"
$venvPip = Join-Path $ScriptDir "venv\Scripts\pip.exe"
$reqFile = Join-Path $ScriptDir "requirements.txt"

# 3.1 保证 venv 可用：不存在、或 pip 缺失则重建
if (-not (Test-Path $venvPip)) {
    if (Test-Path (Join-Path $ScriptDir "venv")) {
        Write-Host "  🧹 发现损坏的 venv（缺 pip），重建中..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force (Join-Path $ScriptDir "venv")
    } else {
        Write-Host "  🧪 首次运行，创建 venv..." -ForegroundColor Cyan
    }
    & python -m venv (Join-Path $ScriptDir "venv") 2>&1 | ForEach-Object { Write-Host "      $_" }
    if (-not (Test-Path $venvPip)) {
        Write-Host "  ❌ 无法创建可用 venv（pip 缺失），请检查系统 python 是否完整" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit 1
    }
}

# 3.2 安装/补齐依赖（已装则 pip 会快速跳过）
if (Test-Path $reqFile) {
    Write-Host "  📦 检查并安装依赖 (requirements.txt)..." -ForegroundColor Cyan
    & $venvPython -m pip install -r $reqFile 2>&1 | ForEach-Object { Write-Host "      $_" }
}

$launcher = $venvPython
$procArgs = "-m uvicorn main:app --host $HostIP --port $PORT"

$LOG_ERR = Join-Path $ScriptDir "apimart_$PORT.err.log"
Write-Host "  🚀 启动 Lovart 网关: http://$HostIP`:$PORT/" -ForegroundColor Green
Write-Host "      日志： $LOG" -ForegroundColor Cyan
Write-Host "      错误日志： $LOG_ERR" -ForegroundColor Cyan
Start-Process -FilePath $launcher -ArgumentList $procArgs -RedirectStandardOutput $LOG -RedirectStandardError $LOG_ERR -NoNewWindow
Start-Sleep -Seconds 3

# 4. 健康检查（用端口监听判断，避免 Get-Process 取不到 CommandLine）
Write-Host "  🩺 健康检查..." -ForegroundColor Cyan
$listening = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    try {
        $code = (Invoke-WebRequest "http://127.0.0.1:$PORT/health" -UseBasicParsing -TimeoutSec 5).StatusCode
    } catch {
        $code = "000"
    }
    Write-Host "      ✅ 进程已启动, /health -> HTTP $code" -ForegroundColor Green
    Write-Host "      Base URL: http://127.0.0.1:$PORT" -ForegroundColor Green
    Write-Host "      API Key:  随便填即可（OPEN_RELAY=true）" -ForegroundColor Green
} else {
    Write-Host "      ❌ 进程未启动，最后日志：" -ForegroundColor Red
    if (Test-Path $LOG) { Get-Content $LOG -Tail 15 }
    if (Test-Path $LOG_ERR) { Get-Content $LOG_ERR -Tail 15 }
}
Write-Host "" 
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host "    启动完成。关闭此窗口不会停止服务。" -ForegroundColor DarkGray
Write-Host "    停止服务： Stop-Process -Name python* -Confirm" -ForegroundColor DarkGray
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host ""
Read-Host "按回车键退出"
