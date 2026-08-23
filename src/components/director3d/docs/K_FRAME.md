# K 帧（关键帧）交互说明

> 本文档描述 3D 导演台的手动 K 帧（打关键帧）交互。当前**已移除 Auto Key（自动关键帧）**，所有关键帧都通过手动 K 帧按钮写入。

## 一、核心概念

- **播放头（Playhead）**：时间轴上的当前时间点，所有打帧都以「当前播放头时间」为写入时间。
- **关键帧（Keyframe）**：在某个时间点上记录对象/相机的一组属性值（位置/旋转/缩放/注视/FOV/姿态等）。
- **轨道（Track）**：每个可打帧对象（角色/道具/机位）在 `timeline.tracks[trackId]` 下维护一组关键帧。

## 二、属性行结构（单一真相）

右侧属性面板（角色 / 模型 / 摄像机）中，每个可打帧属性是一行，行内三部分组成：

```
[ ◆ K帧按钮 ] [ 标签：位置 X ] [ 数值输入框 ]
```

- **每轴一行**：位置 / 旋转 / 缩放 / 注视 按 X、Y、Z 拆成三行（如「位置 X」「位置 Y」「位置 Z」），每轴可独立打帧。
- 统一缩放、相机 FOV 是单行（单值属性）。
- 该行结构由 `TransformKeyframeRows.tsx` 统一渲染，各面板通过 `buildVecAxisRows` 共享构建逻辑，保证属性输入与打帧触点是同一处（单一真相）。

### 支持打帧的属性（面板）

| 面板 | 属性 | 字段 |
|---|---|---|
| 角色 / 模型 / 道具 | 位置 X/Y/Z | `position` |
| 角色 / 模型 / 道具 | 旋转 X/Y/Z | `rotation` |
| 角色 / 模型 / 道具 | 缩放 X/Y/Z | `scale` |
| 角色 / 模型 / 道具 | 统一缩放 | `scale`（三轴同值） |
| 摄像机 | 位置 X/Y/Z | `position` |
| 摄像机 | 注视 X/Y/Z | `target` |
| 摄像机 | 视野 FOV | `fov` |

> 注：角色/道具的 `scale` 三行 + 「统一缩放」共用同一个 `scale` 字段。

## 三、K 帧按钮（◆ 菱形）交互

菱形按钮是打帧触点的唯一入口。点击行为与按钮状态如下：

### 1. 未打帧（空心）

- 播放头处该字段**没有**关键帧时，菱形为**空心**（灰/主题描边）。
- **点击** → 在当前播放头时间给该字段打一个关键帧，记录当前属性值。
- 打帧后按钮变为**实心**（高亮），表示该字段在此时间点已有关键帧。

### 2. 已打帧（实心）

- 播放头处该字段**已有关键帧**时，菱形为**实心**（高亮色），`aria-pressed` 为 `true`。
- 鼠标悬停提示「当前时间已有关键帧」。
- **点击** → 覆盖更新该帧当前值（把当前属性值写入已存在的该字段关键帧）。

> 当前实现：同一字段再次点击是「覆盖写入」最新值，**暂未提供「点击取消/删除关键帧」**。删除关键帧需在底部时间轴选中关键帧后按 Delete，或使用轨道清空按钮。

### 3. 当前时间点是否有帧的判断

`hasFieldAtPlayhead(track, time, field)`：

- 在 `track` 中查找 `|frame.time - time| < TIME_EPSILON`（`TIME_EPSILON = 0.0001`）的帧，且该帧包含对应字段。
- 存在 → 该属性行的 K 帧按钮实心。
- 字段粒度判断：位置/旋转/缩放/注视只要字段存在即算「有帧」，三行共享同一字段状态。

### 4. 不可打帧情况

- 群众整体（crowd）：`keyframable = false`，不渲染打帧菱形，只能打帧单个群众成员。
- 摄像机已绑定注视目标（`targetMode === "object"`）：注视行 `disabled`，提示「已绑定注视目标，注视点自动跟随对象，无需手动打帧」。
- 属性行 `disabled` 时按钮禁用。

## 四、打帧写入逻辑（数据层）

### 1. 按属性组打帧：`setKeyframeGroupAtPlayhead(trackId, fields)`

所有 K 帧按钮点击最终调用此 store action：

```
setKeyframeGroupAtPlayhead(trackId, fields)
  └─ upsertKeyframeFields(timeline, trackId, fields, currentTime)
```

`upsertKeyframeFields` 行为：

- 在 `timeline.tracks[trackId]` 中找 `currentTime`（±TIME_EPSILON）的帧。
- **已有同帧** → 把 `fields` 合并进该帧，保留其他维度（位置/旋转/姿态各自独立记录）。
- **无同帧** → 新建一帧 `{ id, time, ...fields, easing: "linear" }` 追加进轨道，并按时间排序、扩展 timeline duration。

> 轨道不存在时（第一次给某对象打帧）会**自动创建轨道**：`timeline.tracks[trackId]` 由 `?? []` 兜底后写入首帧。

### 2. 按轴独立打帧：`buildAxisKeyframeFields(track, time, field, axis, currentVec)`

点击某个轴（如「位置 X」）时：

- 找到播放头同帧。
- 目标轴取**当前值**，其余轴保留**同帧已有值**（无同帧则取当前值）。
- 返回 `{ [field]: nextVec }` 传给 `setKeyframeGroupAtPlayhead`。

这保证「每轴独立打帧」：改 X 只影响 X 轴记录，不影响同帧 Y/Z。

### 3. 整帧打帧（快捷键）：`addKeyframeForSelection()`

- F9 快捷键触发（`useDirectorViewportShortcuts`）。
- 对当前所有选中对象，在当前播放头用对象当前 transform（+姿态）写入完整关键帧（append 模式）。
- 相机对象会连带写入 `target`。

## 五、关键帧存储位置

```
project.timeline
  ├─ duration: number      // 总时长（秒），随关键帧自动扩展
  ├─ fps: number
  └─ tracks: {
       [trackId]: DirectorKeyframe[]
     }
```

- **trackId 规则**：角色/道具用**对象 id**；机位用**相机 id（`linkedCameraId`）**。
- 底部时间轴 `AnimationTimelineBar` 按此规则遍历 `objects` / `cameras`，凡是 `tracks[trackKey]` 有帧的对象/机位就显示为一行轨道。

### `DirectorKeyframe` 字段

```ts
{
  id: string;
  time: number;                       // 播放头时间（秒）
  position?: [number, number, number]; // 位置（可缺省）
  rotation?: [number, number, number]; // 旋转（可缺省）
  scale?: [number, number, number];    // 缩放（可缺省）
  target?: [number, number, number];   // 注视点（相机）
  fov?: number;                        // 视野（相机）
  near?: number;
  far?: number;
  posePresetId?: string | null;        // 姿态预设
  controls?: Record<string, number>;   // 骨骼控制值
  easing?: "linear" | "ease" | "hold";
}
```

> 各维度可选：缺省字段在插值时**不覆盖**该维度（实现位置/旋转/姿态独立打帧）。

## 六、与时间轴的联动

- 打帧成功后，`project.timeline` 更新 → 底部时间轴对应对象/机位**自动出现轨道**并显示该关键帧（蓝色菱形）。
- 时间轴轨道行点击可选中对应对象，联动右侧面板。
- 关键帧在时间轴上可**拖动改时间**、**点击选中后按 Delete/Backspace 删除**、轨道「✕」可**清除整条轨道**。

## 七、视口拖动与关键帧的关系

在 3D 视口拖动对象/相机（`commitViewportDrag`）：

- **播放头处该对象已有关键帧** → 更新该帧的位移字段（位置/旋转/缩放，相机可带 target/fov），避免播放回跳；同时同步对象 transform，右侧面板数值联动更新。
- **播放头处无关键帧** → 只修改对象/相机 transform（不自动打帧）。要记录到时间轴需手动点 K 帧按钮。

> 视口拖动本身**不会**自动创建关键帧；关键帧必须通过 K 帧按钮或 F9 手动写入。
