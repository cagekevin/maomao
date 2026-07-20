# -*- coding: utf-8 -*-
"""
APIMart 兼容中转站 —— 后端驱动 Lovart（全局最优完美版）
================================================================

运行：
    pip install -r requirements.txt
    export LOVART_ACCESS_KEY=ak_xxx
    export LOVART_SECRET_KEY=sk_xxx
    uvicorn main:app --host 0.0.0.0 --port 8000
"""

import asyncio
import base64
import json
import os
import re
import time
import uuid
from typing import Any, Dict, Optional, Tuple

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

from lovart_client import LovartClient, LovartError, close_http_client, _get_http_client

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

app = FastAPI(title="APIMart-compatible Relay (Lovart backend, optimal)")

@app.on_event("shutdown")
async def _on_shutdown():
    await close_http_client()

_TASK_META: Dict[str, dict] = {}


_IMAGE_RULES = [
    (("gpt-image-2-low", "gpt-image2-low", "gptimage2low"), "generate_image_gpt_image_2_low"),
    (("gpt-image-2-medium", "gpt-image2-medium", "gptimage2medium"), "generate_image_gpt_image_2_medium"),
    (("gpt-image-2-high", "gpt-image2-high", "gptimage2high"), "generate_image_gpt_image_2_high"),
    (("gpt-image-2", "gpt-image2", "gptimage2"), "generate_image_gpt_image_2"),
    (("gpt-image-1.5", "gpt-image-1-5", "gpt-image1.5"), "generate_image_gpt_image_1_5"),
    (("nano-banana-pro", "nano banana pro", "nanobananapro"), "generate_image_nano_banana_pro"),
    (("nano-banana-2", "nano banana 2"), "generate_image_nano_banana_2"),
    (("nano-banana", "nano banana"), "generate_image_nano_banana"),
    (("seedream-5", "seedream5", "seedream-v5", "seedream 5"), "generate_image_seedream_v5"),
    (("seedream-4.5", "seedream-v4-5", "seedream 4.5"), "generate_image_seedream_v4_5"),
    (("seedream-4", "seedream4", "seedream-v4", "seedream 4"), "generate_image_seedream_v4"),
    (("imagen-4", "imagen4", "imagen-v4"), "generate_image_imagen_v4"),
    (("flux.2-max", "flux-2-max", "flux2max"), "generate_image_flux_2_max"),
    (("flux.2-pro", "flux-2-pro", "flux2pro"), "generate_image_flux_2_pro"),
    (("luma-uni-1-max", "luma uni-1-max"), "generate_image_luma_uni_1_max"),
    (("luma-uni-1", "luma uni-1"), "generate_image_luma_uni_1"),
    (("midjourney", "mj"), "generate_image_midjourney"),
]
_VIDEO_RULES = [
    (("seedance-2.0-fast", "seedance-v2-0-fast", "seedance 2.0 fast"), "generate_video_seedance_v2_0_fast"),
    (("seedance-2", "seedance2", "seedance-v2", "seedance 2"), "generate_video_seedance_v2_0"),
    (("seedance-1.5", "seedance-pro", "seedance 1.5"), "generate_video_seedance_pro_v1_5"),
    (("kling-v3-omni", "kling-3-omni", "kling 3 omni"), "generate_video_kling_v3_omni"),
    (("kling-v3", "kling-3", "kling3", "kling 3"), "generate_video_kling_v3"),
    (("kling-v2.6", "kling-2.6", "kling 2.6"), "generate_video_kling_v2_6"),
    (("kling-o1", "kling-omni"), "generate_video_kling_omni_v1"),
    (("kling",), "generate_video_kling_v3"),
    (("veo3.1-fast", "veo-3.1-fast", "veo3-1-fast"), "generate_video_veo3_1_fast"),
    (("veo3.1", "veo-3.1", "veo3-1"), "generate_video_veo3_1"),
    (("veo3", "veo-3"), "generate_video_veo3"),
    (("sora-2-pro", "sora2pro", "sora 2 pro"), "generate_video_sora_v2_pro"),
    (("sora-2", "sora2", "sora 2"), "generate_video_sora_v2"),
    (("wan-2.6", "wan2.6", "wan-v2-6"), "generate_video_wan_v2_6"),
    (("hailuo-2.3", "hailuo2.3", "hailuo-v2-3"), "generate_video_hailuo_v2_3"),
    (("vidu-q2", "vidu q2"), "generate_video_vidu_q2"),
]

def resolve_prefer_models(model: str, category: str) -> Optional[dict]:
    if not model or category not in ("IMAGE", "VIDEO"):
        return None
    m = model.lower().replace("_", "-")
    rules = _IMAGE_RULES if category == "IMAGE" else _VIDEO_RULES
    for keys, tool in rules:
        if any(k in m for k in keys):
            return {category: [tool]}
    return None

def resolve_client(request: Request) -> Tuple[Optional[LovartClient], Optional[JSONResponse]]:
    auth = request.headers.get("authorization", "")
    user_key = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    if OPEN_RELAY:
        ak, sk = DEFAULT_AK, DEFAULT_SK
    elif user_key in USER_KEYS:
        ak, _, sk = USER_KEYS[user_key].partition("|")
    else:
        return None, auth_error()
    if not ak or not sk:
        return None, auth_error()
    return LovartClient(LOVART_BASE, ak, sk, timeout=LOVART_TIMEOUT), None

def auth_error():
    return JSONResponse(status_code=401, content={
        "error": {"code": 401, "message": "Authentication failed", "type": "authentication_error"}
    })

def ok(data):
    return JSONResponse(status_code=200, content={"code": 200, "data": data})

def err(status: int, message: str, etype: str = "invalid_request_error", code=None):
    return JSONResponse(status_code=status, content={
        "error": {"code": code if code is not None else status, "type": etype, "message": message}
    })

def _status_to_type(status: int) -> str:
    return {
        400: "invalid_request_error",
        401: "authentication_error",
        413: "invalid_request_error",
        402: "payment_required",
        403: "permission_error",
        404: "not_found_error",
        409: "conflict_error",
        429: "rate_limit_error",
        500: "server_error",
        502: "bad_gateway",
    }.get(status, "api_error")

def lovart_err_to_response(e: LovartError) -> JSONResponse:
    return err(e.http_status, e.message, _status_to_type(e.http_status), e.http_status)

def lovart_to_apimart(result: dict) -> dict:
    images, videos, audios = [], [], []
    expire = int(time.time()) + TASK_RESULT_TTL
    seen = set()
    for item in result.get("items", []) or []:
        for art in item.get("artifacts", []) or []:
            url = art.get("content", "")
            t = art.get("type", "image")
            if not url or url in seen:
                continue
            seen.add(url)
            if t == "image":
                images.append({"url": [url], "expires_at": expire})
            elif t == "video":
                videos.append({"url": [url], "expires_at": expire})
            elif t in ("audio", "music"):
                audios.append({"audio_url": url, "expires_at": expire})
    out = {}
    if images:
        out["images"] = images
    if videos:
        out["videos"] = videos
    if audios:
        out["music"] = audios
    return out

def assistant_text(result: dict) -> str:
    texts = []
    for item in result.get("items", []) or []:
        t = (item.get("text") or "").strip()
        if t:
            texts.append(t)
    return "\n\n".join(texts)

def _pending_confirmation_error(thread_id: str) -> LovartError:
    """AUTO_CONFIRM=false 时，把待确认状态转成结构化错误，附带 task_id 让调用方去确认。"""
    task_id = "task_" + thread_id
    return LovartError(
        f"任务需要人工确认高成本操作（pending_confirmation）。"
        f"请调用 POST /v1/tasks/{task_id}/confirm 完成确认，"
        f"然后轮询 GET /v1/tasks/{task_id} 获取最终结果。",
        409,
    )

def _chat_content(result: dict) -> str:
    text = assistant_text(result)
    media = lovart_to_apimart(result)
    links = []
    for u in media.get("images", []):
        links.append(f"![image]({u['url'][0]})")
    for u in media.get("videos", []):
        links.append(f"[video]({u['url'][0]})")
    for u in media.get("music", []):
        links.append(f"[audio]({u['audio_url']})")
    return (text + ("\n\n" + "\n".join(links) if links else "")).strip() or "(无内容)"

def _parse_size(size: str):
    if not size:
        return "", ""
    s = size.strip()
    if re.fullmatch(r"\d+:\d+", s):
        return s, ""
    try:
        parts = s.lower().split("x")
        if len(parts) != 2:
            return "", ""
        w, h = int(parts[0]), int(parts[1])
        ratios = [(1, 1, "1:1"), (3, 2, "3:2"), (2, 3, "2:3"), (4, 3, "4:3"),
                  (3, 4, "3:4"), (16, 9, "16:9"), (9, 16, "9:16")]
        r = w / h
        ratio = min(ratios, key=lambda x: abs(r - x[0] / x[1]))[2]
        resolution = "4K" if max(w, h) >= 3000 else ("2K" if max(w, h) >= 1800 else "1K")
        return ratio, resolution
    except Exception:
        return "", ""

def _extract_raw_urls(value) -> list:
    if not value:
        return []
    items = value if isinstance(value, list) else [value]
    out = []
    for it in items:
        if isinstance(it, str):
            out.append(it)
        elif isinstance(it, dict):
            u = it.get("url") or it.get("fileUrl") or ""
            if u:
                out.append(u)
    return out

async def _resolve_attachments(client, raw_urls: list) -> list:
    out = []
    for u in raw_urls:
        if not u or not isinstance(u, str):
            continue
        if u.startswith("http"):
            out.append(u)
        elif u.startswith("data:"):
            try:
                header, _, b64 = u.partition(",")
                ext = "png"
                if "jpeg" in header or "jpg" in header:
                    ext = "jpg"
                elif "gif" in header:
                    ext = "gif"
                elif "webp" in header:
                    ext = "webp"
                elif "mp4" in header:
                    ext = "mp4"
                elif "mpeg" in header or "mp3" in header:
                    ext = "mp3"
                
                raw = await asyncio.to_thread(base64.b64decode, b64)
                cdn = await client.upload_file(f"_ref_{uuid.uuid4().hex[:8]}.{ext}", raw)
                if cdn:
                    out.append(cdn)
            except Exception:
                continue
        else:
            out.append(u)
    return out

PROJECT_CACHE_FILE = os.getenv("PROJECT_CACHE_FILE", ".lovart_project.json")
_PROJECT_CACHE: Dict[str, str] = {}
_PROJECT_LOCK = asyncio.Lock()

try:
    with open(PROJECT_CACHE_FILE, "r", encoding="utf-8") as _pf:
        _loaded = json.load(_pf)
        if isinstance(_loaded, dict):
            _PROJECT_CACHE.update(_loaded)
except (FileNotFoundError, json.JSONDecodeError):
    pass

async def _persist_project_cache() -> None:
    def _write():
        try:
            with open(PROJECT_CACHE_FILE, "w", encoding="utf-8") as _pf:
                json.dump(_PROJECT_CACHE, _pf)
        except OSError:
            pass
    await asyncio.to_thread(_write)

async def ensure_project(client: LovartClient) -> str:
    ak = client.access_key
    async with _PROJECT_LOCK:
        pid = _PROJECT_CACHE.get(ak)
        if pid:
            return pid
        pid = await client.create_project()
        _PROJECT_CACHE[ak] = pid
        await _persist_project_cache()
        return pid

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

async def _send_with_project(client: LovartClient, **kwargs) -> Tuple[str, str]:
    pid = await ensure_project(client)
    try:
        tid = await client.send(project_id=pid, **kwargs)
    except LovartError as e:
        if _is_project_invalid(e):
            async with _PROJECT_LOCK:
                _PROJECT_CACHE.pop(client.access_key, None)
                await _persist_project_cache()
            pid = await ensure_project(client)
            tid = await client.send(project_id=pid, **kwargs)
        else:
            raise
    return tid, pid

def _build_gen_prefix(category: str, size, resolution=None, has_refs: bool = False,
                      params: Optional[list] = None) -> str:
    parts = []
    ratio, res = _parse_size(size) if size else ("", "")
    if ratio:
        parts.append(ratio)
    if res:
        parts.append(res)
    if not res and resolution:
        parts.append(str(resolution).strip().lower())
    for p in (params or []):
        if p:
            parts.append(str(p).strip())
    prefix = ", ".join(parts)
    if category == "IMAGE":
        instr = ("Reference image attached. Use reference and edit. Must generate exactly ONE image."
                 if has_refs else
                 "Must generate exactly ONE image with these settings, do NOT generate more than one.")
    elif category == "VIDEO":
        instr = "Must generate exactly ONE video."
    else:
        instr = ""
    if prefix and instr:
        return f"{prefix}\n{instr}"
    return prefix or instr

def _task_view(task_id, status, progress, created, completed=None, actual_time=None,
               result=None, error=None) -> dict:
    d = {
        "id": task_id, "status": status, "progress": progress, "created": created,
        "actual_time": 0, "estimated_time": None, "cost": 0, "credits_cost": 0,
    }
    if completed is not None:
        d["completed"] = completed
    if actual_time is not None:
        d["actual_time"] = actual_time
    if result is not None:
        d["result"] = result
    if error is not None:
        d["error"] = error
    return d

async def _fire_webhook(task_id: str, data: dict) -> None:
    meta = _TASK_META.get(task_id, {})
    webhook = meta.get("webhook")
    if not webhook or meta.get("webhook_sent"):
        return
    retries = meta.get("webhook_retries", 0)
    if retries >= WEBHOOK_MAX_RETRIES:
        meta["webhook_sent"] = True
        return
    now = time.time()
    if now - meta.get("webhook_last_attempt", 0) < WEBHOOK_RETRY_INTERVAL:
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
        if meta["webhook_retries"] >= WEBHOOK_MAX_RETRIES:
            meta["webhook_sent"] = True
    except Exception:
        meta["webhook_retries"] = retries + 1
        if meta["webhook_retries"] >= WEBHOOK_MAX_RETRIES:
            meta["webhook_sent"] = True

def _build_models() -> list:
    models = [
        {"id": "lovart-chat", "object": "model", "created": 0,
         "owned_by": "lovart", "category": "chat",
         "description": "Lovart 设计 Agent（深度推理，支持图/视频/音频多模态）"},
    ]
    for keys, tool in _IMAGE_RULES:
        models.append({"id": keys[0], "object": "model", "created": 0,
                       "owned_by": "lovart", "category": "image", "tool": tool})
    for keys, tool in _VIDEO_RULES:
        models.append({"id": keys[0], "object": "model", "created": 0,
                       "owned_by": "lovart", "category": "video", "tool": tool})
    models.append({"id": "lovart-music", "object": "model", "created": 0,
                   "owned_by": "lovart", "category": "music",
                   "description": "Lovart 音乐/音频生成（Agent 自选音频工具）"})
    return models

_MODELS = _build_models()

@app.get("/health")
async def health():
    return {"status": "ok", "backend": "lovart", "base": LOVART_BASE,
            "auto_confirm": AUTO_CONFIRM, "mode": DEFAULT_MODE or "account-default"}

@app.get("/v1/models")
async def list_models(request: Request):
    """OpenAI 风格模型列表。必须配置有效的 API Key（多租户/单机均支持）。"""
    client, e = resolve_client(request)
    if e:
        return e
    return JSONResponse(status_code=200, content={
        "object": "list",
        "data": _MODELS,
    })

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    client, e = resolve_client(request)
    if e:
        return e
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
    prefer = resolve_prefer_models(_model, "IMAGE") or resolve_prefer_models(_model, "VIDEO")
    stream = body.get("stream", True)

    async def run_and_get():
        attachments = await _resolve_attachments(client, vision_urls) if vision_urls else None
        try:
            await client.set_mode(unlimited=False)
        except LovartError:
            pass
        thread_id, _ = await _send_with_project(
            client, prompt=prompt,
            attachments=attachments, prefer_models=prefer,
            mode=CHAT_THREAD_MODE,
        )
        deadline = time.time() + CHAT_SYNC_TIMEOUT
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
                            if AUTO_CONFIRM:
                                await client.confirm(thread_id)
                                continue
                            else:
                                raise _pending_confirmation_error(thread_id)
                    except LovartError:
                        pass
                    # 取到结果就返回；取结果瞬时失败（res 仍为 None）则继续轮询，
                    # 绝不返回上一轮残留的陈旧 res（避免误把待确认结果当终态）
                    if res is not None:
                        return res
                    
            if status == "abort":
                raise LovartError("生成已被中止 (aborted)", 400)
            if status == "pending_confirmation":
                if AUTO_CONFIRM:
                    await client.confirm(thread_id)
                else:
                    raise _pending_confirmation_error(thread_id)
                
            if poll_count >= 7 and status == "running" and poll_count % 3 == 0:
                try:
                    res = await client.get_result(thread_id)
                    if res.get("pending_confirmation"):
                        if AUTO_CONFIRM:
                            await client.confirm(thread_id)
                        else:
                            raise _pending_confirmation_error(thread_id)
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
                content = _chat_content(result)
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
        return lovart_err_to_response(ex)
    content = _chat_content(result)
    return ok({
        "id": "chatcmpl-" + uuid.uuid4().hex[:12],
        "object": "chat.completion",
        "created": int(time.time()),
        "model": body.get("model", "lovart-agent"),
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content},
                     "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    })

@app.post("/v1/images/generations")
async def images_generations(request: Request):
    return await _submit_generation(request, "IMAGE")

@app.post("/v1/images/edits")
async def images_edits(request: Request):
    client, e = resolve_client(request)
    if e:
        return e
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
    return await _do_submit(client, body, "IMAGE")

@app.post("/v1/videos/generations")
async def videos_generations(request: Request):
    return await _submit_generation(request, "VIDEO")

# 路由别名：兼容画布 sd2Video 节点（单数 video）
@app.post("/v1/video/generations")
async def video_generations_singular(request: Request):
    return await _submit_generation(request, "VIDEO")

# 路由别名：兼容画布 video 节点（无 generations 后缀）
@app.post("/v1/videos")
async def videos_no_gen(request: Request):
    return await _submit_generation(request, "VIDEO")

@app.post("/v1/music/generations")
async def music_generations(request: Request):
    return err(501, "音乐/音频生成 (music generation) 不被 Lovart 后端支持", "not_supported_error", 501)

@app.post("/v1/audio/generations")
async def audio_generations(request: Request):
    return err(501, "音乐/音频生成 (music generation) 不被 Lovart 后端支持", "not_supported_error", 501)

@app.post("/v1/audio/speech")
async def audio_speech(request: Request):
    return err(501, "TTS (text-to-speech) 不被 Lovart 后端支持", "not_supported_error", 501)

@app.post("/v1/audio/transcriptions")
async def audio_transcriptions(request: Request):
    return err(501, "语音转写 (speech-to-text) 不被 Lovart 后端支持", "not_supported_error", 501)


async def _background_webhook_watcher(task_id: str, client: LovartClient):
    """【核心修复】：后台默默轮询以触发 webhook，防止纯异步调用方不主动 GET 导致 webhook 瘫痪"""
    for _ in range(180): # 保护机制：最多后台监控 15 分钟
        await asyncio.sleep(5)
        meta = _TASK_META.get(task_id, {})
        if not meta or meta.get("webhook_sent"):
            break
        try:
            is_done, _resp = await _check_and_fire_task(task_id, client)
            if is_done:
                break
        except Exception:
            pass


async def _submit_generation(request: Request, category: str):
    client, e = resolve_client(request)
    if e:
        return e
    try:
        body = await request.json()
    except Exception:
        return err(400, "invalid JSON body", "invalid_request_error", 400)
    # 字段兼容映射：画布视频节点字段名 → 网关标准字段名
    if "metadata" in body and isinstance(body["metadata"], dict):
        meta = body.pop("metadata")
        for key in ("reference_images", "reference_videos", "reference_audios",
                     "ratio", "duration", "watermark", "generate_audio"):
            if key in meta and key not in body:
                body[key] = meta[key]
    if "ratio" in body and "aspect_ratio" not in body:
        body["aspect_ratio"] = body.pop("ratio")
    if "seconds" in body and "duration" not in body:
        body["duration"] = body.pop("seconds")
    if "input_reference" in body and "reference_images" not in body:
        body["reference_images"] = body.pop("input_reference")
    if "input_video" in body and "videos" not in body:
        body["videos"] = body.pop("input_video")
    return await _do_submit(client, body, category)

def _cleanup_task_meta():
    if len(_TASK_META) > 500:
        now = int(time.time())
        expired = [k for k, v in _TASK_META.items() if now - v.get("created", now) > 86400]
        for k in expired:
            _TASK_META.pop(k, None)

async def _do_submit(client, body: dict, category: str):
    _cleanup_task_meta()
    prompt = body.get("prompt") or body.get("input") or ""
    if not prompt:
        return err(400, "prompt is required", "invalid_request_error", 400)

    raw_urls = _extract_raw_urls(
        body.get("image_urls") or body.get("images") or body.get("attachments")
    ) + _extract_raw_urls(body.get("reference_images")) \
      + _extract_raw_urls(body.get("videos")) \
      + _extract_raw_urls(body.get("audios"))
    attachments = await _resolve_attachments(client, raw_urls)
    prefer = resolve_prefer_models(body.get("model", ""), category)
    webhook = body.get("webhook")

    extra_params = []
    if category == "VIDEO":
        dur = body.get("duration")
        if dur:
            extra_params.append(f"duration: {dur}")
        ar = body.get("aspect_ratio")
        if ar:
            extra_params.append(f"aspect_ratio: {ar}")

    gen_prefix = _build_gen_prefix(
        category, body.get("size"), body.get("resolution"), bool(attachments),
        params=extra_params,
    )
    if gen_prefix:
        prompt = f"{gen_prefix}\n{prompt}"

    req_mode = body.get("mode")
    if req_mode not in ("fast", "unlimited"):
        req_mode = None
    eff_mode = req_mode or (DEFAULT_MODE if DEFAULT_MODE in ("fast", "unlimited") else None)

    try:
        if eff_mode:
            try:
                await client.set_mode(unlimited=(eff_mode == "unlimited"))
            except LovartError:
                pass
        thread_id, project_id = await _send_with_project(
            client, prompt=prompt,
            attachments=attachments or None, prefer_models=prefer,
        )
    except LovartError as le:
        return lovart_err_to_response(le)

    task_id = "task_" + thread_id
    now = int(time.time())
    _TASK_META[task_id] = {
        "kind": category, "project_id": project_id,
        "created": now, "webhook": webhook, "webhook_sent": False,
        "webhook_retries": 0, "webhook_last_attempt": 0,
        "poll_count": 0,
    }
    
    # 启动异步 webhook 守护程序
    if webhook:
        asyncio.create_task(_background_webhook_watcher(task_id, client))
        
    return ok([{"status": "submitted", "task_id": task_id}])

async def _check_and_fire_task(task_id: str, client: LovartClient) -> Tuple[bool, JSONResponse]:
    """核心轮询逻辑：返回 (是否达到终态, HTTP JSON响应)"""
    if not task_id.startswith("task_"):
        return True, err(400, "Invalid task ID", "invalid_request_error", 400)
    
    thread_id = task_id[len("task_"):]
    meta = _TASK_META.get(task_id, {})
    created = meta.get("created", int(time.time()))

    try:
        st = await client.get_status(thread_id)
    except LovartError as le:
        return False, lovart_err_to_response(le)

    status = st.get("status", "running")

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
        return False, ok(_task_view(task_id, "pending", 0, created))

    if status == "pending_confirmation":
        if AUTO_CONFIRM:
            try:
                await client.confirm(thread_id)
            except LovartError:
                pass
        return False, ok(_task_view(task_id, "processing", 50, created))

    if status == "running":
        return False, ok(_task_view(task_id, "processing", 30, created))

    if status == "abort":
        data = _task_view(task_id, "failed", 100, created,
                          completed=int(time.time()),
                          error={"message": "生成被中止", "code": "abort"})
        await _fire_webhook(task_id, data)
        return True, ok(data)

    try:
        result = await client.get_result(thread_id)
    except LovartError as le:
        return False, lovart_err_to_response(le)

    pc = result.get("pending_confirmation")
    if pc:
        if AUTO_CONFIRM:
            try:
                await client.confirm(thread_id)
            except LovartError:
                pass
            return False, ok(_task_view(task_id, "processing", 60, created))
        return False, ok(_task_view(task_id, "processing", 60, created,
                             error={"message": "pending confirmation required", "code": "pending_confirmation"}))

    task_result = lovart_to_apimart(result)
    now = int(time.time())

    if not task_result:
        msg = assistant_text(result) or "生成完成但未产出任何素材（可能被内容审核拒绝或模型未调用生成工具）"
        data = _task_view(task_id, "failed", 100, created, completed=now,
                          error={"message": msg, "code": "no_artifact"})
        await _fire_webhook(task_id, data)
        return True, ok(data)

    data = _task_view(task_id, "completed", 100, created, completed=now,
                      actual_time=now - created, result=task_result)
    await _fire_webhook(task_id, data)
    return True, ok(data)


@app.get("/v1/tasks/{task_id}")
async def get_task(task_id: str, request: Request):
    client, e = resolve_client(request)
    if e:
        return e
    _is_done, response = await _check_and_fire_task(task_id, client)
    return response


@app.post("/v1/tasks/{task_id}/confirm")
async def confirm_task(task_id: str, request: Request):
    """【核心修复】：消灭 AUTO_CONFIRM=false 永久卡死的脚枪，提供外部确认渠道"""
    client, e = resolve_client(request)
    if e:
        return e
    if not task_id.startswith("task_"):
        return err(400, "Invalid task ID", "invalid_request_error", 400)
    
    thread_id = task_id[len("task_"):]
    try:
        await client.confirm(thread_id)
    except LovartError as le:
        return lovart_err_to_response(le)
    
    return ok({"status": "confirmed"})


@app.post("/v1/uploads/images")
async def upload_image(request: Request):
    client, e = resolve_client(request)
    if e:
        return e
    form = await request.form()
    up = form.get("file")
    if up is None:
        return err(400, "missing file field", "invalid_request_error", 400)
    content = await up.read()
    try:
        url = await client.upload_file(up.filename, content)
    except LovartError as le:
        return lovart_err_to_response(le)
    return JSONResponse(status_code=200, content={
        "url": url,
        "filename": up.filename,
        "content_type": up.content_type,
        "bytes": len(content),
        "created_at": int(time.time()),
    })

@app.get("/v1/balance")
async def balance(request: Request):
    client, e = resolve_client(request)
    if e:
        return e
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