# 脚本工具

```bash
node scripts/status.cjs              # 开工必跑：项目状态速览
npm run build && node scripts/check-build.cjs  # 改码必跑：构建+验证
node scripts/vendor-lookup.cjs <名>  # 查混淆名来源
node scripts/summarize.cjs <函数名>  # 查看函数摘要
node scripts/annotate.cjs --run --force  # 更新映射表后刷新App.js注释
```

| 脚本 | 用途 | 频率 |
|------|------|------|
| `status.cjs` | 开工速览：App.js 行数/函数数/节点语义化/字典条目/构建产物/Git 状态 | 每次开工 |
| `check-build.cjs` | 构建后验证（错误签名/注释完整性/语法/TDZ风险/大小），**不用开 Chrome** | 每次改码后 |
| `vendor-lookup.cjs` | 查 vendor.js 混淆名（例：`Dj`→Three.Texture），支持 `--imports` 列出全部别名 | 排错时 |
| `summarize.cjs` | 单/批量函数摘要（参数/hook/依赖/中文文案），支持 `--skeleton` JSX 骨架 | 读代码时 |
| `annotate.cjs` | 基于 `func-mapping.txt` + `var-mapping.txt` 刷新 App.js 注释 | 映射表更新后 |

## 示例

```bash
# 开工
$ node scripts/status.cjs
📦 App.js
   行数: 43,768
   函数: 287 ✔ / 0 ⚠️
   节点: 26/27 语义化
📚 字典
   func-mapping: 221  var-mapping: 220  vendor: 199
🧹 可清理: false&& x23  return[] x13

# 改完代码
$ npm run build && node scripts/check-build.cjs
✅ 全部检查通过，可安全部署

# 排错
$ node scripts/vendor-lookup.cjs Dj
🔍 查 "Dj"
   vendor.js 内部变量，出现 2 次
   上下文: ...new J,Dj=new J,Oj=class e{...  → Three.js Texture 内部类

# 读函数
$ node scripts/summarize.cjs ImageNodeComp --skeleton
ImageNodeComp [imageNode]  L1287
组件 JSX 结构:
  ├─ div ×1
  ├─ img ×2
  按钮/标签: 下载, 上传, 裁剪
```

## 归档

一次性脚本（反编译/品牌替换/节点拆分等）移至 `scripts/archive/`，需要时取用。
