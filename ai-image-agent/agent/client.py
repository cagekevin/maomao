# ============================================================================
# Agent 轻量客户端（独立，不依赖 main.py）
#
# 仅支持 OpenAI 兼容协议：
#   - 生图：POST {base_url}/images/generations  （或 /v1/images/generations）
#   - LLM ：POST {base_url}/chat/completions     （或 /v1/chat/completions）
#
# 替代 main.py 的 build_online_image_result / canvas_llm。
# 图片返回本地保存（落 agent/output），返回 url 列表，供业务层写会话。
# ============================================================================

import os
import time
import uuid
import httpx
import asyncio

from . import config

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

HTTP_TIMEOUT = httpx.Timeout(connect=20.0, read=300.0, write=60.0, pool=20.0)


def _bearer(key):
    if not key:
        return ""
    return key if key.lower().startswith("bearer ") else "Bearer " + key


def _img_endpoint(base_url):
    base = base_url.rstrip("/")
    # 兼容带 /v1 或不带
    if base.endswith("/v1"):
        return base + "/images/generations"
    return base + "/images/generations"


def _chat_endpoint(base_url):
    base = base_url.rstrip("/")
    if base.endswith("/v1"):
        return base + "/chat/completions"
    return base + "/chat/completions"


async def _save_image_from_url(url):
    """下载远程图片到 agent/output，返回本地 url（file 服务或相对路径）。"""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
            ext = "png"
            ct = r.headers.get("content-type", "")
            if "jpeg" in ct or "jpg" in ct:
                ext = "jpg"
            elif "webp" in ct:
                ext = "webp"
            fname = f"online_{uuid.uuid4().hex[:10]}.{ext}"
            path = os.path.join(OUTPUT_DIR, fname)
            with open(path, "wb") as f:
                f.write(r.content)
            return "/agent/output/" + fname
    except Exception as e:
        print(f"[agent] 下载图片失败，直接用远程 url: {e}")
        return url


async def generate_image(prompt, provider_id="", model="", size="1024x1024", quality="auto", reference_images=None, n=1):
    """OpenAI 兼容生图。返回 {'images': [url, ...], 'model':..., 'provider_id':...}。"""
    provider = config.resolve_image_provider(provider_id)
    if not provider:
        raise RuntimeError("未配置生图模型（agent/api_providers.json 中无 enabled 且含 image_models 的 provider）")
    if not provider.get("base_url"):
        raise RuntimeError(f"provider {provider['id']} 缺少 base_url")
    key = config.provider_api_key(provider["id"], provider.get("api_key"))
    model = model or (provider.get("image_models") or [""])[0]
    if not model:
        raise RuntimeError(f"provider {provider['id']} 未配置 image_models")

    payload = {
        "prompt": prompt,
        "model": model,
        "n": max(1, min(8, int(n or 1))),
        "size": size,
    }
    if reference_images:
        imgs = [r["url"] for r in (reference_images or []) if r.get("url")]
        if imgs:
            payload["image"] = imgs[0]
            if len(imgs) > 1:
                payload["images"] = imgs

    headers = {"Authorization": _bearer(key), "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
        resp = await client.post(_img_endpoint(provider["base_url"]), json=payload, headers=headers)
        if resp.status_code >= 400:
            raise RuntimeError(f"生图接口错误 {resp.status_code}: {resp.text[:300]}")
        data = resp.json()

    urls = []
    # OpenAI 兼容返回 data:[{url|b64_json}]
    items = data.get("data") or []
    for it in items:
        if it.get("url"):
            urls.append(await _save_image_from_url(it["url"]))
        elif it.get("b64_json"):
            import base64
            fname = f"online_{uuid.uuid4().hex[:10]}.png"
            path = os.path.join(OUTPUT_DIR, fname)
            with open(path, "wb") as f:
                f.write(base64.b64decode(it["b64_json"]))
            urls.append("/agent/output/" + fname)
    if not urls:
        # 某些实现直接返回 images 数组
        for it in (data.get("images") or []):
            if isinstance(it, str):
                urls.append(await _save_image_from_url(it))
    return {
        "prompt": prompt,
        "images": urls,
        "model": model,
        "provider_id": provider["id"],
        "provider_name": provider.get("name") or provider["id"],
        "timestamp": time.time(),
    }


async def chat_completion(messages, provider_id="", model="", temperature=0.8):
    """OpenAI 兼容 LLM。返回文本字符串。"""
    provider = config.resolve_chat_provider(provider_id)
    if not provider:
        raise RuntimeError("未配置对话模型（agent/api_providers.json 中无 enabled 且含 chat_models 的 provider）")
    if not provider.get("base_url"):
        raise RuntimeError(f"provider {provider['id']} 缺少 base_url")
    key = config.provider_api_key(provider["id"], provider.get("api_key"))
    model = model or (provider.get("chat_models") or [""])[0]
    if not model:
        raise RuntimeError(f"provider {provider['id']} 未配置 chat_models")

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    headers = {"Authorization": _bearer(key), "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
        resp = await client.post(_chat_endpoint(provider["base_url"]), json=payload, headers=headers)
        if resp.status_code >= 400:
            raise RuntimeError(f"LLM 接口错误 {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
    return data["choices"][0]["message"]["content"]
