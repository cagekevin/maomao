# ============================================================================
# Agent 配置（独立，不依赖 main.py）
#
# 全部 provider / api key / 模型 通过本模块从 config 文件读取：
#   - agent/api_providers.json  （provider 列表，含 base_url / models / 明文 key 可选）
#   - agent/.env                 （API_..._KEY 形式的环境/文件密钥，优先级高于 json 明文）
#
# 设计对齐作者 main.py 的 provider 字段（id/name/enabled/base_url/protocol/
# image_models/chat_models），但仅保留 Agent 所需子集，不搬运画布其他逻辑。
# 生图 / LLM 调用统一走 OpenAI 兼容协议（protocol=openai），
# 由 client.py 直接 httpx 调用 config 中的 base_url。
# ============================================================================

import os
import re
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROVIDERS_FILE = os.path.join(BASE_DIR, "api_providers.json")
ENV_FILE = os.path.join(BASE_DIR, ".env")

SUPPORTED_PROTOCOLS = {"openai", "openai-compatible"}


def _read_env_file_value(key):
    key = (key or "").strip()
    if not key or not os.path.exists(ENV_FILE):
        return ""
    try:
        with open(ENV_FILE, "r", encoding="utf-8-sig") as f:
            for line in f.read().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k.strip() == key:
                    return v.strip().strip('"').strip("'")
    except Exception:
        return ""
    return ""


def provider_key_env(provider_id):
    pid = (provider_id or "").strip().lower()
    if pid == "comfly":
        return "COMFLY_API_KEY"
    if pid == "modelscope":
        return "MODELSCOPE_API_KEY"
    if pid == "runninghub":
        return "RUNNINGHUB_API_KEY"
    if pid == "volcengine":
        return "ARK_API_KEY"
    return "API_PROVIDER_" + re.sub(r"[^A-Za-z0-9]", "_", pid).upper() + "_KEY"


def provider_api_key(provider_id, explicit_key=""):
    """优先 explicit_key → 环境变量 → .env 文件。"""
    if explicit_key:
        return explicit_key
    env_key = provider_key_env(provider_id)
    val = os.getenv(env_key, "") or _read_env_file_value(env_key)
    if val:
        return val
    if provider_id == "modelscope":
        return os.getenv("MODELSCOPE_API_KEY", "")
    return ""


def _normalize_provider(item):
    if not isinstance(item, dict):
        return None
    pid = str(item.get("id") or "").strip().lower()
    if not pid:
        return None
    name = str(item.get("name") or pid).strip() or pid
    base_url = str(item.get("base_url") or "").strip().rstrip("/")
    protocol = str(item.get("protocol") or "openai").strip().lower()
    if protocol not in SUPPORTED_PROTOCOLS:
        protocol = "openai"
    return {
        "id": pid,
        "name": name,
        "base_url": base_url,
        "protocol": protocol,
        "enabled": bool(item.get("enabled", True)),
        "primary": bool(item.get("primary", False)),
        "image_models": [str(m).strip() for m in (item.get("image_models") or []) if str(m).strip()],
        "chat_models": [str(m).strip() for m in (item.get("chat_models") or []) if str(m).strip()],
        "api_key": str(item.get("api_key") or "").strip(),
    }


def load_providers():
    """读取 agent 自己的 provider 配置（不读 main）。"""
    if not os.path.exists(PROVIDERS_FILE):
        return []
    try:
        with open(PROVIDERS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        items = raw if isinstance(raw, list) else raw.get("providers") or []
        return [p for p in (_normalize_provider(x) for x in items) if p]
    except Exception as e:
        print(f"[agent] 加载 api_providers.json 失败: {e}")
        return []


def get_provider(provider_id=""):
    providers = [p for p in load_providers() if p.get("enabled", True)]
    if provider_id:
        hit = next((p for p in providers if p["id"] == provider_id.strip().lower()), None)
        if hit:
            return hit
    primary = next((p for p in providers if p.get("primary")), None)
    if primary:
        return primary
    return providers[0] if providers else None


def image_providers():
    return [p for p in load_providers() if p.get("enabled", True) and (p.get("image_models") or [])]


def chat_providers():
    return [p for p in load_providers() if p.get("enabled", True) and (p.get("chat_models") or [])]


def resolve_image_provider(provider_id=""):
    ps = image_providers()
    if provider_id:
        hit = next((p for p in ps if p["id"] == provider_id.strip().lower()), None)
        if hit:
            return hit
    return ps[0] if ps else None


def resolve_chat_provider(provider_id=""):
    ps = chat_providers()
    if provider_id:
        hit = next((p for p in ps if p["id"] == provider_id.strip().lower()), None)
        if hit:
            return hit
    return ps[0] if ps else None


def provider_image_models(provider_id):
    p = resolve_image_provider(provider_id)
    return (p.get("image_models") or []) if p else []


def provider_chat_models(provider_id):
    p = resolve_chat_provider(provider_id)
    return (p.get("chat_models") or []) if p else []


def max_reference_images(provider):
    """OpenAI 兼容生图一般支持多张参考图，这里给一个合理上限。"""
    return 8
