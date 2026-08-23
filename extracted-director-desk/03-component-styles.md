# 3D 导演台 · 组件样式规范（提取）

> 来源：`scene3dToolbar.tsx`、`scene3dCharacterActionBar.tsx`、`scene3dTrajectorySurfaces.tsx`、`trajectory/TrajectoryTimeline.tsx`
> 用途：各交互组件的外观类名清单。重构时直接复用这些 className 组合。

---

## 1. 通用按钮原语

### `PanelButton`（视口工具/选中态小按钮）
```tsx
<button className={cn(
  'inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-nomi-sm border px-2 whitespace-nowrap',
  'border-[var(--nomi-line-soft)] bg-[var(--nomi-ink-05)] text-caption text-[var(--nomi-ink-60)] transition',
  'hover:bg-[var(--nomi-ink-10)] hover:text-[var(--nomi-ink)]',
  active && 'border-[var(--nomi-ink)] bg-[var(--nomi-ink)] text-[var(--nomi-paper)] hover:bg-[var(--nomi-ink)] hover:text-[var(--nomi-paper)]'
)}/>
```
- 常态：软边框 + 极浅底 + 弱文字。
- 激活（active）：**ink 实底 + paper 字**（反色高亮）。

### `SceneAddButton`（无边框透明小按钮）
```tsx
<button className={cn(
  'inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-nomi px-2',
  'border-0 bg-transparent text-caption text-[var(--nomi-ink-60)] transition',
  'hover:bg-[var(--nomi-ink-05)] hover:text-[var(--nomi-ink)] disabled:cursor-not-allowed disabled:opacity-40',
  active && 'bg-[var(--nomi-ink-05)] text-[var(--nomi-ink)]'
)}/>
```

### `CanvasPanelRestoreButton`（侧栏收起后的恢复钮）
```tsx
<button className={cn(
  'pointer-events-auto absolute top-4 z-[4] grid size-9 place-items-center rounded-nomi',
  'border border-[var(--nomi-line-soft)] bg-[var(--nomi-paper)] text-[var(--nomi-ink-60)] shadow-[var(--nomi-shadow-md)]',
  'hover:bg-[var(--nomi-ink-05)] hover:text-[var(--nomi-ink)]',
  side === 'left' ? 'left-4' : 'right-4'
)}/>
```

---

## 2. 底部添加工具栏（`SceneAddToolbar`）

定位：**画布底部居中浮条**，白色浮层 + 阴影，内嵌多级弹出菜单。

```tsx
<div className="absolute bottom-5 left-1/2 z-[4] max-w-[calc(100%-32px)] -translate-x-1/2">
  {/* 主工具栏条：白色浮层 + md 阴影 + 圆角 */}
  <div className={cn(
    'inline-flex max-w-full items-center gap-1 overflow-x-auto p-[6px]',
    'rounded-nomi border border-[var(--workbench-border)] bg-[var(--nomi-paper)] text-[var(--nomi-ink)] shadow-[var(--nomi-shadow-md)]'
  )} role="toolbar">
    {/* 添加主钮：左侧黑色圆角方块包裹 +号 */}
    <button className={cn(
      'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-nomi py-0 pl-1 pr-2 transition',
      'border-0 bg-transparent text-caption text-[var(--nomi-ink-60)]',
      'hover:bg-[var(--nomi-ink-05)] hover:text-[var(--nomi-ink)]',
      addMenuOpen && 'bg-[var(--nomi-ink-05)] text-[var(--nomi-ink)]'
    )}>
      <span className="grid size-6 shrink-0 place-items-center rounded-nomi-sm bg-[var(--nomi-ink)] text-[var(--nomi-paper)]">
        <IconPlus size={15}/>
      </span>
      <span>添加</span>
      <IconChevronUp size={13} className={cn('transition', addMenuOpen && 'rotate-180')}/>
    </button>
    <span className="h-5 w-px shrink-0 bg-[var(--workbench-border)]"/> {/* 分隔线 */}
    <SceneAddButton .../> {/* 全屏切换 */}
  </div>

  {/* 一级菜单：上弹 156px 宽 */}
  <div className={cn(
    'absolute bottom-[calc(100%+8px)] left-0 z-[5] grid w-[156px] gap-1 p-[6px]',
    'rounded-nomi border border-[var(--workbench-border)] bg-[var(--nomi-paper)] text-[var(--nomi-ink)] shadow-[var(--nomi-shadow-md)]'
  )} role="menu">
    {/* 菜单项：图标+文字+右箭头 */}
    <button className={cn(
      'inline-flex h-8 w-full items-center justify-start gap-2 rounded-nomi px-2',
      'border-0 bg-transparent text-left text-caption text-[var(--nomi-ink-60)] transition',
      'hover:bg-[var(--nomi-ink-05)] hover:text-[var(--nomi-ink)]',
      subOpen && 'bg-[var(--nomi-ink-05)] text-[var(--nomi-ink)]'
    )}>
      <Icon size={15}/><span className="min-w-0 flex-1">场景模板</span><IconChevronRight size={14}/>
    </button>
    {/* 场景模板 / 几何 / 道具 / 假人 / 灯光 / 相机 */}
  </div>

  {/* 二级菜单：left-[164px] 偏移，级联展开 */}
  {/* 群众弹窗：240px 宽 p-3，内嵌数字输入 */}
</div>
```

**道具图标映射**（`PROP_MENU_ICONS`）：car/building/tree/streetlamp/wall/suv/bus/bicycle/scooter/sofa/diningTable/fridge/washingMachine/trashBins/atm/backpack → 各对应 `@tabler/icons-react`。

---

## 3. 视口左上角工具 pill（`Scene3DViewportToolPill`）

```tsx
<div className="pointer-events-auto absolute left-4 top-4 z-[3] flex items-center gap-1
                rounded-nomi border border-[var(--nomi-line-soft)] bg-[var(--nomi-paper)] p-0.5
                shadow-[var(--nomi-shadow-md)]">
  <PanelButton active={translate}> <IconArrowsMove/> </PanelButton>
  <PanelButton active={rotate}> <IconRotate/> </PanelButton>
  <span className="h-5 w-px shrink-0 bg-[var(--workbench-border)]"/>  {/* 分隔线 */}
  <PanelButton> <IconZoomScan/> </PanelButton>
</div>
```

---

## 4. 底部操控条

三种状态由 `Scene3DBottomBar` 切换，样式统一为「底部居中白色浮条」：

### 角色操控条（`CharacterActionBar`）
```tsx
<div className="absolute bottom-5 left-1/2 z-[8] max-w-[calc(100%-32px)] -translate-x-1/2">
  <div className={cn(
    'inline-flex max-w-full items-center gap-1 overflow-x-auto p-[6px]',
    'rounded-nomi border border-[var(--workbench-border)] bg-[var(--nomi-paper)] text-[var(--nomi-ink)] shadow-[var(--nomi-shadow-md)]'
  )} role="toolbar">
    {/* 当前操控角色 chip：ink 实底 + paper 字 */}
    <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-nomi bg-[var(--nomi-ink)] px-2.5 text-caption text-[var(--nomi-paper)]">
      <IconManFilled size={15}/>
      <span className="max-w-[120px] truncate">{name}</span>
    </span>
    <span className="h-5 w-px shrink-0 bg-[var(--workbench-border)]"/>
    {/* 动作库按钮（站立/下蹲/挥手/坐下）：选中态 ink-05 */}
    {/* 录 take 按钮 */}
    {/* 速度滑块 chip */}
    {/* 退出 */}
  </div>
  {/* 底部操作提示 */}
  <div className="mt-1.5 text-center text-micro text-[var(--nomi-ink-60)]">{hint}</div>
</div>
```

### 录 take 按钮（`TakeRecordButton`）
```tsx
// 非录制态：透明底 + 红色圆点 ●REC
<button className={cn(
  'inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-nomi px-2 whitespace-nowrap',
  'border-0 bg-transparent text-caption text-[var(--nomi-ink-60)] transition',
  'hover:bg-[var(--nomi-ink-05)] hover:text-[var(--nomi-ink)]'
)}>
  <IconCircleFilled size={12} className="text-[var(--workbench-danger)]"/>
  <span>录 take</span>
</button>

// 录制态：danger 实底 + paper 字 + 计时
<button className={cn(
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-nomi px-2.5 whitespace-nowrap',
  'border-0 bg-[var(--workbench-danger)] text-caption text-[var(--nomi-paper)] transition hover:opacity-90'
)}>
  <IconPlayerStopFilled size={14}/>
  <span className="tabular-nums">00:05</span>
</button>
```

### 速度滑块 chip
```tsx
<label className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-nomi
                  bg-[var(--nomi-ink-05)] px-2 text-caption text-[var(--nomi-ink-60)]">
  <span>速度</span>
  <input className="h-1.5 w-16 accent-[var(--nomi-ink)]" type="range" .../>
</label>
```

---

## 5. 轨迹相关浮层

### 轨迹编辑横幅（`Scene3DTrajectoryEditBanner`）— 顶部居中 pill
```tsx
<div className="pointer-events-auto absolute left-1/2 top-4 z-[3] flex -translate-x-1/2 items-center gap-2
                rounded-nomi border border-[var(--nomi-line-soft)] bg-[var(--nomi-paper)] px-3 py-2
                text-caption text-[var(--nomi-ink)] shadow-[var(--nomi-shadow-md)]">
  <IconRoute size={15} className="text-[var(--nomi-ink-60)]"/>
  <span>轨迹编辑中…</span>
  <button className="rounded-nomi-sm bg-[var(--nomi-ink-05)] px-2 py-1 text-micro text-[var(--nomi-ink-60)]
                     hover:bg-[var(--nomi-ink-10)] hover:text-[var(--nomi-ink)]">退出编辑</button>
</div>
```

---

## 6. 轨迹时间轴（`TrajectoryTimeline`）

**定位**：画布底部浮层（`absolute inset-x-4 bottom-4 z-[5]`），含左「轨道组」列 + 右「绑定轨道」区。

### 容器
```tsx
<div className="pointer-events-auto absolute inset-x-4 bottom-4 z-[5] max-w-none
                rounded-nomi-sm border border-[var(--nomi-line-soft)] bg-[var(--nomi-paper)] p-3
                text-[var(--nomi-ink)] shadow-[var(--nomi-shadow-md)]">
```

### 头部控制行
```tsx
<div className="mb-2 flex items-center gap-2">
  {/* 播放/暂停主钮：ink 实底 */}
  <button className="grid size-8 place-items-center rounded-nomi-sm bg-[var(--nomi-ink)] text-[var(--nomi-paper)] hover:opacity-90">
    <IconPlayerPlay size={16}/>
  </button>
  {/* 归零钮：ink-05 底 */}
  <button className="grid size-8 place-items-center rounded-nomi-sm bg-[var(--nomi-ink-05)] text-[var(--nomi-ink-60)]
                     hover:bg-[var(--nomi-ink-10)] hover:text-[var(--nomi-ink)]">
    <IconPlayerSkipBack size={16}/>
  </button>
  <div className="min-w-0 flex-1 text-caption font-medium">轨迹时间轴</div>
  <div className="text-micro text-[var(--nomi-ink-40)]">10.0s</div>
  {/* 关闭 */}
  <button className="grid size-8 place-items-center rounded-nomi-sm bg-[var(--nomi-ink-05)] text-[var(--nomi-ink-60)]
                     hover:bg-[var(--nomi-ink-10)] hover:text-[var(--nomi-ink)]">
    <IconX size={15}/>
  </button>
</div>
```

### 主体（左列 + 右区）
```tsx
<div className="grid max-h-[34vh] min-h-[132px] grid-cols-[190px_minmax(0,1fr)] overflow-hidden
                rounded-nomi-sm border border-[var(--nomi-line-soft)] bg-[var(--nomi-ink-05)]">
  {/* 左列：轨道组列表 */}
  <div className="min-w-0 border-r border-[var(--nomi-line-soft)] bg-[var(--nomi-paper)] p-2">
    {/* 组行（可选中/折叠/双击重命名） */}
    <div className={cn(
      'grid h-7 grid-cols-[20px_16px_minmax(0,1fr)_28px] items-center gap-1 rounded-nomi-sm px-1
       text-[var(--nomi-ink-60)] hover:bg-[var(--nomi-ink-05)]',
      selected && 'bg-[var(--nomi-ink)] text-[var(--nomi-paper)] hover:bg-[var(--nomi-ink)]'
    )}>
      <button>折叠chevron</button>
      <IconFolder size={13}/>
      <button className="min-w-0 truncate bg-transparent p-0 text-left text-micro font-medium text-inherit">组名</button>
      <span className="justify-self-end text-micro">数量</span>
    </div>
    {/* 轨迹子行（depth=1 缩进 pl-7） */}
    <button className="grid h-7 grid-cols-[16px_minmax(0,1fr)_40px] items-center gap-1 rounded-nomi-sm pr-1
                       text-[var(--nomi-ink-60)] hover:bg-[var(--nomi-ink-05)]">
      <span className="size-2.5 rounded-full" style={{backgroundColor: trajectory.color}}/> {/* 轨迹色点 */}
      <span className="min-w-0 truncate text-micro">{name}</span>
      <span className="justify-self-end text-micro text-[var(--nomi-ink-40)]">已绑定</span>
    </button>
  </div>

  {/* 右区：绑定轨道 + 播放头 */}
  <div className="min-w-0 p-2">
    <div className="grid grid-cols-5 text-micro text-[var(--nomi-ink-40)]">{/* 时间标尺 */}</div>
    <div ref={laneRef} className="relative mt-2 grid max-h-[calc(34vh-54px)] min-w-0 cursor-pointer gap-1 overflow-auto pr-1">
      {/* 绑定条 TimelineBindingBar */}
    </div>
  </div>
</div>
```

### 播放头（`TimelinePlayhead`）— 纯视觉指示器
```tsx
<div className="pointer-events-none absolute inset-y-0 z-[2] grid w-4 -translate-x-1/2 place-items-center" style={{left}}>
  <span className="h-full min-h-10 w-0.5 rounded-full bg-[var(--nomi-ink)] shadow-sm"/>
  <span className="absolute top-0 size-3 rounded-full border border-[var(--nomi-ink)] bg-[var(--nomi-paper)]"/>
</div>
```

### 绑定条（`TimelineBindingBar`）— 可拖动区间
```tsx
<div className={cn(
  'absolute inset-y-0 rounded-nomi-sm border border-nomi-paper/70 shadow-nomi-sm',
  readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
)} style={{ left:`${start}%`, width:`${width}%`, backgroundColor: trajectory.color }}>
  {/* 起点手柄 */}
  <span className="absolute inset-y-0 left-0 z-[1] w-2 cursor-ew-resize rounded-l-nomi-sm bg-nomi-ink-20 hover:bg-nomi-ink-30"/>
  {/* 终点手柄 */}
  <span className="absolute inset-y-0 right-0 z-[1] w-2 cursor-ew-resize rounded-r-nomi-sm bg-nomi-ink-20 hover:bg-nomi-ink-30"/>
  {/* 节点数 */}
  <span className="block truncate px-1.5 text-micro leading-7 text-nomi-paper">{nodeCount}</span>
  {/* 轨迹点（可拖时间） */}
  <button className="absolute top-1/2 z-[2] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full
                     border border-nomi-paper bg-nomi-paper shadow-nomi-sm ..."/>
</div>
```

---

## 7. 统一的「浮条」样式三要素（可抽成原语）

所有画布浮层都符合同一视觉语言：
1. **容器**：`rounded-nomi border border-[var(--workbench-border)] bg-[var(--nomi-paper)] shadow-[var(--nomi-shadow-md)]`
2. **按钮基线**：`h-8 rounded-nomi(-sm) text-caption`；`hover:bg-[var(--nomi-ink-05)]`
3. **激活态**：ink 实底反色 / 或 ink-05 底高亮；**危险/主 CTA** 用 ink 实底，**录/删**用 danger 实底。
