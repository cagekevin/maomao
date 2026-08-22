import { useEffect } from "react";
import { useDirectorStore, type TransformMode } from "../editor/store/directorStore";

/**
 * 3D 导演台视口快捷键（类 C4D/Blender 常用键位）。
 *
 * ⚠️ 边界：此 hook 只应在 3D 导演台全屏 overlay 存活期间挂载（由 DirectorDeskShell 调用）。
 * 监听挂载在 window 上，cleanup 时移除 → 导演台关闭即完全失效，不污染主画布/其他页面。
 *
 * 当前键位：
 *  - E  切换为「移动」工具
 *  - R  切换为「旋转」工具
 *  - T  切换为「缩放」工具
 *
 * 守卫：
 *  - 目标为 input/textarea/select/contentEditable 时忽略（避免属性面板输入误触发）
 *  - 按住 ctrl/meta/alt 时忽略（避免与浏览器/系统快捷键冲突）
 *  - 仅响应无修饰键的字母键（key.length === 1）
 */
export function useDirectorViewportShortcuts() {
  useEffect(() => {
    const MODE_BY_KEY: Record<string, TransformMode> = {
      e: "translate",
      r: "rotate",
      t: "scale",
    };

    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    function handleKeyDown(event: KeyboardEvent) {
      // 组合键/修饰键一律忽略
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // 表单控件输入中忽略
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const mode = MODE_BY_KEY[key];
      if (!mode) return;

      event.preventDefault();
      useDirectorStore.getState().setTransformMode(mode);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
