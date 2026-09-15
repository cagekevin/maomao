/**
 * ⚠️ 本文件是 **L0 类型层**，**不得** import `@videoEditor/engine*`（TD-22-31）。
 *
 * 原先它 import `TActionWithOptionalArgs` 来定义 `KeybindingConfig` ⇒ **反向依赖 engine**（层位倒置）。
 * 修法与 `MediaAssetData` 不同：`TActionWithOptionalArgs` 由 engine 里的 action 定义表推导，
 * **下沉不了**（总不能把整张 action 表拖进类型层）⇒ `KeybindingConfig` **上移**到
 * `engine/lib/actions/types.ts`。本文件只留零依赖的键位形状。
 */

/**
 * Alt is also regarded as macOS OPTION (⌥) key
 * Ctrl is also regarded as macOS COMMAND (⌘) key (NOTE: this differs from HTML Keyboard spec where COMMAND is Meta key!)
 */
export type ModifierKeys =
  'ctrl' | 'alt' | 'shift' | 'ctrl+shift' | 'alt+shift' | 'ctrl+alt' | 'ctrl+alt+shift';

export type Key =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | '/'
  | '?'
  | '.'
  | 'enter'
  | 'tab'
  | 'space'
  | 'escape'
  | 'esc'
  | 'backspace'
  | 'delete'
  | 'home'
  | 'end';
/* eslint-enable */

export type ModifierBasedShortcutKey = `${ModifierKeys}+${Key}`;
// Singular keybindings (these will be disabled when an input-ish area has been focused)
export type SingleCharacterShortcutKey = `${Key}`;

export type ShortcutKey = ModifierBasedShortcutKey | SingleCharacterShortcutKey;

/* `KeybindingConfig` 已上移到 `engine/lib/actions/types.ts`（TD-22-31，理由见文件头）。 */
