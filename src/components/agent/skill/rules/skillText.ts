/**
 * 技能文本的**清洗**（域内实现，此前住 legacy 壳 `agent/runtime/skillStore.ts` —— TD-11-52）。
 *
 * 【为什么搬进来】那段 40 行启发式（含 5 行"勿加阈值"的实测教训）住在"纯转发壳"里，
 * 最容易被当成随手可改的胶水；而它是**域内实现细节**（外部导入的 `.md` 编码修复）。
 * 搬进来后，壳里不再有业务逻辑，"域外唯一出口 = 门面"这条纪律才在实况上成立。
 */
import { logger } from '@/components/base/core/log/logger';

/**
 * mojibake 乱码修复（对齐大雄 `backend.py` 的 `_repair_mojibake_text`）。
 *
 * 检测「UTF-8 被误当 Latin-1/CP1252 解码」的中文乱码（外部 `.md` 导入时高发），
 * 把误解码字符按字节反解回 UTF-8。只在**像乱码且反解后含 CJK** 时才替换，否则保留原文。
 *
 * ⚠️ **勿再加「长度塌陷」类阈值**：UTF-8 中文是 3 字节 → 1 字符，真实乱码修复后长度比恒为 ≈0.33
 * （如「çµå」→「电商」6→2）。任何 <0.5 的阈值都会把真实修复**全部误杀**，令本功能彻底失效（已实测）。
 */
export function repairMojibakeText(text: string): string {
  if (!text) return text;
  const s = String(text);
  const CP1252 = [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
    0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
    0x0153, 0x017e, 0x0178,
  ];
  let cjk = 0;
  let latinHigh = 0;
  let cp1252 = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x4e00 && c <= 0x9fff) cjk++;
    else if ((c >= 0xc0 && c <= 0x024f) || (c >= 0x1e00 && c <= 0x1eff)) latinHigh++;
    else if (CP1252.includes(c)) cp1252++;
  }
  const score = latinHigh + cp1252;
  const looksLike = (score >= 2 && cjk === 0) || (score >= 3 && score > cjk);
  if (!looksLike) return s;
  // 反解：每个字符视为一个 Latin-1 字节，再按 UTF-8 重新解码
  try {
    const bytes = new Uint8Array([...s].map((ch) => ch.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    // 【误改防护 · 唯一闸门】反解后必须含 CJK，否则视为误判并保留原文：
    // 纯英文内容（含 ™ € é 等字符、cjk=0）会被上方 looksLike 判成乱码，但其反解结果是
    // 「无中文的乱码串」——本闸门据此拦住，避免内容被静默改写且原内容不可恢复。**宁可不修，不可错改。**
    if (!/[\u4e00-\u9fff]/.test(decoded)) return s;
    return decoded;
  } catch (e) {
    logger.warn('skillText', '乱码反解失败，保留原文', (e as { message?: string })?.message || e);
    return s;
  }
}
