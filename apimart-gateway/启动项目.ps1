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

# 3. 启动：直接用系统全局 Python 3.12（不用 venv），起 uvicorn（后台脱离终端，对齐 nohup）
# 定位系统 Python 3.12（候选按优先级：PATH 的 python → py -3.12 → 常见安装路径），
# 每个候选都验证版本确为 3.12，避免命中 Windows Store 的 python 别名空壳。
function Test-UsablePython {
    param([string]$Exe)
    if (-not (Test-Path $Exe)) { return $false }
    $out = & $Exe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
    return ($LASTEXITCODE -eq 0 -and $out -and $out.Trim() -eq "3.12")
}
$SystemPython = $null
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCmd -and (Test-UsablePython $pythonCmd.Source)) { $SystemPython = $pythonCmd.Source }
if (-not $SystemPython) {
    $pyOut = & py -3.12 -c "import sys; print(sys.executable)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $pyOut -and (Test-UsablePython $pyOut.Trim())) { $SystemPython = $pyOut.Trim() }
}
if (-not $SystemPython) {
    $cand = "C:\Users\xinye\AppData\Local\Programs\Python\Python312\python.exe"
    if (Test-UsablePython $cand) { $SystemPython = $cand }
}
if (-not $SystemPython) {
    Write-Host "  ❌ 未找到可用的系统 Python 3.12，请先安装 Python 3.12" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}
Write-Host "  🐍 使用 Python 3.12: $SystemPython" -ForegroundColor Cyan

# 3.1 安装/补齐依赖到全局环境（用 requirements.txt 的 MD5 做变更标记，未变更则跳过，避免每次启动联网解析）
$reqFile = Join-Path $ScriptDir "requirements.txt"
if (Test-Path $reqFile) {
    $stampFile = Join-Path $ScriptDir ".req_installed"
    $reqHash = (Get-FileHash $reqFile -Algorithm MD5).Hash
    if (-not (Test-Path $stampFile) -or ((Get-Content $stampFile -Raw).Trim() -ne $reqHash)) {
        Write-Host "  📦 检查并安装依赖 (requirements.txt)..." -ForegroundColor Cyan
        & $SystemPython -m pip install -r $reqFile 2>&1 | ForEach-Object { Write-Host "      $_" }
        Set-Content -Path $stampFile -Value $reqHash -Encoding UTF8
    } else {
        Write-Host "  ✅ 依赖无变更，跳过 pip 检查（.req_installed）" -ForegroundColor DarkGray
    }
}

$launcher = $SystemPython
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
