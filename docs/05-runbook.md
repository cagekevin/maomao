# 一毛AI画布 · 运维手册（Runbook）

> 启动逻辑抽自 `启动项目.ps1` 与 `package.json`；事实锚点经 AI13 交叉验证实锤（2026-07-21）。
> 目标：重装系统后 5 分钟内跑起来。开发接入口见 `06-integration.md`。

---

## 一、环境依赖（读 package.json / 启动项目.ps1）

- **Node.js**：构建用 `NODE_OPTIONS=--max-old-space-size=1024`（package.json `build` 脚本），建议 Node 18+。
- **Python**：网关 `apimart-gateway` 为 FastAPI，`pip install -r requirements.txt`；`uvicorn` 启动。
- **Chrome**：加载 `dist/` 作为已解压的扩展（MV3）。
- **操作系统**：`启动项目.ps1` 为 Windows 启动器；macOS 对应 `启动项目.command`。

---

## 二、启动步骤

### 第 1 步 · 启动 localTool（本地数据服务，:18080）
```powershell
cd localTool
npm install
npm run build
npm start        # 或 node dist/index.js，端口 18080 硬编码
```
- 数据根目录 `~/.yimao-localtool/`（可用 `YIMAO_DATA_DIR` 覆盖）。
- DB：`localtool.db`（sql.js WASM）；上传落盘：`uploads/`。
- 端口冲突会在 `EADDRINUSE` 报"18080 被占用"。

### 第 2 步 · 启动 AI 网关（:9004）
> ⚠️ `启动项目.ps1` **只启动了 localTool**，网关需另行启动：
```bash
cd apimart-gateway
pip install -r requirements.txt
uvicorn main:app --port 9004     # 端口须 9004，非 README 写的 8000
```
- 环境变量见 `apimart-gateway/.env.example`（如 `LOVART_ACCESS_KEY` / `AUTO_CONFIRM` / `LOVART_BASE_URL`）。
- 日志：`apimart_9004.log` + `apimart_9004.err.log`。
- 端口冲突会在 `EADDRINUSE` 报"9004 被占用"；`USE_LOCAL_ENGINE=false` 时文件路由也走 9004（`REMOTE_BASE`）。

### 第 3 步 · 构建并加载前端扩展
```bash
npm install
npm run build     # 输出 dist/
```
- Chrome → 扩展程序 → 加载已解压的扩展程序 → 选 `dist/`。
- 配置层 `src/config.js`：`USE_LOCAL_ENGINE=true` 走 18080 本地；`ENDPOINTS` 指向 `http://127.0.0.1:9004`。

---

## 三、配置说明

- 前端无统一 `.env.example`；配置项集中在 `src/config.js`：
  - `USE_LOCAL_ENGINE` / `LOCAL_ENGINE.base`（默认 18080）
  - `DEFAULT_ENDPOINT`（默认 `http://127.0.0.1:9004`）
  - `GAS_CLOUD_SYNC_URL`（GAS 云同步部署 URL，可选）
- 网关配置见 `apimart-gateway/.env.example`（若不存在，以 main.py 默认值为准）。

---

## 四、排查入口（日志去哪拿）

| 来源 | 位置 | 拿法 |
|------|------|------|
| 网关 (9004) | `apimart-gateway/apimart_9004.log` + `.err.log` | 直接把路径给排查方 |
| localTool (18080) | `启动项目.ps1` 前台窗口 | 看窗口输出；当前未落盘文件 |
| 前端画布 | 画布内「任务清单」面板 / DevTools Console | UI 内看任务记录；Console 可存文本 |

> 排查时附"预期 vs 实际、触发动作"即可；定位由排查方在代码里做（混淆代码引用必带行号）。

---

## 五、常见故障

- **18080 连不上** → 功能受限但不崩；先确认 localTool 已启动、端口未冲突。
- **网关连 8000 失败** → 网关实际端口 9004，启动必须 `--port 9004`。
- **资源面板破图** → URL 未绝对化（host 硬编码 18080 待改）；确认 `USE_LOCAL_ENGINE=true`。
- **"发送到资源"不落盘** → 见 `docs/TASKS.md` 排查建议（查 localTool 日志 / 端口 / `uploads/migrated/` / `resourceAdded` 接收 / 数据源 transitItems vs resources）。
- **"发送到剪映"无效** → 剪映本地 API 走 `http://127.0.0.1:18080/api/jianying/send`（端口同 localTool，`Wn`=`Bc`=18080），需 localTool 在跑；外部图片须先「魔法棒」转路径图片。
- **网关连 8000 失败** → 网关实际端口 9004，启动必须 `--port 9004`（README 写 8000 是错的）。
