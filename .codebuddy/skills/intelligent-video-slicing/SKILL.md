---
name: intelligent-video-slicing
description: "AI 驱动的智能视频切片引擎。自动运行 PySceneDetect + FFmpeg 对素材进行跳剪检测与切割，分析切片结果（每个 clip 的秒数和数量），对不合理的视频自动调参重跑，最终保证每段落在 4-8 秒区间。适用于达人混剪素材预处理、口播视频分镜提取、抖音/TikTok 素材切片等场景。触发关键词：视频切片、分割画面、智能切片、自动切视频、跳剪分割、scene detection。"
---

# 智能视频切片引擎 (Intelligent Video Slicing)

## 概述

本 Skill 封装了一套完整的"运行 → 分析 → 调参 → 重跑"自动化管线。目标是零人工干预地把一批源视频切分为适合剪辑的短片段（4~8 秒/段），并针对"切不动"的片子自动降阈值重试。

核心外部脚本：`G:\AgentSpace\99_Tools\智能分割画面.py`

## 触发条件

当用户提出以下意图时使用本 Skill：
- "把这个目录的视频切一下"
- "帮我分割画面"
- "素材切片，每段 4-8 秒"
- 任何涉及对一批 MP4 视频做场景检测与切割的请求

## 顶层配置 (脚本调参区)

在运行前，按用户意图修改 `智能分割画面.py` 的顶部配置块：

```
DETECTOR_MODE       = "adaptive"   # 检测器: "adaptive"(灰度自适应) 或 "hsv"(色彩直方图)
DEFAULT_THRESHOLD   = 3.0          # 灵敏度: 1.5~12, 越小越灵敏/切越多
DEFAULT_MIN_SCENE_LEN = 2          # 最小镜头长度(秒): 短原片用小值保节奏, 长原片用大值防碎
```

## 执行管线

### Step 1: 运行初始切片

确定用户给的输入、输出目录后，运行脚本：

```powershell
python "G:\AgentSpace\99_Tools\智能分割画面.py" --input "INPUT_DIR" --output "OUTPUT_DIR"
```

除 --input 和 --output 外，其余参数使用脚本顶部默认值，不额外传入。

### Step 2: 分析切片质量

```powershell
python analyze_clips.py OUTPUT_DIR INPUT_DIR
```

逐视频输出 clips 数 / 总时长 / 平均时长 / 源时长，并标记 UNDERCUT / OVERCUT / 合格。判定标准见 `references/params.md`，核心是：**含任意 >12s 片段即硬伤（欠切）**；avg<2s 为过切；4~8s 且无硬伤为合格。

### Step 3: 自动调参

对 NEED_RETRY 的视频：
- 欠切：阈值 × 0.7（下限 1.5）
- 过切：阈值 × 1.5（上限 12.0）
- MIN_SCENE_LEN：源 ≤30s 用 2，>30s 用 4

**必须先用 delete_undercut.py 删除对应输出子目录**——智能分割画面.py 有缓存跳过逻辑（输出目录已存在就整段跳过），不删目录重跑无效。

```powershell
python delete_undercut.py OUTPUT_DIR INPUT_DIR --dry-run   # 预览
python delete_undercut.py OUTPUT_DIR INPUT_DIR             # 实际删除
```

删后重跑 Step 1（合格目录被缓存跳过，只重切这批）。

### Step 4: 收敛判断

重复 Step 1-3，每轮分析后汇报进度。满足以下任一条件则停止：
- 所有视频均已合格
- 所有剩余不合格视频已达到 3 次重试上限
- 阈值无法进一步调整 (已触上下限)

### Step 5: 片段分类与改名

所有视频切片收敛后，对每个 clip 做视觉分类并按类别重命名。

#### 5.1 批量抽帧

视频无法被直接读取，需先为整个切片目录批量生成截图。用脚本对每个 clip 抽 3 帧（首/中/尾）一次性生成：

```powershell
python extract_frames.py CLIPS_DIR FRAMES_DIR
```

- 每个 clip 产出 `原文件名_f0.jpg`(首) / `_f1.jpg`(中) / `_f2.jpg`(尾)
- 默认 FRAMES_DIR 为 `CLIPS_DIR_frames`
- 可对整个 `OUTPUT_DIR`（含多个子目录）逐个子目录批量运行

#### 5.2 AI 看帧分类

读取每个 clip 对应的 3 张截图（`read_file` 加载 jpg），对照类别判断画面内容：

| 类别 | 画面特征 |
|------|----------|
| 上脸涂抹 | 用手把护肤品/精华涂在脸上、推开 |
| 手持产品 | 手里拿着产品包装/瓶子展示，未上脸 |
| 展示脸部状态 | 正脸怼脸拍，展示皮肤/妆前妆后状态，无涂抹动作 |
| 手持按摩棒 | 手里拿着按摩仪/美容仪在脸上滚动或按压 |
| 胶囊精华液 | 画面主体是胶囊精华液，且正涂/敷在脸上 |
| 片尾 | 视频结尾的收尾画面（通常为口播结束语、Logo、引导关注） |
| 其他 | 无法归入以上任何一类 |

命名规则：`原视频名_类别_序号.mp4`（序号从 001 起，按时间顺序）。
例如：`dedup_xxx_上脸涂抹_001.mp4`、`dedup_xxx_片尾_001.mp4`。
归入"其他"的也照常改名：`dedup_xxx_其他_001.mp4`。

分类不确定时一律归"其他"，不要臆测。

#### 5.3 一键清理截图（需人类确认）

分类改名全部完成后，截图已无用，提供清理脚本。**该脚本会删除整个 frames 目录，必须由人类确认后才运行，AI 不得擅自执行删除。**

```powershell
python cleanup_frames.py FRAMES_DIR
```

脚本仅删除以 `_frames` 结尾的目录，含防护校验避免误删视频。

## 输出报告格式

运行完毕后，输出简表：

```
合格: 28/31  跳过: 3/31
跳过的视频:
  - xxx.mp4 (已重试3次，avg=12.3s)
  - yyy.mp4 (阈值已触上限，avg=15.1s)

分类汇总:
  上脸涂抹: 42  手持产品: 18  展示脸部状态: 25
  手持按摩棒: 11  胶囊精华液: 9  片尾: 28  其他: 7
```

## 实战踩坑（必读）

以下为本 Skill 在真实大批量素材（32 个达人混剪视频）上跑出的经验，务必先看：

1. **缓存跳过是头号陷阱**：智能分割画面.py 在 `process_video_pipeline` 开头判断"输出子目录已存在且有 .mp4 就直接 return"。重切前**必须**删目录，否则跑半天毫无变化。delete_undercut.py 就是为此而生，不要手动删、不要跳过这步。

2. **固定机位静止镜头切不动**：部分口播/产品展示素材前 10~20s 是固定镜头（人物几乎不动、无明暗变化），任何检测器都切不出跳变点，会出现 14s/23s 甚至 47s 的单段。这属物理极限——降阈值（adaptive 1.5）和换 HSV 都无效，强行降只会误切连贯画面。这类硬伤段在 Step 4 收敛时直接标记为 SKIPPED，不要在它身上空耗重试次数。

3. **adaptive 远优于 hsv（对本批素材）**：试过 ContentDetector(HSV) 作兜底，结果更差——korean.mom 出现 21s、theallisonveer 出现 47.9s 超长段，明显漏切。本批"静止背景 + 人物动作"素材，灰度自适应才是正解。**默认就用 adaptive，hsv 仅作理论备用，实测不调好前不要用。**

4. **阈值起点别用脚本默认的 12**：智能分割画面.py 顶部 DEFAULT_THRESHOLD 写的是 12（旧值，太迟钝，导致整批只切 1~2 段）。真实起点应设 **3.0**。若发现一批全欠切，先怀疑是不是用了 12。

5. **PowerShell 会吞掉 Python 的多行输出**：直接 `python xxx.py` 在 PowerShell 里常只返回 CLIXML 空壳。判断脚本是否真跑成功，要么重定向到文件再读（`> out.txt 2>&1` 然后读 out.txt），要么用 `Get-Content -Encoding utf8` 读（勿用裸 Get-Content，会被编码拦截）。

6. **别用 .bat 删中文/带括号目录**：早期用 bat 删 `dedup_7月16日 (2)` 这类目录，因引号与中文解析失败。统一用 Python `shutil.rmtree` 删，最稳。

7. **ffprobe 超时**：个别损坏/极长素材 ffprobe 会卡住，脚本已设 30s timeout，但真遇卡死可单独排查该文件。

## 注意事项

- 确保 ffmpeg 和 ffprobe 在 PATH 中可用
- PySceneDetect 需安装：`pip install scenedetect tqdm`
- 有 NVIDIA GPU 时自动使用 NVENC 硬件加速
- 多视频并发处理，GPU 编码会话数有限，NVENC 模式最多 2-3 路并发
- 当前核心脚本路径固定为 `G:\AgentSpace\99_Tools\智能分割画面.py`，输入/输出目录由用户每次指定
