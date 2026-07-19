"""
gateway 统一验证（合并 verify_contract / verify_webhook / verify_routes）。

三段全部离线，不碰真实 Lovart：
  ① 契约自验证   : 纯函数 lovart_to_apimart / assistant_text / resolve_prefer_models
  ② webhook 重试  : §十 4xx 放弃 / 5xx≤3 / 200（真实 HTTP server + 退避置 0）
  ③ 路由行为      : 鉴权矩阵 / chat 上下文 / mode / SSE / 信封 / audio 501（FakeClient mock）

运行：cd apimart-gateway && python3 verify_gateway.py
"""
import asyncio
import http.server
import json
import sys
import threading

import main as _main
from main import (
    lovart_to_apimart, assistant_text, resolve_prefer_models,
    _fire_webhook, _TASK_META,
)
from fastapi.testclient import TestClient


# ── 共享断言 ────────────────────────────────────────────────
def check(name, cond):
    print(("PASS" if cond else "FAIL"), name)
    if not cond:
        check.failed += 1
check.failed = 0


client = TestClient(_main.app)


# ═══════════════════════════════════════════════════════════
# ① 契约自验证（纯函数，无需凭据）
# ═══════════════════════════════════════════════════════════
def _contract_test():
    lovart_result = {
        "items": [
            {"type": "assistant", "text": "好的，这是你的设计图："},
            {"type": "image", "artifacts": [
                {"type": "image", "content": "https://cdn.lovart.ai/img1.png"},
                {"type": "image", "content": "https://cdn.lovart.ai/img2.png"},
            ]},
            {"type": "video", "artifacts": [
                {"type": "video", "content": "https://cdn.lovart.ai/vid1.mp4"},
            ]},
            {"type": "audio", "artifacts": [
                {"type": "audio", "content": "https://cdn.lovart.ai/music1.m4a"},
            ]},
        ]
    }

    r = lovart_to_apimart(lovart_result)
    check("images 是列表", isinstance(r.get("images"), list))
    check("images 有 2 个元素（每张图一个）", len(r["images"]) == 2)
    check("images[0].url 是数组", isinstance(r["images"][0]["url"], list))
    check("images[0].url 含 1 个字符串", r["images"][0]["url"] == ["https://cdn.lovart.ai/img1.png"])
    check("images[0].expires_at 是整数", isinstance(r["images"][0]["expires_at"], int))

    check("videos 是列表且 1 个元素", isinstance(r.get("videos"), list) and len(r["videos"]) == 1)
    check("videos[0].url 是数组", isinstance(r["videos"][0]["url"], list))

    check("music 是列表且 1 个元素", isinstance(r.get("music"), list) and len(r["music"]) == 1)
    check("music[0].audio_url 是字符串", r["music"][0]["audio_url"] == "https://cdn.lovart.ai/music1.m4a")

    txt = assistant_text(lovart_result)
    check("assistant_text 提取到文本", txt == "好的，这是你的设计图：")

    check("kling-2.6 -> kling_v2_6（正确版本，不误配 kling_v3）",
          resolve_prefer_models("kling-2.6", "VIDEO") == {"VIDEO": ["generate_video_kling_v2_6"]})
    check("kling-3.0 -> kling_v3（精确匹配）",
          resolve_prefer_models("kling-3.0", "VIDEO") == {"VIDEO": ["generate_video_kling_v3"]})
    check("kling -> kling_v3", resolve_prefer_models("kling", "VIDEO") == {"VIDEO": ["generate_video_kling_v3"]})
    check("gpt-image-2 -> gpt_image_2", resolve_prefer_models("gpt-image-2", "IMAGE") == {"IMAGE": ["generate_image_gpt_image_2"]})
    check("未知模型返回 None", resolve_prefer_models("totally-unknown-model", "IMAGE") is None)
    check("MUSIC 类别不强制 prefer（交给 agent）", resolve_prefer_models("anything", "MUSIC") is None)

    empty = lovart_to_apimart({"items": []})
    check("空 result 返回空 dict", empty == {})


# ═══════════════════════════════════════════════════════════
# ② webhook 重试策略契约（§十）
#    移植自 relay 第 8 段，按 gateway 的 webhook_sent/webhook_retries 适配
# ═══════════════════════════════════════════════════════════
def _webhook_test():
    # 关闭退避间隔，让快速连续重试能累计到 3 次
    _main.WEBHOOK_RETRY_INTERVAL = 0

    class _H(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            # _fire_webhook 会拼 /callback，路径形如 /cb5xx/callback
            if "cb4xx" in self.path:
                self.send_response(400)
            elif "cb5xx" in self.path:
                self.send_response(500)
            else:
                self.send_response(200)
            self.end_headers()

        def log_message(self, *a):
            pass

    srv = http.server.HTTPServer(("127.0.0.1", 0), _H)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}/cb"

    async def run():
        _TASK_META["w4"] = {
            "webhook": base + "4xx", "webhook_sent": False,
            "webhook_retries": 0, "webhook_last_attempt": 0,
        }
        await _fire_webhook("w4", {"id": "w4"})
        check("webhook 4xx 立即放弃",
              _TASK_META["w4"]["webhook_sent"] is True
              and _TASK_META["w4"]["webhook_retries"] == 0)

        _TASK_META["w5"] = {
            "webhook": base + "5xx", "webhook_sent": False,
            "webhook_retries": 0, "webhook_last_attempt": 0,
        }
        for _ in range(10):
            await _fire_webhook("w5", {"id": "w5"})
            if _TASK_META["w5"]["webhook_retries"] >= 3:
                break
        check("webhook 5xx 最多重试 3 次",
              _TASK_META["w5"]["webhook_retries"] == 3
              and _TASK_META["w5"]["webhook_sent"] is True)

        _TASK_META["w0"] = {
            "webhook": base + "ok", "webhook_sent": False,
            "webhook_retries": 0, "webhook_last_attempt": 0,
        }
        await _fire_webhook("w0", {"id": "w0"})
        check("webhook 200 标记完成", _TASK_META["w0"]["webhook_sent"] is True)

    asyncio.run(run())
    srv.shutdown()


# ═══════════════════════════════════════════════════════════
# ③ 路由行为（离线，FakeClient mock LovartClient）
# ═══════════════════════════════════════════════════════════
class FakeClient:
    """离线假客户端：记录 prompt / set_mode 调用，返回固定成功结构。"""
    last_prompt = None
    set_mode_calls = []

    def __init__(self, base, ak, sk, timeout=None):
        self.access_key = ak
        self.secret_key = sk

    async def create_project(self):
        return "proj_1"

    async def send(self, prompt, project_id, attachments=None, prefer_models=None, mode=None):
        FakeClient.last_prompt = prompt
        return "thread_1"

    async def get_status(self, thread_id):
        return {"status": "done"}

    async def get_result(self, thread_id):
        return {"items": [
            {"type": "image", "artifacts": [{"type": "image", "content": "https://u/img.png"}]},
        ]}

    async def set_mode(self, unlimited):
        FakeClient.set_mode_calls.append(unlimited)

    async def confirm(self, thread_id):
        return None

    async def query_mode(self):
        return {"unlimited": False}


def _set_auth(open_relay: bool, user_keys: dict, ak="ak_test", sk="sk_test"):
    """切换鉴权配置，并把 LovartClient 换成 FakeClient（避免真实网络）。"""
    _main.OPEN_RELAY = open_relay
    _main.USER_KEYS = user_keys
    _main.DEFAULT_AK = ak
    _main.DEFAULT_SK = sk
    _main.LovartClient = FakeClient


def _routes_test():
    # 1. 鉴权矩阵
    _set_auth(False, {})
    r = client.post("/v1/images/generations", json={"prompt": "x"})
    check("OPEN_RELAY=false 无key 无Bearer → 401", r.status_code == 401)

    _set_auth(False, {"known": "ak|sk"})
    r = client.post("/v1/images/generations", json={"prompt": "x"},
                    headers={"authorization": "Bearer unknown"})
    check("未知 user_key → 401（不 fallback 默认凭据）", r.status_code == 401)

    _set_auth(True, {})
    r = client.post("/v1/images/generations", json={"prompt": "x"})
    check("OPEN_RELAY=true 无Bearer → 放行(200)", r.status_code == 200)

    _set_auth(False, {"known": "ak|sk"})
    r = client.post("/v1/images/generations", json={"prompt": "x"},
                    headers={"authorization": "Bearer known"})
    check("已知 user_key → 映射到 AK/SK 放行(200)", r.status_code == 200)

    # 2. chat 多轮上下文
    _set_auth(True, {})
    msgs = [
        {"role": "system", "content": "你是设计师"},
        {"role": "assistant", "content": "好的"},
        {"role": "user", "content": "画只猫"},
    ]
    r = client.post("/v1/chat/completions",
                    json={"model": "gpt-image-2", "messages": msgs, "stream": False})
    check("chat 多轮含 system/assistant → 200", r.status_code == 200)
    p = FakeClient.last_prompt
    check("system 带 [system] 前缀", "[system]" in p)
    check("assistant 带 [assistant] 前缀", "[assistant]" in p)
    check("user 直拼无 [user] 前缀", p.endswith("画只猫") and "[user]" not in p)

    r = client.post("/v1/chat/completions",
                    json={"model": "gpt-image-2",
                          "messages": [{"role": "assistant", "content": "hi"}], "stream": False})
    check("chat 无 user 消息 → 400", r.status_code == 400)

    # 3. mode 语义
    FakeClient.set_mode_calls = []
    r = client.post("/v1/images/generations", json={"prompt": "x", "mode": "unlimited"})
    check("mode=unlimited → set_mode(True)", FakeClient.set_mode_calls == [True])

    FakeClient.set_mode_calls = []
    r = client.post("/v1/images/generations", json={"prompt": "x", "mode": "fast"})
    check("mode=fast → set_mode(False)", FakeClient.set_mode_calls == [False])

    FakeClient.set_mode_calls = []
    r = client.post("/v1/images/generations", json={"prompt": "x", "mode": "thinking"})
    check("mode=thinking(非法) → 不调 set_mode", FakeClient.set_mode_calls == [])

    # 4. SSE 流式
    r = client.post("/v1/chat/completions",
                    json={"model": "gpt-image-2",
                          "messages": [{"role": "user", "content": "画只猫"}], "stream": True})
    body = r.text
    check("stream=true → 含 chat.completion.chunk", "chat.completion.chunk" in body)
    check("stream=true → 含 [DONE]", "[DONE]" in body)

    r = client.post("/v1/chat/completions",
                    json={"model": "gpt-image-2",
                          "messages": [{"role": "user", "content": "画只猫"}], "stream": False})
    check("stream=false → 同步 chat.completion",
          r.status_code == 200 and r.json().get("data", {}).get("object") == "chat.completion")

    # 5. 信封 / 错误形状
    ok_body = json.loads(_main.ok([1]).body)
    check("ok() 包 {code:200,data}", ok_body == {"code": 200, "data": [1]})

    err_body = json.loads(_main.err(400, "x", "invalid_request_error", 400).body)
    check("err() 形状 {error:{code,type,message}}",
          err_body == {"error": {"code": 400, "type": "invalid_request_error", "message": "x"}})

    ae = _main.auth_error()
    check("auth_error() → 401 形状",
          ae.status_code == 401 and json.loads(ae.body)["error"]["code"] == 401)

    # 6. audio 501
    r = client.post("/v1/audio/speech")
    check("audio/speech → 501 not_supported_error",
          r.status_code == 501 and r.json()["error"]["type"] == "not_supported_error")
    r = client.post("/v1/audio/transcriptions")
    check("audio/transcriptions → 501 not_supported_error",
          r.status_code == 501 and r.json()["error"]["type"] == "not_supported_error")

    # 7. 异步提交信封形状
    _set_auth(True, {})
    r = client.post("/v1/images/generations", json={"prompt": "x"})
    j = r.json()
    check("提交返回 {code:200,data:[{status:submitted,task_id}]}",
          j.get("code") == 200 and isinstance(j.get("data"), list)
          and j["data"][0].get("status") == "submitted"
          and j["data"][0]["task_id"].startswith("task_"))


# ── 执行 ───────────────────────────────────────────────────
if __name__ == "__main__":
    print("── ① 契约自验证 ──")
    _contract_test()
    print("\n── ② webhook 重试 ──")
    _webhook_test()
    print("\n── ③ 路由行为 ──")
    _routes_test()

    print("\n结果:", "全部通过 ✅" if check.failed == 0 else f"{check.failed} 项失败 ❌")
    sys.exit(1 if check.failed else 0)
