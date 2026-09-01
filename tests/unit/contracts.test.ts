// @ts-nocheck
// 回归测试：contracts.ts（横切契约登记表）
import { describe, it, expect } from 'vitest'
import { EVENTS, STORAGE_KEYS, GEN_ERRORS, getLocalKeys, getKvKeyPatterns } from '../../src/components/base/contracts.ts'

/* ════════════════════════════════════════════════════════════════
 * STORAGE_KEYS 结构检查
 * ════════════════════════════════════════════════════════════════ */

describe('STORAGE_KEYS 结构完整性', () => {
  const REQUIRED_FIELDS = ['domain', 'store', 'backend', 'note']

  it('每条记录包含所有必需字段', () => {
    const entries = Object.entries(STORAGE_KEYS)
    expect(entries.length).toBeGreaterThan(0)
    for (const [key, entry] of entries) {
      for (const field of REQUIRED_FIELDS) {
        expect(entry[field], `${key} 缺少 ${field}`).toBeDefined()
      }
    }
  })

  it('backend 必须是合法值', () => {
    const VALID_BACKENDS = ['local', 'kv', 'native']
    for (const [key, entry] of Object.entries(STORAGE_KEYS)) {
      expect(VALID_BACKENDS, `${key} backend 非法: ${entry.backend}`).toContain(entry.backend)
    }
  })

  it('domain 不能为空字符串', () => {
    for (const [key, entry] of Object.entries(STORAGE_KEYS)) {
      expect(entry.domain, `${key} domain 为空`).toBeTruthy()
    }
  })

  it('store 不能为空字符串', () => {
    for (const [key, entry] of Object.entries(STORAGE_KEYS)) {
      expect(entry.store, `${key} store 为空`).toBeTruthy()
    }
  })

  it('note 不能为空字符串', () => {
    for (const [key, entry] of Object.entries(STORAGE_KEYS)) {
      expect(entry.note, `${key} note 为空`).toBeTruthy()
    }
  })
})

describe('STORAGE_KEYS 语义检查', () => {
  it('pattern 为 true 的键必须含 {xxx} 占位符', () => {
    for (const [key, entry] of Object.entries(STORAGE_KEYS)) {
      if (entry.pattern) {
        expect(key).toMatch(/\{/m)
      }
    }
  })

  it('pattern 缺省为 false 的键不应含 {xxx} 占位符', () => {
    for (const [key, entry] of Object.entries(STORAGE_KEYS)) {
      if (!entry.pattern) {
        // 动态键模板必须显式标记 pattern:true
        expect(key).not.toMatch(/\{/m)
      }
    }
  })

  it('migration 字段存在时必须是字符串', () => {
    for (const [key, entry] of Object.entries(STORAGE_KEYS)) {
      if (entry.migration !== undefined) {
        expect(typeof entry.migration, `${key} migration 不是字符串`).toBe('string')
      }
    }
  })

  it('migration 键指向的目标必须存在', () => {
    for (const [key, entry] of Object.entries(STORAGE_KEYS)) {
      if (entry.migration) {
        // migration 值可能是目标键名或包含 {xxx} 的模板，检查目标键是否在注册表中
        const targetKey = entry.migration
        const found = Object.keys(STORAGE_KEYS).find((k) => k.startsWith(targetKey.replace(/\{.*\}/, '')))
        expect(found, `${key} 的 migration 目标 "${targetKey}" 在 STORAGE_KEYS 中不存在`).toBeTruthy()
      }
    }
  })

  it('native 后端的键不通过 storageAdapter，应手动确认无遗漏', () => {
    const nativeKeys = Object.entries(STORAGE_KEYS).filter(([, v]) => v.backend === 'native')
    // P2-F2：director3d-project 已迁移为 kv（走 KV 主通道），native 仅剩 director3d-custom-poses
    expect(nativeKeys.length).toBeGreaterThanOrEqual(1)
    for (const [key, entry] of nativeKeys) {
      expect(entry.store, `${key} 需标注 store 来源`).toBeTruthy()
    }
  })
})

describe('STORAGE_KEYS 内容验证', () => {
  it('当前共有 34 个登记键', () => {
    expect(Object.keys(STORAGE_KEYS).length).toBe(34)
  })

  it('包含所有核心业务键', () => {
    const keys = Object.keys(STORAGE_KEYS)
    expect(keys).toContain('projects')
    expect(keys).toContain('lastOpenedProject')
    expect(keys).toContain('app_settings')
    expect(keys).toContain('agent_skills')
    expect(keys).toContain('agent_skill_usage')
    expect(keys).toContain('agent_skill_enabled')
    expect(keys).toContain('agent_chat_model')
    expect(keys).toContain('yimao_preset_prompts')
    expect(keys).toContain('yimao_preset_recent')
    expect(keys).toContain('yimao_asset_library')
    expect(keys).toContain('yimao_node_prefs')
    expect(keys).toContain('yimao_accounts')
    expect(keys).toContain('agent_panel_width')
    expect(keys).toContain('agent_draft')
    expect(keys).toContain('agent_input_mode')
    expect(keys).toContain('canvasAgentGenParams')
    expect(keys).toContain('mutiwindow-clipboard')
  })

  it('包含 KV 画布快照键', () => {
    expect(Object.keys(STORAGE_KEYS)).toContain('canvas-state-v1-{projectId}')
    expect(Object.keys(STORAGE_KEYS)).toContain('canvas-state-v1-{projectId}_version')
  })

  it('账号 yimao_accounts 后端为 kv（R1/R6：走 KV 磁盘持久化 + 云同步）', () => {
    expect(STORAGE_KEYS.yimao_accounts.backend).toBe('kv')
    expect(STORAGE_KEYS.yimao_accounts.domain).toBe('account')
  })

  it('包含 AI 会话动态键', () => {
    expect(Object.keys(STORAGE_KEYS)).toContain('agent_conversations_{agentKey}')
    expect(Object.keys(STORAGE_KEYS)).toContain('agent_active_conversation_id_{agentKey}')
  })

  it('旧迁移键标记了 migration 字段', () => {
    expect(STORAGE_KEYS.agent_conversations.migration).toBe('agent_conversations_{agentKey}')
    expect(STORAGE_KEYS.agent_active_conversation_id.migration).toBe('agent_active_conversation_id_{agentKey}')
  })
})

/* ════════════════════════════════════════════════════════════════
 * getLocalKeys / getKvKeyPatterns 辅助函数
 * ════════════════════════════════════════════════════════════════ */

describe('getLocalKeys', () => {
  it('返回所有 backend=local 且不含 migration 的键', () => {
    const keys = getLocalKeys()
    expect(keys.length).toBeGreaterThan(0)
    // 应包含非迁移的 local 键
    expect(keys).toContain('projects')
    expect(keys).toContain('app_settings')
    // 不应包含 kv 键
    expect(keys).not.toContain('canvas-state-v1-{projectId}')
    // 不应包含 native 键
    expect(keys).not.toContain('storyai-3d-director-local-model-library')
    // 不应包含迁移旧键
    expect(keys).not.toContain('agent_conversations')
    // 不应包含动态键模板
    expect(keys).not.toContain('agent_conversations_{agentKey}')
  })

  it('返回的键数量与 STORAGE_KEYS 中 local+migration+pattern 过滤一致', () => {
    const expected = Object.entries(STORAGE_KEYS)
      .filter(([, v]) => v.backend === 'local' && !v.migration && !v.pattern)
      .length
    expect(getLocalKeys().length).toBe(expected)
  })
})

describe('getKvKeyPatterns', () => {
  it('返回所有 backend=kv 的键', () => {
    const keys = getKvKeyPatterns()
    expect(keys).toContain('canvas-state-v1-{projectId}')
    expect(keys).toContain('canvas-state-v1-{projectId}_version')
    // 不应包含非 kv 键
    expect(keys).not.toContain('projects')
    expect(keys).not.toContain('app_settings')
  })

  it('返回的键数量与 STORAGE_KEYS 中 kv 过滤一致', () => {
    const expected = Object.entries(STORAGE_KEYS).filter(([, v]) => v.backend === 'kv').length
    expect(getKvKeyPatterns().length).toBe(expected)
  })
})

/* ════════════════════════════════════════════════════════════════
 * EVENTS 结构检查
 * ════════════════════════════════════════════════════════════════ */

describe('EVENTS 结构完整性', () => {
  const REQUIRED_FIELDS = ['from', 'to', 'payload', 'note']

  it('每条事件记录包含所有必需字段', () => {
    const entries = Object.entries(EVENTS)
    expect(entries.length).toBeGreaterThan(0)
    for (const [key, entry] of entries) {
      for (const field of REQUIRED_FIELDS) {
        expect(entry[field], `${key} 缺少 ${field}`).toBeDefined()
      }
    }
  })

  it('from 必须是数组', () => {
    for (const [key, entry] of Object.entries(EVENTS)) {
      expect(Array.isArray(entry.from), `${key} from 不是数组`).toBe(true)
    }
  })

  it('to 必须是数组', () => {
    for (const [key, entry] of Object.entries(EVENTS)) {
      expect(Array.isArray(entry.to), `${key} to 不是数组`).toBe(true)
    }
  })

  it('payload 必须是字符串', () => {
    for (const [key, entry] of Object.entries(EVENTS)) {
      expect(typeof entry.payload, `${key} payload 不是字符串`).toBe('string')
    }
  })

  it('事件名格式为 domain:action 或 domain-action', () => {
    for (const key of Object.keys(EVENTS)) {
      expect(key).toMatch(/^[a-z-]+[:|-][a-z-]+$/)
    }
  })
})

describe('EVENTS 内容验证', () => {
  it('当前共有 10 个登记事件', () => {
    expect(Object.keys(EVENTS).length).toBe(10)
  })

  it('包含所有核心事件', () => {
    const keys = Object.keys(EVENTS)
    expect(keys).toContain('agent:task-completed')
    expect(keys).toContain('presets-changed')
    expect(keys).toContain('project:import')
    expect(keys).toContain('project:export')
    expect(keys).toContain('persist:failed')
    expect(keys).toContain('agent:credit-gate')
    // P1-D 新增：素材发送事件收口（取代 assetStore 裸回调桥）+ 跨窗口画布移除边登记
    expect(keys).toContain('asset:sent')
    expect(keys).toContain('yimao:remove-edge')
    // P2-G 新增：上游完成 → 直接下游可自动触发（安全网）
    expect(keys).toContain('upstream:updated')
    // 素材改名/移动归类 → 旧 url 广播，App 订阅后改写画布引用
    expect(keys).toContain('resource:renamed')
  })
})

/* ════════════════════════════════════════════════════════════════
 * GEN_ERRORS 结构检查
 * ════════════════════════════════════════════════════════════════ */

describe('GEN_ERRORS', () => {
  it('存在且为对象', () => {
    expect(GEN_ERRORS).toBeDefined()
    expect(typeof GEN_ERRORS).toBe('object')
  })
})