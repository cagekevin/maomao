# -*- coding: utf-8 -*-
"""
APIMart 兼容中转站（Relay） —— 后端对接 Lovart
================================================================

职责边界（读代码前先看这一段）
----------------------------------------------------------------
本网关是一个【纯中转站】，只做三件事：
    1. 接收外部请求（OpenAI 风格：/v1/images、/v1/videos、/v1/chat）
    2. 做最小必要的请求规范化（尺寸解析、数量约束、模型别名映射）
    3. 转发给 Lovart，并把结果回传给调用方

我们只关心「信息的接收与发送」，不关心两件事：
    ✗ 不关心前端：前端是什么节点、特惠还是普通、用哪个混淆产物字段，
      这些与网关无关。网关只认三种能力——图片 / 视频 / 聊天。
    ✗ 不关心 Lovart 内部：Lovart 的项目管理、工具名、生成策略由
      lovart_client.py 与上游协议负责，本文件只调用、不侵入。

三种能力（capability）
----------------------------------------------------------------
    • 图片：category="IMAGE"   → /v1/images/* 、/v1/gateway/*(图片)
    • 视频：category="VIDEO"   → /v1/videos/* 、/v1/gateway/generate
    • 聊天：/v1/chat/completions（Agent 自选模型，不强制 IMAGE/VIDEO）

「别名」是允许的，且是中转站的正常职责（见 _IMAGE_RULES / _VIDEO_RULES）：
把前端传来的 model 名翻译为 Lovart 工具名。这是转发映射，不是业务逻辑。
但别名只做「翻译」，不为此新增任何复杂度或分支。

鲁棒性（对上游故障自愈，与前端无关）
----------------------------------------------------------------
    • 项目失效自动重建（TaskService.send_with_project / _is_project_invalid）
    • 生成结果 done 翻转防抖（TaskService.check_and_fire_task）
    • 待确认高成本操作自动/手动确认（AUTO_CONFIRM）
这些都属于「中转站对上游不稳定性的兜底」，不改变职责定位。

运行：
    pip install -r requirements.txt
    export LOVART_ACCESS_KEY=ak_xxx
    export LOVART_SECRET_KEY=sk_xxx
    uvicorn main:app --host 0.0.0.0 --port 9004
"""

import asyncio
import base64
import json
import os
import re
import time
import uuid
from urllib.parse import urlparse
from typing import Any, Dict, Optional, Tuple, List

import httpx
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse, Response, PlainTextResponse

from contract import normalize_body
from lovart_client import LovartClient, LovartError, close_http_client, _get_http_client


# ============================================================================
# 1. 配置与日志层 (Config & Logging)
# ============================================================================
class Config:
    LOVART_BASE = os.getenv("LOVART_BASE_URL", "https://lgw.lovart.ai")
    DEFAULT_AK = os.getenv("LOVART_ACCESS_KEY", "")
    DEFAULT_SK = os.getenv("LOVART_SECRET_KEY", "")
    USER_KEYS = json.loads(os.getenv("USER_KEYS", "{}"))
    LOVART_TIMEOUT = int(os.getenv("LOVART_TIMEOUT", "600"))
    OPEN_RELAY = os.getenv("OPEN_RELAY", "false").lower() == "true"
    AUTO_CONFIRM = os.getenv("AUTO_CONFIRM", "true").lower() == "true"
    DEFAULT_MODE = os.getenv("LOVART_MODE", "").strip().lower()
    CHAT_THREAD_MODE = os.getenv("LOVART_CHAT_MODE", "thinking").strip().lower() or "thinking"
    TASK_RESULT_TTL = int(os.getenv("TASK_RESULT_TTL", "86400"))
    CHAT_SYNC_TIMEOUT = int(os.getenv("CHAT_SYNC_TIMEOUT", "300"))
    WEBHOOK_MAX_RETRIES = 3
    WEBHOOK_RETRY_INTERVAL = 10
    GATEWAY_LOG_LEVEL = (os.getenv("LOG_LEVEL") or "info").lower()
    PROJECT_CACHE_FILE = os.getenv("PROJECT_CACHE_FILE", ".lovart_project.json")

def _log(msg: str, level: str = "info") -> None:
    # 网关日志原语（print + flush，零依赖）：LOG_LEVEL=debug 可启用 debug 级别输出（如 _extract_raw_urls 内部细节）；
    # flush=True 确保 launch-all 重定向到 .log 时不丢尾。
    if level == "debug" and Config.GATEWAY_LOG_LEVEL != "debug":
        return
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [{level}] {msg}", flush=True)


# ============================================================================
# 2. 常量与模型映射 (Constants & Mappings)
# ============================================================================
# ── 模型别名表（转发映射，非业务逻辑）──
# 仅把前端 model 名翻译为 Lovart 工具名；新增模型只需在此追加一行，不新增分支。
# 注意：本表是【人工精选子集】，仅收录运营挑选的少量模型，
#       非官方全量（官方另有 20+ 图片 / 15+ 视频工具，见 vendor/ 官方资料）。
#       刻意不全——不用的模型不进表，避免前端出现无法落地的选项。
_IMAGE_RULES = [
    (("gpt-image-2-low", "gpt-image2-low", "gptimage2low"), "generate_image_gpt_image_2_low"),
    (("gpt-image-2-medium", "gpt-image2-medium", "gptimage2medium"), "generate_image_gpt_image_2_medium"),
    (("gpt-image-2", "gpt-image2", "gptimage2"), "generate_image_gpt_image_2"),
    (("nano-bn-pro", "nano bn pro", "nanobnpro"), "generate_image_nano_banana_pro"),
    (("nano-bn-2", "nano bn 2"), "generate_image_nano_banana_2"),
    # 官方暂无工具的图片模型：仅拼提示词驱动（tool 为空 → 不下发 prefer_tool_categories）。
    (("nano-bn-2-lite", "nano banana 2 lite", "nanobn2lite"), ""),
]

_VIDEO_RULES = [
    # 同样为精选子集：仅收录运营挑选的视频模型，非官方全量（有意为之）。
    (("seedance-2.0-fast", "seedance-v2-0-fast", "seedance 2.0 fast",
      "seedance_2_fast", "seedance-2-fast", "seedance 2 fast"), "generate_video_seedance_v2_0_fast"),
    (("seedance-2", "seedance2", "seedance-v2", "seedance 2"), "generate_video_seedance_v2_0"),
    (("kling-v3-omni", "kling-3-omni", "kling 3 omni"), "generate_video_kling_v3_omni"),
    # 官方暂无工具的视频模型：仅拼提示词驱动（tool 为空）。
    (("seedance-2.0-mini", "seedance-v2-0-mini", "seedance 2.0 mini",
      "seedance_2_mini", "seedance-2-mini", "seedance 2 mini"), ""),
    (("minimax-h3", "minimax h3", "hailuo h3"), ""),
]

# 提示词可读模型名：前端可能传内部代号（如 nano-bn-2-lite），
# 但拼进 prompt 时必须用上游 AI 能识别的官方可读名，否则 Agent 看不懂。
_PROMPT_MODEL_NAMES = {
    "nano-bn-pro": "Nano Banana Pro",
    "nano-bn-2": "Nano Banana 2",
    "nano-bn-2-lite": "Nano Banana 2 Lite",
    "seedance-2.0-mini": "Seedance 2.0 mini",
    "minimax-h3": "MiniMax H3",
}


def _build_models() -> list:
    models = [
        {"id": "lovart-chat", "object": "model", "created": 0,
         "owned_by": "lovart", "category": "chat",
         "description": "Lovart 设计 Agent（深度推理，支持图/视频/音频多模态）"},
    ]
    for keys, tool in _IMAGE_RULES:
        models.append({"id": keys[0], "object": "model", "created": 0,
                       "owned_by": "lovart", "category": "image", "tool": tool,
                       "prompt_only": not tool})
    for keys, tool in _VIDEO_RULES:
        models.append({"id": keys[0], "object": "model", "created": 0,
                       "owned_by": "lovart", "category": "video", "tool": tool,
                       "prompt_only": not tool})
    models.append({"id": "lovart-music", "object": "model", "created": 0,
                   "owned_by": "lovart", "category": "music",
                   "description": "Lovart 音乐/音频生成（Agent 自选音频工具）"})
    return models

_MODELS = _build_models()


# ============================================================================
# 3. 状态与缓存管理 (State Management)
# ============================================================================
class TaskManager:
    _meta: Dict[str, dict] = {}

    @classmethod
    def get(cls, task_id: str) -> dict:
        return cls._meta.get(task_id, {})

    @classmethod
    def set(cls, task_id: str, data: dict):
        cls._meta[task_id] = data

    @classmethod
    def cleanup(cls):
        if len(cls._meta) > 500:
            now = int(time.time())
            expired = [k for k, v in cls._meta.items() if now - v.get("created", now) > 86400]
            for k in expired:
                cls._meta.pop(k, None)


class ProjectManager:
    _cache: Dict[str, str] = {}
    _lock = asyncio.Lock()

    @classmethod
    def load(cls):
        try:
            with open(Config.PROJECT_CACHE_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    cls._cache.update(loaded)
        except (FileNotFoundError, json.JSONDecodeError):
            pass

    @classmethod
    async def persist(cls):
        def _write():
            try:
                with open(Config.PROJECT_CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump(cls._cache, f)
            except OSError:
                pass
        await asyncio.to_thread(_write)

    @classmethod
    async def ensure_project(cls, client: LovartClient) -> str:
        ak = client.access_key
        async with cls._lock:
            if pid := cls._cache.get(ak):
                return pid
            pid = await client.create_project()
            cls._cache[ak] = pid
            await cls.persist()
            return pid

    @classmethod
    async def clear_project(cls, access_key: str):
        # 上游项目失效时清除缓存，下次 ensure 会重建（鲁棒性自愈的一部分）
        async with cls._lock:
            cls._cache.pop(access_key, None)
            await cls.persist()

ProjectManager.load()


# ============================================================================
# 4. FastAPI 初始化与异常/依赖拦截 (App, Exceptions, Dependencies)
# ============================================================================
app = FastAPI(title="APIMart-compatible Relay (Lovart backend, optimal)")

class RelayAuthError(Exception):
    pass

@app.exception_handler(RelayAuthError)
async def auth_error_handler(request: Request, exc: RelayAuthError):
    return JSONResponse(status_code=401, content={
        "error": {"code": 401, "message": "Authentication failed", "type": "authentication_error"}
    })

@app.exception_handler(LovartError)
async def lovart_error_handler(request: Request, exc: LovartError):
    etype = {
        400: "invalid_request_error", 401: "authentication_error", 413: "invalid_request_error",
        402: "payment_required", 403: "permission_error", 404: "not_found_error",
        409: "conflict_error", 429: "rate_limit_error", 500: "server_error", 502: "bad_gateway",
    }.get(exc.http_status, "api_error")
    return JSONResponse(status_code=exc.http_status, content={
        "error": {"code": exc.http_status, "type": etype, "message": exc.message}
    })

def get_lovart_client(request: Request) -> LovartClient:
    """依赖注入：解析鉴权头并返回 Client 实例"""
    auth = request.headers.get("authorization", "")
    user_key = auth[7:].strip() if auth.lower().startswith("bearer ") else ""

    if Config.OPEN_RELAY:
        ak, sk = Config.DEFAULT_AK, Config.DEFAULT_SK
    elif user_key in Config.USER_KEYS:
        ak, _, sk = Config.USER_KEYS[user_key].partition("|")
    else:
        raise RelayAuthError()

    if not ak or not sk:
        raise RelayAuthError()

    return LovartClient(Config.LOVART_BASE, ak, sk, timeout=Config.LOVART_TIMEOUT)


@app.on_event("shutdown")
async def _on_shutdown():
    await close_http_client()


# ============================================================================
# 5. 核心工具类 (Utils & Formatting)
# ============================================================================
def ok(data):
    return JSONResponse(status_code=200, content={"code": 200, "data": data})

def err(status: int, message: str, etype: str = "invalid_request_error", code=None):
    return JSONResponse(status_code=status, content={
        "error": {"code": code if code is not None else status, "type": etype, "message": message}
    })

_LOVART_ERR_TYPES = {
    400: "invalid_request_error", 401: "authentication_error", 413: "invalid_request_error",
    402: "payment_required", 403: "permission_error", 404: "not_found_error",
    409: "conflict_error", 429: "rate_limit_error", 500: "server_error", 502: "bad_gateway",
}

def lovart_err_response(e: LovartError) -> JSONResponse:
    """把 LovartError 统一转成 OpenAI 风格错误 JSON。供路由与内部逻辑复用。"""
    return JSONResponse(status_code=e.http_status, content={
        "error": {"code": e.http_status, "type": _LOVART_ERR_TYPES.get(e.http_status, "api_error"),
                  "message": e.message}
    })

class DataFormatter:
    """负责将 Lovart 的数据结构转换为中转站格式"""
    @staticmethod
    def resolve_prefer_models(model: str, category: str) -> Optional[dict]:
        if not model or category not in ("IMAGE", "VIDEO"):
            return None
        m = model.lower().replace("_", "-")
        rules = _IMAGE_RULES if category == "IMAGE" else _VIDEO_RULES
        for keys, tool in rules:
            if any(k in m for k in keys):
                # tool 为空表示官方暂无对应生成工具，仅作提示词驱动，
                # 不下发 prefer_tool_categories，避免上游收到无效工具名。
                if not tool:
                    return None
                return {category: [tool]}
        return None

    @staticmethod
    def lovart_to_apimart(result: dict) -> dict:
        images, videos, audios = [], [], []
        expire = int(time.time()) + Config.TASK_RESULT_TTL
        seen = set()
        for item in result.get("items", []) or []:
            for art in item.get("artifacts", []) or []:
                url = art.get("content", "")
                t = art.get("type", "image")
                if not url or url in seen: continue
                seen.add(url)
                if t == "image": images.append({"url": [url], "expires_at": expire})
                elif t == "video": videos.append({"url": [url], "expires_at": expire})
                elif t in ("audio", "music"): audios.append({"audio_url": url, "expires_at": expire})
        out = {}
        if images: out["images"] = images
        if videos: out["videos"] = videos
        if audios: out["music"] = audios
        return out

    @staticmethod
    def assistant_text(result: dict) -> str:
        texts = [(i.get("text") or "").strip() for i in result.get("items", []) if (i.get("text") or "").strip()]
        return "\n\n".join(texts)

    @staticmethod
    def chat_content(result: dict) -> str:
        text = DataFormatter.assistant_text(result)
        media = DataFormatter.lovart_to_apimart(result)
        links = [f"![image]({u['url'][0]})" for u in media.get("images", [])] + \
                [f"[video]({u['url'][0]})" for u in media.get("videos", [])] + \
                [f"[audio]({u['audio_url']})" for u in media.get("music", [])]
        return (text + ("\n\n" + "\n".join(links) if links else "")).strip() or "(无内容)"

    # 未指定清晰度档位时，比例兜底用的目标长边（对应 1080p）。
    # 语义：前端只给比例（如 9:16）没给 1K/2K 时，网关用这个长边把比例算成固定像素，
    # 保证无论如何都能给出具体像素 target_size，不让 Lovart 自由换算。
    DEFAULT_LONG_EDGE = 1920
    # 默认清晰度档位名（供 _res_from_long_edge 推导用，本身不再拼进提示词）。
    DEFAULT_RESOLUTION = "1080p"
    # 表示"比例由模型自动决定"的关键词。
    AUTO_KEYS = ("auto", "自动", "any", "随机")
    # 清晰度档位 → 目标长边（像素）。1K/1080p 取 1080p 标准长边，2K/4K 对应。
    # 网关收到「比例 + 档位」后，用这个长边把比例换算成固定像素 target_size 直传，
    # 从而锁定 Lovart 每次输出的像素，避免 Agent 自由换算导致 576×1344/768×1376... 不一致。
    _RES_LONG_EDGE = {
        "hd": 1280, "720p": 1280,
        "1k": 1920, "1080p": 1920, "fhd": 1920,
        "2k": 2560, "1440p": 2560, "qhd": 2560,
        "4k": 3840, "2160p": 3840, "uhd": 3840,
    }

    @staticmethod
    def _res_to_long_edge(res_lower: str) -> int:
        """清晰度档位 → 目标长边像素；不认识返回 0。"""
        return DataFormatter._RES_LONG_EDGE.get(res_lower, 0)

    @staticmethod
    def _res_from_long_edge(long_edge: int) -> str:
        """像素长边 → 清晰度档位名（4K/2K/1080p）。"""
        if long_edge >= 3840:
            return "4K"
        if long_edge >= 2560:
            return "2K"
        return DataFormatter.DEFAULT_RESOLUTION

    @staticmethod
    def parse_size(size, resolution=None) -> Tuple[str, str, str]:
        """把「比例/像素 + 清晰度档位」翻译成 (target_size, 比例, 分辨率)。

        目的：前端只能传「比例（如 16:9）+ 1K/2K 档位」。若原样透传给 Lovart，
        会被 Agent 自由换算成不同像素（每次 576×1344 / 768×1376 ... 不一致）。
        这里在网关侧把「比例 × 档位」按目标长边换算成固定像素 target_size，直传锁定输出。

        返回语义：
          - target_size：给了精确像素（如 750x1000）→ 原样返回；给了「比例 + 档位」
            → 按目标长边换算成固定像素（如 16:9 + 1K → 1920x1080）；都没有 → ""。
          - 比例：给 "21:9" 这类 → 原样返回（供无像素时回退）；否则 ""。
          - 分辨率：从 resolution 参数或像素长边推导，兜底 DEFAULT_RESOLUTION。
        """
        s = size.strip() if size else ""
        res_lower = str(resolution or "").strip().lower()

        # 1. 精确像素 → 原样，档位按长边推导。
        px = re.fullmatch(r"(\d+)[xX](\d+)", s)
        if px:
            w, h = int(px.group(1)), int(px.group(2))
            return f"{w}x{h}", "", DataFormatter._res_from_long_edge(max(w, h))

        # 2. 纯比例（如 16:9 / 9:16）→ 用清晰度档位算出固定像素 target_size。
        #    若前端没给档位，用 DEFAULT_LONG_EDGE（1080p 长边）兜底，仍能算出像素。
        pm = re.fullmatch(r"(\d+)\s*:\s*(\d+)", s)
        if pm:
            rw, rh = int(pm.group(1)), int(pm.group(2))
            long_edge = DataFormatter._res_to_long_edge(res_lower) or DataFormatter.DEFAULT_LONG_EDGE
            if long_edge and rw > 0 and rh > 0:
                if rw >= rh:  # 横图：宽对齐目标长边
                    w, h = long_edge, round(long_edge * rh / rw)
                else:         # 竖图：高对齐目标长边
                    w, h = round(long_edge * rw / rh), long_edge
                return f"{w}x{h}", f"{rw}:{rh}", DataFormatter._res_from_long_edge(long_edge)
            # 兜底仍算不出像素（比例非法）→ 保留比例，不强制像素。
            return "", f"{rw}:{rh}", DataFormatter.DEFAULT_RESOLUTION

        # 3. 只有档位（如 "1K"）→ 不强制像素，只给档位。
        if res_lower:
            return "", "", DataFormatter._res_from_long_edge(DataFormatter._res_to_long_edge(res_lower)) \
                if DataFormatter._res_to_long_edge(res_lower) else DataFormatter.DEFAULT_RESOLUTION

        # 4. auto / 空 / 无法解析 → 不指定尺寸，兜底档位。
        return "", "", DataFormatter.DEFAULT_RESOLUTION

    @staticmethod
    def extract_raw_urls(value) -> list:
        if not value: return []
        items = value if isinstance(value, list) else [value]
        out = []
        for it in items:
            if isinstance(it, str):
                out.append(it)
            elif isinstance(it, dict):
                u = it.get("url") or it.get("fileUrl") or ""
                if u: out.append(u)
        return out

    @staticmethod
    def extract_raw_urls_from_files(value) -> list:
        """从前端 `files: [{url, type:"image"|"video"|"audio"}]` 提取素材 URL。

        特惠视频节点把参考素材（图片/视频/音频）都放在 `files` 数组里
        （而非 image_urls/videos/audios 字段），网关此前未读取导致素材丢失
        （下游 Lovart 收不到）。这里提取所有类型 URL，统一进入 attachments 透传，
        类型由 Lovart 端自行识别。
        """
        if not value or not isinstance(value, list):
            return []
        out = []
        for it in value:
            if not isinstance(it, dict):
                continue
            u = it.get("url") or it.get("fileUrl") or ""
            if u:
                out.append(u)
        return out

    @staticmethod
    def build_gen_prefix(category: str, size, resolution=None, has_refs: bool = False,
                          params: Optional[list] = None, model_name: str = "") -> str:
        # 请求规范化（中转站职责，必须）：把尺寸/数量/模型约束拼成前缀，
        # 让 Lovart 明确「按指定尺寸、只生成一份、用指定模型」。
        # 尺寸传参：图片只传具体像素 target_size（最精确、无可争议），
        # 不附带 1K/2K/1080p 档位文字——不同人对档位的理解不一致，两个一起传会冲突。
        # parse_size 保证：给像素原样用；只给比例/档位也能算出固定像素（比例无档位用 1080p 兜底）。
        parts = []
        target_size, ratio, res = DataFormatter.parse_size(size, resolution)
        if category == "IMAGE":
            if target_size:
                parts.append(f"target_size: {target_size}")
        elif category == "VIDEO":
            if ratio:
                parts.append(ratio)
        for p in (params or []):
            if p:
                parts.append(str(p).strip())
        prefix = ", ".join(parts)
        _model_clause = f" using the {model_name} model" if model_name else ""
        if category == "IMAGE":
            # 注意：不能写 "Use reference and edit"，那会引导 Lovart 走 edit_media（改图）。
            # 我们每次都是生成新图（generate），只保留参考图声明，避免误入编辑工具。
            instr = (f"Reference image attached. "
                     f"Generate exactly ONE image{_model_clause}."
                     if has_refs else
                     f"Generate exactly ONE image{_model_clause}.")
        elif category == "VIDEO":
            instr = f"Generate exactly ONE video{_model_clause}."
        else:
            instr = ""
        if prefix and instr:
            return f"{prefix}\n{instr}"
        return prefix or instr

    @staticmethod
    def task_view(task_id, status, progress, created, completed=None, actual_time=None,
                  result=None, error=None) -> dict:
        d = {
            "id": task_id, "status": status, "progress": progress, "created": created,
            "actual_time": 0, "estimated_time": None, "cost": 0, "credits_cost": 0,
        }
        if completed is not None: d["completed"] = completed
        if actual_time is not None: d["actual_time"] = actual_time
        if result is not None:
            d["result"] = result
            # 视频结果映射：Lovart 返回 result.videos[0].url[0]，但调用方轮询取 video_url 候选，
            # 需显式映射出来，否则视频 URL 取不到。
            if isinstance(result, dict):
                vids = result.get("videos") or []
                if vids and isinstance(vids[0], dict):
                    vurl = vids[0].get("url")
                    if isinstance(vurl, list):
                        vurl = vurl[0] if vurl else None
                    if vurl: d["video_url"] = vurl
        if error is not None: d["error"] = error
        return d

    @staticmethod
    def pending_confirmation_error(thread_id: str) -> LovartError:
        """AUTO_CONFIRM=false 时，把待确认状态转成结构化错误，附带 task_id 让调用方去确认。"""
        task_id = "task_" + thread_id
        return LovartError(
            f"任务需要人工确认高成本操作（pending_confirmation）。"
            f"请调用 POST /v1/tasks/{task_id}/confirm 完成确认，"
            f"然后轮询 GET /v1/tasks/{task_id} 获取最终结果。", 409,
        )


# ============================================================================
# 6. 核心业务逻辑 (Core Services)
# ============================================================================
# ── 鲁棒性适配（中转站对上游 Lovart 故障的自愈，与前端无关）──
# 上游项目可能失效，网关自动重建并重试一次；不暴露给调用方，也不依赖前端配合。
# Lovart 表达"项目失效"的多种错误形态（文案 / 业务码），命中任一即触发重建
_PROJECT_INVALID_HINTS = (
    "not found", "not exist", "does not exist", "invalid", "expired",
    "deleted", "missing", "unknown project", "项目不存在", "已删除", "失效", "不存在",
)

def _is_project_invalid(e: LovartError) -> bool:
    msg = (e.message or "").lower()
    if any(h in msg for h in _PROJECT_INVALID_HINTS):
        return True
    # 业务码层面无法精确区分，但 project 相关的 4xx 一律按失效处理
    # （重建后仅重试一次，若仍失败则按原样抛出，不会无限循环）
    if e.http_status in (400, 404, 409) and "project" in msg:
        return True
    return False

# 常见媒体 base64 魔数前缀（无 data: 前缀的裸 base64）
# 前缀 → 对应的扩展名。覆盖图片 + 特惠视频的 视频/音频 base64。
_B64_MEDIA_MAGIC = {
    "/9j/": "jpg",  # JPEG FF D8
    "iVBOR": "png",  # PNG 89 50 4E 47
    "R0lGOD": "gif",  # GIF 47 49 46 38
    "UklGR": "webp",  # WebP 52 49 46 46（RIFF）
    "Qk02": "bmp",  # BMP 42 4D
    "SUQz": "mp3",  # MP3 ID3
    "SU5G": "m4a",  # M4A
    "AAAA": "mp4",  # MP4/通用（辅助）
    "GkXf": "webm",  # WebM/Matroska 1A 45 DF A3
    "Zkxh": "flac",  # FLAC 66 4C 61 43
    "/e8/": "mp3",  # MP3 MPEG 帧 FF FB / FF F3
    "TWFn": "m4a",  # M4A iTunes MP4 音频（ftyp 在 M4A 头）
}

def looks_like_base64_media(s: str) -> bool:
    """判断字符串是否可能是裸 base64 媒体数据（无 data: 前缀）。

    前端可能把参考图以 base64 原始字节发来（如 /9j/... JPEG、iVBOR... PNG），
    若不识别会走 else 原样透传给 Lovart，导致其无法识别而图生图一直 running。
    """
    if not s or not isinstance(s, str) or len(s) < 64:
        return False
    if s.startswith(("http://", "https://", "data:", "blob:")):
        return False
    return s.startswith(tuple(_B64_MEDIA_MAGIC.keys()))

def _ext_from_b64_magic(s: str) -> str:
    """从裸 base64 魔数前缀推断扩展名。"""
    for pre, ext in _B64_MEDIA_MAGIC.items():
        if s.startswith(pre):
            return ext
    return "png"

def _ext_from_data_header(header: str) -> str:
    """从 data: header（如 image/jpeg）推断扩展名。"""
    h = header.lower()
    if any(x in h for x in ("jpeg", "jpg")): return "jpg"
    if "png" in h: return "png"
    if "gif" in h: return "gif"
    if "webp" in h: return "webp"
    if "bmp" in h: return "bmp"
    if "mp4" in h: return "mp4"
    if "webm" in h: return "webm"
    if any(x in h for x in ("mpeg", "mp3", "audio")): return "mp3"
    return "png"


def _ext_from_content_type(ct: Optional[str]) -> str:
    """从 HTTP 响应的 Content-Type 推断扩展名（本地回环图下载用）。"""
    if not ct:
        return "png"
    h = ct.lower()
    if any(x in h for x in ("jpeg", "jpg")): return "jpg"
    if "png" in h: return "png"
    if "gif" in h: return "gif"
    if "webp" in h: return "webp"
    if "bmp" in h: return "bmp"
    if "mp4" in h: return "mp4"
    if "webm" in h: return "webm"
    if any(x in h for x in ("mpeg", "mp3", "audio")): return "mp3"
    return "png"

class TaskService:
    @staticmethod
    async def resolve_attachments(client: LovartClient, raw_urls: list) -> Tuple[list, int]:
        """把各种形式的参考素材统一转成 Lovart 可用的 CDN URL。

        覆盖：http(s) 直接透传；data: base64；无前缀裸 base64（JPEG/PNG/GIF/WebP/视频/音频）；
        blob: 等无法访问的丢弃；未知格式丢弃（避免原样透传给 Lovart 导致图生图卡死）。

        返回 (out, failed_count)：out 为成功转出的 CDN URL 列表；
        failed_count 为「真实上传/下载失败」的素材数（主动 drop 的 blob/未知格式不计入，
        便于调用方区分「部分失败」与「设计上丢弃」，见方案 A）。
        """
        out = []
        failed_count = 0
        last_upload_err: Optional[str] = None
        for i, u in enumerate(raw_urls):
            if not u or not isinstance(u, str) or not u.strip():
                # 异常：空 / 非字符串素材
                _log(f"[resolve:skip] 第{i}个参考素材为空或非字符串，已跳过: {type(u).__name__}={str(u)[:80]!r}")
                continue
            u = u.strip()
            # 1) 合法 http(s) URL
            if u.startswith(("http://", "https://")):
                # 1a) 本机回环地址（127.0.0.1 / localhost / 0.0.0.0）：Lovart 服务器
                #     访问不到用户本地端口，必须网关自下载后转 CDN 再透传，否则垫图失效。
                host = (urlparse(u).hostname or "").lower()
                if host in ("127.0.0.1", "localhost", "0.0.0.0", "[::1]"):
                    try:
                        cli = await _get_http_client()
                        dl = await cli.get(u, timeout=30)
                        dl.raise_for_status()
                        raw = dl.content
                        ext = _ext_from_content_type(dl.headers.get("content-type")) or "png"
                        cdn = await client.upload_file(f"_local_{uuid.uuid4().hex[:8]}.{ext}", raw)
                    except Exception as e:
                        last_upload_err = str(e)
                        failed_count += 1
                        _log(f"[resolve:error] 第{i}个本机回环URL下载/上传失败，已丢弃: {u[:160]} -> {e}")
                        continue
                    if cdn:
                        out.append(cdn)
                    else:
                        last_upload_err = "本机图上传CDN返回空"
                        failed_count += 1
                        _log(f"[resolve:warn] 第{i}个本机回环URL上传CDN返回空，已丢弃: {u[:160]}")
                    continue
                # 1b) 其余外网 URL：直接透传（正常，不打日志）
                out.append(u)
                continue
            # 2) data: 前缀的 base64：解析 header 得扩展名后上传 CDN
            if u.startswith("data:"):
                try:
                    header, _, b64 = u.partition(",")
                    ext = _ext_from_data_header(header)
                    raw = await asyncio.to_thread(base64.b64decode, b64)
                    cdn = await client.upload_file(f"_ref_{uuid.uuid4().hex[:8]}.{ext}", raw)
                except Exception as e:
                    # 异常：解码或上传抛异常
                    last_upload_err = str(e)
                    failed_count += 1
                    _log(f"[resolve:error] 第{i}个 data:base64 处理失败: {e}，前80字符={u[:80]!r}")
                    continue
                if cdn:
                    out.append(cdn)  # 正常，不打日志
                else:
                    # 异常：上传 CDN 返回空
                    last_upload_err = "上传 CDN 返回空"
                    failed_count += 1
                    _log(f"[resolve:warn] 第{i}个 data:base64 上传CDN返回空，已丢弃")
                continue
            # 3) 无前缀裸 base64：识别魔数后解码上传 CDN
            if looks_like_base64_media(u):
                try:
                    ext = _ext_from_b64_magic(u)
                    raw = await asyncio.to_thread(base64.b64decode, u)
                    cdn = await client.upload_file(f"_ref_{uuid.uuid4().hex[:8]}.{ext}", raw)
                except Exception as e:
                    # 异常：解码或上传抛异常
                    last_upload_err = str(e)
                    failed_count += 1
                    _log(f"[resolve:error] 第{i}个裸base64 解码/上传失败: {e}，前80字符={u[:80]!r}")
                    continue
                if cdn:
                    out.append(cdn)  # 正常，不打日志
                else:
                    # 异常：上传 CDN 返回空
                    last_upload_err = "上传 CDN 返回空"
                    failed_count += 1
                    _log(f"[resolve:warn] 第{i}个裸base64 上传CDN返回空，已丢弃")
                continue
            # 4) 其他（blob: / 本地路径 / 未知）：网关拿不到内容，直接丢弃，
            #    避免把无效 URL 原样透传给 Lovart 造成图生图一直 running
            _log(f"[resolve:drop] 第{i}个参考素材无法识别，已丢弃（不再透传给Lovart）: {str(u)[:160]}")
        _log(f"[resolve:end] 翻译完成，产出 {len(out)} 个 attachment")
        # 方案 A（2026-08-07）：只要存在「真实上传/下载失败」的参考素材（failed_count>0），
        # 即阻断发出——垫图不齐就不应把「有参考图」的生成请求发出去，否则 Lovart 收不到完整
        # 垫图、prompt 却声称有参考图，生成结果与用户意图偏差且无法察觉。
        # 主动 drop（blob:/未知格式）与 URL 透传不计入 failed_count，不受此阻断影响。
        if raw_urls and failed_count > 0:
            raise LovartError(
                f"有 {failed_count} 个参考素材上传失败，无法进行图生图/图生视频。"
                "请确认已开启 VPN 或检查网络后重试（代理重传也失败）。"
                f"详情: {last_upload_err}",
                502,
            )
        return out, failed_count

    @staticmethod
    async def send_with_project(client: LovartClient, **kwargs) -> Tuple[str, str]:
        # ── 鲁棒性适配（中转站对上游 Lovart 故障的自愈，与前端无关）──
        pid = await ProjectManager.ensure_project(client)
        try:
            return await client.send(project_id=pid, **kwargs), pid
        except LovartError as e:
            if _is_project_invalid(e):
                await ProjectManager.clear_project(client.access_key)
                pid = await ProjectManager.ensure_project(client)
                return await client.send(project_id=pid, **kwargs), pid
            raise

    @staticmethod
    async def check_and_fire_task(task_id: str, client: LovartClient) -> Tuple[bool, JSONResponse]:
        """核心轮询逻辑：返回 (是否达到终态, HTTP JSON响应)"""
        if not task_id.startswith("task_"):
            return True, err(400, "Invalid task ID", "invalid_request_error", 400)

        thread_id = task_id[len("task_"):]
        meta = TaskManager.get(task_id)
        created = meta.get("created", int(time.time()))

        try:
            st = await client.get_status(thread_id)
        except LovartError as le:
            return False, lovart_err_response(le)

        status = st.get("status", "running")
        # P0-4：轮询打点。同时打 lovart_raw（Lovart 原始状态）和 effective（网关改写后），
        # 区分 done 防抖（lovart_raw=done, effective=running）vs 真卡住（lovart_raw=running 持续）。
        # tid 来自 TaskManager，后台 watcher 路径无 HTTP header 时降级为 "-"。
        _log(f"[poll] traceId={meta.get('tid','-')} thread={thread_id} "
             f"lovart_raw={st.get('status')} effective={status} "
             f"poll={meta.get('poll_count')} "
             f"raw_keys={list(st.keys()) if isinstance(st, dict) else type(st).__name__}")

        if status == "done":
            now = time.time()
            done_seen = meta.get("done_first_seen")
            if not done_seen:
                meta["done_first_seen"] = now
                status = "running"
            elif now - done_seen < 5:
                status = "running"
        else:
            meta.pop("done_first_seen", None)

        if status == "running":
            meta["poll_count"] = meta.get("poll_count", 0) + 1
            if meta["poll_count"] >= 7 and meta["poll_count"] % 3 == 0:
                try:
                    res = await client.get_result(thread_id)
                    if res.get("pending_confirmation"):
                        status = "pending_confirmation"
                except LovartError:
                    pass

        if status in ("pending", "queued", "submitted"):
            return False, ok(DataFormatter.task_view(task_id, "pending", 0, created))

        # P0-4：第一处 AUTO_CONFIRM（status 路径，轮询探测到 pending_confirmation）。
        # confirm 需日志确认是否真正执行，否则排查者无法判断。
        if status == "pending_confirmation":
            if Config.AUTO_CONFIRM:
                try:
                    await client.confirm(thread_id)
                    _log(f"[poll:confirm] traceId={meta.get('tid','-')} thread={thread_id} AUTO_CONFIRM triggered")
                except LovartError:
                    _log(f"[poll:confirm] traceId={meta.get('tid','-')} thread={thread_id} AUTO_CONFIRM FAILED")
                    pass
            return False, ok(DataFormatter.task_view(task_id, "processing", 50, created))

        if status == "running":
            return False, ok(DataFormatter.task_view(task_id, "processing", 30, created))

        if status == "abort":
            data = DataFormatter.task_view(task_id, "failed", 100, created,
                                           completed=int(time.time()),
                                           error={"message": "生成被中止", "code": "abort"})
            await TaskService.fire_webhook(task_id, data)
            return True, ok(data)

        try:
            result = await client.get_result(thread_id)
        except LovartError as le:
            return False, lovart_err_response(le)

        # P0-4：第二处 AUTO_CONFIRM（get_result 路径，拿到结果后确认）。
        # 这是真正常命中的确认点，若只补第一处而漏此，排查者会误判"AUTO_CONFIRM 未执行"（假阴性）。
        pc = result.get("pending_confirmation")
        if pc:
            if Config.AUTO_CONFIRM:
                try:
                    await client.confirm(thread_id)
                    _log(f"[poll:confirm2] traceId={meta.get('tid','-')} thread={thread_id} AUTO_CONFIRM triggered (via get_result)")
                except LovartError:
                    _log(f"[poll:confirm2] traceId={meta.get('tid','-')} thread={thread_id} AUTO_CONFIRM FAILED (via get_result)")
                    pass
                return False, ok(DataFormatter.task_view(task_id, "processing", 60, created))
            return False, ok(DataFormatter.task_view(task_id, "processing", 60, created,
                                 error={"message": "pending confirmation required", "code": "pending_confirmation"}))

        task_result = DataFormatter.lovart_to_apimart(result)
        now = int(time.time())

        if not task_result:
            msg = DataFormatter.assistant_text(result) or "生成完成但未产出任何素材（可能被内容审核拒绝或模型未调用生成工具）"
            data = DataFormatter.task_view(task_id, "failed", 100, created, completed=now,
                                          error={"message": msg, "code": "no_artifact"})
            await TaskService.fire_webhook(task_id, data)
            return True, ok(data)

        data = DataFormatter.task_view(task_id, "completed", 100, created, completed=now,
                                      actual_time=now - created, result=task_result)
        await TaskService.fire_webhook(task_id, data)
        return True, ok(data)

    @staticmethod
    async def fire_webhook(task_id: str, data: dict) -> None:
        meta = TaskManager.get(task_id)
        webhook = meta.get("webhook")
        if not webhook or meta.get("webhook_sent"):
            return
        retries = meta.get("webhook_retries", 0)
        if retries >= Config.WEBHOOK_MAX_RETRIES:
            meta["webhook_sent"] = True
            return
        now = time.time()
        if now - meta.get("webhook_last_attempt", 0) < Config.WEBHOOK_RETRY_INTERVAL:
            return
        meta["webhook_last_attempt"] = now
        try:
            client = await _get_http_client()
            r = await client.post(webhook.rstrip("/") + "/callback", json=data, timeout=15)
            if 200 <= r.status_code < 300:
                meta["webhook_sent"] = True
                return
            if 400 <= r.status_code < 500:
                meta["webhook_sent"] = True
                return
            meta["webhook_retries"] = retries + 1
            if meta["webhook_retries"] >= Config.WEBHOOK_MAX_RETRIES:
                meta["webhook_sent"] = True
        except Exception:
            meta["webhook_retries"] = retries + 1
            if meta["webhook_retries"] >= Config.WEBHOOK_MAX_RETRIES:
                meta["webhook_sent"] = True


# ============================================================================
# 7. FastAPI 路由定义 (Routers)
# ============================================================================

@app.get("/health")
async def health():
    return {"status": "ok", "backend": "lovart", "base": Config.LOVART_BASE,
            "auto_confirm": Config.AUTO_CONFIRM, "mode": Config.DEFAULT_MODE or "account-default"}

@app.get("/llms.txt")
async def llms_txt():
    """
    机器可读的 API 文档（llms.txt 约定）。
    供 Nomi 等客户端在接入时自动发现端点协议，无需人工配置 mapping。
    端点形状与 apimart.ai / OpenAI 兼容。
    """
    doc = """# APIMart-compatible Relay (Lovart backend)

本服务是一个 apimart.ai 协议兼容的中转网关，后端为 Lovart。
所有端点前缀均为 /v1，鉴权使用 Bearer user_key（在 USER_KEYS 中配置）。

## 鉴权
Authorization: Bearer <user_key>

## 模型列表
GET /v1/models
返回 OpenAI 风格模型列表：{ "object": "list", "data": [ { "id": <model_id>, "object": "model", "category": "image"|"video"|"chat" } ] }
可用模型示例：lovart-chat（对话）、nano-bn-pro / gpt-image-2-*（文生图）、seedance-2（文生视频）。

## 对话（文本生成）
POST /v1/chat/completions
请求体（OpenAI 兼容）：{ "model": "lovart-chat", "messages": [ { "role": "user", "content": "..." } ], "stream": false }
响应：{ "choices": [ { "message": { "role": "assistant", "content": "..." } } ], "usage": { "prompt_tokens": N, "completion_tokens": N } }

## 文生图 / 图生图
POST /v1/images/generations
POST /v1/images/edits
请求体：{ "model": "<image_model_id>", "prompt": "...", "size": "1024x1024"|"1:1", "image_urls": ["<参考图URL>"]（可选）, "n": 1 }
响应（同步返回任务）：{ "data": [ { "task_id": "task_xxx" } ] }

## 文生视频
POST /v1/videos/generations
POST /v1/video/generations
POST /v1/videos
请求体：{ "model": "<video_model_id>", "prompt": "...", "size": "1280x720"|"16:9", "image_urls": ["<参考图URL>"]（可选） }
响应（同步返回任务）：{ "data": [ { "task_id": "task_xxx" } ] }

## 任务查询（轮询）
GET /v1/tasks/{task_id}
GET /v1/videos/{task_id}
GET /v1/video/generations/{task_id}
状态枚举：pending / queued / submitted / processing / running / completed / failed / abort
终态 completed 的响应体：
{
  "id": "task_xxx",
  "status": "completed",
  "result": {
    "images": [ { "url": [ "<图片URL>" ] } ],
    "videos": [ { "url": [ "<视频URL>" ] } ]
  }
}
结果取用路径：
  图片：result.images[0].url[0]
  视频：result.videos[0].url[0]

## 人工确认（可选）
POST /v1/tasks/{task_id}/confirm
当 AUTO_CONFIRM=false 且任务 pending_confirmation 时调用。

## 上传辅助
POST /v1/uploads/images  （multipart/form-data，字段 file）
POST /v1/gateway/upload
GET  /v1/balance

## 不支持的能力
以下端点返回 HTTP 501（Lovart 后端不提供音频/音乐生成）：
POST /v1/music/generations
POST /v1/audio/generations
POST /v1/audio/speech
POST /v1/audio/transcriptions
"""
    return PlainTextResponse(doc)


@app.get("/v1/models")
async def list_models(client: LovartClient = Depends(get_lovart_client)):
    """OpenAI 风格模型列表。"""
    return JSONResponse(status_code=200, content={
        "object": "list",
        "data": _MODELS,
    })

# ----------------- 聊天能力 -----------------
@app.post("/v1/chat/completions")
async def chat_completions(request: Request, client: LovartClient = Depends(get_lovart_client)):
    try:
        body = await request.json()
    except Exception:
        return err(400, "invalid JSON body", "invalid_request_error", 400)

    messages = body.get("messages", [])
    parts = []
    vision_urls = []
    has_user = False
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if isinstance(content, list):
            texts = []
            for p in content:
                if not isinstance(p, dict):
                    continue
                if p.get("text"):
                    texts.append(p["text"])
                elif p.get("type") == "image_url":
                    img = (p.get("image_url") or {}).get("url", "")
                    if img:
                        vision_urls.append(img)
            content = " ".join(texts)
        if not isinstance(content, str):
            content = ""
        if role == "user" and content:
            has_user = True
        if content:
            parts.append(content if role == "user" else f"[{role}] {content}")
    prompt = "\n".join(parts).strip()
    if not has_user or not prompt:
        return err(400, "no user message found", "invalid_request_error", 400)

    _model = body.get("model", "")
    prefer = DataFormatter.resolve_prefer_models(_model, "IMAGE") or DataFormatter.resolve_prefer_models(_model, "VIDEO")
    stream = body.get("stream", True)

    async def run_and_get():
        # 方案 A：resolve_attachments 返回 (out, failed_count)；failed_count>0 已抛错阻断。
        attachments = (await TaskService.resolve_attachments(client, vision_urls))[0] if vision_urls else None
        try:
            await client.set_mode(unlimited=False)
        except LovartError:
            pass
        thread_id, _ = await TaskService.send_with_project(
            client, prompt=prompt,
            attachments=attachments, prefer_models=prefer,
            mode=Config.CHAT_THREAD_MODE,
        )
        deadline = time.time() + Config.CHAT_SYNC_TIMEOUT
        poll_count = 0

        while time.time() < deadline:
            st = await client.get_status(thread_id)
            status = st.get("status", "running")
            poll_count += 1

            if status == "done":
                await asyncio.sleep(5)
                st2 = await client.get_status(thread_id)
                # 二次确认期间任务可能在 done/abort 间翻转（sub-agent 启动后被中止）。
                # abort 必须作为失败终态抛出，绝不能和 done 一样吞掉结果返回 200。
                if st2.get("status") == "abort":
                    raise LovartError("生成已被中止 (aborted)", 400)
                if st2.get("status") == "done":
                    res = None
                    try:
                        res = await client.get_result(thread_id)
                        if res.get("pending_confirmation"):
                            if Config.AUTO_CONFIRM:
                                await client.confirm(thread_id)
                                continue
                            else:
                                raise DataFormatter.pending_confirmation_error(thread_id)
                    except LovartError:
                        pass
                    # 取到结果就返回；取结果瞬时失败（res 仍为 None）则继续轮询，
                    # 绝不返回上一轮残留的陈旧 res（避免误把待确认结果当终态）
                    if res is not None:
                        return res

            if status == "abort":
                raise LovartError("生成已被中止 (aborted)", 400)
            if status == "pending_confirmation":
                if Config.AUTO_CONFIRM:
                    await client.confirm(thread_id)
                else:
                    raise DataFormatter.pending_confirmation_error(thread_id)

            if poll_count >= 7 and status == "running" and poll_count % 3 == 0:
                try:
                    res = await client.get_result(thread_id)
                    if res.get("pending_confirmation"):
                        if Config.AUTO_CONFIRM:
                            await client.confirm(thread_id)
                        else:
                            raise DataFormatter.pending_confirmation_error(thread_id)
                except LovartError:
                    pass

            await asyncio.sleep(3)
        # 【核心修复】：抛出明确的 504 错误，而非默默返回空内容
        raise LovartError("同步等待生成结果超时", 504)

    if stream:
        async def gen():
            task = asyncio.create_task(run_and_get())
            try:
                while not task.done():
                    await asyncio.sleep(2)
                    yield b": heartbeat\n\n"
                try:
                    result = task.result()
                except LovartError as ex:
                    yield f"data: {json.dumps({'error': {'message': ex.message}})}\n\n".encode()
                    yield b"data: [DONE]\n\n"
                    return
                except Exception as ex:  # noqa
                    yield f"data: {json.dumps({'error': {'message': str(ex)}})}\n\n".encode()
                    yield b"data: [DONE]\n\n"
                    return
                content = DataFormatter.chat_content(result)
                chunk = {
                    "id": "chatcmpl-" + uuid.uuid4().hex[:12],
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": body.get("model", "lovart-agent"),
                    "choices": [{"index": 0, "delta": {"content": content}, "finish_reason": "stop"}],
                }
                yield f"data: {json.dumps(chunk)}\n\n".encode()
                yield b"data: [DONE]\n\n"
            except asyncio.CancelledError:
                if not task.done():
                    task.cancel()
                raise
        return StreamingResponse(gen(), media_type="text/event-stream")

    try:
        result = await run_and_get()
    except LovartError as ex:
        return lovart_err_response(ex)
    content = DataFormatter.chat_content(result)
    return ok({
        "id": "chatcmpl-" + uuid.uuid4().hex[:12],
        "object": "chat.completion",
        "created": int(time.time()),
        "model": body.get("model", "lovart-agent"),
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content},
                     "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    })


# ----------------- 生成能力抽象 -----------------
async def _submit_generation_flow(request: Request, client: LovartClient, category: str):
    try:
        body = await request.json()
    except Exception:
        return err(400, "invalid JSON body", "invalid_request_error", 400)

    # ── 字段翻译（见 contract.py）──
    body, alias_hits = normalize_body(body)
    if alias_hits:
        _log(f"[submit:alias] hits={alias_hits}")

    # 支持 ?wait=1 query string 同步返回（localTool FormData 路径拼 query string）
    if request.query_params.get("wait") == "1":
        body["wait"] = True

    # 生成提交阶段 traceId（此时 thread_id 尚未产生，网关自生成）。
    # 前端可传 X-Trace-Id 头跨节点关联；未传则 uuid 自生成。
    # 此 tid 会透传给 _do_submit → 写入 TaskManager → [poll] 日志回读，形成"提交 → 轮询"全链路可关联。
    tid = request.headers.get("X-Trace-Id") or uuid.uuid4().hex[:12]
    _log(f"[submit] traceId={tid} model={body.get('model','-')} "
         f"ref_images_raw={len(body.get('reference_images') or [])} "
         f"ref_videos_raw={len(body.get('reference_videos') or [])} "
         f"ref_audios_raw={len(body.get('reference_audios') or [])} "
         f"videos_raw={len(body.get('videos') or [])} "
         f"prompt={(body.get('prompt') or '')[:80]!r}")
    return await _do_submit(client, body, category, tid)

async def _do_submit(client, body: dict, category: str, tid: str = None):
    TaskManager.cleanup()
    prompt = body.get("prompt") or body.get("input") or ""
    if not prompt:
        return err(400, "prompt is required", "invalid_request_error", 400)

    # reference_videos / reference_audios 静默丢弃修复：
    # 此前只读了 videos/audios → 视频/音频参考被静默丢弃。修复：videos or reference_videos、audios or reference_audios。
    # or 短路语义天然覆盖：不存在 / []（空列表 falsy）/ 单 dict 或字符串。
    raw_urls = DataFormatter.extract_raw_urls(
        body.get("image_urls") or body.get("images") or body.get("attachments")
    ) + DataFormatter.extract_raw_urls(body.get("reference_images")) \
      + DataFormatter.extract_raw_urls(body.get("videos") or body.get("reference_videos")) \
      + DataFormatter.extract_raw_urls(body.get("audios") or body.get("reference_audios")) \
      + DataFormatter.extract_raw_urls_from_files(body.get("files"))
    # 参考素材来源明细（仅在有参考素材时打印，便于定位"来源异常"；无素材不刷屏）
    if raw_urls:
        _log(f"[submit:sources] traceId={tid or '-'} "
             f"image_urls/images/attachments={len(DataFormatter.extract_raw_urls(body.get('image_urls') or body.get('images') or body.get('attachments')))} "
             f"reference_images={len(DataFormatter.extract_raw_urls(body.get('reference_images')))} "
             f"videos={len(DataFormatter.extract_raw_urls(body.get('videos') or body.get('reference_videos')))} "
             f"audios={len(DataFormatter.extract_raw_urls(body.get('audios') or body.get('reference_audios')))} "
             f"files={len(DataFormatter.extract_raw_urls_from_files(body.get('files')))} "
             f"=> raw_urls合计={len(raw_urls)}")
    # 方案 A：resolve_attachments 返回 (out, failed_count)；failed_count>0 时内部已抛 LovartError 阻断，
    # 故此处正常到达即说明参考素材全部就绪（或本就无参考素材）。attachments 即成功转出的 CDN 列表。
    attachments, _failed = await TaskService.resolve_attachments(client, raw_urls)
    prefer = DataFormatter.resolve_prefer_models(body.get("model", ""), category)
    webhook = body.get("webhook")

    extra_params = []
    if category == "VIDEO":
        dur = body.get("duration")
        if dur:
            extra_params.append(f"duration: {dur}")
        ar = body.get("aspect_ratio")
        if ar:
            extra_params.append(f"aspect_ratio: {ar}")
        # 分辨率：前端传 resolution（如 720p/480p/1080p），与 duration/aspect_ratio 同格式拼入。
        res = body.get("resolution")
        if res:
            extra_params.append(f"resolution: {str(res).strip()}")

    gen_prefix = DataFormatter.build_gen_prefix(
        category, body.get("size"), body.get("resolution"), bool(attachments),
        params=extra_params,
        model_name=_PROMPT_MODEL_NAMES.get((body.get("model") or "").strip().lower(),
                                            (body.get("model") or "").strip()),
    )
    # 用户提示词原文用 <user_prompt> 标签包裹，并在末尾追加"原样使用"指令：
    # 让上游 Lovart Agent 明确知晓这是用户提示词原文，须严格原样透传给下游生成工具，
    # 不做改写或润色。只作用于用户输入，gen_prefix（尺寸/数量/模型约束）仍在标签之外。
    wrapped_prompt = (f"<user_prompt>\n{prompt}\n</user_prompt>\n"
                      f"以上为用户提示词原文，直接使用，请勿修改")
    if gen_prefix:
        prompt = f"{gen_prefix}\n{wrapped_prompt}"
    else:
        prompt = wrapped_prompt

    req_mode = body.get("mode")
    if req_mode not in ("fast", "unlimited"):
        req_mode = None
    eff_mode = req_mode or (Config.DEFAULT_MODE if Config.DEFAULT_MODE in ("fast", "unlimited") else None)

    try:
        if eff_mode:
            try:
                await client.set_mode(unlimited=(eff_mode == "unlimited"))
            except LovartError:
                pass
        thread_id, project_id = await TaskService.send_with_project(
            client, prompt=prompt,
            attachments=attachments or None, prefer_models=prefer,
        )
    except LovartError as le:
        return lovart_err_response(le)

    task_id = "task_" + thread_id
    now = int(time.time())
    # tid 写入 TaskManager，使 [poll] 日志可回读 traceId 与 [submit] 关联。
    # 后台 _background_webhook_watcher 调 check_and_fire_task 时无 HTTP 上下文，此时 tid 来自 meta 而非 header（降级为 "-" 可接受）。
    TaskManager.set(task_id, {
        "kind": category, "project_id": project_id,
        "created": now, "webhook": webhook, "webhook_sent": False,
        "webhook_retries": 0, "webhook_last_attempt": 0,
        "poll_count": 0, "tid": tid or "-",
    })

    _log(f"[submit:parse] traceId={tid or '-'} task_id={task_id} "
         f"raw_urls={len(raw_urls)} attachments={len(attachments or [])}")

    wait = body.get("wait") or False

    if wait:
        # 同步模式：内部轮询到完成，SSE 流式输出 progress，最后输出结果。
        # 前端图片节点（OpenAI 兼容）通过 SSE 分支读取 progress 更新任务中心进度，
        # 收到 status:succeeded + results[0].url 后取最终图片，等价于原同步 JSON 返回。
        async def sse_gen():
            deadline = time.time() + Config.LOVART_TIMEOUT
            while time.time() < deadline:
                is_done, response = await TaskService.check_and_fire_task(task_id, client)
                if is_done:
                    body_data = json.loads(response.body)
                    data = body_data.get("data", {})
                    result = data.get("result", {})
                    images = result.get("images", [])
                    videos = result.get("videos", [])
                    url = ""
                    if images:
                        url = (images[0].get("url") or [""])[0]
                    elif videos:
                        url = (videos[0].get("url") or [""])[0]
                    if url:
                        yield f"data: {json.dumps({'status':'succeeded','results':[{'url':url}]})}\n\n"
                    else:
                        yield f"data: {json.dumps({'status':'failed','error':(data.get('error') or {}).get('message','no artifact')})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                # 未完成：解析 progress 实时推给前端
                try:
                    prog = json.loads(response.body).get("data", {}).get("progress", 0)
                except Exception:
                    prog = 0
                yield f"data: {json.dumps({'progress':prog})}\n\n"
                await asyncio.sleep(3)
            # P0-4：同步 wait 模式 504 超时埋点。配合 [poll] 日志区分"超时"vs"Lovart 卡住"。
            _log(f"[submit:sync-timeout] traceId={tid or '-'} task_id={task_id} timeout={Config.LOVART_TIMEOUT}s")
            yield f"data: {json.dumps({'status':'failed','error':'同步等待生成结果超时'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(sse_gen(), media_type="text/event-stream")

    # 异步模式（默认）：返回 task_id，由调用方自行轮询或等待 webhook
    if webhook:
        asyncio.create_task(_background_webhook_watcher(task_id, client))

    if category == "VIDEO":
        # 视频能力统一返回对象结构（前端按 O.id / O.task_id 取轮询键）；
        # 图片能力按数组解析（前端按数组下标取 task_id）。
        # 网关只有三种能力：图片 / 视频 / 聊天，不区分"特惠/普通"视频。
        return ok({"id": task_id, "status": "submitted", "task_id": task_id})
    return ok([{"status": "submitted", "task_id": task_id}])

async def _background_webhook_watcher(task_id: str, client: LovartClient):
    """后台默默轮询以触发 webhook，防止纯异步调用方不主动 GET 导致 webhook 瘫痪"""
    for _ in range(180):  # 保护机制：最多后台监控 15 分钟
        await asyncio.sleep(5)
        meta = TaskManager.get(task_id)
        if not meta or meta.get("webhook_sent"):
            break
        try:
            is_done, _resp = await TaskService.check_and_fire_task(task_id, client)
            if is_done:
                break
        except Exception:
            pass


# ----------------- 图像生成与编辑 -----------------
@app.post("/v1/images/generations")
async def images_generations(request: Request, client: LovartClient = Depends(get_lovart_client)):
    return await _submit_generation_flow(request, client, "IMAGE")

@app.post("/v1/images/edits")
async def images_edits(request: Request, client: LovartClient = Depends(get_lovart_client)):
    try:
        form = await request.form()
    except Exception:
        return err(400, "invalid form data", "invalid_request_error", 400)
    prompt = form.get("prompt", "") or ""
    model = form.get("model", "") or ""
    size = form.get("size")
    files = form.getlist("image") if hasattr(form, "getlist") else [form.get("image")]
    files = [f for f in files if f]
    attachments = []
    for f in files:
        try:
            content = await f.read()
        except Exception:
            continue
        if not content:
            continue
        try:
            url = await client.upload_file(f.filename or "ref.png", content)
            if url:
                attachments.append(url)
        except LovartError:
            pass
    mask = form.get("mask")
    if mask:
        try:
            mcontent = await mask.read()
            if mcontent:
                murl = await client.upload_file(mask.filename or "mask.png", mcontent)
                if murl:
                    attachments.append(murl)
        except Exception:
            pass
    body = {
        "prompt": prompt,
        "model": model,
        "size": size,
        "images": attachments,
    }
    if request.query_params.get("wait") == "1":
        body["wait"] = True
    return await _do_submit(client, body, "IMAGE")


# ----------------- 视频生成 (支持多路由别名) -----------------
@app.post("/v1/videos/generations")
# 路由别名：兼容画布 sd2Video 节点（单数 video）
@app.post("/v1/video/generations")
# 路由别名：兼容画布 video 节点（无 generations 后缀）
@app.post("/v1/videos")
@app.post("/v1/gateway/generate")
async def videos_generations(request: Request, client: LovartClient = Depends(get_lovart_client)):
    # 视频生成统一入口（无论画布里是普通还是特惠节点，网关只认"视频"这一种能力）
    return await _submit_generation_flow(request, client, "VIDEO")


# ----------------- 任务查询与确认 -----------------
@app.get("/v1/tasks/{task_id}")
# ── 路由别名：兼容画布 video 节点轮询 → 统一走 /v1/tasks/{id} ──
@app.get("/v1/videos/{task_id}")
# ── 路由别名：兼容画布 sd2Video 节点轮询 → 统一走 /v1/tasks/{id} ──
@app.get("/v1/video/generations/{task_id}")
@app.get("/v1/gateway/task/{task_id}")
async def get_task(task_id: str, client: LovartClient = Depends(get_lovart_client)):
    _is_done, response = await TaskService.check_and_fire_task(task_id, client)
    return response

@app.post("/v1/tasks/{task_id}/confirm")
async def confirm_task(task_id: str, client: LovartClient = Depends(get_lovart_client)):
    """提供外部确认渠道，消灭 AUTO_CONFIRM=false 永久卡死的脚枪"""
    if not task_id.startswith("task_"):
        return err(400, "Invalid task ID", "invalid_request_error", 400)
    thread_id = task_id[len("task_"):]
    try:
        await client.confirm(thread_id)
    except LovartError as le:
        return lovart_err_response(le)
    return ok({"status": "confirmed"})


# ----------------- 绘图节点 / 上传 / 余额辅助端点 -----------------
# ── G3: 绘图节点 draw/completions → 复用 IMAGE 生成 ──
@app.post("/v1/draw/completions")
async def draw_completions(request: Request, client: LovartClient = Depends(get_lovart_client)):
    # 字段兼容：前端 draw 节点发送 {model, prompt, aspectRatio, urls}
    try:
        body = await request.json()
    except Exception:
        return err(400, "invalid JSON body", "invalid_request_error", 400)
    if "urls" in body and "image_urls" not in body:
        body["image_urls"] = body["urls"]
    if "aspectRatio" in body and "size" not in body:
        body["size"] = body.pop("aspectRatio")
    return await _do_submit(client, body, "IMAGE")

@app.post("/v1/uploads/images")
async def upload_image(request: Request, client: LovartClient = Depends(get_lovart_client)):
    form = await request.form()
    up = form.get("file")
    if up is None:
        return err(400, "missing file field", "invalid_request_error", 400)
    content = await up.read()
    try:
        url = await client.upload_file(up.filename, content)
    except LovartError as le:
        return lovart_err_response(le)
    return JSONResponse(status_code=200, content={
        "url": url,
        "filename": up.filename,
        "content_type": up.content_type,
        "bytes": len(content),
        "created_at": int(time.time()),
    })

# ============================================================================
# 路由别名：前端统一走 /v1/gateway/* 前缀，真实端点映射由本区块集中维护；
# 未来端点调整只改这里。能力只分三类：图片 / 视频 / 聊天 + 上传/任务查询辅助。
# ============================================================================
@app.post("/v1/gateway/upload")
async def gateway_upload(request: Request, client: LovartClient = Depends(get_lovart_client)):
    return await upload_image(request, client)

@app.get("/v1/balance")
async def balance(request: Request, client: LovartClient = Depends(get_lovart_client)):
    try:
        mode = await client.query_mode()
        unlimited = bool(mode.get("unlimited", False))
    except Exception:
        unlimited = False
    return JSONResponse(status_code=200, content={
        "success": True,
        "remain_balance": -1,
        "remain_credits": -1,
        "used_balance": -1,
        "used_credits": -1,
        "unlimited_quota": unlimited,
        "note": "Lovart backend does not expose balance; -1 means unknown",
    })


# ----------------- 不支持的能力拦截 -----------------
@app.post("/v1/music/generations")
@app.post("/v1/audio/generations")
@app.post("/v1/audio/speech")
@app.post("/v1/audio/transcriptions")
async def unsupported_audio():
    return err(501, "Audio/Music generation not supported by Lovart", "not_supported_error", 501)
