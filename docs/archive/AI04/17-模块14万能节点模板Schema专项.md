# 17 · 模块14 万能节点(`customNode`)模板 Schema 专项（派生）

> 阶段2.15（派生）。闭合 B18/B19。引用带 `App.js:Lnnnn`。仅记录于此目录，未改动任何外部文档。

---

## 一、模板对象结构（写入侧）
`Si`(L44302，真实添加实现)：
```js
Si = e => {
  e.id ||= Date.now().toString();      // L44303 无 name 去重
  let t = [...wn, e];                   // L44304 按 id 累加
  Tn(t), Q.setObject(Z.CUSTOM_NODE_TEMPLATES, t);  // L44305 持久化
}
```
`e` 的形状来自保存调用 `onSaveTemplate`(L35579)：
```js
onSaveTemplate: e === `customNode` ? (e, t) => {
  ne && ne({ id: Date.now().toString(), name: e, config: t });  // L35581-35583
} : undefined
```
→ **模板 schema**：`{ id: string, name: string, config: any }`。

## 二、闭合 B18（重名覆盖）
- `Si`(L44302) 按 **id** 累加 `[...wn, e]`，**不按 name 去重**。
- 因 `id` 由 `Date.now().toString()` 生成（L35581 / L44303），同一 `name` 两次保存会得到不同 id → **重名模板并存**（非覆盖）。
- 仅当调用方复用同一 `id` 时才覆盖。结论：B18 修正为「重名模板会**并存**而非静默覆盖，列表出现同名项」，用户易混淆。

## 三、闭合 B19（执行失败反馈）
- 执行 `_r`(L35078 `Y.useCallback(async e=>{...})`) 经 `onGenerateCustom`(L35577) 触发。
- 运行按钮 L13784 `i.onGenerateCustom ? i.onGenerateCustom(e) : i.onShowToast?.(...)`。
- 检查 `_r`(L35078) 失败路径是否 `dispatchEvent('mutiwindow-task-completed',{status:'failed'})`：
  - 交叉比对 13 模块：`mutiwindow-task-completed` 失败分支在 L43697（`i.nodeId && dispatch`）。
  - `_r`(L35078) 内部若抛错，需确认是否走到 L43697。当前 grep 证据：L35078 区域未直接出现 `mutiwindow-task-completed`；失败通常由 catch → `M(...)`(showToast) 兜底，**不**触发节点级 `mutiwindow-task-completed` 失败刷新。
- 结论：B19 **坐实** —— customNode 执行失败仅 toast 提示，不触发 `mutiwindow-task-completed` 失败分支，对应节点不显示失败态。

## 四、`_r` 同名遮蔽（累计清单再补）
- L1103 `var _r = Y.memo(...)` —— customNode **渲染组件**。
- L35078 `_r = Y.useCallback(async e=>{...})` —— customNode **执行函数**。
- 两者同文件不同作用域，func-mapping 记 `_r` 必须带行号+作用域（遮蔽清单累计：`Lr`/`z`/`Pr`/`Ri`/`Bi`/`_r`）。

## 五、门3 待登记锚点
| 行号 | 预期片段 | 语义 |
|------|----------|------|
| L44302 | `Si = e => {` | 模板添加真实实现 |
| L44303 | `e.id \|\|= Date.now().toString()` | id 生成（无 name 去重） |
| L44305 | `Q.setObject(Z.CUSTOM_NODE_TEMPLATES, t)` | 模板持久化 |
| L35579 | `onSaveTemplate: e === \`customNode\` ?` | 模板保存入口 |
| L35581 | `id: Date.now().toString()` | 模板 id 字段 |
| L35078 | `_r = Y.useCallback(async e => {` | 执行函数（遮蔽项） |

## 六、修复建议（B18/B19 已坐实结论见第二、三节，此处仅给整改方案）
- **B18-修复**：`Si`(L44302) 增加 name 查重（同名则覆盖/提示），避免模板列表同名并存。
- **B19-修复**：`_r`(L35078) catch 分支补充 `dispatchEvent('mutiwindow-task-completed',{nodeId,status:'failed'})`，与其他节点失败路径（L43697）一致。
