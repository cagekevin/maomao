# =====================================================================
# 猫猫AI画布 — 一键启动器 (launch-all)  [Windows / PowerShell]
# ---------------------------------------------------------------------
# 依次拉起：本地服务 localTool (:18080，托管【原型】前端)
# 说明：localTool 在 18080 同时托管【原型构建产物】(根目录 dist/) 与后端 API，
#       打开 http://127.0.0.1:18080 即为【原型画布】（API 同源，无需跨端口）。
#
# 运行方式（Windows）：
#   powershell -ExecutionPolicy Bypass -File .\launch-all.ps1     # 控制台模式，便于调试
#   或双击 build-exe.ps1 生成的 launch-猫猫画布.exe               # 静默模式，常驻系统托盘
#
# 行为：启动 localTool(:18080) → 打开画布 → 常驻右下角托盘。
#       右键托盘图标可 打开画布 / 构建前端 / 构建后端(localTool) / 重启服务 / 打开日志目录 / 退出。
#       构建为静默后台执行（不弹 cmd 窗口），完成后气泡提示；构建后端成功会自动重启服务。
#       服务掉线会自动重启；连续失败 3 次则停止重试并弹气泡报警，避免无限重试刷爆日志。
#       点「退出」会连同 node 进程树一并清理，不留孤儿进程。
#       单实例：基于系统命名 Mutex，进程崩溃/断电自动释放，绝无重复实例。
# =====================================================================

$ErrorActionPreference = "Continue"
# 脚本已收拢到 packaging/windows/；项目根 = 脚本目录上两级（本目录不持项目内容）。
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir "..\.."))
Set-Location -Path $ProjectRoot

# ── ⚙️ 全局配置 ──
$Config = @{
    LocalTool = @{ Port = 18080; Dir = "localTool";       Name = "本地工具" }
}

$script:MutexName = "MaomaoCanvas_SingleInstance"
$script:AppMutex  = $null

# ── 🚦 自动重启策略 ──
# 连续失败达到上限就停止重试：node 若因编译/配置错误起不来，
# 无限重试只会每 5 秒刷日志 + 产生僵尸进程，不如停下来报警让你处理。
$script:LocalToolPid   = 0    # 当前 node 进程 PID，退出时按【进程树】清理
$script:FailCount      = 0    # 连续启动失败次数（成功一次即归零）
$script:MaxAutoRestart = 3    # 连续失败上限

# ── 🧷 Job Object：进程清理的兜底保障 ──
$script:JobHandle = [IntPtr]::Zero
$script:JobReady  = $false

# ── 🔧 静默构建状态（供构建 Timer 回调跨作用域读取）──
$script:BuildBusy    = $false  # 是否有构建在进行
$script:BuildProc    = $null   # 后台构建进程
$script:BuildOutBuf  = $null   # stdout 累积
$script:BuildErrBuf  = $null   # stderr 累积
$script:BuildLogFile = $null   # 本次构建日志路径
$script:BuildKey     = $null   # "前端" / "后端"
$script:BuildAsyncTimer = $null

# =====================================================================
# ── 🛠️ 核心辅助函数 ──
# =====================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "Info")
    # 静默模式：打包成 -noConsole 的 exe 后没有控制台，ps2exe 会把 Write-Host 逐条弹成 MessageBox，
    # 因此在静默模式下改为写入日志文件（logs\launcher.log），实现完全无弹窗。
    if ($global:MaomaoSilent) {
        try {
            $logDir = Join-Path $ProjectRoot "logs"
            if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
            $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')][$Level] $Message"
            Add-Content -Path (Join-Path $logDir "launcher.log") -Value $line -Encoding UTF8
        } catch { }
        return
    }
    $colors = @{ "Info"="Cyan"; "Success"="Green"; "Warn"="Yellow"; "Error"="Red"; "Dim"="DarkGray" }
    Write-Host $Message -ForegroundColor $colors[$Level]
}

# ── 🔒 单实例（系统命名 Mutex）──
# 相比旧的 PID 文件锁：进程崩溃/断电时由操作系统自动释放，无残留文件；
# 也不会因 PID 被系统复用给无关进程而误判，更不需要按进程名猜。
function Acquire-SingleInstance {
    $createdNew = $false
    try {
        $script:AppMutex = New-Object System.Threading.Mutex($true, $script:MutexName, [ref]$createdNew)
        if ($createdNew) { return $true }
        # 已被占用：说明已有实例在运行
        try { $script:AppMutex.Dispose() } catch { }
        $script:AppMutex = $null
        return $false
    } catch {
        # 创建失败（权限等异常）时放行，不阻塞启动
        Write-Log "  ⚠️ 单实例检测不可用，继续启动：$($_.Exception.Message)" "Warn"
        return $true
    }
}

function Release-SingleInstance {
    if ($null -ne $script:AppMutex) {
        try { $script:AppMutex.ReleaseMutex() } catch { }
        try { $script:AppMutex.Dispose() } catch { }
        $script:AppMutex = $null
    }
}

# ── 🌲 按进程树结束（/T 连带子进程）──
# node 可能经由 npm/tsx 等包装层拉起子进程，只杀主进程会留下孤儿。
function Stop-ProcessTree {
    param([int]$ProcessId)
    if ($ProcessId -le 0) { return }
    try { $null = & taskkill.exe /PID $ProcessId /T /F 2>&1 } catch { }
}

# ── 🧷 Windows Job Object（进程清理的兜底保障）──
# 为什么需要：finally 只在【正常退出】时执行。一旦本程序被强杀(Stop-Process -Force)、
# 崩溃、或被任务管理器结束，finally 根本不会跑，node 及其子进程就会变成孤儿并继续占着 18080。
# 解法：把 node 加入 Job Object 并设 JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE。
#       本进程一旦消失（任何原因），Windows 内核会自动终止 Job 内所有进程 —— 兜底 100% 可靠。
function Ensure-JobObject {
    if ($script:JobReady) { return $script:JobHandle }
    $script:JobReady = $false
    try {
        if (-not ('MaomaoJobObject' -as [type])) {
            Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class MaomaoJobObject
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetInformationJobObject(IntPtr hJob, int infoClass, IntPtr lpInfo, uint cbInfo);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
    private const int JobObjectExtendedLimitInformation = 9;

    public static IntPtr CreateKillOnCloseJob()
    {
        IntPtr hJob = CreateJobObject(IntPtr.Zero, null);
        if (hJob == IntPtr.Zero) return IntPtr.Zero;

        JOBOBJECT_EXTENDED_LIMIT_INFORMATION info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        int size = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
        IntPtr ptr = Marshal.AllocHGlobal(size);
        try
        {
            Marshal.StructureToPtr(info, ptr, false);
            if (!SetInformationJobObject(hJob, JobObjectExtendedLimitInformation, ptr, (uint)size))
            {
                return IntPtr.Zero;
            }
        }
        finally
        {
            Marshal.FreeHGlobal(ptr);
        }
        return hJob;
    }
}
'@
        }
        $script:JobHandle = [MaomaoJobObject]::CreateKillOnCloseJob()
        $script:JobReady  = ($script:JobHandle -ne [IntPtr]::Zero)
        if ($script:JobReady) {
            Write-Log "  🧷 进程回收保障已启用 (Job Object)" "Dim"
        } else {
            Write-Log "  ⚠️ Job Object 创建失败，退出时将依赖进程树清理" "Warn"
        }
    } catch {
        Write-Log "  ⚠️ Job Object 不可用（不影响启动，退出时回退到进程树清理）：$($_.Exception.Message)" "Warn"
    }
    return $script:JobHandle
}

# ── 📡 网络与端口探测 ──
function Clear-Port {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connections) {
        Write-Log "  🧹 端口 $Port 被占用，正在清理旧进程..." "Warn"
        $connections.OwningProcess | Sort-Object -Unique | ForEach-Object {
            Stop-ProcessTree -ProcessId $_
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

# ── 🔇 静默执行 npm（无控制台窗口）──
# 关键：在 ps2exe 的 -noConsole GUI 进程里直接调用 `npm`(npm.cmd) 时，
# Windows 会为 .cmd 批处理强制分配一个 cmd 控制台窗口 → 启动时闪黑框。
# 解法：用 `node` 直接执行 npm 的 JS 入口 (npm-cli.js)，绕过 cmd.exe，彻底不弹窗。
# 同时把输出捕获到内存变量，返回退出码，便于判断成败并写入日志。
function Get-NpmCliPath {
    # 优先从 PATH 里的 npm.cmd / npm.ps1 反推同目录 node_modules\npm\bin\npm-cli.js
    try {
        $npmCmd = Get-Command npm -ErrorAction Stop
        $src = $npmCmd.Source
        $dir = Split-Path $src -Parent
        $cand = Join-Path $dir "node_modules\npm\bin\npm-cli.js"
        if (Test-Path $cand) { return $cand }
        # npm 也可能是个符号/转发：真实 cli 在 ..\lib\node_modules\npm\bin\npm-cli.js
        $cand2 = Join-Path (Split-Path $dir -Parent) "lib\node_modules\npm\bin\npm-cli.js"
        if (Test-Path $cand2) { return $cand2 }
    } catch { }
    return $null
}

function Invoke-Npm {
    param(
        [string]$Arguments,          # 例如 "install" / "run build"
        [string]$WorkingDir
    )
    $cli = Get-NpmCliPath
    if (-not $cli) {
        Write-Log "  ❌ 无法定位 npm-cli.js，请确认 Node.js/npm 已安装并在 PATH。" "Error"
        return 1
    }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "node"
    $psi.Arguments = "`"$cli`" $Arguments"
    $psi.WorkingDirectory = $WorkingDir
    # 关键：完全隐藏窗口 + 不创建控制台
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow  = $true
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    try {
        $p = New-Object System.Diagnostics.Process
        $p.StartInfo = $psi
        $sb = New-Object System.Text.StringBuilder
        # 异步行读取：避免 stdout/stderr 任一管道写满导致同步 ReadToEnd 死锁
        $p.add_OutputDataReceived({ if ($_.Data) { $null = $sb.AppendLine($_.Data) } })
        $p.add_ErrorDataReceived({ if ($_.Data) { $null = $sb.AppendLine($_.Data) } })
        if (-not $p.Start()) { Write-Log "  ❌ 无法启动 node 进程执行 npm。" "Error"; return 1 }
        $p.BeginOutputReadLine()
        $p.BeginErrorReadLine()
        # 最多等 10 分钟，防止 install 极慢时无限卡死
        if (-not $p.WaitForExit(600000)) {
            Write-Log "  ⚠️ npm 执行超过 10 分钟，强制结束。" "Error"
            try { $p.Kill() } catch { }
            return 1
        }
        $code = $p.ExitCode
        if ($code -ne 0) {
            Write-Log "  stderr: $($sb.ToString())" "Error"
        }
        return $code
    } catch {
        Write-Log "  ❌ 执行 node npm 失败：$($_.Exception.Message)" "Error"
        return 1
    }
}

# ── 📦 环境就绪检测 ──
function Ensure-NodeEnvironment {
    param([string]$Path, [switch]$NeedsBuild)
    Push-Location $Path
    try {
        if (-not (Test-Path "node_modules")) {
            Write-Log "  📦 [$Path] 首次运行，正在安装依赖（静默）..." "Info"
            $null = Invoke-Npm -Arguments "install" -WorkingDir $Path
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
                Write-Log "  🛠️ [$Path] 检测到源码更新，正在编译 TypeScript（静默）..." "Info"
                $code = Invoke-Npm -Arguments "run build" -WorkingDir $Path
                if ($code -ne 0) {
                    Write-Log "  ❌ [$Path] TypeScript 编译失败，中止启动。" "Error"
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
    # 用 Chrome app 模式开独立窗口（无地址栏/标签栏，等同 PWA 观感，不堆标签）。
    # 找不到 Chrome 才退回默认浏览器。详见 packaging/windows/PWA-说明.md。
    $url = "http://127.0.0.1:$($Config.LocalTool.Port)"
    $chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $chrome)) { $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" }
    if (Test-Path $chrome) {
        Write-Log "  🌐 用 Chrome app 窗口打开画布 $url" "Info"
        Start-Process $chrome -ArgumentList "--app=$url"
    } else {
        Write-Log "  ⚠️ 未找到 Chrome，退回默认浏览器打开 $url" "Warn"
        Start-Process $url
    }
}

# ── 🛠️ 静默后台构建（菜单项：构建前端 / 构建后端(localTool)）──
# 不弹任何 cmd 窗口：用 node 直接执行 npm-cli.js（绕过 npm.cmd 触发的控制台创建），
# 日志写入 logs\build_<key>.log，完成后回 UI 线程用托盘气泡报告成功/失败（与 Mac 一致）。
# 构建后端成功后会自动重启服务以加载新代码。
# 可靠性设计：所有跨事件回调的状态都放 $script: 级，避免 PowerShell Add_Tick/异步 IO
# 事件闭包捕获不到局部变量的坑。
# BuildPollTicks     累计的轮询计数（构建超时/诊断用，保留占位）
function Invoke-SilentBuild {
    param(
        [string]$titleKey,   # 用于文件名/提示，如 前端 / 后端
        [string]$WorkDir,
        [string]$NpmArgs     # 例如 "run build"
    )
    try {
        if ($script:BuildBusy) {
            Write-Log "  ⏳ 已有构建在进行，忽略重复请求 ($titleKey)。" "Warn"
            if ($script:NotifyIcon) { $script:NotifyIcon.ShowBalloonTip(3000, "猫猫画布", "已有构建正在进行，请稍候。", [System.Windows.Forms.ToolTipIcon]::Info) }
            return
        }

        $cli = Get-NpmCliPath
        if (-not $cli) {
            Write-Log "  ❌ 无法定位 npm-cli.js，无法构建 $titleKey。" "Error"
            if ($script:NotifyIcon) {
                $script:NotifyIcon.ShowBalloonTip(6000, "猫猫画布", "构建 $titleKey 失败：找不到 npm。请确认 Node 已安装。", [System.Windows.Forms.ToolTipIcon]::Error)
            }
            return
        }

        # 日志文件：logs\build_<key>.log（覆盖旧内容）
        $logDir = Join-Path $ProjectRoot "logs"
        if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
        $logFile = Join-Path $logDir "build_$titleKey.log"

        # 用异步 IO 启动 node 构建进程（不创建控制台 → 不弹窗）
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "node"
        $psi.Arguments = "`"$cli`" $NpmArgs"
        $psi.WorkingDirectory = $WorkDir
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true

        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $psi
        # 先把缓冲与元数据放进 script 级，供下面的事件 handler / Timer 回调可靠访问
        $script:BuildOutBuf = New-Object System.Text.StringBuilder
        $script:BuildErrBuf = New-Object System.Text.StringBuilder
        $script:BuildLogFile = $logFile
        $script:BuildKey    = $titleKey
        # 事件 handler 在异步 IO 线程触发，统一访问 $script: 级缓冲，避免闭包取不到局部变量
        $proc.add_OutputDataReceived({ if ($_.Data) { $null = $script:BuildOutBuf.AppendLine($_.Data) } })
        $proc.add_ErrorDataReceived({ if ($_.Data) { $null = $script:BuildErrBuf.AppendLine($_.Data) } })

        if (-not $proc.Start()) {
            Write-Log "  ❌ 构建 $titleKey 无法启动 node 进程。" "Error"
            $script:BuildBusy = $false
            return
        }
        $proc.BeginOutputReadLine()
        $proc.BeginErrorReadLine()

        $script:BuildProc   = $proc
        $script:BuildBusy   = $true
        $script:BuildAsyncTimer = $null
        if ($script:NotifyIcon) { $script:NotifyIcon.Text = "猫猫画布 — 正在构建$titleKey..." }

        Write-Log "  🛠️ 开始静默构建 $titleKey (node npm run ...)。完成后气泡提示。日志：$logFile" "Info"
        Start-BuildPollTimer
    } catch {
        $script:BuildBusy = $false
        Write-Log "  ❌ 触发构建 $titleKey 失败：$($_.Exception.Message)" "Error"
    }
}

# 启动一个轻量轮询定时器，检测后台构建进程是否结束。
function Start-BuildPollTimer {
    $t = New-Object System.Windows.Forms.Timer
    $t.Interval = 500
    # Add_Tick 的事件块在独立作用域执行，只能通过 $script: 访问状态。
    # 注意：回调内绝不能引用局部变量 $t（事件作用域里取不到），统一用 $script:BuildAsyncTimer。
    $t.Add_Tick({
        $p = $script:BuildProc
        if ($null -ne $p -and $p.HasExited) {
            $self = $script:BuildAsyncTimer
            if ($null -ne $self) { $self.Stop(); $self.Dispose() }
            $script:BuildAsyncTimer = $null
            $code = $p.ExitCode
            $out = $script:BuildOutBuf.ToString()
            $err = $script:BuildErrBuf.ToString()
            $logFile = $script:BuildLogFile
            $key = $script:BuildKey
            try { [System.IO.File]::WriteAllText($logFile, ($out + $err), [System.Text.Encoding]::UTF8) } catch { }
            $script:BuildProc = $null
            $script:BuildBusy = $false
            if ($script:NotifyIcon) { $script:NotifyIcon.Text = "猫猫画布 — 运行中 (:18080)" }
            if ($code -eq 0) {
                Write-Log "  ✅ 构建 $key 成功。日志：$logFile" "Success"
                if ($script:NotifyIcon) {
                    $script:NotifyIcon.ShowBalloonTip(4000, "猫猫画布", "构建 $key 成功", [System.Windows.Forms.ToolTipIcon]::Info)
                }
                # 后端构建成功 → 自动重启服务以加载新代码
                if ($key -eq "后端") {
                    Write-Log "  🔄 后端已重新编译，正在自动重启服务..." "Info"
                    Start-RestartServiceSilently
                }
            } else {
                Write-Log "  ❌ 构建 $key 失败。日志：$logFile" "Error"
                if ($script:NotifyIcon) {
                    $script:NotifyIcon.ShowBalloonTip(8000, "猫猫画布", "构建 $key 失败，请打开日志目录查看 $logFile", [System.Windows.Forms.ToolTipIcon]::Error)
                }
            }
        }
    })
    $script:BuildAsyncTimer = $t
    $t.Start()
}

# 静默重启服务（构建后端成功后自动调用）——复用已有逻辑但减少刷屏。
function Start-RestartServiceSilently {
    try {
        if ($script:LocalToolPid -gt 0) { Stop-ProcessTree -ProcessId $script:LocalToolPid }
        $script:LocalToolPid = 0
        Clear-Port -Port $Config.LocalTool.Port
        if (Start-LocalTool) {
            $script:FailCount = 0
            if ($script:HealthTimer) { $script:HealthTimer.Start() }
            if ($script:NotifyIcon) {
                $script:NotifyIcon.Text = "猫猫画布 — 运行中 (:18080)"
                $script:NotifyIcon.ShowBalloonTip(3000, "猫猫画布", "服务已重启", [System.Windows.Forms.ToolTipIcon]::Info)
            }
        } else {
            if ($script:NotifyIcon) {
                $script:NotifyIcon.ShowBalloonTip(6000, "猫猫画布", "重启失败，请打开日志目录排查。", [System.Windows.Forms.ToolTipIcon]::Error)
            }
        }
    } catch {
        Write-Log "  ❌ 自动重启服务失败：$($_.Exception.Message)" "Error"
    }
}

# =====================================================================
# ── 🚀 业务功能模块 ──
# =====================================================================

# ── 🖥️ 构建【原型】前端（npm run build → 根目录 dist/，供 localTool 在 18080 托管）──
# [已注释] 前端已提前手动 build，启动流程不再自动构建
<# function Build-Prototype {
    Write-Log "`n🛠️ 正在构建原型前端（npm run build → dist/）..." "Info"
    Push-Location $ProjectRoot
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
    $distIndex = Join-Path $ProjectRoot "dist\index.html"
    if (-not (Test-Path $distIndex)) {
        Write-Log "  ❌ 原型构建产物 dist\index.html 不存在，中止启动。" "Error"
        return $false
    }
    Write-Log "  ✅ 原型已构建（dist\index.html）" "Success"
    return $true
} #>

function Start-LocalTool {
    $dir = Join-Path $ProjectRoot $Config.LocalTool.Dir
    if (-not (Test-Path $dir)) { Write-Log "❌ 未找到 localTool 目录: $dir" "Error"; return $false }

    if (-not (Ensure-NodeEnvironment -Path $dir -NeedsBuild)) {
        Write-Log "  ❌ LocalTool 环境准备失败，已中止启动（保留原服务不动）。" "Error"
        return $false
    }
    
    Clear-Port -Port $Config.LocalTool.Port

    # 日志改由 localTool 进程内接管（logWriter.ts 按天轮转 + 自动删 7 天前），
    # 不再用 Start-Process 重定向 stdout/err，避免双写单文件。
    # PassThru：记住 PID，退出时才能 taskkill /T 杀掉整棵进程树而不留孤儿。
    $proc = Start-Process -FilePath "node" -ArgumentList (Join-Path $dir "dist\index.js") `
        -WindowStyle Hidden -WorkingDirectory $dir -PassThru
    $script:LocalToolPid = $proc.Id

    # 加入 Job Object：本进程无论正常退出 / 崩溃 / 被强杀，node 及其子进程都会被系统回收
    $hJob = Ensure-JobObject
    if ($hJob -ne [IntPtr]::Zero) {
        try {
            $null = [MaomaoJobObject]::AssignProcessToJobObject($hJob, $proc.Handle)
        } catch { }
    }

    if (Wait-PortReady -Port $Config.LocalTool.Port -TimeoutSec 25) {
        Write-Log "  ✅ LocalTool 已启动 (PID=$($script:LocalToolPid)，日志: localTool\logs\localtool_18080_YYYY-MM-DD.log，自动轮转)" "Success"
        return $true
    }
    Write-Log "  ❌ LocalTool 启动超时 (PID=$($script:LocalToolPid))，请查看 localTool\logs\ 下当日日志" "Error"
    # 启动失败：立刻清掉半死的进程，避免它占着端口干扰后续重试
    Stop-ProcessTree -ProcessId $script:LocalToolPid
    $script:LocalToolPid = 0
    return $false
}

# ── 🛑 停止全部服务（杀进程树 + 兜底清端口 + 释放单实例）──
function Stop-AllServices {
    Write-Log "正在停止全部服务..." "Warn"

    # 1) 按记录的 PID 杀整棵进程树（连带 npm/tsx 等子进程，不留孤儿）
    if ($script:LocalToolPid -gt 0) {
        Write-Log "  🛑 结束服务进程树 (PID=$($script:LocalToolPid))" "Warn"
        Stop-ProcessTree -ProcessId $script:LocalToolPid
        $script:LocalToolPid = 0
    }

    # 2) 兜底：清掉仍占用端口的进程（例如上一次崩溃遗留、PID 已失效的情况）
    $connections = Get-NetTCPConnection -LocalPort $Config.LocalTool.Port -ErrorAction SilentlyContinue
    if ($connections) {
        $connections.OwningProcess | Sort-Object -Unique | ForEach-Object {
            Stop-ProcessTree -ProcessId $_
        }
    }

    Release-SingleInstance
    Write-Log "✅ 已停止全部服务" "Success"
}

# ── 💬 临时气泡提示（用完即毁，不常驻托盘）──
function Show-Notice {
    param([string]$Text, [string]$Title = "猫猫AI画布", [int]$Seconds = 5)
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $n = New-Object System.Windows.Forms.NotifyIcon
        $icoPath = Join-Path $ScriptDir "maomao.ico"
        if (Test-Path $icoPath) { $n.Icon = New-Object System.Drawing.Icon($icoPath) }
        $n.Visible = $true
        $n.ShowBalloonTip($Seconds * 1000, $Title, $Text, [System.Windows.Forms.ToolTipIcon]::Info)
        Start-Sleep -Seconds $Seconds
        $n.Dispose()
    } catch { }
}

# ── 🐱 系统托盘常驻（右下角图标，右键菜单：打开画布/重启/日志/退出）──
function Start-TrayDaemon {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    # 单实例：已有实例在跑时提示并退出，而不是开两个抢端口
    if (-not (Acquire-SingleInstance)) {
        Write-Log "⚠️ 检测到已有实例在运行，本次启动退出。" "Warn"
        Show-Notice -Text "猫猫画布已在运行中（见右下角托盘图标）" -Seconds 4
        exit 0
    }

    Write-Log "📡 正在启动服务..." "Info"
    $null = Start-LocalTool
    Open-Canvas

    # 图标：直接读磁盘上的 maomao.ico（新鲜、不受 shell icon cache 影响）。
    # 原先优先 ExtractAssociatedIcon(exe) 会命中 Windows 图标缓存 → 看到旧图标。
    # 只有当 maomao.ico 缺失时才回退到 exe 自身的图标（保底）。
    $trayIcon = $null
    $icoPath = Join-Path $ScriptDir "maomao.ico"
    if (Test-Path $icoPath) {
        try { $trayIcon = New-Object System.Drawing.Icon($icoPath) } catch { }
    }
    if ($null -eq $trayIcon) {
        try {
            $selfExe = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
            $trayIcon = [System.Drawing.Icon]::ExtractAssociatedIcon($selfExe)
        } catch { }
    }

    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = $trayIcon
    $notify.Text = "猫猫AI画布 — 运行中 (:18080)"
    $notify.Visible = $true

    # ── 右键菜单 ──
    $menu = New-Object System.Windows.Forms.ContextMenuStrip

    $miOpen = New-Object System.Windows.Forms.ToolStripMenuItem("打开画布")
    $miOpen.Font = New-Object System.Drawing.Font($miOpen.Font, [System.Drawing.FontStyle]::Bold)
    $miOpen.Add_Click({ Open-Canvas })
    $null = $menu.Items.Add($miOpen)

    $miRestart = New-Object System.Windows.Forms.ToolStripMenuItem("重启服务")
    $miRestart.Add_Click({
        Write-Log "🔄 手动重启服务..." "Warn"
        Stop-ProcessTree -ProcessId $script:LocalToolPid
        $script:LocalToolPid = 0
        Clear-Port -Port $Config.LocalTool.Port

        if (Start-LocalTool) {
            # 手动重启成功：恢复自动巡检（此前可能因连续失败被停掉）
            $script:FailCount = 0
            if ($script:HealthTimer) { $script:HealthTimer.Start() }
            if ($script:NotifyIcon) {
                $script:NotifyIcon.Text = "猫猫AI画布 — 运行中 (:18080)"
                $script:NotifyIcon.ShowBalloonTip(3000, "猫猫AI画布", "服务已重启", [System.Windows.Forms.ToolTipIcon]::Info)
            }
        } else {
            if ($script:NotifyIcon) {
                $script:NotifyIcon.ShowBalloonTip(6000, "猫猫AI画布", "重启失败，请打开日志目录排查。", [System.Windows.Forms.ToolTipIcon]::Error)
            }
        }
    })
    $null = $menu.Items.Add($miRestart)

    # ── 🛠️ 构建子菜单：构建前端 / 构建后端（静默后台构建，完成气泡提示，不弹 cmd 窗口）──
    $miBuild = New-Object System.Windows.Forms.ToolStripMenuItem("构建")
    $miBuild.Font = New-Object System.Drawing.Font($miBuild.Font, [System.Drawing.FontStyle]::Bold)

    $miBuildFe = New-Object System.Windows.Forms.ToolStripMenuItem("构建前端")
    $miBuildFe.Add_Click({
        if ($script:BuildBusy) {
            if ($script:NotifyIcon) { $script:NotifyIcon.ShowBalloonTip(3000, "猫猫画布", "已有构建正在进行，请稍候。", [System.Windows.Forms.ToolTipIcon]::Info) }
            return
        }
        Invoke-SilentBuild -titleKey "前端" -WorkDir $ProjectRoot -NpmArgs "run build"
    })
    $null = $miBuild.DropDownItems.Add($miBuildFe)

    $miBuildTool = New-Object System.Windows.Forms.ToolStripMenuItem("构建后端 (localTool)")
    $miBuildTool.Add_Click({
        if ($script:BuildBusy) {
            if ($script:NotifyIcon) { $script:NotifyIcon.ShowBalloonTip(3000, "猫猫画布", "已有构建正在进行，请稍候。", [System.Windows.Forms.ToolTipIcon]::Info) }
            return
        }
        # 构建后端：完成后需重启服务才能加载新代码
        Invoke-SilentBuild -titleKey "后端" -WorkDir (Join-Path $ProjectRoot $Config.LocalTool.Dir) -NpmArgs "run build"
    })
    $null = $miBuild.DropDownItems.Add($miBuildTool)

    $null = $menu.Items.Add($miBuild)

    $miLog = New-Object System.Windows.Forms.ToolStripMenuItem("打开日志目录")
    $miLog.Add_Click({
        $d = Join-Path $ProjectRoot "logs"
        if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
        Start-Process explorer.exe -ArgumentList $d
    })
    $null = $menu.Items.Add($miLog)

    $null = $menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

    $miExit = New-Object System.Windows.Forms.ToolStripMenuItem("退出")
    $miExit.Add_Click({
        Write-Log "👋 通过托盘菜单退出，正在清理..." "Warn"
        # 只触发退出；清理动作统一交给下面的 finally，避免 Stop-AllServices 被重复执行
        [System.Windows.Forms.Application]::Exit()
    })
    $null = $menu.Items.Add($miExit)

    $notify.ContextMenuStrip = $menu
    $notify.Add_DoubleClick({ Open-Canvas })

    # 事件处理器（定时器/菜单回调）在独立作用域执行，用 script 级变量确保可靠访问
    $script:NotifyIcon  = $notify
    $script:HealthTimer = $timer = New-Object System.Windows.Forms.Timer

    # ── 健康检查 + 掉线自动重启（带退避上限）──
    # 定时器替代 while 循环，避免阻塞 UI 线程。
    # 连续失败达上限即停止重试并报警：node 若因编译/配置错误根本起不来，
    # 无限重试只会每 5 秒刷日志、反复 spawn 僵尸进程，而你毫无感知。
    $timer.Interval = 5000
    $timer.Add_Tick({
        if (-not (Test-PortStatus -Port $Config.LocalTool.Port -Name $Config.LocalTool.Name -Quiet)) {
            $script:FailCount++
            Write-Log "  ⚠️ $(Get-Date -Format 'HH:mm:ss') 本地工具掉线，正在重启（连续失败 $($script:FailCount)/$($script:MaxAutoRestart)）..." "Warn"

            if (Start-LocalTool) {
                $script:FailCount = 0        # 恢复即归零，偶发抖动可无限次自愈
                Write-Log "  ✅ 服务已恢复" "Success"
            } elseif ($script:FailCount -ge $script:MaxAutoRestart) {
                $script:HealthTimer.Stop()
                Write-Log "  🛑 连续 $($script:MaxAutoRestart) 次启动失败，已停止自动重试。请排查后右键图标→重启服务。" "Error"
                if ($script:NotifyIcon) {
                    $script:NotifyIcon.Text = "猫猫AI画布 — 服务异常，已停止自动重启"
                    $script:NotifyIcon.ShowBalloonTip(10000, "猫猫AI画布",
                        "服务连续启动失败，已停止自动重启。请右键图标→打开日志目录排查，或→重启服务。",
                        [System.Windows.Forms.ToolTipIcon]::Error)
                }
            }
        }
    })
    $timer.Start()

    Write-Log "🐱 已常驻系统托盘 (右下角)，右键图标可打开画布 / 重启 / 退出" "Success"
    Write-Log "   🔒 本实例 PID=$PID" "Dim"

    try {
        [System.Windows.Forms.Application]::Run((New-Object System.Windows.Forms.ApplicationContext))
    } finally {
        $timer.Stop()
        $timer.Dispose()
        $notify.Visible = $false
        $notify.Dispose()
        $menu.Dispose()
        Stop-AllServices
    }
}

# ── 入口 ──
# 统一为系统托盘形态：右键图标可 打开画布 / 重启服务 / 打开日志目录 / 退出。
# 静默模式（打包成 exe 时由 build-exe.ps1 注入 $global:MaomaoSilent）：日志写文件，零弹窗零窗口。
# 直接运行本 ps1 时：日志打印到控制台，行为完全一致，便于调试。
Start-TrayDaemon