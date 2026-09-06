# Windows — 让画布走 PWA（独立应用）操作说明

> 目标：把 `http://127.0.0.1:18080` 装成 **Windows 独立应用（PWA）**，
> 不再每次开一堆浏览器标签。本文是你明天在 Windows 电脑上的操作步骤。
>
> 适用：Windows + Chrome / Edge + 本项目 `launch-all.ps1` 托盘工具。

---

## 一、先装 PWA（一次即可）

### 用 Chrome 装
1. 先启动服务并打开画布：
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\packaging\windows\launch-all.ps1
   ```
   （若已打成 exe，直接双击 `packaging\windows\猫猫画布.exe` 即可，会自动起 18080）
2. 浏览器打开 `http://127.0.0.1:18080`。
3. 点 Chrome 右上角「⋮」→ **「安装 猫猫画布…」**（或地址栏右侧出现的「安装」图标）。
4. 弹窗点「安装」。完成后 Chrome 会开一个**独立窗口**，且开始菜单/桌面会出现「猫猫画布」应用。

### 用 Edge 装（如果默认浏览器是 Edge）
1. 打开 `http://127.0.0.1:18080`。
2. 点右上角「⋮」→ **「应用」→「将此站点作为应用安装」**。
3. 点「安装」。

> 装好后，浏览器里那个普通标签可以关掉。以后直接点开始菜单里的「猫猫画布」进。

---

## 二、关键：Windows 的 PWA 没有「命令行自动唤醒」

这点和 Mac 不同，请知悉：
- **Mac**：我们的菜单栏工具可以直接 `open` 磁盘上的 PWA `.app`（已实现）。
- **Windows**：Chrome/Edge 的 PWA 没有稳定可编程的唤醒命令。
  `Start-Process http://127.0.0.1:18080` 只会走默认浏览器开「普通标签」，**不会**唤醒已装的 PWA。

所以 Windows 上「每次点托盘想进 PWA」没法像 Mac 那样自动判定，需要你用下面**方案 A 或 B** 之一。

---

## 三、两种可用做法（选一种）

### ✅ 方案 A（推荐）：Chrome 用 `--app=` 直接开独立窗口（不堆标签）
Chrome 支持 **app 模式**命令行：用它打开 `http://127.0.0.1:18080` 会得到**独立窗口（无地址栏/标签栏）**，观感等同 PWA，且不占用普通标签页。这是 Windows 上最可靠、跨机器可复现的写法：

```powershell
# 注意：--app= 参数要作为 chrome.exe 的参数传，不能用 Start-Process 直接甩 URL
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" }
Start-Process $chrome -ArgumentList "--app=http://127.0.0.1:18080"
```

> 若你已装正式 PWA 且希望唤醒「那个已装的应用」，见下方「补充：拉起已装 PWA」。两选一即可。

### 补充：拉起「已安装的 PWA」（若你希望它命中已装实例）
Chrome 把每个已装 PWA 建成独立启动器，藏在 User Data 下的 Web Applications 目录，名称是随机 id，但可通过它含的 URL 精确识别。运行下面这段会自动找出「猫猫画布」PWA 的 exe 路径：

```powershell
# 扫描 Chrome 安装的 PWA，找到指向 18080 的那个并打印其 exe 路径
$roots = @(
  "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Web Applications",
  "$env:LOCALAPPDATA\Google\Chrome\User Data\*\Web Applications"
)
foreach ($r in $roots) {
  Get-ChildItem $r -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $manifest = Join-Path $_.FullName "manifest.json"
    if (Test-Path $manifest) {
      $txt = Get-Content $manifest -Raw
      if ($txt -match "127.0.0.1:18080") {
        # 找到后，其下的 .exe 或 _crx/… 就是启动器
        Get-ChildItem $_.FullName -Recurse -Filter *.exe -ErrorAction SilentlyContinue |
          Select-Object -First 1 -ExpandProperty FullName
      }
    }
  }
}
```
把打印出的完整路径存到一个变量，就能用 `Start-Process "<该路径>"` 拉起已装 PWA。
> ⚠️ 该路径含随机目录名，不同机器不同；建议第一次跑出路径后，把它写进 `launch-all.ps1` 里 `Open-Canvas` 函数作为一个常量（见第四节示例）。

### ✅ 方案 B：纯手动，最干净
1. 托盘工具照常起服务（右下角图标在即可，不用它开页面）。
2. 进画布：一律点**开始菜单或桌面的「猫猫画布」PWA 图标**。
3. 这样永远只有一个独立窗口，不堆标签。

---

## 四、让托盘「打开画布」走 PWA 独立窗口（改写 Open-Canvas）

`launch-all.ps1` 里画布打开统一由函数 `Open-Canvas` 处理（启动时 + 托盘菜单/双击都会调它）。把它的实现改成「用 Chrome app 模式开独立窗口」即可全局生效。

编辑 `packaging\windows\launch-all.ps1`，把 `Open-Canvas` 函数体替换为：

```powershell
function Open-Canvas {
    # 用 Chrome app 模式开独立窗口（无地址栏/标签栏，等同 PWA 观感，不堆标签）
    $chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $chrome)) { $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" }
    if (Test-Path $chrome) {
        $url = "http://127.0.0.1:$($Config.LocalTool.Port)"
        Write-Log "  🌐 用 Chrome app 窗口打开画布 $url" "Info"
        Start-Process $chrome -ArgumentList "--app=$url"
    } else {
        # Chrome 找不到时退回默认浏览器开普通标签（保底）
        Write-Log "  ⚠️ 未找到 Chrome，退回默认浏览器打开 $url" "Warn"
        Start-Process $url
    }
}
```

若你已按上面「补充」拿到**已装 PWA 的 exe 路径**，想唤醒那个正式实例，则把 `Start-Process $chrome ...` 换成一启动已装 PWA：
```powershell
# 把 <已装PWA路径> 换成实际跑出的完整路径，含引号
Start-Process "<已装PWA路径>"
```
并在函数开头加上已装 PWA 路径存在才用、否则走 `--app=` 的兜底判断。

### 若你只想「启动时不开、手动点」
把 `Start-TrayDaemon` 里那行 `Open-Canvas` 删掉/注释掉即可（托盘菜单仍可点）。

> ⚠️ 改完如需用 exe，重新打包：
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\packaging\windows\build-exe.ps1
> ```

---

## 五、Windows 常见问题
- **装了 PWA 但点开后空白**：确认 18080 服务在跑（托盘图标在 / `netstat -ano | findstr 18080` 有监听）。
- **想卸载 PWA**：开始菜单/设置 → 应用 → 找到「猫猫画布」卸载，不影响项目本身。
- **换图标**：PWA 图标由网页 `manifest.webmanifest` 决定，改 `public/manifest.webmanifest` + `public/icon-*.png` 后重装 PWA。

---
*本说明 2026-09-06 由 Mac 侧同步编写，Windows 端路径均为相对 packaging/windows。*
