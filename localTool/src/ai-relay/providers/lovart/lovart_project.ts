/**
 * lovart_project — 按 accessKey 缓存默认 project（单例）+ 失效自愈 + 磁盘持久化。
 *
 * 对齐 apimart-gateway/main.py 的 ProjectManager（main.py:234-276）与
 * TaskService.send_with_project（main.py:779-790）、_is_project_invalid（main.py:588-602）：
 *   - ensure：缓存命中直接返回，不做额外 validate 网络往返（main.py 无 /project/validate；
 *     TS 旧实现每次命中调 validate 是自造端点，已撤销）。
 *   - 失效自愈点从「缓存命中时的 validate」移到「发送失败时」：send 抛 project 失效错误
 *     → clear 缓存 → 重建 → 重试一次；仍失败按原样抛出，不无限循环。
 *   - 持久化：create / clear 后写回本地 JSON（PROJECT_CACHE_FILE），进程重启可复用 project，
 *     不重复向上游建 project。每 accessKey 首次触达对应缓存文件时 lazy load。
 *
 * 并发：ensure / clear 用单一 promise 链串行化，避免并发首次建 project 时各建一个
 * （对齐 main.py 用 asyncio.Lock 包裹 ensure/clear）。
 *
 * 缓存文件路径按「当前 deps / env」在每次 ensure 时解析（不粘死首调），
 * 便于测试注入独立临时文件，也允许进程内不同 baseUrl 分区各自持久化。
 */

import { promises as fsp } from 'node:fs';
import { join as pathJoin } from 'node:path';
import { createLovartProject, sendLovartChat } from './lovart_client.js';
import type { LovartClientDeps } from './lovart_client.js';
import type { LovartSendInput } from './lovart_contract.js';
import { LovartError } from './lovart_errors.js';
import { RelayHttpError } from '../../httpTransport.js';

/**
 * project 缓存文件路径。解析优先级：
 *   1. deps.projectCacheFile（测试注入 / 显式配置）；
 *   2. 环境变量 LOVART_PROJECT_CACHE_FILE（对齐 main.py Config.PROJECT_CACHE_FILE）；
 *   3. main.py 兜底 .lovart_project.json（cwd）。
 */
export function resolveProjectCacheFile(deps?: { projectCacheFile?: string }): string {
  if (deps?.projectCacheFile) return deps.projectCacheFile;
  if (process.env.LOVART_PROJECT_CACHE_FILE) return process.env.LOVART_PROJECT_CACHE_FILE;
  return pathJoin(process.cwd(), '.lovart_project.json');
}

/** accessKey → project_id（进程内权威缓存）。 */
const projectCache = new Map<string, string>();
/** accessKey → 该 key 归属的缓存文件（用于写回正确文件）。 */
const keyFile = new Map<string, string>();
/** 已经 lazy-load 过内容的文件路径（避免每 accessKey 重复读盘）。 */
const loadedFiles = new Set<string>();

/** ensure/clear 的串行化 promise 链（等价 main.py 的 asyncio.Lock）。 */
let mutationChain: Promise<unknown> = Promise.resolve();

function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutationChain.then(fn, fn);
  mutationChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function projectKey(deps: LovartClientDeps): string {
  return deps.auth?.accessKey ?? '';
}

/**
 * 把某个缓存文件里属于本模块的全部 project_id 合并进内存（lazy load，幂等）。
 * load 失败静默（对齐 main.py ProjectManager.load 的 (FileNotFoundError, JSONDecodeError): pass）。
 */
async function ensureFileLoaded(file: string): Promise<void> {
  if (loadedFiles.has(file)) return;
  loadedFiles.add(file);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string' && !projectCache.has(k)) {
          projectCache.set(k, v);
          keyFile.set(k, file);
        }
      }
    }
  } catch {
    // 文件不存在 / 非法 JSON：忽略（对齐 main.py）。
  }
}

/** 把单个 accessKey 的绑定写回其归属缓存文件。写失败静默（对齐 main.py persist 的 except OSError: pass）。 */
async function persistKey(accessKey: string): Promise<void> {
  const file = keyFile.get(accessKey);
  if (!file) return;
  // 该文件内只保留归属它的 key（多文件分区互不污染）。
  const scoped: Record<string, string> = {};
  for (const [k, v] of projectCache) {
    if (keyFile.get(k) === file) scoped[k] = v;
  }
  try {
    await fsp.writeFile(file, JSON.stringify(scoped, null, 2), 'utf8');
  } catch {
    // 静默：持久化失败不影响主链路。
  }
}

/**
 * ensure 默认 project：缓存命中直接返回；未命中则建一次并写回缓存 + 持久化。
 * 对齐 main.py ProjectManager.ensure_project（main.py:258-267）：无 validate 往返。
 */
export async function ensureLovartProject(deps: LovartClientDeps): Promise<string> {
  const file = resolveProjectCacheFile(deps);
  const key = projectKey(deps);
  const cached = projectCache.get(key);
  if (cached) {
    if (!keyFile.has(key)) keyFile.set(key, file);
    return cached;
  }
  return runSerialized(async () => {
    await ensureFileLoaded(file);
    // 链内二次检查：等待期间别的 ensure 可能已建好。
    const again = projectCache.get(key);
    if (again) return again;
    const projectId = await createLovartProject(deps);
    if (!projectId) throw new Error('Lovart 创建 project 失败：未返回 project_id');
    projectCache.set(key, projectId);
    keyFile.set(key, file);
    await persistKey(key);
    return projectId;
  });
}

/**
 * 清除某 accessKey 的 project 缓存并持久化。供 project 失效自愈时重建用。
 * 对齐 main.py ProjectManager.clear_project（main.py:269-274）。
 */
export async function clearLovartProject(accessKey: string): Promise<void> {
  return runSerialized(async () => {
    projectCache.delete(accessKey);
    const file = keyFile.get(accessKey);
    keyFile.delete(accessKey);
    if (file) {
      loadedFiles.delete(file);
      // 删除磁盘上该 accessKey 记录（重建后重新写入）。
      try {
        const scoped: Record<string, string> = {};
        for (const [k, v] of projectCache) {
          if (keyFile.get(k) === file) scoped[k] = v;
        }
        await fsp.writeFile(file, JSON.stringify(scoped, null, 2), 'utf8');
      } catch {
        // 静默。
      }
    }
  });
}

/**
 * 判断某发送错误是否表示「上游 project 已失效」（需重建）。
 * 对齐 main.py _is_project_invalid（main.py:588-602）：
 *   - 错误文案命中失效 hints（not found / not exist / does not exist / invalid / expired /
 *     deleted / missing / unknown project / 项目不存在 / 已删除 / 失效 / 不存在）；
 *   - 或（状态为 400/404/409 且文案含 "project"）。
 * @param err LovartError（上游业务码在 .code）或 RelayHttpError（HTTP 码在 .status）。
 */
export function isLovartProjectInvalid(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = String((err as { message?: unknown }).message ?? '').toLowerCase();
  const hints = [
    'not found',
    'not exist',
    'does not exist',
    'invalid',
    'expired',
    'deleted',
    'missing',
    'unknown project',
    '项目不存在',
    '已删除',
    '失效',
    '不存在',
  ];
  if (hints.some((h) => msg.includes(h))) return true;
  const status = (err as { status?: unknown }).status ?? (err as { code?: unknown }).code;
  const n = typeof status === 'number' ? status : Number(status);
  if ((n === 400 || n === 404 || n === 409) && msg.includes('project')) return true;
  return false;
}

/** 非 project 失效的发送错误原样抛出（LovartError/RelayHttpError 透传，其他包一层）。 */
function rethrowSendError(e: unknown): never {
  if (e instanceof LovartError || e instanceof RelayHttpError) throw e;
  throw e;
}

/**
 * send + project 失效自愈（对齐 main.py TaskService.send_with_project，main.py:779-790）：
 *   ensure project → send；抛 project 失效错误则 clear + 重建 → 重试一次；仍失败原样抛出。
 * 返回上游 threadId 与实际使用的 projectId（供句柄持久化）。
 */
export async function sendLovartChatWithProject(
  deps: LovartClientDeps,
  input: Omit<LovartSendInput, 'projectId'>,
): Promise<{ threadId: string; projectId: string }> {
  const projectId = await ensureLovartProject(deps);
  try {
    const threadId = await sendLovartChat(deps, { ...input, projectId });
    return { threadId, projectId };
  } catch (e) {
    if (isLovartProjectInvalid(e)) {
      // 对齐 main.py send_with_project：clear 旧缓存 → 重建（ensure 建新）→ 重试一次。
      await clearLovartProject(projectKey(deps));
      const rebuilt = await ensureLovartProject(deps);
      const threadId = await sendLovartChat(deps, { ...input, projectId: rebuilt });
      return { threadId, projectId: rebuilt };
    }
    rethrowSendError(e);
  }
}
