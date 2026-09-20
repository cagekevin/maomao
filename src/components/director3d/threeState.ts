/**
 * R3F `useThree()` 的**具名形状** —— 3D 域内唯一真源（TD-07-9 A 组收口，2026-09-20）。
 *
 * 【为什么建】R3F `RootState.controls` 的类型是 `EventManager`（**不是** OrbitControls），
 * 而本域运行期拿到的就是 OrbitControls ⇒ 此前 **10 处**调用点各自写
 * `useThree() as unknown as { … }` 内联形状（`camera` 有 3 种写法、`controls` 有 3 种写法）
 * ⇒ 形状声明**散落 10 处**，改一处漏九处，且都不可跳转。
 *
 * 【收口后】**本文件是唯一一处双重断言**；调用点一律 `useThreeTyped()`，
 * 且类型有名字可跳转（`ThreeState` / `ThreeControls`）。
 *
 * 【为什么不直接用 R3F 自带的类型】`controls` 在运行期是 OrbitControls，与 `EventManager` 不兼容，
 * 必须断言 —— 但断言只该有**一份**，而不是每处一份。
 */
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * OrbitControls 在 R3F 里的运行期形状。
 * 字段合并自：原 `Viewport.tsx` 的 `OrbitLike`（target/update/addEventListener/removeEventListener）
 * 与各调用点用到的 `enabled` —— 结构性兼容三处旧写法（`{enabled}` · `OrbitLike` · `{update}`）。
 */
export interface ThreeControls {
  enabled: boolean;
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

/** 本域实际消费的 R3F state 字段集（并集；各调用点按需取子集） */
export type ThreeState = {
  camera: THREE.PerspectiveCamera;
  controls: ThreeControls | null;
  gl: THREE.WebGLRenderer;
  size: { width: number; height: number };
  invalidate: () => void;
};

/** 唯一一次双重断言：把 R3F 的 RootState 收窄为本域真实使用的形状 */
export const useThreeTyped = () => useThree() as unknown as ThreeState;
