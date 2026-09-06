# =====================================================================
# 猫猫AI画布 — 一键重打包 exe (build-exe)
# ---------------------------------------------------------------------
# 把 launch-all.ps1 编译成【无控制台】的 launch-猫猫画布.exe，嵌入猫猫图标。
# 关键：在脚本前注入 $global:MaomaoSilent = $true，
#       使 Write-Log 改走日志文件，避免 ps2exe GUI 把每行输出弹成 MessageBox。
# 运行：powershell -ExecutionPolicy Bypass -File .\build-exe.ps1
# =====================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
Set-Location -Path $ScriptDir

$InputScript  = Join-Path $ScriptDir "launch-all.ps1"
$IconFile     = Join-Path $ScriptDir "maomao.ico"
# 注意：改文件名也会让 Windows 图标缓存失效（缓存按 路径+文件名 做 key），
#       因此换图标时一并改名，可确保资源管理器立刻显示新图标。
$OutputExe    = Join-Path $ScriptDir "猫猫画布.exe"
$SilentScript = Join-Path $ScriptDir ".launch-silent.tmp.ps1"

if (-not (Test-Path $InputScript)) { Write-Error "未找到 $InputScript"; exit 1 }
if (-not (Test-Path $IconFile))    { Write-Error "未找到图标 $IconFile"; exit 1 }

# 合成自包含的静默入口：先置静默标志，再内联 launch-all.ps1 全文
$header = @"
# 由 build-exe.ps1 自动生成的静默入口（临时文件，编译后删除）
`$global:MaomaoSilent = `$true
"@
$body = Get-Content $InputScript -Raw -Encoding UTF8
Set-Content -Path $SilentScript -Value ($header + "`r`n" + $body) -Encoding UTF8

try {
    if (-not (Get-Module -ListAvailable ps2exe)) {
        Write-Host "正在安装 ps2exe（首次需要）..." -ForegroundColor Cyan
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
        Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
        Install-Module -Name ps2exe -Scope CurrentUser -Force
    }

    Write-Host "正在编译 $OutputExe ..." -ForegroundColor Cyan

    # -STA：系统托盘(NotifyIcon) 必须在单线程单元下运行，否则消息循环无法正常工作
    # 先结束正在运行的旧 exe，否则文件被占用会导致 Remove-Item 报权限拒绝
    # 注意：用 [IO.Path] 取进程名，不用 Split-Path -LeafBase（后者仅 PS 6.0+ 支持）
    $exeProcName = [System.IO.Path]::GetFileNameWithoutExtension($OutputExe)
    Get-Process -Name $exeProcName -ErrorAction SilentlyContinue |
        ForEach-Object {
            Write-Host "正在结束运行中的 $($_.ProcessName) (PID=$($_.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $_.Id -Force
        }
    Start-Sleep -Milliseconds 600

    Invoke-ps2exe -InputFile $SilentScript -OutputFile $OutputExe -noConsole -STA -icon $IconFile

    if (Test-Path $OutputExe) {
        $size = [math]::Round((Get-Item $OutputExe).Length / 1KB, 1)
        Write-Host "✅ 打包完成：$OutputExe ($size KB)" -ForegroundColor Green
        Write-Host "   双击启动后常驻系统托盘(右下角)，右键图标可打开画布/重启/退出" -ForegroundColor DarkGray
        Write-Host "   日志见 logs\launcher.log" -ForegroundColor DarkGray
    } else {
        Write-Error "打包失败：未生成 $OutputExe"
    }
} finally {
    if (Test-Path $SilentScript) { Remove-Item $SilentScript -Force }
}
