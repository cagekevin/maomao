# Windows 打包说明（猫猫画布）

> 覆盖打包：把一键启动器 `launch-all.ps1` 打包成**无控制台、常驻系统托盘的 `exe`**（推荐形态）。

## 产物是什么

`packaging/windows/build-exe.ps1` 用 `ps2exe` 把 `launch-all.ps1` 编成
`packaging/windows/猫猫画布.exe`（无控制台、静默、嵌猫猫图标）。
- 双击后：静默拉起 localTool(:18080) → 打开画布 → **常驻右下角托盘**（无任何窗口/黑框）。
- 右键托盘菜单：打开画布 / 构建前端 / 构建后端(localTool) / 重启服务 / 打开日志目录 / 退出。
- 单实例：命名 Mutex「MaomaoCanvas_SingleInstance」（系统级，崩溃自动释放，绝无重复实例）。
- 健康自愈：服务掉线每 5 秒尝试重启，连续失败 3 次停止并气泡报警（防止无限刷）。
- 构建为**静默后台**（不弹 cmd 黑框），日志写 `logs\build_<key>.log`，完成托盘气泡提示；
  构建后端成功**自动重启服务**加载新代码。

## 一键打包（在 Windows 上运行）

```powershell
cd packaging\windows
powershell -ExecutionPolicy Bypass -File .\build-exe.ps1
```

产出 `packaging\windows\猫猫画布.exe`。先结束正在运行的旧 exe 再重打（脚本会自动做），
若报"文件被占用/权限拒绝"，手动右键托盘退出后再打。

## 两种使用方式（按需选）

| 方式 | 命令 | 特点 |
|------|------|------|
| **打包 exe（推荐日常）** | 见上 build-exe.ps1 | 静默托盘、无窗口、图标常驻 |
| **直接跑 ps1（调试）** | `powershell -ExecutionPolicy Bypass -File .\packaging\windows\launch-all.ps1` | 日志打到控制台，便于看过程；行为与 exe 一致 |

> 提示：直接跑 ps1 时 `npm install`/`npm run build` 已改为 `node` 直跑，不弹 cmd 窗口；
> 但 ps1 自身在控制台里会打印彩色日志，这是"调试态"预期行为。

## 文件清单

```
packaging/windows/
├── launch-all.ps1      ← 主逻辑（唯一需要手改的）
├── build-exe.ps1       ← 打包脚本：注入静默标志 + ps2exe 编 exe
├── refresh-icon.ps1    ← 换图标后若系统仍显示旧图标，跑它刷新缓存
├── maomao.ico          ← 托盘/打包用图标（真源，勿删）
├── PACKAGING.md        ← 本文档
└── TROUBLESHOOTING.md  ← 排查手册（出问题先看它）
```

## 打包工具链（ps2exe）

- `build-exe.ps1` 首次会**自动安装 ps2exe**（从 PowerShell Gallery）。
- 若自动安装失败（常见：代理/网络挡了 PSGallery）：
  ```powershell
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Install-PackageProvider -Name NuGet -Force -Scope CurrentUser
  Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
  Install-Module -Name ps2exe -Scope CurrentUser -Force
  ```
- 打包参数要点（脚本已内置）：`-noConsole`（无控制台）+ `-STA`（NotifyIcon 托盘必需）
  + `-icon maomao.ico`。脚本还会在 ps1 前注入 `$global:MaomaoSilent=$true`
  使日志改走 `logs\launcher.log`（否则 GUI exe 会把每行输出弹成 MessageBox）。

## 前置条件（Windows）

- Windows 10/11；PowerShell 5.1+（自带）。
- Node.js + npm 已安装并加进 `PATH`（脚本用 `node` 直跑 npm-cli.js，找不到会报"无法定位 npm-cli.js"）。
- 首次运行如需 `npm install` 会静默执行（较慢属正常）。
- 图标：`maomao.ico`；若改图标，改完跑 `refresh-icon.ps1` 清缓存，或给 exe 换个文件名。

## 常见问题（速查）

| 现象 | 处理 |
|------|------|
| 双击 exe 无反应 | 看 `logs\launcher.log`；多半已有实例在跑（托盘在）或打包失败 |
| 启动/构建仍闪 CMD 黑框 | **多半是旧 exe** → 重跑 build-exe.ps1；新版已用 node 直跑消除黑框 |
| 找不到 npm / 无法定位 npm-cli.js | 确认 node/npm 在 PATH：cmd 里 `node -v`、`npm -v` |
| 服务一直"自动重启中"气泡 | 打开日志看启动失败原因（依赖缺失/编译错/端口被占），修好右键「重启服务」 |
| 端口 18080 被占 | `netstat -ano \| findstr 18080` → `taskkill /PID <pid> /T /F` |

> 更细的排查见 `packaging/windows/TROUBLESHOOTING.md`。

## 收尾建议：改完代码想重新发布

1. 改 `launch-all.ps1`（若有逻辑调整）。
2. Windows 上重打：`powershell -ExecutionPolicy Bypass -File .\build-exe.ps1`。
3. 把新的 `猫猫画布.exe` 分发到目标机；连同仓库一起更新（ps1 入 git，exe 可选分发）。
