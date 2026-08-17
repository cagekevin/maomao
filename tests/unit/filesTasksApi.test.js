// 回归测试：filesApi.js、tasksApi.js、projectsApi.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  saveInlineToLocal,
  saveResultToTasks,
  saveTextToTasks,
  toAbsoluteFileUrl,
} from '../../src/components/base/filesApi.js'
import {
  fetchTasks,
  saveTask,
  batchSaveTasks,
  deleteTask,
  batchDeleteTasks,
  clearAllTasksApi,
} from '../../src/components/base/tasksApi.js'
import { fetchProjects, saveProjects } from '../../src/components/base/projectsApi.js'

const API_BASE = 'http://127.0.0.1:18080'

// ---------- 通用 fetch mock 工具 ----------
function okJson(body) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) }
}
function failRes(status = 500) {
  return { ok: false, status, json: () => Promise.resolve({}) }
}

/** 解析 fetch 调用的 FormData body，返回其 entries 的普通对象（file 取 File.name） */
function fdToObj(fd) {
  const out = {}
  for (const [k, v] of fd.entries()) {
    out[k] = v && typeof v === 'object' && 'name' in v ? { name: v.name, type: v.type } : v
  }
  return out
}

let fetchMock
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// =========================================================
// 一、filesApi.js
// =========================================================
// 说明：safeName 与 EXT_BY_TYPE 为 filesApi.js 内部私有实现（未导出），
// 而任务硬约束不允许改动源模块。故通过使用它们的导出函数间接覆盖：
//   - safeName 的「去非法字符 + 空格→下划线」由 saveTextToTasks 的 filename 体现；
//   - EXT_BY_TYPE 的类型→扩展名映射由 saveResultToTasks 上传文件名体现。
describe('filesApi §safeName/EXT_BY_TYPE（经导出函数间接覆盖）', () => {
  it('EXT_BY_TYPE：image→png / video→mp4 映射进 saveResultToTasks 上传文件名', async () => {
    const data = 'data:image/png;base64,QUJDRA==' // "ABCD"
    fetchMock.mockResolvedValue(okJson({ url: 'http://127.0.0.1:18080/files/tasks/ok.png' }))
    await saveResultToTasks(data, 'video') // video → mp4
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/files/upload`)
    expect(opts.method).toBe('POST')
    const body = fdToObj(opts.body)
    // 文件名 = result_<ts>.mp4，且 multipart 里额外带 filename=safeName('generated','mp4')
    expect(body.file.name).toMatch(/\.mp4$/)
    expect(body.filename).toMatch(/^generated_\d{8}_\d{6}\.mp4$/)
    expect(body.subfolder).toBe('tasks')
  })

  it('EXT_BY_TYPE：未知类型回退 bin（saveResultToTasks 上传文件名 .bin）', async () => {
    fetchMock.mockResolvedValue(okJson({ url: 'http://x/a.png' }))
    await saveResultToTasks('data:image/png;base64,QUJDRA==', 'unknownType')
    const body = fdToObj(fetchMock.mock.calls[0][1].body)
    expect(body.file.name).toMatch(/\.bin$/)
  })

  it('safeName：saveTextToTasks 对含非法字符/空格的 name 清洗（经 filename 体现）', async () => {
    fetchMock.mockResolvedValue(okJson({ url: 'http://x/t.txt' }))
    // 非法字符 [\/:*?"<>|] → _；空格 → _
    await saveTextToTasks('hello world', 'a/b:c*d?e"f<g>h|i j')
    const body = fdToObj(fetchMock.mock.calls[0][1].body)
    expect(body.file.name).toMatch(/\.txt$/)
    expect(body.filename).toMatch(/^a_b_c_d_e_f_g_h_i_j_\d{8}_\d{6}\.txt$/)
  })

  it('saveTextToTasks：空/非字符串文本返回 null，不发请求', async () => {
    expect(await saveTextToTasks('')).toBe(null)
    expect(await saveTextToTasks('   ')).toBe(null)
    expect(await saveTextToTasks(null)).toBe(null)
    expect(await saveTextToTasks(123)).toBe(null)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('filesApi §saveInlineToLocal', () => {
  it('非 data: 前缀（如 http / blob / 空）返回 null，不发请求', async () => {
    expect(await saveInlineToLocal(null)).toBe(null)
    expect(await saveInlineToLocal('')).toBe(null)
    expect(await saveInlineToLocal('http://x/y.png')).toBe(null)
    expect(await saveInlineToLocal('blob:http://x/abc')).toBe(null)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('data: 前缀 → POST /api/files/upload，文件名=sha1 前 16 位语义（40 位十六进制）.png，成功返回 url', async () => {
    const url = 'http://127.0.0.1:18080/files/canvas/abcd1234.png'
    fetchMock.mockResolvedValue(okJson({ url }))
    const res = await saveInlineToLocal('data:image/png;base64,QUJDRA==', 'canvas')
    expect(res).toBe(url)
    const [reqUrl, opts] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/files/upload`)
    expect(opts.method).toBe('POST')
    const body = fdToObj(opts.body)
    // 幂等去重：文件名 = sha1 十六进制（40 位）.png
    expect(body.file.name).toMatch(/^[a-f0-9]{40}\.png$/)
    expect(body.file.type).toBe('image/png')
    expect(body.subfolder).toBe('canvas')
  })

  it('落盘失败（!res.ok）返回 null，不抛异常', async () => {
    fetchMock.mockResolvedValue(failRes(500))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await saveInlineToLocal('data:image/png;base64,QUJDRA==')
    expect(res).toBe(null)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('落盘抛异常（fetch reject）返回 null，不抛异常', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await saveInlineToLocal('data:image/png;base64,QUJDRA==')
    expect(res).toBe(null)
    warn.mockRestore()
  })

  it('响应 json 解析失败（非 JSON）仍返回 null，不抛', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.reject(new Error('bad json')) })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await saveInlineToLocal('data:image/png;base64,QUJDRA==')
    expect(res).toBe(null)
    warn.mockRestore()
  })
})

describe('filesApi §saveResultToTasks', () => {
  it('blob: URL 返回 null，不发请求（本地临时地址无上传意义）', async () => {
    expect(await saveResultToTasks('blob:http://x/abc', 'image')).toBe(null)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('空 url 返回 null，不发请求', async () => {
    expect(await saveResultToTasks('', 'image')).toBe(null)
    expect(await saveResultToTasks(null, 'image')).toBe(null)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('data: URL → multipart 上传到 subfolder=tasks', async () => {
    fetchMock.mockResolvedValue(okJson({ url: 'http://x/t.png' }))
    await saveResultToTasks('data:image/png;base64,QUJDRA==', 'image')
    const [reqUrl, opts] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/files/upload`)
    expect(opts.method).toBe('POST')
    const body = fdToObj(opts.body)
    expect(body.subfolder).toBe('tasks')
    expect(body.filename).toMatch(/^generated_\d{8}_\d{6}\.png$/)
  })

  it('http(s) URL → JSON body fileUrl 幂等下载', async () => {
    fetchMock.mockResolvedValue(okJson({ url: 'http://x/result.png' }))
    await saveResultToTasks('http://upstream.example/a.png', 'image')
    const [reqUrl, opts] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/files/upload`)
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(opts.body)
    expect(body.fileUrl).toBe('http://upstream.example/a.png')
    expect(body.subfolder).toBe('tasks')
    expect(body.filename).toMatch(/^generated_\d{8}_\d{6}\.png$/)
  })

  it('落盘失败（!res.ok）返回 null，不抛', async () => {
    fetchMock.mockResolvedValue(failRes(500))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await saveResultToTasks('http://upstream.example/a.png', 'image')).toBe(null)
    warn.mockRestore()
  })
})

describe('filesApi §toAbsoluteFileUrl re-export', () => {
  it('re-export 来自 imageUrl.js：/files/ 相对路径补全为绝对 URL', () => {
    expect(toAbsoluteFileUrl('/files/tasks/x.png')).toBe(`${API_BASE}/files/tasks/x.png`)
  })

  it('re-export 非 /files/ 原样返回', () => {
    expect(toAbsoluteFileUrl('http://x/y.png')).toBe('http://x/y.png')
    expect(toAbsoluteFileUrl(null)).toBe(null)
    expect(toAbsoluteFileUrl(undefined)).toBe(undefined)
  })
})

// =========================================================
// 二、tasksApi.js
// =========================================================
describe('tasksApi §fetchTasks', () => {
  it('构造 page/pageSize/keyword 查询参数并返回 items/total', async () => {
    const payload = { items: [{ task_id: 't1' }], total: 1, page: 2, pageSize: 10 }
    fetchMock.mockResolvedValue(okJson(payload))
    const res = await fetchTasks({ page: 2, pageSize: 10, keyword: '生图' })
    const [reqUrl] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/tasks?page=2&pageSize=10&keyword=${encodeURIComponent('生图')}`)
    expect(res).toEqual(payload)
  })

  it('无 keyword 时不带 keyword 参数', async () => {
    fetchMock.mockResolvedValue(okJson({ items: [], total: 0 }))
    await fetchTasks({ page: 1, pageSize: 200 })
    const [reqUrl] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/tasks?page=1&pageSize=200`)
    expect(reqUrl).not.toContain('keyword')
  })

  it('空参默认 page=1 pageSize=200', async () => {
    fetchMock.mockResolvedValue(okJson({ items: [], total: 0 }))
    await fetchTasks()
    const [reqUrl] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/tasks?page=1&pageSize=200`)
  })

  it('非 ok 抛错', async () => {
    fetchMock.mockResolvedValue(failRes(500))
    await expect(fetchTasks()).rejects.toThrow('fetchTasks failed: HTTP 500')
  })
})

describe('tasksApi §saveTask', () => {
  it('POST JSON body 单条任务', async () => {
    fetchMock.mockResolvedValue(okJson({ ok: true }))
    const task = { task_id: 't1', prompt: '一只猫' }
    const res = await saveTask(task)
    expect(res).toEqual({ ok: true })
    const [reqUrl, opts] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/tasks/save`)
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(opts.body)).toEqual(task)
  })

  it('非 ok 抛错', async () => {
    fetchMock.mockResolvedValue(failRes(400))
    await expect(saveTask({})).rejects.toThrow('saveTask failed: HTTP 400')
  })
})

describe('tasksApi §batchSaveTasks', () => {
  it('空数组返回 { ok: true }，不发请求', async () => {
    expect(await batchSaveTasks([])).toEqual({ ok: true })
    expect(await batchSaveTasks(null)).toEqual({ ok: true })
    expect(await batchSaveTasks(undefined)).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('非空数组 POST /api/tasks/batch-save JSON body', async () => {
    fetchMock.mockResolvedValue(okJson({ ok: true }))
    const tasks = [{ task_id: 'a' }, { task_id: 'b' }]
    const res = await batchSaveTasks(tasks)
    expect(res).toEqual({ ok: true })
    const [reqUrl, opts] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/tasks/batch-save`)
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual(tasks)
  })

  it('非 ok 抛错', async () => {
    fetchMock.mockResolvedValue(failRes(500))
    await expect(batchSaveTasks([{ task_id: 'a' }])).rejects.toThrow('batchSaveTasks failed: HTTP 500')
  })
})

describe('tasksApi §deleteTask / batchDeleteTasks / clear', () => {
  it('deleteTask：POST /api/tasks/delete?id=...', async () => {
    fetchMock.mockResolvedValue(okJson({ ok: true }))
    await deleteTask('task/123')
    const [reqUrl, opts] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/tasks/delete?id=task%2F123`) // encodeURIComponent 转义 /
    expect(opts.method).toBe('POST')
  })

  it('deleteTask：非 ok 抛错', async () => {
    fetchMock.mockResolvedValue(failRes(500))
    await expect(deleteTask('t1')).rejects.toThrow('deleteTask failed: HTTP 500')
  })

  it('batchDeleteTasks：空 ids 返回 { deleted: 0 }，不发请求', async () => {
    expect(await batchDeleteTasks([])).toEqual({ deleted: 0 })
    expect(await batchDeleteTasks(null)).toEqual({ deleted: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('batchDeleteTasks：POST /api/tasks/batch-delete { ids }，返回后端 deleted:n', async () => {
    fetchMock.mockResolvedValue(okJson({ deleted: 2 }))
    const res = await batchDeleteTasks(['a', 'b'])
    expect(res).toEqual({ deleted: 2 })
    const [reqUrl, opts] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/tasks/batch-delete`)
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ ids: ['a', 'b'] })
  })

  it('clearAllTasksApi：POST /api/tasks/clear，返回 deleted:n', async () => {
    fetchMock.mockResolvedValue(okJson({ deleted: 5 }))
    const res = await clearAllTasksApi()
    expect(res).toEqual({ deleted: 5 })
    const [reqUrl, opts] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/tasks/clear`)
    expect(opts.method).toBe('POST')
  })

  it('clearAllTasksApi：非 ok 抛错', async () => {
    fetchMock.mockResolvedValue(failRes(500))
    await expect(clearAllTasksApi()).rejects.toThrow('clearTasks failed: HTTP 500')
  })
})

// =========================================================
// 三、projectsApi.js
// =========================================================
describe('projectsApi §fetchProjects', () => {
  it('GET /api/projects 返回项目列表 + lastOpened', async () => {
    const payload = {
      projects: [{ id: 'p1', name: '项目A', createdAt: 'x' }],
      lastOpened: 'p1',
    }
    fetchMock.mockResolvedValue(okJson(payload))
    const res = await fetchProjects()
    expect(res).toEqual(payload)
    const [reqUrl] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/projects`)
  })

  it('非 ok 抛错', async () => {
    fetchMock.mockResolvedValue(failRes(500))
    await expect(fetchProjects()).rejects.toThrow('fetchProjects failed: HTTP 500')
  })
})

describe('projectsApi §saveProjects', () => {
  it('POST /api/projects/save 发送 { projects, lastOpened }', async () => {
    fetchMock.mockResolvedValue(okJson({ ok: true }))
    const projects = [{ id: 'p1', name: '项目A' }, { id: 'p2', name: '项目B' }]
    const lastOpened = 'p2'
    const res = await saveProjects(projects, lastOpened)
    expect(res).toEqual({ ok: true })
    const [reqUrl, opts] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/projects/save`)
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(opts.body)
    // 项目只带 id/name，且带 currentId(lastOpened)
    expect(body.projects).toEqual([{ id: 'p1', name: '项目A' }, { id: 'p2', name: '项目B' }])
    expect(body.lastOpened).toBe('p2')
    expect(body.projects[0].id).toBe('p1')
    expect(body.projects[0].name).toBe('项目A')
  })

  it('非 ok 抛错', async () => {
    fetchMock.mockResolvedValue(failRes(500))
    await expect(saveProjects([], 'p1')).rejects.toThrow('saveProjects failed: HTTP 500')
  })
})
