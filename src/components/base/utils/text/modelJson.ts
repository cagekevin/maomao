/**
 * 从模型回复正文读取 JSON 的**唯一原语**（TD-01-34 收口）。
 *
 * 是什么：剥掉 markdown 围栏 → 取出第一个完整 JSON 块（对象优先，其次数组）→ 严格 `JSON.parse`，
 *   返回**判别联合**：`{ ok:true, value }` 或 `{ ok:false, reason, error? }`。
 *
 * 唯一入口：`parseModelJsonText`。四个域一律调它，**禁止再写第二份**
 *   「剥围栏 + 取花括号 + JSON.parse」（那正是本债的原始病灶：同判据 4 份）。
 *
 * 谁在用：`scriptbox/scriptBoxEngine`（剧本 / 分镜提示词 / 生图提示词）、
 *   `agent/assistantTable`（表格 JSON）、`text/TextGenerate`（自动拆分）、
 *   `agent/runtime/agentCore`（回复正文里的 generations）。
 *
 * 禁止什么：
 *   - 禁止在调用方重新实现提取（换皮 `tryParse` 也算第二份）；
 *   - 禁止把失败压成 `null` / `{}` / `[]`（失败必须在类型上取不到值）；
 *   - **本层不产出用户文案**：它不知道调用方是表格还是剧本，文案由拥有域知识的那层给
 *     （「只有生产者才有权呈现错误」—— 域层才生产得出「剧本 JSON 格式有误」这句事实）。
 *
 * 【为什么 shape 不统一】四个域的 JSON 结构（`shots[]` / `rows[]` / `items[]` / `generations[]`）
 *   各不相同，schema 校验必须由调用方注入；本原语只统一「怎么把 JSON 抠出来」与「失败怎么表达」。
 */
export type ModelJsonFailureReason =
  /** 入参根本不是字符串（或空串）：属于「这不是 JSON 回复」的正常结论，不是解析故障 */
  | 'not-string'
  /** 剥完围栏后既找不到对象块也找不到数组块 */
  | 'no-json-block'
  /** 抠出了块，但 `JSON.parse` 抛了 —— 这类才是需要排查的真故障 */
  | 'parse-error';

export type ModelJsonResult =
  { ok: true; value: unknown } | { ok: false; reason: ModelJsonFailureReason; error?: unknown };

/** 剥围栏（` ```json ` / ` ``` `），保留正文；对齐官方 Ar/Ir 的容错口径。 */
function stripFences(text: string): string {
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

/**
 * 从模型回复正文里抠出第一个 JSON 块并解析。
 *
 * 提取顺序（顺序本身是契约，改它等于改四个域的行为）：
 * 1. 若存在 ` ```json ... ``` ` 代码块 → 取**第一个块**的内容（多块回复只认第一块）；
 * 2. 否则剥掉所有围栏 → 取「首个 `{` 到最后一个 `}`」；没有对象再取「首个 `[` 到最后一个 `]`」。
 *
 * @param raw 模型回复正文（可能夹自然语言、围栏、尾部杂字）
 * @returns 判别联合；失败时 `value` 不可取（`ok:false` 那一臂上没有 `value`）
 */
export function parseModelJsonText(raw: unknown): ModelJsonResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'not-string' };
  const text = raw.trim();
  if (!text) return { ok: false, reason: 'not-string' };

  // 1) 优先第一个 ```json / ``` 代码块：多块回复只认第一块（既有 agent 侧行为，勿改）
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let body = fence && fence[1] ? fence[1].trim() : '';

  // 2) 无代码块：剥围栏后按「对象优先、数组兜底」抠块
  if (!body) {
    const stripped = stripFences(text);
    const objStart = stripped.indexOf('{');
    const objEnd = stripped.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
      body = stripped.slice(objStart, objEnd + 1);
    } else {
      const arrStart = stripped.indexOf('[');
      const arrEnd = stripped.lastIndexOf(']');
      if (arrStart >= 0 && arrEnd > arrStart) body = stripped.slice(arrStart, arrEnd + 1);
      else return { ok: false, reason: 'no-json-block' };
    }
  }

  try {
    return { ok: true, value: JSON.parse(body) };
  } catch (error) {
    return { ok: false, reason: 'parse-error', error };
  }
}
