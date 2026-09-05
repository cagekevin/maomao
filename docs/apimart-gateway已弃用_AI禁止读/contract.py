# -*- coding: utf-8 -*-
"""
前后端字段契约（网关侧海关）

本文件是「前后端契约海关审计」（docs/16）的可执行落地。
用途：
  - 声明前端实际使用的字段名 → 网关标准字段名的映射关系
  - 提供 normalize_body() 统一翻译入口，替代散落在 _submit_generation 的 if 硬编码
  - 每次翻译自动记录命中了哪些别名，方便线上排查

维护规则：
  - 前端新增字段名变体 → 在对应字典加一行，不要改逻辑
  - 不要在此文件中做运行时 JSON Schema 校验（前端是混淆黑盒，未知字段仅 warn 不拒绝）
"""

from typing import Any


# ── 别名映射：前端字段名（旧名/别名）→ 网关标准字段名 ──
# 规则：仅当标准字段名在 body 中不存在时，才做别名转换（不覆盖已有值）
FIELD_ALIASES: dict[str, str] = {
    "ratio":           "aspect_ratio",
    "seconds":         "duration",
    "input_reference": "reference_images",
    "input_video":     "videos",
}

# ── metadata 子对象提升字段 ──
# 前端把以下字段塞进 `metadata` 子对象；后端在 normalize_body 中提升到顶层。
# 规则：仅当顶层不存在该字段时，才从 metadata 提升（不覆盖已有值）。
# 注意：其中 watermark / generate_audio 提升后当前 _do_submit 未实际消费，
#       仅保证不丢失；若将来要支持水印/自动音频，须后端补消费逻辑。
METADATA_LIFT_KEYS: tuple[str, ...] = (
    "reference_images", "reference_videos", "reference_audios",
    "ratio", "duration", "watermark", "generate_audio",
)

# ── 多候选 URL 合并（用于 _extract_raw_urls），按媒体类型分组 ──
# 规则：每组内按顺序 or 短路，取第一个有值的候选字段。
#       例如 image 组：image_urls or images or attachments or reference_images
URL_MERGE_GROUPS: dict[str, list[str]] = {
    "image": ["image_urls", "images", "attachments", "reference_images", "files"],
    "video": ["videos", "reference_videos", "files"],
    "audio": ["audios", "reference_audios", "files"],
}



def normalize_body(body: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """
    翻译前端请求体为网关标准字段名。

    处理顺序（顺序敏感，不可调换）：
      1. metadata 子对象提升（仅当顶层不存在时写入）
      2. 字段别名映射（仅当目标字段不存在时转换）

    参数：
      body: 前端原始 JSON 请求体（会被原地修改）
    返回：
      (翻译后的 body, 命中别名列表)
      命中格式示例：["metadata.ratio→ratio", "ratio→aspect_ratio", "seconds→duration"]
    """
    hits: list[str] = []

    # ── 1. metadata 子对象提升 ──
    meta = body.pop("metadata", None)
    if isinstance(meta, dict):
        for key in METADATA_LIFT_KEYS:
            if key in meta and key not in body:
                body[key] = meta[key]
                hits.append(f"metadata.{key}→{key}")

    # ── 2. 字段别名映射 ──
    for old_key, new_key in FIELD_ALIASES.items():
        if old_key in body and new_key not in body:
            body[new_key] = body.pop(old_key)
            hits.append(f"{old_key}→{new_key}")

    return body, hits
