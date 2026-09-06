/**
 * 多开账号管理 store（环境 = 一组 Cookie 集合）。
 *
 * 1:1 复刻 docs/32 + 官方 Vr.jsx `V === 'accounts'` 多开页签逻辑：
 *  - 每个「环境」存一套 Cookie：{ id, name, siteName, siteUrl, avatar, cookies, isFavorite }
 *  - 运行端 k = !!chrome.runtime?.id；扩展端才有真实 Cookie 读写，浏览器端降级。
 *  - 数据持久化：localStorage（原型对官方 `users` KV 键 B.USERS 的替代）。
 *
 * 范式对齐 taskStore/assetStore：模块级 state + useSyncExternalStore，
 * 数据变更一律新引用，绝不原地修改（useSyncExternalStore 依赖引用变化触发渲染）。
 */
import { useSyncExternalStore } from 'react';
import type { Ref } from 'react';
import { contentGetAsync, contentSetAsync } from '../core/contentStore.ts';
import { askConfirm } from '../core/confirmStore.ts';
import { generateId } from '../core/idGen.ts';

const STORAGE_KEY = 'yimao_accounts';

/** 单个 Cookie 记录（chrome.cookies.Cookie 前端镜像；写入扩展时按 setOpts 缺字段降级） */
export interface AccountCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
  sameSite?: string;
  storeId?: string;
  [key: string]: unknown;
}

/** 浏览器环境 = 一组 Cookie 集合（+ localStorage 快照） */
export interface AccountEnv {
  id: string;
  name: string;
  siteName: string;
  siteUrl: string;
  avatar: string;
  cookies: AccountCookie[];
  /** 登录态 token 等 localStorage 快照（扩展端抓取；换环境时一并恢复免重登） */
  localStorage?: Record<string, string> | null;
  isFavorite?: boolean;
  [key: string]: unknown;
}

/** store 状态快照 */
export interface AccountsState {
  envs: AccountEnv[];
  activeId: string | null;
  confirmDeleteId: string | null;
  saving: boolean;
  formOpen: boolean;
  formEditId: string | null;
  formName: string;
  formCookies: string;
}

/** saveEnvironment 返回值 */
export interface SaveEnvironmentResult {
  ok: boolean;
  error?: string;
}

/** chrome 扩展的 tags 查询结果 tab（本模块只消费这几个字段） */
interface ChromeTabLike {
  id?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
}

// 轻量全局 chrome 类型声明：扩展 API 只在运行时存在（isExtensionEnv 守卫），此处仅做非空收窄
declare const chrome: {
  runtime?: { id?: string };
  tabs?: {
    query: (q: { active: boolean; currentWindow: boolean }) => Promise<ChromeTabLike[]>;
    // 可选参在前会触发 TS1016；此处调用点可能只传 props（tabId 为 undefined 时语义上等同当前页），
    // 如实声明为必填 + 调用处传 undefined，保持运行时行为不变
    update: (tabId: number | undefined, props: { url: string }) => Promise<unknown>;
    reload: (tabId: number) => Promise<unknown>;
  };
  cookies?: {
    getAll: (d: { url: string } | { domain: string }) => Promise<AccountCookie[]>;
    set: (opts: Record<string, unknown>) => Promise<unknown>;
    remove: (d: { url: string; name: string; storeId?: string }) => Promise<unknown>;
  };
  scripting?: {
    executeScript: (d: {
      target: { tabId: number };
      world: string;
      func: (...args: unknown[]) => unknown;
      args?: unknown[];
    }) => Promise<Array<{ result?: unknown }>>;
  };
};

// 演示环境占位常量（浏览器端降级新建环境时用的测试站点地址与头像，统一避免散落硬编码）
export const TEST_SITE_URL = 'http://localhost:3000';
export const TEST_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=test';

// 登录态 Cookie 白名单（即梦/字节系，复刻官方 `ma`）
export const LOGIN_COOKIE_WHITELIST = [
  'sid_tt',
  'sid_guard',
  'uid_tt',
  'ttwid',
  'n_mh',
  'odin_tt',
  'has_biz_token',
  'is_staff_user',
  'user_spaces_idc',
];

// 运行端判断：是否 Chrome 扩展端（官方 `k = !!chrome.runtime?.id`）
export function isExtensionEnv() {
  return typeof chrome !== 'undefined' && !!chrome?.runtime?.id;
}

// 水合防竞态：load 异步，仅当列表仍为空时应用结果，防止覆盖用户在加载期间的编辑
/**
 * 异步加载账号环境（走 KV 后端，读不到返回空、不写空覆盖——修 R6 关闭插件重开不丢的配套）。
 * 惰性执行一次，仅在环境列表仍为空时应用，避免与用户编辑竞态/覆盖。
 * @returns {Promise<Array>} 清洗后的环境数组
 */
async function load(): Promise<AccountEnv[]> {
  try {
    // contentGetAsync 返回 unknown（存储值不可信）：先 Array.isArray 判数组，再按 AccountEnv[]
    // 收窄（外层有运行时守卫才诚实，F11），不要在断言后才补守卫。
    const parsed: unknown = await contentGetAsync(STORAGE_KEY);
    const cleaned = Array.isArray(parsed)
      ? (parsed as AccountEnv[]).filter(
          (e) =>
            !String(e.id || '').startsWith('env_demo_') &&
            !(e.siteName === '开发测试网' && (e.cookies || []).every((c) => c.name === 'test')),
        )
      : [];
    if (state.envs.length === 0) setState({ envs: cleaned });
    return cleaned;
  } catch {
    if (state.envs.length === 0) setState({ envs: [] });
    return [];
  }
}

// 模块级 state：环境数组 + 当前激活环境 id + 表单/菜单态（官方 rn/on/un/fn/mn/gn/ja）。
// 不再同步 load（KV 为异步后端），初始为空，由上水合异步填充。
let state: AccountsState = {
  envs: [],
  activeId: null,
  confirmDeleteId: null, // 删除二次确认（官方 `ja`）
  saving: false, // 保存中（官方 `yn`）
  formOpen: false, // 是否显示表单（官方 `un`）
  formEditId: null, // 正在编辑的环境 id，null=新建（官方 `mn`）
  formName: '', // 表单名称（官方 `fn`）
  formCookies: '', // 表单 Cookie 粘贴串（官方 `gn`）
};
const listeners = new Set<() => void>();

function setState(patch: Partial<AccountsState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot(): AccountsState {
  return state;
}
export function useAccounts(): AccountsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// 异步落盘（对齐官方 users 走 localTool KV；等待 KV 完成，避免写空覆盖丢历史）
async function persist(): Promise<void> {
  await contentSetAsync(STORAGE_KEY, state.envs);
}

// 保存环境数组（复刻官方 `fa`：内存 + 异步持久化）
async function saveEnvs(next: AccountEnv[]): Promise<void> {
  setState({ envs: next });
  await persist();
}

// 首次模块加载时惰性水合（KV 异步，不能同步填充）
void load();

// ── 表单控制（复刻官方 dn/pn/hn/_n + 表单 ✕ 关闭）──
export function openCreateForm(): void {
  setState({ formOpen: true, formEditId: null, formName: '', formCookies: '' });
}
export function openEditForm(envId: string): void {
  const env = state.envs.find((e) => e.id === envId);
  if (!env) return;
  setState({
    formOpen: true,
    formEditId: envId,
    formName: env.name,
    formCookies: JSON.stringify(env.cookies),
  });
}
export function closeForm(): void {
  setState({ formOpen: false, formEditId: null, formName: '', formCookies: '' });
}
export function setFormName(name: string): void {
  setState({ formName: name });
}
export function setFormCookies(str: string): void {
  setState({ formCookies: str });
}

// ── 解析手动粘贴的 Cookie（复刻官方 Sa L1840-1866）──
// JSON 数组/单对象；失败且含 `=` 按 key=value; 拆（value 内可含 =）；否则 null。
export function parseCookies(input: string, fallbackHost?: string): AccountCookie[] | null {
  const n = (input || '').trim();
  if (!n) return null;
  try {
    const parsed = JSON.parse(n);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
    return null;
  } catch {
    if (n.includes('=')) {
      return n
        .split(';')
        .map((e) => {
          const [t, ...rest] = e.trim().split('=');
          const val = rest.join('=');
          if (t && val) {
            return {
              name: t.trim(),
              value: val.trim(),
              domain: new URL(fallbackHost || 'https://example.com').hostname,
              path: '/',
              secure: true,
            };
          }
          return null;
        })
        .filter(Boolean);
    }
    return null;
  }
}

// 抓取当前激活标签页（复刻官方 Sa L1882-1897：url/favIcon/cookies/title前5字）
async function fetchActiveTab(): Promise<ChromeTabLike | null> {
  if (!isExtensionEnv()) return null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
}

function dicebear(seed?: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || 'env')}`;
}

// cookie 全字段映射（复刻官方 Sa L1911-1923）
function mapCookie(e: AccountCookie): AccountCookie {
  return {
    name: e.name,
    value: e.value,
    domain: e.domain,
    path: e.path,
    secure: e.secure,
    httpOnly: e.httpOnly,
    expirationDate: e.expirationDate,
    sameSite: e.sameSite,
    storeId: e.storeId,
  };
}

/** 从 URL 解析 hostname（去端口）；失败返回空串 */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * 逐级上溯域名列表（如 www.qq.com → [www.qq.com, qq.com]）。
 * 不引入 tldts 等依赖：对公有后缀（如 .com.cn）会多上溯一层（com.cn），
 * 但多抓的这层通常无实际 cookie，仅多几次 getAll 调用，无害。
 */
export function domainAscendants(host?: string): string[] {
  const out: string[] = [];
  const parts = (host || '').split('.').filter(Boolean);
  for (let i = 0; i < parts.length - 1; i++) {
    out.push(parts.slice(i).join('.'));
  }
  return out; // [www.qq.com, qq.com]
}

/**
 * 抓取当前标签页相关的全部 Cookie（加强版）：
 *  - 先 getAll({url}) 拿当前域 + 其父域能访问的 cookie（Chrome 原生语义）；
 *  - 再按域名逐级上溯（www.qq.com → qq.com）getAll({domain})，把挂在
 *    其它子域 / 顶级注册域的登录 cookie 也抓进来（腾讯系、字节系等站点常用）；
 *  - 合并去重（按 name + domain + path）。
 * 仅扩展端可用；任一级失败静默跳过（尽量多抓，抓不全不阻塞保存）。
 */
async function collectAllCookies(url: string): Promise<AccountCookie[]> {
  if (!isExtensionEnv() || !url) return [];
  const seen = new Set<string>();
  const out: AccountCookie[] = [];
  const push = (c) => {
    if (!c) return;
    const key = `${c.name}|${c.domain}|${c.path}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  // 1) 当前 url 域（含父域）兜底
  try {
    const base = await chrome.cookies.getAll({ url });
    base.forEach(push);
  } catch {
    /* 忽略 */
  }

  // 2) 逐级上溯域名 getAll({domain})，覆盖其它子域/顶级域的登录 cookie
  const host = hostOf(url);
  for (const dom of domainAscendants(host)) {
    try {
      const list = await chrome.cookies.getAll({ domain: dom });
      list.forEach(push);
    } catch {
      /* 忽略 */
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// 【第二步·待实现】指纹多样性注入（UA / 语言 / 时区）。
// 目标：切换环境时，让每个环境的浏览器指纹有差异（UA、navigator.language、时区等），
//       降低被平台通过指纹关联的风险（参考指纹浏览器 AdsPower/比特 等原理）。
// 技术路线（受限于 manifest 当前无 debugger 权限，采用降级方案）：
//   - UA：`chrome.webRequest.onBeforeSendHeaders` 拦截请求改写 User-Agent 头（需在 manifest 加
//          `webRequest` + `webRequestBlocking` 权限）；仅服务端可见，页面 JS 的 navigator.userAgent 不变。
//   - 语言：content script 在 `world: 'MAIN'` 用 `Object.defineProperty` 覆盖 `navigator.language` /
//          `navigator.languages`（部分可改）。
//   - 时区：较难（Intl.DateTimeFormat 依赖系统），可用 main world 覆盖 `Intl.DateTimeFormat` 的部分行为。
// 注：Chrome 扩展做的是「有限度指纹模拟」，做不到指纹浏览器那种深度 Canvas/WebGL 内核级伪造；
//     若需强防关联，需引入 `debugger` 权限走 CDP（chrome.debugger.sendCommand）。
// 数据模型：环境对象增加 `fingerprint: { ua, language, timezone, screen }` 字段，
//           切换时按此注入（对齐上文 localStorage 的「保存快照 → 切换写回」模式）。
// 相关文件：accountsStore.js（切换逻辑）、public/background.js（webRequest 拦截）、public/manifest.json（权限）。
// 什么时候做：等用户说「做第二步」时，按此注释施工即可（注释即设计文档）。
// ────────────────────────────────────────────────────────────────────────────

/**
 * 读取当前标签页页面的 localStorage 快照（main world，读到的是页面真实 localStorage）。
 * 很多站点的登录态不只存 cookie，还存 localStorage（token/设备标识），切换环境时一并保存/恢复，
 * 登录态更完整。仅扩展端可用；非 http(s) 页或注入失败返回 null（不阻断保存/切换）。
 * @returns {Promise<Record<string,string>|null>} { key: value }，读取失败返回 null
 */
async function readTabLocalStorage(): Promise<Record<string, string> | null> {
  if (!isExtensionEnv()) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab?.url || !/^https?:/i.test(tab.url)) return null;
  try {
    // world: 'MAIN' 让注入代码跑在页面主世界，能访问页面真正的 localStorage（ISOLATED world 是扩展自己的）
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => {
        try {
          const out: Record<string, string> = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k) out[k] = localStorage.getItem(k) ?? '';
          }
          return out;
        } catch {
          return null;
        }
      },
    });
    const rr =
      res && typeof res.result === 'object' && res.result !== null && !Array.isArray(res.result)
        ? res.result
        : null;
    if (!rr) return null;
    // 注入函数写侧产出 string 值，但读侧仍逐值取 string 子集（F28：值类型不整体断言为 Record<string,string>）
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rr as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * 把环境的 localStorage 快照写回当前标签页页面（main world）。
 * 切换环境时调用，让目标环境的登录态（含 localStorage 部分）完整落到当前站点。
 * 仅扩展端可用；非 http(s) 页或注入失败静默跳过（不影响 cookie 切换主流程）。
 * @param {Record<string,string>|null} data localStorage 快照
 */
async function writeTabLocalStorage(
  data: Record<string, string> | null | undefined,
): Promise<void> {
  if (!isExtensionEnv() || !data) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab?.url || !/^https?:/i.test(tab.url)) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: (store) => {
        try {
          localStorage.clear();
          if (store && typeof store === 'object') {
            for (const k of Object.keys(store)) localStorage.setItem(k, store[k]);
          }
        } catch {
          /* 忽略 */
        }
      },
      args: [data],
    });
  } catch {
    /* 忽略 */
  }
}

// ── 保存环境（复刻官方 `Sa(e)`，新建/修改同一入口）──
// auto=true 对应官方 `Sa(true)`（「保存当前环境」卡片：忽略表单，自动抓取/降级 + 新建）。
// 返回 { ok, error }；error 非空时调用方用 alert 提示（与官方一致）。
export async function saveEnvironment(auto = false): Promise<SaveEnvironmentResult> {
  setState({ saving: true });
  try {
    const formName = auto ? '' : state.formName;
    const formCookies = auto ? '' : state.formCookies;
    const editId = auto ? null : state.formEditId;

    // name：表单名 → 激活标签页 title → 兜底「新建环境」
    let name = formName.trim();
    const tab = await fetchActiveTab();
    if (!name && tab?.title) name = tab.title;
    name ||= '新建环境';

    let cookies: AccountCookie[] = [];
    let localStorageData: Record<string, string> | null = null;
    let siteName = '未知网站';
    let siteUrl = '';
    let avatar = '';

    if (formCookies.trim()) {
      try {
        const parsed = parseCookies(formCookies, siteUrl);
        if (parsed === null || parsed.length === 0) throw Error('Invalid cookie format');
        cookies = parsed;
        siteName = '手动添加';
        siteUrl ||= 'https://example.com';
        avatar = tab?.favIconUrl || dicebear(name);
      } catch {
        setState({ saving: false });
        return {
          ok: false,
          error: 'Cookie 格式错误，请输入有效的 JSON 数组或 key=value; 格式字符串',
        };
      }
    } else if (isExtensionEnv()) {
      // 扩展端：抓当前激活标签页 cookies（加强版：逐级上溯域名，尽量抓全登录 cookie）
      // 并连带读取当前页面 localStorage 快照（登录态 token 常存这里，一并保存换环境免重登）
      if (tab?.url) {
        siteUrl = tab.url;
        avatar =
          tab.favIconUrl ||
          `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=64`;
        cookies = await collectAllCookies(tab.url);
        localStorageData = await readTabLocalStorage();
        if (tab.title) siteName = tab.title.substring(0, 5);
      }
    } else {
      // 浏览器端降级：写测试数据（官方行为）
      siteName = '开发测试网';
      siteUrl = TEST_SITE_URL;
      avatar = dicebear('test');
      cookies = [{ name: 'test', value: '123' }];
    }

    // 空 Cookie → 确认（复刻官方 Sa L1907 `e.length === 0 && !confirm(...)`；手动分支 cookies 恒>0，仅扩展端抓取为 0 时触发）。
    // 走 confirmStore：模块级 store 让 store 内也能直接 await 用户选择，
    // 不必把「用户是否确认」当参数从 UI 层一路传进来（这正是选 store 而非 hook 范式的价值）。
    if (
      cookies.length === 0 &&
      !(await askConfirm({
        title: '当前页面未检测到 Cookie，且未手动输入，确定要保存吗？',
        confirmText: '仍要保存',
        danger: true,
      }))
    ) {
      setState({ saving: false });
      return { ok: false, error: '' };
    }

    const mapped = cookies.map(mapCookie);

    let next: AccountEnv[];
    if (editId) {
      // 修改：保留 siteName/siteUrl/avatar，更新 name/cookies/localStorage
      next = state.envs.map((e) =>
        e.id === editId
          ? {
              ...e,
              name,
              cookies: mapped,
              localStorage: localStorageData ?? e.localStorage,
              avatar: avatar || e.avatar,
              siteName: e.siteName,
              siteUrl: e.siteUrl,
            }
          : e,
      );
    } else {
      const newEnv: AccountEnv = {
        id: generateId('env'),
        name,
        siteName,
        siteUrl,
        avatar: avatar || dicebear(name),
        cookies: mapped,
        // localStorage 快照：扩展端保存当前页面登录态 token（换环境时一并恢复，免重登）
        localStorage: localStorageData || undefined,
      };
      next = [...state.envs, newEnv];
    }
    await saveEnvs(next);
    setState({ formOpen: false, formEditId: null, formName: '', formCookies: '' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `添加失败，请重试: ${e.message || '未知错误'}` };
  } finally {
    setState({ saving: false });
  }
}

// ── 切换 / 激活环境（复刻官方 `ga`：pa 同步 → 扩展端跳 siteUrl → cn 标记激活）──
export async function activateEnv(envId: string): Promise<void> {
  const env = state.envs.find((e) => e.id === envId);
  if (!env) return;
  await syncCookies(env);
  if (isExtensionEnv() && env.siteUrl) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) chrome.tabs.update(tab.id, { url: env.siteUrl });
    } catch {
      /* ignore */
    }
  }
  setState({ activeId: envId });
}

// 环境同步注入（复刻官方 `pa`）：Cookie（先删多余 → 逐个 set）+ localStorage 快照，仅扩展端。
async function syncCookies(env: AccountEnv): Promise<void> {
  if (!isExtensionEnv()) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.url.startsWith('http')) return;
    const url = tab.url;
    const current = await chrome.cookies.getAll({ url });
    const envNames = new Set<string>((env.cookies || []).map((e) => e.name));
    for (const c of current) {
      if (!envNames.has(c.name)) {
        try {
          await chrome.cookies.remove({ url, name: c.name, storeId: c.storeId });
        } catch {
          /* ignore */
        }
      }
    }
    for (const t of env.cookies || []) {
      try {
        // 出站体含条件追加字段，显式标注为可索引记录
        const setOpts: Record<string, unknown> = { url, name: t.name, value: t.value };
        if (t.domain !== undefined) setOpts.domain = t.domain;
        if (t.path !== undefined) setOpts.path = t.path;
        if (t.secure !== undefined) setOpts.secure = t.secure;
        if (t.httpOnly !== undefined) setOpts.httpOnly = t.httpOnly;
        if (t.expirationDate) setOpts.expirationDate = t.expirationDate;
        if (t.storeId) setOpts.storeId = t.storeId;
        if (t.sameSite) setOpts.sameSite = t.sameSite;
        await chrome.cookies.set(setOpts);
      } catch {
        /* ignore */
      }
    }
    // 连带写回该环境的 localStorage 快照（登录态 token 常存这里，一并恢复免重登）
    await writeTabLocalStorage(env.localStorage);
  } catch {
    /* ignore */
  }
}

// ── 清除 Cookie（复刻官方 `ha`，仅扩展端）──
// all=true 清全部；all=false 仅清登录态白名单。清除后 reload 当前标签页。
// ⚠️ 忠实复刻：官方 `ha` 里的 `e.cookies = []` 是【无效果副作用】（只改内存对象引用，不调
//    `fa`/`an()` → 不触发 re-render、不落库），故此处【不做】任何 envs state 更新/持久化。
// 返回 { ok, count, error }。
export async function clearCookies(
  envId: string,
  all = false,
): Promise<{ ok: boolean; count: number; error: string }> {
  void envId;
  if (!isExtensionEnv()) return { ok: true, count: 0, error: '' };
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.url.startsWith('http'))
      return { ok: false, count: 0, error: '无法获取当前页面 URL' };
    const url = tab.url;
    const current = await chrome.cookies.getAll({ url });
    if (current.length === 0) return { ok: true, count: 0, error: '' };
    let cleared = 0;
    for (const c of current) {
      if (all || LOGIN_COOKIE_WHITELIST.includes(c.name)) {
        try {
          await chrome.cookies.remove({ url, name: c.name, storeId: c.storeId });
          cleared++;
        } catch {
          /* ignore */
        }
      }
    }
    if (tab.id) {
      try {
        await chrome.tabs.reload(tab.id);
      } catch {
        /* ignore */
      }
    }
    return { ok: true, count: cleared, error: '' };
  } catch {
    return { ok: false, count: 0, error: '清除 Cookies 失败' };
  }
}

// ── 删除环境（复刻官方 `Na`：二次确认，3s 未确认自动重置）──
export async function requestDelete(envId: string): Promise<void> {
  if (state.confirmDeleteId === envId) {
    // 二次确认：真正删除
    await saveEnvs(state.envs.filter((e) => e.id !== envId));
    if (state.activeId === envId) setState({ activeId: null });
    setState({ confirmDeleteId: null });
  } else {
    setState({ confirmDeleteId: envId });
    setTimeout(() => setState({ confirmDeleteId: null }), 3000);
  }
}

// ── 收藏（复刻官方 `Pa` toggle isFavorite）──
export async function toggleFavorite(envId: string): Promise<void> {
  setState({
    envs: state.envs.map((e) => (e.id === envId ? { ...e, isFavorite: !e.isFavorite } : e)),
  });
  await persist();
}

// ── 拖拽排序（复刻官方 `Da/Oa/ka/Aa`）──
export async function moveEnv(fromIndex: number | null, toIndex: number): Promise<void> {
  if (fromIndex === null || fromIndex === toIndex) return;
  const next = [...state.envs];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  await saveEnvs(next);
}
