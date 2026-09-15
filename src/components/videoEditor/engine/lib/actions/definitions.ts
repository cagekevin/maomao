import type { ShortcutKey } from '@videoEditor/types/keybinding';

export type TActionCategory =
  'playback' | 'navigation' | 'editing' | 'selection' | 'history' | 'timeline' | 'controls';

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
    description: 'Play/Pause',
    category: 'playback',
    defaultShortcuts: ['space', 'k'],
  },
  'stop-playback': {
    description: 'Stop playback',
    category: 'playback',
  },
  'seek-forward': {
    description: 'Seek forward 1 second',
    category: 'playback',
    defaultShortcuts: ['l'],
  },
  'seek-backward': {
    description: 'Seek backward 1 second',
    category: 'playback',
    defaultShortcuts: ['j'],
  },
  'frame-step-forward': {
    description: 'Frame step forward',
    category: 'navigation',
    defaultShortcuts: ['right'],
  },
  'frame-step-backward': {
    description: 'Frame step backward',
    category: 'navigation',
    defaultShortcuts: ['left'],
  },
  'jump-forward': {
    description: 'Jump forward 5 seconds',
    category: 'navigation',
    defaultShortcuts: ['shift+right'],
  },
  'jump-backward': {
    description: 'Jump backward 5 seconds',
    category: 'navigation',
    defaultShortcuts: ['shift+left'],
  },
  'goto-start': {
    description: 'Go to timeline start',
    category: 'navigation',
    defaultShortcuts: ['home', 'enter'],
  },
  'goto-end': {
    description: 'Go to timeline end',
    category: 'navigation',
    defaultShortcuts: ['end'],
  },
  split: {
    description: 'Split elements at playhead',
    category: 'editing',
    defaultShortcuts: ['s'],
  },
  'split-left': {
    description: 'Split and remove left',
    category: 'editing',
    defaultShortcuts: ['q'],
  },
  'split-right': {
    description: 'Split and remove right',
    category: 'editing',
    defaultShortcuts: ['w'],
  },
  'delete-selected': {
    description: 'Delete selected elements',
    category: 'editing',
    defaultShortcuts: ['backspace', 'delete'],
  },
  'copy-selected': {
    description: 'Copy selected elements',
    category: 'editing',
    defaultShortcuts: ['ctrl+c'],
  },
  'export-selected-clip': {
    description: 'Export selected clip',
    category: 'editing',
  },
  'freeze-frame': {
    description: 'Freeze frame',
    category: 'editing',
  },
  'paste-copied': {
    description: 'Paste elements at playhead',
    category: 'editing',
    defaultShortcuts: ['ctrl+v'],
  },
  'toggle-snapping': {
    description: 'Toggle snapping',
    category: 'editing',
    defaultShortcuts: ['n'],
  },
  'select-all': {
    description: 'Select all elements',
    category: 'selection',
    defaultShortcuts: ['ctrl+a'],
  },
  'duplicate-selected': {
    description: 'Duplicate selected element',
    category: 'selection',
    defaultShortcuts: ['ctrl+d'],
  },
  'toggle-elements-muted-selected': {
    description: 'Mute/unmute selected elements',
    category: 'selection',
  },
  'toggle-elements-visibility-selected': {
    description: 'Show/hide selected elements',
    category: 'selection',
  },
  'detach-audio': {
    description: 'Detach audio from video',
    category: 'editing',
  },
  'convert-to-speech': {
    description: 'Convert text to speech',
    category: 'editing',
  },
  'toggle-bookmark': {
    description: 'Toggle bookmark at playhead',
    category: 'timeline',
  },
  undo: {
    description: 'Undo',
    category: 'history',
    defaultShortcuts: ['ctrl+z'],
  },
  redo: {
    description: 'Redo',
    category: 'history',
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
