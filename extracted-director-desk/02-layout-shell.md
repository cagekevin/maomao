# 3D 导演台 · 外壳布局结构（提取）

> 来源：`Scene3DFullscreen.tsx`（全屏主编辑器外壳）+ `Scene3DFullscreenHeader.tsx` + `Scene3DWindowBar.tsx`
> 用途：导演台的骨架。重构时照着这个结构搭壳，再替换内部逻辑。

---

## 1. 全屏壳（`Scene3DFullscreen`）

用 `createPortal(editorShell, document.body)` 挂到 body 全屏。整体三层布局：

```
┌──────────────────────────────────────────────┐
│  Scene3DWindowBar (仅 win32 自绘标题栏)        │  h-8
├──────────────────────────────────────────────┤
│  Scene3DFullscreenHeader (顶部工具栏)          │  min-h-[52px]
├──────────┬───────────────────┬───────────────┤
│ 左栏 260  │    3D 画布区       │ 右栏 300       │  ← AnimatePresence 开合
│ Inspector│  FencedCanvas     │ RightPanelBody │
│ or       │  (SceneContent)   │ + MoveHub      │
│ Trajectory│  中央覆盖层:        │               │
│ ListPanel│  - ViewportToolPill│               │
│          │  - TaskOverlays    │               │
│          │  - TrajectoryBanner│               │
│          │  - BottomBar(底部)  │               │
│          │  - TimelineBar(底) │               │
└──────────┴───────────────────┴───────────────┘
  CoachMarks / ExportingCard / moveFrameCapture (全局覆盖)
```

### 壳根 className
```tsx
<div
  className="workbench-shell fixed inset-0 isolate flex h-[100dvh] w-screen flex-col overflow-hidden
             bg-[var(--workbench-bg)] text-[var(--workbench-ink)] font-[var(--nomi-font-sans)]"
  style={{ position:'fixed', inset:0, width:'100vw', height:'100dvh',
           zIndex: FULLSCREEN_Z_INDEX, background:'var(--workbench-bg)', pointerEvents:'auto' }}
  role="dialog" aria-modal="true"
>
```

### 主区域
```tsx
<main className="relative flex min-h-0 flex-1 overflow-hidden bg-[var(--workbench-bg)]">
  {/* 左栏：AnimatePresence 收起动画 */}
  <motion.aside className="relative z-[2] flex min-h-0 shrink-0 flex-col overflow-hidden
                           border-r border-[var(--workbench-border)]
                           bg-[var(--workbench-surface-solid)] shadow-workbench-pop"
                 animate={{ opacity:1, scale:1, width:260, x:0 }}
                 exit={{ opacity:0, scale:0.16, width:0, x:-26 }}
                 initial={{ opacity:0, scale:0.16, width:0, x:-26 }}
                 style={{ transformOrigin:'top left' }}
                 transition={{ duration:0.24, ease:[0.22,1,0.36,1] }}>
    {trajectoryMode ? <TrajectoryListPanel/> : <SceneObjectList/>}
  </motion.aside>

  {/* 中央画布 */}
  <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--nomi-ink-05)]">
    <FencedCanvas camera={canvasCamera} dpr={[1,2]} ...>
      <SceneContent .../>          {/* 3D 场景内容 */}
      <Scene3DTrajectoryLayer/>    {/* 轨迹可视化 + 播放 */}
      <Scene3DTakeSampler/>        {/* 录 take 采样 */}
    </FencedCanvas>
    {/* 覆盖层 */}
    <CanvasPanelRestoreButton side="left"/>   {/* 左栏收起后的恢复钮 */}
    <CanvasPanelRestoreButton side="right"/>
    <CameraPreview/> or <PlaybackCameraMonitor/>
    <Scene3DTrajectoryEditBanner/>
    <Scene3DTaskOverlays/>
    <Scene3DViewportToolPill/>
    <Scene3DBottomBar/>            {/* 底部添加/操控条 */}
    <Scene3DTrajectoryTimelineBar/> {/* 底部时间轴 */}
  </div>

  {/* 右栏：AnimatePresence */}
  <motion.aside className="relative z-[2] flex min-h-0 shrink-0 flex-col overflow-hidden
                           border-l border-[var(--workbench-border)]
                           bg-[var(--workbench-surface-solid)] shadow-workbench-pop"
                 animate={{ opacity:1, scale:1, width:300, x:0 }}
                 exit={{ opacity:0, scale:0.16, width:0, x:26 }}
                 initial={{ opacity:0, scale:0.16, width:0, x:26 }}
                 style={{ transformOrigin:'top right' }}
                 transition={{ duration:0.24, ease:[0.22,1,0.36,1] }}>
    <CharacterPossessButton/>      {/* 顶部操控钮 */}
    <Scene3DRightPanelBody/>       {/* 属性 + MoveHub */}
  </motion.aside>
</main>

{/* 全局覆盖 */}
{showCoach && <Scene3DCoachMarks/>}
<Scene3DExportingCard/>
{moveFrameCapture}
```

**关键点**：
- 左右栏用 `motion.aside` + `AnimatePresence` 做收起动画，宽度 `260/300`，靠 `width:0 + scale:0.16 + x偏移` 收起。
- 中央画布背景是 `--nomi-ink-05`（比左右栏的 `--workbench-surface-solid` 略暗，凸显画布）。
- `FULLSCREEN_Z_INDEX` 在 `scene3dConstants.ts` 定义，保证盖住其他 UI。

---

## 2. 顶部工具栏（`Scene3DFullscreenHeader`）

```
[IconCube 标题]  [任务入口 pill: 构图图|人物动作|运镜参考]  ...  [精调][帮助][CTA 完成][X]
```

### 结构 + 样式
```tsx
<header className="relative z-[2] flex min-h-[52px] shrink-0 items-center gap-3
                   border-b border-[var(--workbench-border)]
                   bg-[var(--workbench-surface-solid)] px-4 shadow-nomi-sm">
  {/* 标题 */}
  <div className="flex min-w-0 flex-1 items-center gap-2">
    <IconCube size={18} className="shrink-0 text-[var(--workbench-muted)]"/>
    <div className="min-w-0 truncate text-body-sm font-medium text-[var(--workbench-ink)]">{title}</div>
  </div>

  {/* 任务入口 pill：圆角胶囊容器 + 选中白色浮起 */}
  <div className="flex shrink-0 items-center gap-1 rounded-pill bg-[var(--nomi-ink-05)] p-0.5" role="tablist">
    {tasks.map(t => (
      <button className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-pill px-2.5 text-caption transition-colors',
        active ? 'bg-[var(--nomi-paper)] font-medium text-[var(--nomi-ink)] shadow-nomi-sm'
               : 'text-[var(--nomi-ink-60)] hover:text-[var(--nomi-ink)]'
      )} role="tab" aria-selected={active}>
        <Icon size={14}/><span>{shortLabel}</span>
      </button>
    ))}
  </div>

  {/* 右侧操作 */}
  <div className="ml-auto flex min-w-0 items-center gap-2">
    {/* 精调 toggle：开=ink-05 底，关=paper 底 + muted 字 */}
    <button className={cn(
      'inline-flex h-8 shrink-0 items-center rounded-nomi-sm border border-[var(--nomi-line-soft)] px-2.5 text-caption',
      refineOpen ? 'bg-[var(--nomi-ink-05)] text-[var(--nomi-ink)]'
                 : 'bg-[var(--nomi-paper)] text-[var(--workbench-muted)] hover:bg-[var(--nomi-ink-05)] hover:text-[var(--workbench-ink)]'
    )}>精调</button>

    {/* 帮助：icon square */}
    <button className="grid size-8 shrink-0 place-items-center rounded-nomi-sm
                       border border-[var(--nomi-line-soft)] bg-[var(--nomi-paper)]
                       text-[var(--workbench-muted)] hover:bg-[var(--nomi-ink-05)] hover:text-[var(--workbench-ink)]">
      <IconHelp size={15}/>
    </button>

    {/* CTA 主按钮：ink 实底 + paper 字 */}
    <button className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-nomi
                       bg-[var(--nomi-ink)] px-3 text-caption font-medium text-[var(--nomi-paper)]
                       transition-opacity hover:opacity-90">
      <span>{ctaLabel}</span>
    </button>

    {/* 关闭 */}
    <button className="grid size-8 shrink-0 place-items-center rounded-nomi-sm
                       border border-[var(--nomi-line-soft)] bg-[var(--nomi-ink-05)]
                       text-[var(--nomi-ink-60)] hover:bg-[var(--nomi-ink-10)] hover:text-[var(--nomi-ink)]">
      <IconX size={16}/>
    </button>
  </div>
</header>
```

---

## 3. 窗口条（`Scene3DWindowBar`，仅 win32）

`isWindows ? <div class="app-drag ..."/> : null`。整条 `app-drag`（可拖窗），内部 `app-no-drag`。高度 `h-8`。

---

## 4. 组件间职责分离约定（重构参考）

Scene3DFullscreen 壳 **只做接线**（state 提升 + 传回调），把每块 UI 自闭合：
- 底部「显示哪个条」的判断 → `Scene3DBottomBar` 内部自决（操控角色/相机/默认添加条）。
- 顶部「操控」入口可见性 → `CharacterPossessButton` 内部自决。
- 右栏整运镜三 tab → `Scene3DMoveHub` 自闭合。
- 时间轴开合/播放 → `TrajectoryTimeline` 自闭合。
