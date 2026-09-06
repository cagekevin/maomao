# packaging/ — 打包 / 启动 / 常驻工具统一目录

> 目的：把散在项目根与 `scripts/` 的「各平台启动器、exe/App 打包器、菜单栏常驻工具」归拢到一个地方，
> 避免项目根被一堆 `.ps1`/`.command`/`.ico` 弄乱。
>
> **注意**：PWA 相关文件（`public/manifest.webmanifest`、`public/icon-*.png`、`index.html` 的 `<link rel=manifest>`）
> 因必须被 `http://127.0.0.1:18080` 直接访问，**只能留在 `public/`**（经 Vite 拷进 `dist/`），不在本目录。
> 本目录只放「构建 / 启动 / 常驻进程」类脚本与源码。

## 结构

```
packaging/
├── README.md                 ← 本文件
├── windows/                  ← Windows (PowerShell) 打包/启动
│   ├── launch-all.ps1        ← 一键启动：起 localTool(:18080) + 系统托盘常驻 + 右键菜单
│   ├── build-exe.ps1         ← 把 launch-all.ps1 编成无控制台 exe（静默托盘版）
│   ├── refresh-icon.ps1      ← 刷新 Windows 图标缓存（换图标后视需要跑）
│   ├── maomao.ico            ← 托盘/打包用图标（Windows 侧真源）
│   ├── PACKAGING.md          ← 【打包说明】（Windows 侧）
│   └── TROUBLESHOOTING.md    ← 【快速排查手册】
└── mac/                      ← macOS 启动/打包
    ├── launch-all.command    ← 一键启动：起 localTool(:18080) + 打开画布 + 守护自动重启
    ├── PACKAGING.md          ← 【打包说明】（Mac 侧）
    └── menubar/              ← 猫猫画布 菜单栏常驻工具（原生 Swift，纯菜单栏形态）
        ├── main.swift        ← 主源码
        ├── build.sh          ← 一键编译 → 自建/装进项目根 猫猫画布.app → 重签 → 清隔离标记
        └── assets/           ← 打包资源（app.icns / menubar.png，已入 git，可复现重建 .app）
```

> 打包步骤：见 `windows/PACKAGING.md`、`mac/PACKAGING.md`。
> 出问题先看 `windows/TROUBLESHOOTING.md`。

## ⚠️ 路径约定（所有脚本已改为「基于项目根」）

脚本收拢到本目录后，**自身所在目录 ≠ 项目根**。因此每个脚本内部都做了「项目根定位」：
脚本通过自身相对位置向上推出项目根（`packaging/windows` 与 `packaging/mac` 均上两级即项目根），
再以项目根为基准访问 `localTool/`、`dist/`、`logs/` 等。
唯一例外：Windows 托盘/打包图标 `maomao.ico` 与脚本**同目录**（`$ScriptDir`），已彻底收拢在 `packaging/windows/`。
**请勿再把这些脚本当项目根放回根目录，也勿改动路径推算层级。**

## 各端用法

### macOS — launch-all.command（zsh）
```bash
# 先开 VPN（连 lgw.lovart.ai 需代理）
/path/to/maomao/packaging/mac/launch-all.command
# 或 cd 到 packaging/mac 后 ./launch-all.command
```
行为：清理 18080 旧进程 → 起 localTool（源码更新才重编译）→ 打开画布 → 守护轮询自动重启。Ctrl+C 退出并清端口。

### macOS — 猫猫画布菜单栏工具（Swift，常用）
- 源码：`packaging/mac/menubar/main.swift`
- 成品：项目根 `猫猫画布.app`（**纯菜单栏形态**：LSUIElement/accessory，无 Dock 图标、不进 Cmd+Tab，
  只在顶部菜单栏显示猫猫图标；后端崩则图标变灰 + 菜单栏 ⚠）
- 改代码后一键打包（.app 缺失会自动从 assets 重建，无需预置）：
  ```bash
  cd packaging/mac/menubar && ./build.sh
  ```
- 打包细节：见 `packaging/mac/PACKAGING.md`。

### Windows — 一键启动 / 打包 exe（PowerShell）
```powershell
# 一键启动（控制台调试 / 直接运行）
powershell -ExecutionPolicy Bypass -File .\packaging\windows\launch-all.ps1

# 打包成无控制台 exe（托盘常驻）→ 产出 packaging/windows/猫猫画布.exe
powershell -ExecutionPolicy Bypass -File .\packaging\windows\build-exe.ps1

# 换图标后若系统仍显示旧图标
powershell -ExecutionPolicy Bypass -File .\packaging\windows\refresh-icon.ps1
```

## 迁移记录
- 2026-09-06：由项目根迁入本目录并完成「项目根路径」改造：
  - `launch-all.ps1`（根→windows）、`build-exe.ps1`（根→windows）、`refresh-icon.ps1`（根→windows）、`maomao.ico`（根→windows）
  - `launch-all.command`（根→mac）、`main.swift`（`scripts/maomao-menubar`→mac/menubar）
  - 根目录 `launch-all.ps1/build-exe.ps1/refresh-icon.ps1/maomao.ico/launch-all.command` 均已删除。
  - **Windows 托盘/打包图标彻底统一到 `packaging/windows/maomao.ico`**（launch-all.ps1 与 build-exe.ps1 均读 `$ScriptDir/maomao.ico`）；项目根 `maomao.ico` 已删除。
  - ⚠️ `public/maomao.ico` 是 **Chrome 扩展**用图标，独立保留，**勿删、勿与 packaging/windows 混淆**。
  - 旧引用点已同步：见下。

## 跨文件引用同步说明
- `scripts/1mao-scripts/clear-cache.cjs` 报错文案提示过 `./launch-all.command` / `launch-all.ps1`，现为新路径（仅提示语，不影响功能）。
- `CLAUDE.md`、`docs/` 中「启动方式」描述仍写根目录旧路径，属文档滞后，可后续更新；功能不受影响。
