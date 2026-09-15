import type { ShortcutKey } from '@videoEditor/types/keybinding';

export type TActionCategory = '回放' | '导航' | '编辑' | '选择' | '历史' | '时间轴' | '控制';

export interface TActionDefinition {
  description: string;
  category: TActionCategory;
  defaultShortcuts?: ShortcutKey[];
  // 【此处原有 `args?: Record<string, unknown>`，已删（TD-22-36）】
  // 「哪些动作带参、参数是什么」的契约**只有一份** = `actions/types.ts` 的 `TActionArgsMap`
  // （它被 `TActionWithArgs` / `TArgOfAction` / `TActionFunc` 消费，是编译器强制的那份）。
  // 这里那份是平行手抄副本，且**全库零消费者**（`getActionDefinition(...).args` 无人读）——
  // 留着它只是让「新增带参动作」多一处要记得同步的地方。
}

export const ACTIONS = {
  'toggle-play': {
    description: '播放/暂停',
    category: '回放',
    defaultShortcuts: ['space', 'k'],
  },
  'stop-playback': {
    description: '停止播放',
    category: '回放',
  },
  'seek-forward': {
    description: '快进 1 秒',
    category: '回放',
    defaultShortcuts: ['l'],
  },
  'seek-backward': {
    description: '快退 1 秒',
    category: '回放',
    defaultShortcuts: ['j'],
  },
  'frame-step-forward': {
    description: '逐帧前进',
    category: '导航',
    defaultShortcuts: ['right'],
  },
  'frame-step-backward': {
    description: '逐帧后退',
    category: '导航',
    defaultShortcuts: ['left'],
  },
  'jump-forward': {
    description: '跳转 5 秒',
    category: '导航',
    defaultShortcuts: ['shift+right'],
  },
  'jump-backward': {
    description: '回退 5 秒',
    category: '导航',
    defaultShortcuts: ['shift+left'],
  },
  'goto-start': {
    description: '跳到时间轴开头',
    category: '导航',
    defaultShortcuts: ['home', 'enter'],
  },
  'goto-end': {
    description: '跳到时间轴结尾',
    category: '导航',
    defaultShortcuts: ['end'],
  },
  split: {
    description: '在播放头处分割',
    category: '编辑',
    defaultShortcuts: ['s'],
  },
  'split-left': {
    description: '分割并删除左侧',
    category: '编辑',
    defaultShortcuts: ['q'],
  },
  'split-right': {
    description: '分割并删除右侧',
    category: '编辑',
    defaultShortcuts: ['w'],
  },
  'delete-selected': {
    description: '删除选中元素',
    category: '编辑',
    defaultShortcuts: ['backspace', 'delete'],
  },
  'copy-selected': {
    description: '复制选中元素',
    category: '编辑',
    defaultShortcuts: ['ctrl+c'],
  },
  'export-selected-clip': {
    description: '导出选中片段',
    category: '编辑',
  },
  'freeze-frame': {
    description: '冻结帧',
    category: '编辑',
  },
  'paste-copied': {
    description: '在播放头处粘贴',
    category: '编辑',
    defaultShortcuts: ['ctrl+v'],
  },
  'toggle-snapping': {
    description: '切换吸附',
    category: '编辑',
    defaultShortcuts: ['n'],
  },
  'select-all': {
    description: '全选元素',
    category: '选择',
    defaultShortcuts: ['ctrl+a'],
  },
  'duplicate-selected': {
    description: '复制选中元素副本',
    category: '选择',
    defaultShortcuts: ['ctrl+d'],
  },
  'toggle-elements-muted-selected': {
    description: '静音/取消静音选中元素',
    category: '选择',
  },
  'toggle-elements-visibility-selected': {
    description: '显示/隐藏选中元素',
    category: '选择',
  },
  'detach-audio': {
    description: '分离视频中的音频',
    category: '编辑',
  },
  'convert-to-speech': {
    description: '文字转语音',
    category: '编辑',
  },
  'toggle-bookmark': {
    description: '在播放头处切换书签',
    category: '时间轴',
  },
  undo: {
    description: '撤销',
    category: '历史',
    defaultShortcuts: ['ctrl+z'],
  },
  redo: {
    description: '重做',
    category: '历史',
    defaultShortcuts: ['ctrl+shift+z', 'ctrl+y'],
  },
} as const satisfies Record<string, TActionDefinition>;

export type TAction = keyof typeof ACTIONS;

export function getActionDefinition(action: TAction): TActionDefinition {
  return ACTIONS[action];
}

export function getDefaultShortcuts(): Record<ShortcutKey, TAction> {
  const shortcuts: Record<string, TAction> = {};

  for (const [action, def] of Object.entries(ACTIONS) as Array<[TAction, TActionDefinition]>) {
    if (def.defaultShortcuts) {
      for (const shortcut of def.defaultShortcuts) {
        shortcuts[shortcut] = action;
      }
    }
  }

  return shortcuts as Record<ShortcutKey, TAction>;
}
