# Windows 猫猫画布工具 — 快速排查手册（交接）

> 目的：万一哪天 Windows 工具（托盘 exe / launch-all.ps1）出问题，按本文 3 分钟内定位到原因。
> 本文同时收录 2026-09-06 对 Windows 与 Mac 菜单栏工具的改动要点，方便还原现场。

---

## 0. 一图看懂「各部件 & 日志在哪」

```
猫猫画布.exe（托盘守护，常驻右下角）
   │   ├─ 单实例锁：命名 Mutex「MaomaoCanvas_SingleInstance」（系统级，崩溃自动释放）
   │   ├─ 拉起 node 进程 = localTool 后端（:18080，托管 dist/ 前端 + API）
   │   └─ 监听：服务掉线自动重启（连续失败 3 次才停）
   │
日志文件（全部在项目根）：
   ├─ logs\launcher.log            ← 托盘/守护自身日志（最关键！）
   ├─ logs\build_前端.log          ← 点「构建前端」的输出
   ├─ logs\build_后端.log          ← 点「构建后端」的输出
   ├─ localTool\logs\localtool_18080_YYYY-MM-DD.log  ← 后端 node 运行日志（按天轮转）
   └─ 后端错误：多半已并入上述运行日志（后端内 logWriter 接管）
```

**排查第一步永远是：先看 `logs\launcher.log` 最后 30 行。** 托盘一切动作（启动/构建/重启/报错）都会写它。

---

## 1. 最常见的 5 个问题 & 秒查答案

| 现象 | 最可能原因 | 快速定位 |
|------|-----------|---------|
| 启动闪 CMD 黑框 | 旧 exe 未重新打包 / 或走了旧 `npm.cmd` 路径 | 见 §2.1 |
| 托盘构建点了没反应/不弹气泡 | 构建在后台跑或已失败，看日志 | 见 §3 |
| 服务起不来、一直重启 | node 缺依赖 / 编译失败 / 端口被占 | 见 §4 |
| 端口 18080 被别的程序占 | 别的服务占用 | `netstat -ano \| findstr 18080` |
| 双击 exe 无任何反应 | 单实例 Mutex 被残留占用 / 打包损坏 | 见 §5 |

---

## 2. 启动 / 打包

### 2.1 我改了什么（2026-09-06）
- **消除启动 & 构建时的 CMD 黑框**：不再直接调 `npm`（`npm.cmd` 会触发 cmd 窗口），
  改为用 `node` 直接执行 `npm-cli.js`（新增函数 `Get-NpmCliPath` / `Invoke-Npm`）。
- **托盘「构建」改为静默后台**：新增 `Invoke-SilentBuild` / `Start-BuildPollTimer` /
  `Start-RestartServiceSilently`。构建不弹窗、日志写 `logs\build_*.log`、完成后托盘气泡提示，
  构建后端成功自动重启服务。旧的 `Invoke-BuildWindow`（弹 cmd 窗口版）已删除。
- **所有跨事件回调状态统一放 `$script:` 级变量**（`BuildBusy/BuildProc/BuildOutBuf/...`），
  避免 PowerShell 事件闭包取不到局部变量的坑。

**如果你看到仍然闪黑框** → 很可能跑的是旧 exe，**重新打包**：
```powershell
cd packaging\windows
powershell -ExecutionPolicy Bypass -File .\build-exe.ps1
```
再双击 `猫猫画布.exe` 验证。

### 2.2 打包工具链
- `build-exe.ps1` 依赖模块 `ps2exe`（首次会自动装）。装失败常见原因：公司网络/代理挡了 NuGet 或 PSGallery。
  - 代理相关：先确保能连 `powershellgallery.com`。
  - 手动装：`Install-Module ps2exe -Scope CurrentUser -Force`
- 打包要求 exe 未被占用：脚本会先 `Stop-Process` 掉正在跑的旧 exe。若仍报"权限拒绝"，可能是托盘还在，手动右键退出后再打。

### 2.3 如果 `Get-NpmCliPath` 找不到 npm-cli.js
- 现象：launcher.log 里出现 `无法定位 npm-cli.js` 或 `找不到 npm`。
- 检查：`npm -v` / `node -v` 在 cmd 里是否正常；Node 是否装了并加进 `PATH`。
- Node 默认装在 `C:\Program Files\nodejs\`，npm-cli.js 在 `<node>\node_modules\npm\bin\npm-cli.js`。
- 脚本会从 `Get-Command npm` 反推该路径；若自定义安装或走 nvm-windows，可能推不准 → 见 §6 增强建议。

---

## 3. 托盘「构建前端 / 构建后端」排查

流程：点菜单 → `Invoke-SilentBuild` → 起 node 后台跑 `npm run build` → 写 `logs\build_<key>.log` → 完成气泡。

| 现象 | 查哪里 |
|------|--------|
| 点了没反应、托盘无变化 | `logs\launcher.log` 看是否 `BuildBusy` 卡住（上次构建没结束） |
| 气泡说"构建成功"但想确认产物 | 看 `logs\build_前端.log` 尾部是否有 `✓ built`；`dist\` 时间戳是否更新 |
| 气泡说"构建失败" | 打开 `logs\build_后端.log` 看报错（tsc/esbuild/vite 错误会写全） |
| 构建后端成功后服务没重启 | 看 launcher.log 是否有 `自动重启服务` 及报错；服务重启气泡是否出现 |

**构建日志被覆盖？** 每次构建会用本次输出**覆盖**该 key 的日志（`logs\build_前端.log` 恒为最后一次）。
历史想看可用托盘「打开日志目录」或 localTool 自带日志。

**改完代码想立即生效的后端流程**：点「构建后端」→ 成功后**自动重启**服务加载新代码，无需手动重启。
前端（原型）是 localTool 托管 `dist/`，构建前端后刷新浏览器即可，**无需重启服务**。

---

## 4. localTool 后端（:18080）排查

### 4.1 端口 / 进程
```powershell
netstat -ano | findstr 18080          # 谁在听 18080
tasklist | findstr node               # 所有 node 进程
```
- 托盘正常时，`netstat` 应能看到一个 `node` 进程 LISTENING 18080。
- 若被无关进程占用：托盘「退出」后手动 `taskkill /PID <pid> /T /F`，再启动。

### 4.2 后端日志
- 后端 node 运行日志：`localTool\logs\localtool_18080_YYYY-MM-DD.log`（logWriter 按天轮转、自动删 7 天前）。
- 起不来 / 编译失败时的报错会出现在 `logs\launcher.log` 或该运行日志。

### 4.3 常见：一直"自动重启中"
托盘有健康检查：服务掉线每 5 秒尝试重启，**连续失败 3 次会停止并弹气泡**（防止无限刷）。
若遇到该气泡：
1. 打开 `logs\launcher.log` 看最后几次启动失败原因（多半是 build 或依赖）。
2. 修好后右键托盘「重启服务」恢复自动巡检。
3. 常见诱因：`node_modules` 缺失 → 首次会静默 `npm install`；`src/*.ts` 比 `dist\index.js` 新 → 会先静默 build。

---

## 5. 单实例 / 无反应排查

- 机制：系统命名 Mutex「MaomaoCanvas_SingleInstance」。崩溃/断电由 OS 自动释放，理论上不会残留。
- 现象：双击 exe 无反应，但托盘也没有 → 可能已有实例在跑（右下角仔细看），或刚退出图标还在淡出。
- 强制清理：
  ```powershell
  # 找并结束所有猫猫画布 / launch 相关进程
  taskkill /IM 猫猫画布.exe /F 2>nul
  taskkill /IM node.exe /F 2>nul     # 谨慎：会杀掉机器上所有 node
  ```
- 确认无残留 Mutex：重开电脑最干净；或确认没有任何相关进程后重试。

---

## 5.5 退出会不会留孤儿 node？（Windows 已安全，别照搬 Mac 的修法）

**背景**：2026-09-06 在 Mac 上发现一个真 bug——Mac 菜单栏工具退出时只杀了 `npm`，没杀它拉起的 `node` 孙进程，导致 node 变孤儿继续占 18080。
**结论：Windows 没有这个问题，机制更安全，无需照 Mac 改。**

Windows 为何安全（三重保障）：
1. **无 npm 中间层**：`Start-LocalTool` 用 `Start-Process node dist\index.js` **直接跑 node**，
   `LocalToolPid` 就是真正的后端进程，不是 npm。
2. **正常退出清整树**：`Stop-ProcessTree` = `taskkill /PID <pid> /T /F`，`/T` 连带杀整棵子进程树，
   等价于 Mac 后来加的 `killProcessTree`，Windows 本来就内置。
3. **崩溃/强杀内核兜底**：node 加入 **Job Object**（`KILL_ON_JOB_CLOSE`）——托盘 exe 无论怎么死
   （正常/崩溃/被任务管理器结束），Windows 内核都会自动回收 Job 内所有 node。这是 Mac 没有的。

**所以 Windows 上：点「退出」会清干净；托盘 exe 被强杀，node 也会被系统回收。不用处理。**

**明天要留意/可复核的点**：若哪天发现 18080 仍被占，按 §4.1 用 `netstat` 查；清理用 §5 的命令。

---

## 6. 如果我改坏了脚本 / 想还原

所有改动集中在 **`packaging/windows/launch-all.ps1`**，其余文件（build-exe/refresh-icon/ico）基本没动。
- 版本管理：git 可看该文件历史；改动点见 §2.1。
- 逻辑主线（可对照还原）：
  1. `Start-TrayDaemon`：单实例 → 起服务 → 开画布 → 常驻托盘 → 健康自愈 → finally 清理。
  2. 启动时：`Ensure-NodeEnvironment`（缺依赖 install、源码新则 build）→ `Start-LocalTool`。
  3. 构建：菜单 → `Invoke-SilentBuild`（node 直跑 npm，后台）→ 气泡 + 后端成功自动重启。
- 若怀疑我新增的后台构建逻辑有 bug，可临时把托盘「构建」菜单改回直接调 `npm run build`（会弹窗口但能看输出），排查完再改回。

---

## 7. 附：Mac 侧同批改动（供对照，防串台）

同一天在 `packaging/mac/menubar/main.swift` 也做了加固，若在 Mac 端排查可参考：
- **build.sh 加了自动重签** `codesign --force --deep --sign - --identifier "com.maomao.launcher"`。
  ⚠️ 若没重签，`UNUserNotificationCenter` 请求授权会静默失败（系统日志 `hasError: 1`），通知不显示。
- **单实例改成 flock 文件锁**（`/tmp/maomao_launcher.lock`，原子互斥，崩溃自动释放），替换旧的 PID 探测。
- **菜单栏图标旁有状态文字**：编译中/失败✗/后端崩溃⚠，不再只靠系统通知。
- **「查看日志」** 改为优先打开有内容的 `localtool_18080.log`（旧版打开空 err.log 会没反应）。
- **退出孤儿进程修复（重点，2026-09-06）**：原 `stopBackend` 只杀 npm（`launcher→npm→node` 中间层），
  node 孙进程会变孤儿继续占 18080（实测父进程变 launchd）。已新增 `killProcessTree`（用 `pgrep -P`
  递归收后代、先杀叶再杀根），应用到 `stopBackend`/`restartBackend`/`killPort`。修复后点退出实测
  launcher/npm/node 全清、18080 完全释放。**注意：Mac 没有 Windows 的 Job Object 内核兜底，launcher
  被 `kill -9`/崩溃时 node 仍可能残留，靠下次启动前 `killPort` 自愈（不堆积）。**
- 排查 Mac 后端：`localTool/localtool_18080.log`；菜单栏工具构建日志：`.maomao_frontend_build.log`、`.maomao_backend_build.log`（项目根/隐藏文件）。
- Mac 通知被"勿扰/专注模式"抑制是系统行为，非代码 bug（系统日志 `outcome: suppressed; reason: mode configuration type`），关专注模式即可。

---

*本手册 2026-09-06 生成（同日补充 §5.5 退出孤儿清理说明、§7 Mac 进程树修复记录）。
排查顺序建议：日志（launcher.log / build_*.log）→ 端口（netstat）→ 进程（tasklist）→ 本文各节。*
