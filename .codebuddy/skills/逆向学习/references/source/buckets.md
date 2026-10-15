# 分桶方法（Phase 1 用）

> **造梦工坊只是参考案例**。桶定义必须按**当前项目**重新推导，**禁止照搬**下面示例的桶。
> 分桶是整个 SOP 里唯一"错了会级联"的环节——桶错则归档错、深挖错、交付错。

---

## 一、校准方法（三步推导本项目桶）

### Step 1 · 列出所有 AI 调用点
扫所有可能调用 AI 的文件（命令见 `commands.md`）：
```
call_llm | call_image | call_video | image_generate | video_generate | ...
```

### Step 2 · 按「输出模态」切主桶
一个 AI 应用通常有 3-6 个主桶，按**产出物的模态**划分：

| 模态 | 典型桶 |
|---|---|
| 文本 | LLM 应用层（大纲/剧本/分镜/精修…） |
| 图片 | 文生图 / 图编辑 / 放大 |
| 视频 | 图生视频队列 + 多 provider |
| 音频 | TTS / 音频提取 |
| 3D | 文生 3D / 图生 3D |

### Step 3 · 补「角色桶」（非模态类）
- **基础设施**：LLM 路由 + token/cost 控制
- **编排 / 批处理**：orchestrator + 批量任务控制
- **模板 / 素材**：prompt 模板、素材库生命周期
- **配置契约**：模型边界表 + 凭证来源 + 全局开关
- **辅助衔接**：跨产物一致性（如尾帧/参考图）等特化辅助

### Step 4 · 校验三件事
1. **互斥**：每个文件只进一个桶
2. **完备**：无大文件（>1000 行）落在桶外
3. **依赖方向**：基础设施桶 + 契约桶在底层，其余桶依赖它们

---

## 二、参考案例：造梦工坊的 11 个桶（仅示例，勿照搬）

> 这是**一个**真实项目的分桶结果，用来让你感受"一个 AI 应用的分桶长什么样"。它**不是标准答案**。

| 桶 | 覆盖范围 | 典型 service |
|---|---|---|
| **桶0 · LLM 基础设施** | call_llm 路由 + token/cost 控制 | llm_service, cloud_token_service |
| **桶1 · 文本生成（LLM 应用层）** | 大纲/章节/剧本/分镜/精修等纯 LLM Skill | novel_creation, script, storyboard, storyboard_refine |
| **桶2 · 静态图片生成** | Text-to-Image + Image Editing | image_service, storyboard_image, panorama_service |
| **桶3 · 视频生成** | Image-to-Video 队列 + 多 provider | queue_worker, queue_service, supplement_video, independent_video |
| **桶4 · 图片编辑** | 放大/去字幕/融合 | image_upscale, subtitle_removal |
| **桶5 · 语音** | TTS + 音频提取 | voice_service, vocal_extraction |
| **桶6 · 编排与批处理** | orchestrator + 批量任务控制 | pipeline_service, storyboard_batch_service |
| **桶7 · 特化 Skill** | 战斗分镜/全景等独立子领域 | fight_storyboard_service |
| **桶8 · 模板/素材管理** | prompt_templates 完整生命周期 | template_service, volc_asset_service |
| **桶9 · 视频衔接辅助** | 跨分镜一致性（尾帧黏土/场景参考图） | last_frame_auto_clay, scene_reference_service |
| **桶10 · 配置契约层** | 模型边界表 + 凭证来源 + 全局开关 | model_presets, video_model_capabilities, cloud_llm_sync |

---

## 三、归档检查（Phase 1 验收）

- Σ 各桶内文件数 = service 文件总数（用文件数核对，不用行数）
- 无 >1000 行文件在桶外
- 基础层桶（基础设施 / 契约）已明确标出
