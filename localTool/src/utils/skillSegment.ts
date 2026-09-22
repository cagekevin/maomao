/**
 * 技能目录/分类名**单段**的合法性与长度上限 —— 跨栈纯规则（无 IO、无状态、可单测）。
 *
 * 【为什么独立成文件（TD-11-79）】这段判据与前端
 * `src/components/agent/skill/rules/skillDirName.ts` 的 `isLegalDirSegment` 是**同一条跨栈判据的两侧载体**
 * （前端 = 早退、后端 = 权威；跨栈无共享模块是结构必然，见 `check:arch` 的 CROSS_STACK_CONSTS）。
 * 此前它内联在 `routes/skills.ts`（连带 fs / db 依赖）⇒ **对账测试无法加载它**，两侧逻辑只能靠人读对齐。
 * 抽为纯函数后，两侧各自对着**同一份向量表**（`scripts/skill-segment-vectors.json`）断言，
 * 任一侧漂移即该侧测试变红 —— 本仓能做到的**最短对账路径**（对账测试优先于新增闸）。
 */

/** 目录名单段长度上限 —— **跨栈契约常量**（前端同名常量，由 `check:arch` 跨栈对账保证相等）。 */
export const SKILL_MAX_DIR_SEGMENT_LEN = 64;

/**
 * 分类名 / 名称段的合法性。
 * 判据刻意**排除了以 `.` 开头的名字** —— `.tmp` 与 `.trash` 是 facade 内部工作目录，
 * 若允许用户段以 `.` 开头，就能写进内部目录（脏数据 + 列目录时被跳过，用户看不见自己写的东西）。
 */
export function isSafeSegment(v: unknown): v is string {
  if (typeof v !== 'string' || !v) return false;
  if (v !== v.trim()) return false; // 前后空白：多半是复制粘贴带来的，拒绝而非静默裁剪
  if (v.length > SKILL_MAX_DIR_SEGMENT_LEN) return false;
  if (v === '.' || v === '..') return false;
  if (v.startsWith('.')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[/\\:\u0000-\u001f]/.test(v)) return false;
  return true;
}
