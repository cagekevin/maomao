# Mac 打包说明（猫猫画布）

> 覆盖打包：**菜单栏常驻工具 `.app`**（推荐形态）。另一入口 `launch-all.command` 是纯终端守护脚本，非打包产物，见文末。

## 产物是什么

`packaging/mac/menubar/build.sh` 编译 `main.swift` → 项目根 `猫猫画布.app`。
- 成品是**纯菜单栏工具**（LSUIElement / accessory）：只在顶部菜单栏显示猫猫图标，
  无 Dock 图标、不进入 Cmd+Tab。
- 菜单项：打开画布 / Build 前端 / Build 后端 / 重启服务 / 查看日志 / 退出。
- 后端崩时图标变灰 + 菜单栏出现 ⚠ 提示。
- 单实例：flock 文件锁（`/tmp/maomao_launcher.lock`，原子互斥，崩溃自动释放）。

## 一键打包（推荐）

```bash
cd packaging/mac/menubar
./build.sh
```

脚本会：
1. **若 `猫猫画布.app` 不存在 → 自动从 `assets/` 重建骨架**（生成 Info.plist，含 LSUIElement/bundle id，拷入 app.icns / menubar.png）——所以**任何环境（含干净 clone）都能一键出包**。
2. `swiftc` 编译 `main.swift` → `Contents/MacOS/launcher`。
3. `codesign --force --deep --sign - --identifier com.maomao.launcher` 重签整包。
   ⚠️ **这步不能省**：swiftc 直编后的签名不含 Info.plist 绑定，不重签会导致系统通知授权静默失败（`hasError:1`）、行为异常。
4. `xattr -cr` 清隔离标记（否则首次双击被 Gatekeeper 拦）。

打包完成后双击 `猫猫画布.app` 启动。

## 文件与资源

```
packaging/mac/menubar/
├── main.swift        ← 主源码（唯一需要手改的）
├── build.sh          ← 打包脚本（可复现，自动建骨架）
└── assets/           ← 打包资源（已入 git，勿删）
    ├── app.icns      ← Dock/系统用图标（当前为无 Dock 形态，主要给 .app 图标元数据）
    └── menubar.png   ← 菜单栏小图（44×44）
```

- `猫猫画布.app` 本身被 `.gitignore` 忽略、不入库；资源与 Info.plist 生成逻辑都在 git 内，可完整复现。
- 若改代码：改 `main.swift` → 重跑 `./build.sh`（热更新）。
- 若改菜单栏图标：替换 `assets/menubar.png`（保持 44×44）→ 重跑 build.sh。
- 若想重置 .app：`rm -rf <项目根>/猫猫画布.app` → 重跑 build.sh 会重建。

## 前置条件

- macOS 11+；已装 Xcode 命令行工具（`xcode-select --install`），提供 `swiftc` / `codesign`。
- 运行时依赖：Node（fnm 管理，v22.23.2 等）；后端 localTool、前端 dist 由菜单栏工具自身拉起/构建。

## 常见问题

| 现象 | 处理 |
|------|------|
| `swiftc: command not found` | 装 Xcode CLT：`xcode-select --install` |
| 双击被 Gatekeeper 拦 | 说明 `xattr -cr` 没生效；重跑 build.sh 或手动 `xattr -cr 猫猫画布.app` |
| 通知不弹（hasError:1） | 先确认是否重签过（build.sh 已自动做）；再看系统「勿扰/专注模式」是否抑制（见 TROUBLESHOOTING） |
| 想让它出现在 Dock/Cmd+Tab | 这是特性：当前是纯菜单栏形态。想改回带 Dock 形态，把 main.swift 的 `setActivationPolicy(.accessory)` 改回 `.regular` 并去掉 Info.plist 的 LSUIElement |

## 另一入口 launch-all.command（终端守护，非打包）

`packaging/mac/launch-all.command`：直接双击或 `./launch-all.command` 运行，
后台拉起 localTool(:18080)+打开画布并进入守护（掉线自动重启），Ctrl+C 退出。
**它不需要打包**，直接可执行。它适合"不用菜单栏工具、纯命令行常驻"的场景；
日常推荐用菜单栏 `.app`。
