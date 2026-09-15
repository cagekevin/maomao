import type { MutableRefObject } from 'react';
import type { ShortcutKey } from '@videoEditor/types/keybinding';
import type { TAction } from './definitions';

export type { TAction };

export type TActionArgsMap = {
  'seek-forward': { seconds: number } | undefined;
  'seek-backward': { seconds: number } | undefined;
  'jump-forward': { seconds: number } | undefined;
  'jump-backward': { seconds: number } | undefined;
  'freeze-frame': { trackId: string; elementId: string } | undefined;
};

type TKeysWithValueUndefined<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

export type TActionWithArgs = keyof TActionArgsMap;

export type TActionWithOptionalArgs = TActionWithNoArgs | TKeysWithValueUndefined<TActionArgsMap>;

export type TActionWithNoArgs = Exclude<TAction, TActionWithArgs>;

export type TArgOfAction<A extends TAction> = A extends TActionWithArgs
  ? TActionArgsMap[A]
  : undefined;

export type TActionFunc<A extends TAction> = A extends TActionWithArgs
  ? (arg: TArgOfAction<A>, trigger?: TInvocationTrigger) => void
  : (_?: undefined, trigger?: TInvocationTrigger) => void;

export type TInvocationTrigger = 'keypress' | 'mouseclick';

export type TActionHandlerOptions = MutableRefObject<boolean> | boolean | undefined;

/**
 * 「键位 → action」的映射（用户可自定义的键位表）。
 *
 * 【为什么定义在本文件（2026-09-15 · TD-22-31）】它原先住在 `types/keybinding.ts`，
 * 但它的值类型 `TActionWithOptionalArgs` 是由**本模块的 action 定义表**推导出来的
 * （`TActionArgsMap` → `TKeysWithValueUndefined`），类型层拿不到
 * ⇒ 形成 **types → engine 的反向依赖**（层位倒置）。
 *
 * 与同一笔债里的 `MediaAssetData` **修法不同**：那个零 engine 依赖，可以**下沉**到 types；
 * 这个**下不去**（总不能把整张 action 表拖进类型层）⇒ 把**消费方类型上移**到 engine。
 * engine 依赖 types 是合法方向。`types/keybinding.ts` 仍保留纯键位形状
 * （`ModifierKeys` / `Key` / `ShortcutKey`），那部分零 engine 依赖。
 */
export type KeybindingConfig = {
  [key in ShortcutKey]?: TActionWithOptionalArgs;
};
