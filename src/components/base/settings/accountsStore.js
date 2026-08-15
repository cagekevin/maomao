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
import { useSyncExternalStore } from 'react'
import { sGet, sSet } from '../storageAdapter.js'

const STORAGE_KEY = 'yimao_accounts'

// 演示环境占位常量（浏览器端/空态时 seed 的测试站点地址与头像，统一避免散落硬编码）
export const TEST_SITE_URL = 'http://localhost:3000'
export const TEST_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=test'

// 登录态 Cookie 白名单（即梦/字节系，复刻官方 `ma`）
export const LOGIN_COOKIE_WHITELIST = [
  'sid_tt', 'sid_guard', 'uid_tt', 'ttwid', 'n_mh', 'odin_tt',
  'has_biz_token', 'is_staff_user', 'user_spaces_idc',
]

// 运行端判断：是否 Chrome 扩展端（官方 `k = !!chrome.runtime?.id`）
export function isExtensionEnv() {
  return typeof chrome !== 'undefined' && !!chrome?.runtime?.id
}

// 预置演示环境（官方默认 rn=[]；原型本地为空时 seed 演示数据，便于直观看到卡片列表）
const DEFAULT_ENVS = [
  {
    id: 'env_demo_1',
    name: '即梦小号',
    siteName: '开发测试网',
    siteUrl: TEST_SITE_URL,
    avatar: TEST_AVATAR,
    isFavorite: false,
    cookies: [{ name: 'test', value: '123' }],
  },
  {
    id: 'env_demo_2',
    name: '即梦主号',
    siteName: '开发测试网',
    siteUrl: TEST_SITE_URL,
    avatar: TEST_AVATAR,
    isFavorite: false,
    cookies: [{ name: 'test', value: '456' }],
  },
]

function load() {
  try {
    const raw = sGet(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
    try { sSet(STORAGE_KEY, JSON.stringify(DEFAULT_ENVS)) } catch { /* ignore */ }
    return DEFAULT_ENVS
  } catch {
    return DEFAULT_ENVS
  }
}

// 模块级 state：环境数组 + 当前激活环境 id + 表单/菜单态（官方 rn/on/un/fn/mn/gn/ja）
let state = {
  envs: load(),
  activeId: null,
  confirmDeleteId: null, // 删除二次确认（官方 `ja`）
  saving: false,         // 保存中（官方 `yn`）
  formOpen: false,       // 是否显示表单（官方 `un`）
  formEditId: null,      // 正在编辑的环境 id，null=新建（官方 `mn`）
  formName: '',          // 表单名称（官方 `fn`）
  formCookies: '',       // 表单 Cookie 粘贴串（官方 `gn`）
}
const listeners = new Set()

function setState(patch) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function getSnapshot() {
  return state
}
export function useAccounts() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function persist() {
  try {
    sSet(STORAGE_KEY, JSON.stringify(state.envs))
  } catch { /* ignore */ }
}

// 保存环境数组（复刻官方 `fa`：内存 + 持久化）
function saveEnvs(next) {
  setState({ envs: next })
  persist()
}

// ── 表单控制（复刻官方 dn/pn/hn/_n + 表单 ✕ 关闭）──
export function openCreateForm() {
  setState({ formOpen: true, formEditId: null, formName: '', formCookies: '' })
}
export function openEditForm(envId) {
  const env = state.envs.find((e) => e.id === envId)
  if (!env) return
  setState({ formOpen: true, formEditId: envId, formName: env.name, formCookies: JSON.stringify(env.cookies) })
}
export function closeForm() {
  setState({ formOpen: false, formEditId: null, formName: '', formCookies: '' })
}
export function setFormName(name) {
  setState({ formName: name })
}
export function setFormCookies(str) {
  setState({ formCookies: str })
}

// ── 解析手动粘贴的 Cookie（复刻官方 Sa L1840-1866）──
// JSON 数组/单对象；失败且含 `=` 按 key=value; 拆（value 内可含 =）；否则 null。
export function parseCookies(input, fallbackHost) {
  const n = (input || '').trim()
  if (!n) return null
  try {
    const parsed = JSON.parse(n)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') return [parsed]
    return null
  } catch {
    if (n.includes('=')) {
      return n.split(';').map((e) => {
        const [t, ...rest] = e.trim().split('=')
        const val = rest.join('=')
        if (t && val) {
          return {
            name: t.trim(),
            value: val.trim(),
            domain: new URL(fallbackHost || 'https://example.com').hostname,
            path: '/',
            secure: true,
          }
        }
        return null
      }).filter(Boolean)
    }
    return null
  }
}

// 抓取当前激活标签页（复刻官方 Sa L1882-1897：url/favIcon/cookies/title前5字）
async function fetchActiveTab() {
  if (!isExtensionEnv()) return null
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab || null
  } catch {
    return null
  }
}

function dicebear(seed) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || 'env')}`
}

// cookie 全字段映射（复刻官方 Sa L1911-1923）
function mapCookie(e) {
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
  }
}

// ── 保存环境（复刻官方 `Sa(e)`，新建/修改同一入口）──
// auto=true 对应官方 `Sa(true)`（「保存当前环境」卡片：忽略表单，自动抓取/降级 + 新建）。
// 返回 { ok, error }；error 非空时调用方用 alert 提示（与官方一致）。
export async function saveEnvironment(auto = false) {
  setState({ saving: true })
  try {
    const formName = auto ? '' : state.formName
    const formCookies = auto ? '' : state.formCookies
    const editId = auto ? null : state.formEditId

    // name：表单名 → 激活标签页 title → 兜底「新建环境」
    let name = formName.trim()
    const tab = await fetchActiveTab()
    if (!name && tab?.title) name = tab.title
    name ||= '新建环境'

    let cookies = []
    let siteName = '未知网站'
    let siteUrl = ''
    let avatar = ''

    if (formCookies.trim()) {
      try {
        const parsed = parseCookies(formCookies, siteUrl)
        if (parsed === null || parsed.length === 0) throw Error('Invalid cookie format')
        cookies = parsed
        siteName = '手动添加'
        siteUrl ||= 'https://example.com'
        avatar = tab?.favIconUrl || dicebear(name)
      } catch {
        setState({ saving: false })
        return { ok: false, error: 'Cookie 格式错误，请输入有效的 JSON 数组或 key=value; 格式字符串' }
      }
    } else if (isExtensionEnv()) {
      // 扩展端：抓当前激活标签页 cookies
      if (tab?.url) {
        siteUrl = tab.url
        avatar = tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=64`
        cookies = await chrome.cookies.getAll({ url: tab.url })
        if (tab.title) siteName = tab.title.substring(0, 5)
      }
    } else {
      // 浏览器端降级：写测试数据（官方行为）
      siteName = '开发测试网'
      siteUrl = TEST_SITE_URL
      avatar = dicebear('test')
      cookies = [{ name: 'test', value: '123' }]
    }

    // 空 Cookie → 确认（复刻官方 Sa L1907 `e.length === 0 && !confirm(...)`；手动分支 cookies 恒>0，仅扩展端抓取为 0 时触发）
    if (cookies.length === 0 && !window.confirm('当前页面未检测到 Cookie，且未手动输入，确定要保存吗？')) {
      setState({ saving: false })
      return { ok: false, error: '' }
    }

    const mapped = cookies.map(mapCookie)

    let next
    if (editId) {
      // 修改：保留 siteName/siteUrl/avatar，更新 name/cookies
      next = state.envs.map((e) =>
        e.id === editId ? { ...e, name, cookies: mapped, avatar: avatar || e.avatar, siteName: e.siteName, siteUrl: e.siteUrl } : e
      )
    } else {
      const newEnv = {
        id: Date.now().toString(),
        name,
        siteName,
        siteUrl,
        avatar: avatar || dicebear(name),
        cookies: mapped,
      }
      next = [...state.envs, newEnv]
    }
    saveEnvs(next)
    setState({ formOpen: false, formEditId: null, formName: '', formCookies: '' })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `添加失败，请重试: ${e.message || '未知错误'}` }
  } finally {
    setState({ saving: false })
  }
}

// ── 切换 / 激活环境（复刻官方 `ga`：pa 同步 → 扩展端跳 siteUrl → cn 标记激活）──
export async function activateEnv(envId) {
  const env = state.envs.find((e) => e.id === envId)
  if (!env) return
  await syncCookies(env)
  if (isExtensionEnv() && env.siteUrl) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab) chrome.tabs.update(tab.id, { url: env.siteUrl })
    } catch { /* ignore */ }
  }
  setState({ activeId: envId })
}

// Cookie 同步注入（复刻官方 `pa`：先删多余 → 逐个 set，仅扩展端）
async function syncCookies(env) {
  if (!isExtensionEnv()) return
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url || !tab.url.startsWith('http')) return
    const url = tab.url
    const current = await chrome.cookies.getAll({ url })
    const envNames = new Set((env.cookies || []).map((e) => e.name))
    for (const c of current) {
      if (!envNames.has(c.name)) {
        try { await chrome.cookies.remove({ url, name: c.name, storeId: c.storeId }) } catch { /* ignore */ }
      }
    }
    for (const t of env.cookies || []) {
      try {
        const setOpts = { url, name: t.name, value: t.value }
        if (t.domain !== undefined) setOpts.domain = t.domain
        if (t.path !== undefined) setOpts.path = t.path
        if (t.secure !== undefined) setOpts.secure = t.secure
        if (t.httpOnly !== undefined) setOpts.httpOnly = t.httpOnly
        if (t.expirationDate) setOpts.expirationDate = t.expirationDate
        if (t.storeId) setOpts.storeId = t.storeId
        if (t.sameSite) setOpts.sameSite = t.sameSite
        await chrome.cookies.set(setOpts)
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

// ── 清除 Cookie（复刻官方 `ha`，仅扩展端）──
// all=true 清全部；all=false 仅清登录态白名单。清除后 reload 当前标签页。
// ⚠️ 忠实复刻：官方 `ha` 里的 `e.cookies = []` 是【无效果副作用】（只改内存对象引用，不调
//    `fa`/`an()` → 不触发 re-render、不落库），故此处【不做】任何 envs state 更新/持久化。
// 返回 { ok, count, error }。
export async function clearCookies(envId, all = false) {
  void envId
  if (!isExtensionEnv()) return { ok: true, count: 0, error: '' }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url || !tab.url.startsWith('http')) return { ok: false, count: 0, error: '无法获取当前页面 URL' }
    const url = tab.url
    const current = await chrome.cookies.getAll({ url })
    if (current.length === 0) return { ok: true, count: 0, error: '' }
    let cleared = 0
    for (const c of current) {
      if (all || LOGIN_COOKIE_WHITELIST.includes(c.name)) {
        try {
          await chrome.cookies.remove({ url, name: c.name, storeId: c.storeId })
          cleared++
        } catch { /* ignore */ }
      }
    }
    if (tab.id) {
      try { await chrome.tabs.reload(tab.id) } catch { /* ignore */ }
    }
    return { ok: true, count: cleared, error: '' }
  } catch {
    return { ok: false, count: 0, error: '清除 Cookies 失败' }
  }
}

// ── 删除环境（复刻官方 `Na`：二次确认，3s 未确认自动重置）──
export function requestDelete(envId) {
  if (state.confirmDeleteId === envId) {
    // 二次确认：真正删除
    saveEnvs(state.envs.filter((e) => e.id !== envId))
    if (state.activeId === envId) setState({ activeId: null })
    setState({ confirmDeleteId: null })
  } else {
    setState({ confirmDeleteId: envId })
    setTimeout(() => setState({ confirmDeleteId: null }), 3000)
  }
}

// ── 收藏（复刻官方 `Pa` toggle isFavorite）──
export function toggleFavorite(envId) {
  setState({
    envs: state.envs.map((e) => (e.id === envId ? { ...e, isFavorite: !e.isFavorite } : e)),
  })
  persist()
}

// ── 拖拽排序（复刻官方 `Da/Oa/ka/Aa`）──
export function moveEnv(fromIndex, toIndex) {
  if (fromIndex === null || fromIndex === toIndex) return
  const next = [...state.envs]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  saveEnvs(next)
}
