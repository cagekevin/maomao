/**
 * 技能库后端 facade 的前端调用层（模块内部件，**不进 `index.ts` 门面**）。
 *
 * 【为什么独立于 `base/api/filesApi.ts`】技能库不在 `uploads/` 之下（见 `localTool/src/routes/skills.ts`
 * 文件头三条硬事实），既有 files 端点作用域不适用；把它塞进 filesApi 会让那个模块同时背两个根目录的判据。
 *
 * 【失败契约】一律返回 `SkillApiResult<T>`（判别联合），**不抛**：
 * 抛错会让调用方只能 `try/catch` 猜，而这里失败是**预期内**的（后端没起 / 目录不存在 / 校验拒绝 400）。
 * `message` 来自后端或网络层**原样转发**（消费方禁止自己编话术 —— 本仓「生产者给全 / 消费者只转发」）。
 *
 * ⚠️ **URL 写法约束（改本文件前必读）**：必须保持「字面量路径 + 变量段」形态，即
 *   `${API_BASE}/api/skills/${encodeURIComponent(x)}`。
 *   **禁止**在路径末尾再拼变量（如 `${API_BASE}/api/skills${qs}`）—— 那会让 `npm run check:api`
 *   的反向扫描（字面量调用点 → 登记表求差）归一成 `/api/skills{x}` 而对不上登记项，报"未登记"。
 * 【重试纪律】读操作可重试（httpClient 只对网络/超时重试）；**写操作 `retries: 0`** ——
 * 重发一次"整包写"没有意义，还可能与用户随手的第二次编辑打架。
 */
import { API_BASE, LOCAL_CRUD_TIMEOUT } from '@/components/base/core/config.ts';
import { httpRequest } from '@/components/base/api/httpClient.ts';
import { SKILL_ENTRY_FILE } from '../rules/skillEntry.ts';
import type { ApiEnvelope } from '@/components/base/api/localToolApi.ts';
import { logger } from '@/components/base/core/log/logger.ts';
import type {
  SkillApiResult,
  SkillLibrary,
  SkillPackage,
  SkillPackageFile,
} from '../skillTypes.ts';

interface CallOptions {
  method?: string;
  body?: string;
  retries?: number;
}

/** 统一调用 + 判别联合收敛（唯一实现；禁止各函数各写一份 try/catch 口径） */
async function call<T>(
  url: string,
  label: string,
  opts: CallOptions = {},
): Promise<SkillApiResult<T>> {
  try {
    const env = await httpRequest<ApiEnvelope<T>>(url, {
      method: opts.method,
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body,
      retries: opts.retries,
      timeoutMs: LOCAL_CRUD_TIMEOUT,
      label,
    });
    if (!env || typeof env.code !== 'number') {
      return { ok: false, message: `${label}：响应不是 { code, data } 信封` };
    }
    return { ok: true, data: env.data };
  } catch (e) {
    const message = (e as { message?: string })?.message || String(e);
    const status = (e as { status?: number })?.status;
    logger.warn('skillApi', `${label} 失败`, message);
    // 带上 status：调用方要按**事实**分支（如 404 = 磁盘上本来就没有），不要去猜 message 文案
    return { ok: false, message, status, notFound: status === 404 };
  }
}

/**
 * 列全部 Skill 包（`withContent` 时同时带 `SKILL.md` + `references/**`，一次拉全避免 N+1）。
 *
 * 【`onlySkillMd`：取数范围跟判据匹配（TD-11-39）】漂移侦测只需要 `SKILL.md` 的正文指纹，
 * 却把 `references/**` 全量拉一遍 ⇒ 库一大就是每次焦点无谓的 IO。带上它后端只回 `SKILL.md`。
 * 【三条 URL 都写成字面量】`check:api` 的反向扫描按字面量路径归一 —— 末尾拼变量会让它对不上登记项。
 */
export function listSkillPackages(
  opts: {
    withContent?: boolean;
    onlySkillMd?: boolean;
  } = {},
): Promise<SkillApiResult<SkillLibrary>> {
  // `only` 的**取值**就是入口文件名 ⇒ 用常量拼（`only=SKILL.md` 里的那个名字与后端比对的是同一份口径）
  const url = !opts.withContent
    ? `${API_BASE}/api/skills`
    : opts.onlySkillMd
      ? `${API_BASE}/api/skills?withContent=1&only=${SKILL_ENTRY_FILE}`
      : `${API_BASE}/api/skills?withContent=1`;
  return call<SkillLibrary>(url, 'listSkillPackages');
}

/**
 * 用例「**展示技能库**」：一次读回磁盘上的全貌（根 + 分组 + 每个包的 `files` 与正文）。
 *
 * 【为什么不直接暴露 `listSkillPackages`】门面按**用例**定义（ADR-0044 §8）：界面要的是
 * "把技能库画出来"，不是"调那个端点"。带不带 `withContent` 属实现细节，不该由消费方决定
 * （历史上正是"有的地方带、有的地方不带"造成了漂移侦测多拉一遍全量正文 —— TD-11-39）。
 */
export function readSkillLibrary(): Promise<SkillApiResult<SkillLibrary>> {
  return listSkillPackages({ withContent: true });
}

/**
 * 用例「**读磁盘现状（轻量）**」：每包**只取入口文件** —— 包清单 + `SKILL.md` 正文。
 *
 * 【为什么另立一个用例，而不是复用 `readSkillLibrary`】两者的**取数范围不同**：
 *   · `readSkillLibrary`（含 `references/**`）给"把技能库画出来 / 编辑整包"用；
 *   · 本用例只要"包在不在 + 入口正文是什么"—— 漂移侦测比的是正文指纹，取用面判的是
 *     "磁盘上还有没有它"。把 `references/**` 也拉回来是纯浪费（TD-11-39 的同一判据：
 *     取数范围要跟判据匹配；库一大就是每次开面板无谓的 IO）。
 * 【共用一个函数而不是各写各的 URL】"只取入口文件"这件事只在这一处定义 —— 从前漂移侦测自己
 * 拼 `only=SKILL.md`，取用面若再拼一遍就是**同一条口径两个写法**（本仓 M1 母体）。
 */
export function readDiskSkillPackages(): Promise<SkillApiResult<SkillLibrary>> {
  return listSkillPackages({ withContent: true, onlySkillMd: true });
}

/** 读单个包；`scope` 缺省 `content`（后端排除 `scripts/**`），`package` 仅导入导出 UI 用。 */
export function readSkillPackage(
  category: string,
  slug: string,
  scope: 'content' | 'package' = 'content',
): Promise<SkillApiResult<SkillPackage>> {
  const url =
    scope === 'package'
      ? `${API_BASE}/api/skills/${encodeURIComponent(category)}/${encodeURIComponent(slug)}?scope=package`
      : `${API_BASE}/api/skills/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`;
  return call<SkillPackage>(url, 'readSkillPackage');
}

/** 整包原子写（覆盖语义：提交的文件集合即最终状态，不做合并）。 */
export function saveSkillPackage(
  category: string,
  slug: string,
  files: SkillPackageFile[],
): Promise<SkillApiResult<{ category: string; slug: string; written: number }>> {
  const url = `${API_BASE}/api/skills/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`;
  return call(url, 'saveSkillPackage', {
    method: 'POST',
    body: JSON.stringify({ files }),
    retries: 0,
  });
}

/** 整包原子删（后端进 `.trash/`，不真删）。 */
export function deleteSkillPackage(
  category: string,
  slug: string,
): Promise<SkillApiResult<{ category: string; slug: string; deleted: boolean }>> {
  const url = `${API_BASE}/api/skills/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`;
  return call(url, 'deleteSkillPackage', { method: 'DELETE', retries: 0 });
}

/** 打开文件夹（缺 `category` ⇒ 开技能库根；`path` 由后端如实回传，前端不自己拼路径）。 */
export function openSkillFolder(
  category?: string,
  slug?: string,
): Promise<SkillApiResult<{ path: string }>> {
  const url = `${API_BASE}/api/skills/open-dir?category=${encodeURIComponent(category || '')}&slug=${encodeURIComponent(slug || '')}`;
  return call<{ path: string }>(url, 'openSkillFolder');
}

/** 新建分组（= 技能库下一级目录）。已存在 ⇒ 后端幂等返回 `created:false`（点两次不该报错）。 */
export function createSkillGroup(
  name: string,
): Promise<SkillApiResult<{ name: string; created: boolean }>> {
  const url = `${API_BASE}/api/skills/group`;
  return call<{ name: string; created: boolean }>(url, 'createSkillGroup', {
    method: 'POST',
    body: JSON.stringify({ name }),
    retries: 0,
  });
}
