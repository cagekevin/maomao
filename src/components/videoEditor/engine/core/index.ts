/**
 * EditorCore —— 剪辑器引擎总装（**长驻单例**）。
 *
 * 【两个生命周期，别混用】
 *   · `releaseProjectContext()` —— **上下文生命周期**：切换 / 关闭 / 新建项目、
 *     退出编辑器、编辑器卸载时调用。重置一切「跨项目存活」的状态，实例继续复用。
 *     **唯一入口**：禁止各调用点再手写零散清理（见下方方法头，TD-22-32/45/46 的成因）。
 *   · `EditorCore.reset()`（静态）—— **测试隔离**：丢弃单例，让下一次 `getInstance()`
 *     重新构造。只用测试；生产不销毁实例（销毁要成对调各 manager 的 `dispose()`）。
 */
import { PlaybackManager } from './managers/playback-manager';
import { TimelineManager } from './managers/timeline-manager';
import { ScenesManager } from './managers/scenes-manager';
import { ProjectManager } from './managers/project-manager';
import { MediaManager } from './managers/media-manager';
import { RendererManager } from './managers/renderer-manager';
import { CommandManager } from './managers/commands';
import { SaveManager } from './managers/save-manager';
import { AudioManager } from './managers/audio-manager';
import { SelectionManager } from './managers/selection-manager';
// ★ TD-22-68：把「访问单例」挪到叶子（见该文件头）—— 24 个命令类改依赖它，
//   从而断开「命令 → core/index.ts」这条环闭合边。本 import 是**单向**的：
//   core/index → editorInstance（值），editorInstance 只 `import type` 本文件 ⇒ 无环。
import { registerEditorInstance, clearEditorInstance } from './editorInstance';

export class EditorCore {
  private static instance: EditorCore | null = null;

  public readonly command: CommandManager;
  public readonly playback: PlaybackManager;
  public readonly timeline: TimelineManager;
  public readonly scenes: ScenesManager;
  public readonly project: ProjectManager;
  public readonly media: MediaManager;
  public readonly renderer: RendererManager;
  public readonly save: SaveManager;
  public readonly audio: AudioManager;
  public readonly selection: SelectionManager;

  private constructor() {
    this.command = new CommandManager();
    this.playback = new PlaybackManager(this);
    this.timeline = new TimelineManager(this);
    this.scenes = new ScenesManager(this);
    this.project = new ProjectManager(this);
    this.media = new MediaManager(this);
    this.renderer = new RendererManager(this);
    this.save = new SaveManager(this);
    this.audio = new AudioManager(this);
    this.selection = new SelectionManager(this);
    // TD-22-68：注册到叶子访问点（命令类经 getEditor() 取用，不再 import 本文件）。
    registerEditorInstance(this);
    this.save.start();
  }

  static getInstance(): EditorCore {
    if (!EditorCore.instance) {
      EditorCore.instance = new EditorCore();
    }
    return EditorCore.instance;
  }

  /**
   * 释放「当前项目上下文」—— 所有**跨项目存活**的状态在此统一重置。
   *
   * ════════════════════════════════════════════════════════════════
   * 【唯一入口】切项目 / 关项目 / 新建项目 / 切场景 / 退出编辑器 / 编辑器卸载 —— 一律走这里。
   *
   * 【为什么必须收口】此项此前被散写成 4 处「`media.clearAllAssets()` + `scenes.clearScenes()`」
   * 两行，且**每处都记不全**：命令栈、选择、音频、播放、渲染树没有一个被清。
   * 后果（TD-22-45/46/32，均为高息）：
   *   · B 项目按 Ctrl+Z → 弹出 A 项目的命令，其 `undo()` 把 **A 的 tracks 快照写回 B**；
   *   · 选择残留旧 trackId/elementId → 属性面板错乱 + 误删；
   *   · 旧项目音频继续调度；播放时间码停在旧位置。
   * 根因不是「漏调某个 API」，而是**没有一个人拥有这件事** —— 谁调用的谁就得记全 10 项，
   * 于是必然漏。本方法是这个「唯一拥有者」。
   * ════════════════════════════════════════════════════════════════
   *
   * 【语义 = 重置，不是销毁】实例继续复用：订阅、`AudioContext`、事件监听一律保留
   * （对照 `AudioManager.dispose()` 的销毁语义）。
   *
   * 【顺序】先停「会产生副作用的」（播放 → 音频在途调度），再清缓存、栈与项目本体。
   */
  releaseProjectContext(): void {
    this.playback.reset();
    this.audio.reset();
    this.renderer.setRenderTree({ renderTree: null });
    this.command.clear();
    this.selection.clearSelection();
    this.media.clearAllAssets();
    this.scenes.clearScenes();
    this.project.clearActive();
  }

  static reset(): void {
    EditorCore.instance = null;
    // TD-22-68：叶子访问点必须同步失效，否则 reset 后 getEditor() 仍返回**已丢弃的旧实例**
    // （测试隔离会假通过）。
    clearEditorInstance();
  }
}
