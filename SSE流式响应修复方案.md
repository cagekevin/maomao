# 第三方 API 流式响应（SSE）修复方案

> 状态：待应用（git 恢复后，按本文档三处修改点手动/自动改 `src/_engine/App.js`）
> 关联问题：第三方配置 `lovart-chat` 调用 `/v1/chat/completions` 时报
> `Unexpected token ':', ": heartbea"... is not valid JSON`

---

## 一、问题现象

在节点里用第三方 API 配置（如 `lovart-chat`）发对话请求时，响应为空，控制台报错：

```
(无响应数据) Unexpected token ':', ": heartbea"... is not valid JSON
```

请求体正常（`model: "lovart-chat"` + `messages`），但响应解析失败。

## 二、根因

`lovart-chat` 指向的 `/v1/chat/completions` 端点**默认返回 SSE 流式响应**，格式如下：

```
: heartbeat                              ← 注释行（保活，非 JSON）
data: {"choices":[{"delta":{"content":"你"}}]}
data: {"choices":[{"delta":{"content":"好"}}]}
data: [DONE]
```

而原代码用 `response.json()` 把**整个响应体**当 JSON 解析，遇到 `: heartbeat` 这一行就抛
`Unexpected token ':'`，导致后续所有文本提取失败。

## 三、修复策略

将 `response.json()` 换成 `response.text()` 拿全文，然后：

1. **先试 JSON**：`JSON.parse` 成功 → 走原提取逻辑（兼容 OpenAI `choices[].message.content`、
   Gemini `candidates[].content.parts[].text`、`response` 字段）。覆盖「端点非流式 / 设了 `stream:false`」的情况。
2. **失败再按 SSE 解析**：逐行扫描，跳过 `: heartbeat` 注释行和 `data: [DONE]`，
   对每行 `data: xxx` 取 `delta.content` 拼接。覆盖遇到的流式情况。
3. **非流式端点完全不受影响**（第 1 步直接命中）。

> 设计取舍：提取为空时**静默返回空**（`|| ''`），不额外抛错，与原代码契约一致，最小化行为变更。

---

## 四、三处修改点

> 定位方式：在 `src/_engine/App.js` 中搜索下方「原代码」片段即可，行号随版本变动，勿依赖行号。

### 修改点 ①：主文本生成函数（原 `tr` 内）

**原代码：**
```js
let T = (await w.json()).choices?.[0]?.message?.content || ``;
```

**改为：**
```js
let T = ``;
{
  let rt = await w.text();
  try {
    let rd = JSON.parse(rt);
    T = rd?.choices?.[0]?.message?.content || rd?.candidates?.[0]?.content?.parts?.[0]?.text || rd?.response || (typeof rd == `string` ? rd : ``);
  } catch {
    for (let line of rt.split(`\n`)) {
      let ln = line.trim();
      if (ln.startsWith(`data:`) && ln !== `data: [DONE]`) {
        let dt = ln.substring(5).trim();
        if (!dt) continue;
        try {
          let d = JSON.parse(dt);
          let piece = d.choices?.[0]?.delta?.content || d.choices?.[0]?.message?.content || ``;
          if (piece) T += piece;
        } catch {}
      }
    }
  }
}
```

---

### 修改点 ②：JSON 提取助手（原 `lr` 内）

**原代码：**
```js
let d = await c.json(),
  f = ``;
if (d?.choices?.[0]?.message?.content) f = d.choices[0].message.content;else if (d?.candidates?.[0]?.content?.parts?.[0]?.text) f = d.candidates[0].content.parts[0].text;else if (d?.response) f = d.response;else if (typeof d == `string`) f = d;else throw Error(`无法从大模型返回结果中提取文本`);
```

**改为：**
```js
let d = await c.text(),
  f = ``;
try {
  let rj = JSON.parse(d);
  if (rj?.choices?.[0]?.message?.content) f = rj.choices[0].message.content;
  else if (rj?.candidates?.[0]?.content?.parts?.[0]?.text) f = rj.candidates[0].content.parts[0].text;
  else if (rj?.response) f = rj.response;
  else if (typeof rj == `string`) f = rj;
} catch {
  for (let line of d.split(`\n`)) {
    let ln = line.trim();
    if (ln.startsWith(`data:`) && ln !== `data: [DONE]`) {
      let dt = ln.substring(5).trim();
      if (!dt) continue;
      try {
        let rj = JSON.parse(dt);
        let piece = rj.choices?.[0]?.delta?.content || rj.choices?.[0]?.message?.content || ``;
        if (piece) f += piece;
      } catch {}
    }
  }
}
```

---

### 修改点 ③：画幅自动检测（原 `if (o.ok) {` 内）

**原代码：**
```js
if (o.ok) {
  let t = (await o.json()).choices?.[0]?.message?.content?.trim()?.match(/(1:1|1:4|1:8|2:3|3:2|3:4|4:1|4:3|4:5|5:4|8:1|9:16|16:9|21:9)/);
```

**改为：**
```js
if (o.ok) {
  let otext = await o.text(),
    oc;
  try {
    oc = JSON.parse(otext);
  } catch {
    oc = {
      choices: [{
        message: {
          content: ``
        }
      }]
    };
    for (let line of otext.split(`\n`)) {
      let ln = line.trim();
      if (ln.startsWith(`data:`) && ln !== `data: [DONE]`) {
        let dt = ln.substring(5).trim();
        if (!dt) continue;
        try {
          let d = JSON.parse(dt);
          let p = d.choices?.[0]?.delta?.content || d.choices?.[0]?.message?.content || ``;
          if (p) oc.choices[0].message.content += p;
        } catch {}
      }
    }
  }
  let t = oc?.choices?.[0]?.message?.content?.trim()?.match(/(1:1|1:4|1:8|2:3|3:2|3:4|4:1|4:3|4:5|5:4|8:1|9:16|16:9|21:9)/);
```

---

## 五、验证方法

1. 用第三方配置 `lovart-chat` 发一条对话，确认能正常返回文本、不再报 `Unexpected token ':'`。
2. 用非流式端点（或设了 `stream:false` 的端点）发对话，确认返回正常（走 JSON 分支）。
3. 触发一次画幅自动检测，确认不再因流式响应报错。

## 六、备注

- 本方案未改动任何 git 仓库结构，仅文档存档。
- `gr`（API 配置助手）走通用节点执行器 `zc`，响应提取用 `resultPath`，不在本次 SSE 问题范围内，暂不改。
- 另有一个**未处理**的提示词库 bug：「最近使用」不记录本地提示词（`Ka(e.id)` 只在官方提示词的「使用」里调，本地提示词走 `n(e.content)` 未调 `Ka`）。待本次 API 修复确认后再处理。
