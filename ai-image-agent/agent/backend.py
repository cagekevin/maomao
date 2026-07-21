# ============================================================================
# Agent 后端（独立模块，解耦自 smart-canvas.js 的 Agent 逻辑）
#
# 目标对齐（见 docs/PRD-AGENT-DECOUPLING.md）：
#   T1 独立文件（不寄生 main.py，自带 app / include_router 挂载）
#   T2 完整后端（v1.0–v1.6 逻辑搬运）
#   T3 不回写画布（生图结果只存会话，绝不碰画布节点）
#   T4 会话落盘（data/agent/）
#   T6 不重构（原逻辑逐字搬运，不改写）
#
# 本文件仅包含 Agent 相关后端能力。底层生图/LLM 由 agent.client 实现，
# provider 由 agent.config 读取，不依赖 main.py。
# ============================================================================

import os
import re
import json
import uuid
import time
import asyncio
import threading
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Request, Header, WebSocket, WebSocketDisconnect
from fastapi import APIRouter, HTTPException, Request, Header, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

# ---- 解耦：仅依赖 agent 自有模块（不 import main）----
from . import config
from . import client


# ============================================================================
# 本地轻量数据模型（替代 main 的 OnlineImageRequest / AIReference / CanvasLLMRequest）
# 字段保持对齐，便于业务逻辑逐字搬运（T6）。
# ============================================================================
class AIReference:
    def __init__(self, url="", name="ref"):
        self.url = url
        self.name = name

    def to_dict(self):
        return {"url": self.url, "name": self.name}


class OnlineImageRequest:
    def __init__(self, prompt="", provider_id="", model="", size="1024x1024",
                 quality="auto", n=1, reference_images=None):
        self.prompt = prompt
        self.provider_id = provider_id
        self.model = model
        self.size = size
        self.quality = quality
        self.n = n
        self.reference_images = reference_images or []


class CanvasLLMRequest:
    def __init__(self, message="", messages=None, images=None, videos=None,
                 model="", provider="", ms_model="", system_prompt=""):
        self.message = message
        self.messages = messages or []
        self.images = images or []
        self.videos = videos or []
        self.model = model
        self.provider = provider
        self.ms_model = ms_model
        self.system_prompt = system_prompt


# ============================================================================
# 自带 AgentWSManager（替代 main 的 ConnectionManager 的 agent 广播方法）
# ============================================================================
class AgentWSManager:
    def __init__(self):
        self.active_connections = []
        self._lock = threading.Lock()

    async def connect(self, websocket, client_id=None):
        await websocket.accept()
        with self._lock:
            self.active_connections.append(websocket)

    def disconnect(self, websocket, client_id=None):
        with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def _send(self, websocket, payload):
        try:
            await websocket.send_text(json.dumps(payload, ensure_ascii=False))
        except Exception:
            pass

    async def broadcast_agent_llm_done(self, conversation_id, status):
        payload = {"type": "agent_llm_done", "conversation_id": conversation_id, "status": status}
        for ws in list(self.active_connections):
            await self._send(ws, payload)

    async def broadcast_agent_gen_done(self, conversation_id, data):
        payload = {"type": "agent_gen_done", "conversation_id": conversation_id, "data": data}
        for ws in list(self.active_connections):
            await self._send(ws, payload)


ws_manager = AgentWSManager()


# ============================================================================
# 自带 LLM 任务管理（保留 5 分钟超时语义）
# ============================================================================
AGENT_LLM_TASKS = {}
AGENT_LLM_TASK_LOCK = threading.Lock()
AGENT_LLM_TASK_TIMEOUT = 5 * 60


def get_agent_llm_task(task_id):
    with AGENT_LLM_TASK_LOCK:
        return AGENT_LLM_TASKS.get(task_id)


async def run_agent_llm_task(task_id, coro):
    async def _run():
        try:
            result = await asyncio.wait_for(coro, timeout=AGENT_LLM_TASK_TIMEOUT)
            with AGENT_LLM_TASK_LOCK:
                AGENT_LLM_TASKS[task_id] = {"status": "done", "result": result}
        except Exception as e:
            with AGENT_LLM_TASK_LOCK:
                AGENT_LLM_TASKS[task_id] = {"status": "error", "error": str(e)}
    asyncio.create_task(_run())
    return task_id


# ============================================================================
# 配置与存储根目录（解耦：落 agent/data/，不读 main 的 DATA_DIR）
# ============================================================================
AGENT_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(AGENT_DATA_DIR, exist_ok=True)


def now_ms():
    return int(time.time() * 1000)


def safe_user_id(x_user_id, request=None):
    uid = (x_user_id or "").strip()
    if uid:
        return re.sub(r"[^a-zA-Z0-9_-]", "", uid) or "default"
    return "default"


Lock = threading.Lock


# ============================================================================
# 模块 1：Agent 后端·会话与存储
# ============================================================================

AGENT_CONVERSATION_DIR = os.path.join(AGENT_DATA_DIR, "agent")
AGENT_CONV_LOCK = Lock()
os.makedirs(AGENT_CONVERSATION_DIR, exist_ok=True)

class AgentConversationRequest(BaseModel):
    title: str = "新对话"

def agent_user_dir(user_id):
    path = os.path.join(AGENT_CONVERSATION_DIR, user_id)
    os.makedirs(path, exist_ok=True)
    return path

def agent_conversation_path(user_id, conversation_id):
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "", conversation_id or "")
    if not cleaned:
        raise HTTPException(status_code=400, detail="无效的 Agent 对话 ID")
    return os.path.join(agent_user_dir(user_id), f"{cleaned}.json")

# 新会话默认结构（字段对齐原前端 agentState，搬运不重命名，C1-3）
def new_agent_conversation(user_id, title="新对话"):
    timestamp = now_ms()
    conversation = {
        "id": uuid.uuid4().hex,
        "title": (title or "新对话")[:80],
        "created_at": timestamp,
        "updated_at": timestamp,
        "messages": [],
        "attachments": [],
        "genProvider": "",
        "genModel": "",
        "genRatio": "square",
        "genResolution": "1k",
        "genCount": 1,
        "genQuality": "",
        "thinkingMode": False,
        "skills": [],
        "chatProvider": "",
        "chatModel": "",
    }
    save_agent_conversation(user_id, conversation)
    return conversation

def save_agent_conversation(user_id, conversation):
    with AGENT_CONV_LOCK:
        path = agent_conversation_path(user_id, conversation["id"])
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(conversation, f, ensure_ascii=False, indent=2)

def load_agent_conversation(user_id, conversation_id):
    path = agent_conversation_path(user_id, conversation_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Agent 对话不存在")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def list_agent_conversations(user_id):
    records = []
    for filename in os.listdir(agent_user_dir(user_id)):
        if not filename.endswith(".json"):
            continue
        path = os.path.join(agent_user_dir(user_id), filename)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            continue
        records.append({
            "id": data.get("id"),
            "title": data.get("title", "新对话"),
            "created_at": data.get("created_at", 0),
            "updated_at": data.get("updated_at", 0),
            "message_count": len(data.get("messages", [])),
        })
    records.sort(key=lambda r: r.get("updated_at", 0), reverse=True)
    return records

# ---------------------------------------------------------------------------
# Agent Router（模块 1 路由；模块 2/3 的路由后续追加到同一 router）
# ---------------------------------------------------------------------------
agent_router = APIRouter()

@agent_router.get("/api/agent/conversations")
async def agent_conversations(request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    return {"user_id": user_id, "conversations": list_agent_conversations(user_id)}

@agent_router.post("/api/agent/conversations")
async def create_agent_conversation(payload: AgentConversationRequest, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = new_agent_conversation(user_id, payload.title)
    return {"conversation": conv}

@agent_router.get("/api/agent/conversations/{conversation_id}")
async def get_agent_conversation(conversation_id: str, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    return {"conversation": load_agent_conversation(user_id, conversation_id)}

@agent_router.delete("/api/agent/conversations/{conversation_id}")
async def delete_agent_conversation(conversation_id: str, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    path = agent_conversation_path(user_id, conversation_id)
    if os.path.exists(path):
        os.remove(path)
    return {"ok": True}

# ============================================================================
# 模块 2：Agent 后端·编排引擎（搬运自 smart-canvas.js 约 16797–19760）
# 纪律：T6 只搬运不改写；X2 图片解析改从会话取数；T3 不回写画布。
# 分多批写入：2a 常量+纯算法 → 2b 改写辅助 → 2c 主流程与状态机
# ============================================================================

# ---- 2a 常量 + [原样] 纯算法函数 ----
AGENT_STORAGE_PREFIX = 'smart_agent_v1:'
AGENT_SKILL_MAX_BYTES = 512 * 1024
AGENT_HISTORY_MAX = 20
AGENT_LLM_IMAGE_MAX = 8
AGENT_GEN_MAX_PER_MSG = 8
AGENT_MSG_MAX = 60
AGENT_NL = "\n"

AGENT_FORMAT_INSTRUCTION = ("You are an AI image-generation agent. Reply with raw JSON only (no markdown, no extra text):\n"
'{"reply":"回复用户的话","options":[],"prompts":[],"generations":[{"prompt":"详细中文提示词","count":1,"use_last_outputs":false,"use_attachments":false}]}\n\n'
"Fields: \"reply\"=对话回复; \"options\"=[{label,value}]按钮; \"prompts\"=待确认的中文提示词; \"generations\"=立即生成的图片(最多8项). \"use_last_outputs\":引用/修改上一轮图片时true; \"use_attachments\":引用/修改用户上传图时true.\n\n"
"核心原则：能生成就生成，不要问。\n"
"- 用户有明确主体+任何细节 → 扩写prompt并立即生成(generations)\n"
"- 用户刚选了选项或回答了问题 → 立即生成，不要再确认\n"
"- 请求模糊有多个方向 → 给2-4个选项(options)，用户选后立即生成\n"
"- 关键信息缺失无法给选项 → 问1-3个短问题(reply)\n"
"- 用户要多张不同图 → generations放多项\n"
"- 所有prompt必须中文，包含主体/风格/构图/光线/色彩/细节/氛围\n"
"- 用户上传角色参考图 → 后续生成保持角色一致性\n"
"- 有skill文档时遵循其风格规则\n"
"- 不要只问\"确认要生成吗\"而不给完整prompt\n\n"
"修改场景规则：\nA. 风格/属性修改（use_last_outputs必须为true）：只描述要修改的内容+保持原图其他部分不变。\n"
"B. 主体更换（use_last_outputs必须为true）：明确指示替换主体+保留场景，格式\"将原图中的[原主体]替换为[新主体]，保持原有的场景、背景、构图、光影、色彩和氛围完全不变，仅改变主体本身\"。\n"
"通用规则：1.绝对不要添加用户没要求的内容；2.新主体不同于原主体→主体更换(B)，否则风格修改(A)；3.无论A/B都用use_last_outputs:true引用原图。")

def normalize_prompts(prompts):
    if not isinstance(prompts, list):
        return []
    out = []
    for p in prompts:
        if isinstance(p, str):
            t = p.strip()
            if t:
                out.append({"prompt": t, "count": 1, "use_last_outputs": False, "use_attachments": False, "status": "pending"})
            continue
        if isinstance(p, dict) and isinstance(p.get("prompt"), str) and p["prompt"].strip():
            normalized = {"prompt": p["prompt"].strip(), "count": max(1, min(8, int(p.get("count") or 1) or 1)),
                          "use_last_outputs": bool(p.get("use_last_outputs")), "use_attachments": bool(p.get("use_attachments")), "status": p.get("status") or "pending"}
            if isinstance(p.get("attachment_indices"), list):
                normalized["attachment_indices"] = [int(i) for i in p["attachment_indices"] if isinstance(i, (int, float)) and i >= 0]
            out.append(normalized)
    return out

def ensure_current_prompt(msg):
    if not msg or msg.get("role") != "assistant" or not isinstance(msg.get("prompts"), list) or not msg["prompts"]:
        return
    if not any(p.get("status") in ("current", "editing") for p in msg["prompts"]):
        fp = next((i for i, p in enumerate(msg["prompts"]) if not p.get("status") or p.get("status") == "pending"), -1)
        if fp >= 0:
            msg["prompts"][fp]["status"] = "current"
            msg["promptIdx"] = fp

def chat_requested_image_count(text):
    t = str(text or "")
    m = re.search(r"(?<!\d)([1-8])\s*(?:张|幅|个|组|套|条|只|名|版|款)(?!\d)", t)
    if m:
        return int(m.group(1))
    cn_map = {"一": 1, "二": 2, "两": 2, "俩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8}
    for k, v in cn_map.items():
        if (k + "张") in t or (k + "幅") in t or (k + "个") in t or (k + "条") in t:
            return v
    return 0

def resolve_final_gen_count(text, gen_count=1):
    fi = chat_requested_image_count(text)
    if fi > 1:
        return {"count": min(8, fi), "source": "input"}
    return {"count": max(1, min(8, int(gen_count) or 1)), "source": "toolbar"}

def is_vague_image_request(text):
    t = str(text or "").strip()
    if not t:
        return False
    if re.search(r"改成|换成|转换成|修改为|变成|转为|改为|转成|调整|重新画|重画", t, re.I):
        return False
    kw = ['风','风格','主义','流派','艺术','画法','画风','渲染','摄影','插画','海报','logo','标志','图标','3d','3D','写实','动漫','水墨','油画','水彩','素描','速写','像素','赛博','蒸汽波','极简','极繁','扁平','卡通','可爱','复古','霓虹','lowpoly','波普','印象派','抽象','超现实','涂鸦','手绘','国风','中国风','日式','和风','美式','欧式','赛博朋克','蒸汽朋克','未来主义','装饰艺术','artdeco','bauhaus','印象','点彩','浮世绘','赛璐珞','吉卜力','新海诚','皮克斯','迪士尼','漫威','dc','chibi','q版']
    has = any(k in t.lower() for k in kw)
    return len(t) < 25 and not has

def parse_image_ref_tasks(text, attach_count):
    if not text or not attach_count or attach_count == 0:
        return None
    cn = {'一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10'}
    t = re.sub(r"图\s*([一二三四五六七八九十])", lambda m: "图" + cn.get(m.group(1), m.group(1)), text)
    urefs = set()
    cranges = []
    def add(num):
        if 1 <= num <= attach_count:
            urefs.add(num)
    rre = re.compile(r"图\s*(\d+)\s*[到至\-~]\s*图?\s*(\d+)")
    m = rre.search(t)
    while m:
        for i in range(min(int(m.group(1)),int(m.group(2))), max(int(m.group(1)),int(m.group(2)))+1):
            add(i)
        cranges.append((m.start(), m.end())); m = rre.search(t, m.end())
    lre = re.compile(r"图\s*(\d+)((?:\s*[、,，和与]\s*\d+)*)")
    m = lre.search(t)
    while m:
        ms, me = m.start(), m.end()
        if any(s <= ms and me <= e for s, e in cranges):
            m = lre.search(t, m.end()); continue
        add(int(m.group(1)))
        if m.group(2):
            for n in re.findall(r"\d+", m.group(2)):
                add(int(n))
        m = lre.search(t, m.end())
    fm = re.search(r"前(?:面)?\s*(\d+)\s*张", t)
    if fm:
        for i in range(1, min(int(fm.group(1)), attach_count)+1):
            add(i)
    if not urefs:
        return None
    allr = sorted(urefs)
    base = set()
    for bre in (r"图\s*(\d+)\s*(?:中|里)\s*(?:的)?(?:左|右|上|下|中间|旁边)", r"保持\s*图\s*(\d+)\s*的", r"图\s*(\d+)\s*的(?:背景|构图|版式|布局|场景|底色)"):
        bm = re.search(bre, t)
        while bm:
            num = int(bm.group(1))
            if 1 <= num <= attach_count: base.add(num)
            bm = re.search(bre, t, bm.end())
    combine = bool(re.search(r"合成一张|合并|拼在一起|组合成|拼接|融合", t))
    split_kw = bool(re.search(r"各出一张|各出|分别|各一张|每张|逐一|逐个|全部重新", t))
    if base:
        return {"mode":"single","tasks":[{"prompt":text,"attachment_indices":[r-1 for r in allr]}]}
    if combine:
        return {"mode":"single","tasks":[{"prompt":text,"attachment_indices":[r-1 for r in allr]}]}
    if len(allr) <= 1:
        return {"mode":"single","tasks":[{"prompt":text,"attachment_indices":[r-1 for r in allr]}]}
    rrefs = set()
    m = rre.search(t)
    while m:
        for i in range(min(int(m.group(1)),int(m.group(2))), max(int(m.group(1)),int(m.group(2)))+1):
            if 1 <= i <= attach_count: rrefs.add(i)
        m = rre.search(t, m.end())
    indep = [r for r in allr if r in rrefs]
    common = [r for r in allr if r not in rrefs]
    if (split_kw or len(rrefs) > 1) and len(indep) > 1:
        ca = [r-1 for r in common]
        return {"mode":"split","tasks":[{"prompt":text,"attachment_indices":[r-1]+ca} for r in indep]}
    return {"mode":"single","tasks":[{"prompt":text,"attachment_indices":[r-1 for r in allr]}]}

def extract_json_blocks(text):
    blocks = []; i = 0
    while i < len(text):
        if text[i] == '{':
            depth = 0; ins = False; esc = False; end = -1
            for j in range(i, len(text)):
                ch = text[j]
                if esc: esc = False; continue
                if ch == '\\': esc = True; continue
                if ch == '"': ins = not ins; continue
                if ins: continue
                if ch == '{': depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0: end = j; break
            if end > i:
                blocks.append(text[i:end+1]); i = end+1
            else: i += 1
        else: i += 1
    return blocks

def repair_json_string(s):
    if not s or not isinstance(s, str):
        return s
    s = re.sub(r"/\*[\s\S]*?\*/", "", s)
    s = re.sub(r"(^|[^:\\])\/\/.*$", r"\1", s, flags=re.M)
    s = s.replace("\u201c",'"').replace("\u201d",'"').replace("\u201e",'"').replace("\u201f",'"')
    s = s.replace("\u2018","'").replace("\u2019","'").replace("\u201a","'").replace("\u201b","'")
    s = re.sub(r":\s*'([^']*)'", r': "\1"', s)
    s = re.sub(r"([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:", r'\1"\2":', s)
    s = re.sub(r",(\s*[}\]])", r"\1", s)
    s = re.sub(r'"((?:[^"\\]|\\.)*)"', lambda m: '"' + m.group(1).replace("\n","\\n").replace("\r","\\r").replace("\t","\\t") + '"', s)
    return s

def extract_numbered_options(text):
    lines = [l.strip() for l in str(text or "").split("\n")]
    nre = re.compile(r"^(\d+)[.、)]\s*(.+)$")
    items = []; hdr = []; inl = False; i = 0
    while i < len(lines):
        line = lines[i]
        if not line: i += 1; continue
        m = nre.match(line)
        if m:
            inl = True; title = m.group(2).strip(); desc = ""
            if i+1 < len(lines) and lines[i+1] and not nre.match(lines[i+1]):
                desc = lines[i+1].strip(); i += 1
            items.append({"label": title, "value": desc or title})
        elif not inl:
            hdr.append(line)
        i += 1
    if len(items) >= 2:
        return {"reply": "\n".join(hdr).strip(), "options": items[:4]}
    return None

def extract_clarify_options(text, last_user_text):
    bre = re.compile(r"([^\s,，、（）()：:?？！!]{2,6})[（(]([^）)]{2,60})[）)]")
    items = []
    for m in bre.finditer(text):
        cat = re.sub(r"^[或以及和的]+", "", m.group(1)).strip()
        if not cat or len(cat) > 6: continue
        for opt in [o.strip() for o in re.split(r"[、,，/]", m.group(2)) if o.strip() and o.strip() != "等" and len(o.strip()) <= 10]:
            co = re.sub(r"等$","",opt).strip()
            if co:
                ctx = (last_user_text + "，" + cat + "：" + co) if last_user_text else (cat + "：" + co)
                items.append({"label": co, "value": ctx})
    return items[:8] if len(items) >= 2 else None

def extract_gen_prompt(text):
    for line in [l.strip() for l in str(text or "").split("\n") if l.strip()]:
        if len(line) < 20: continue
        if re.search(r"[？?]$", line) and len(line) < 40: continue
        cn = len(re.findall(r"[\u4e00-\u9fff]", line)); en = len(re.findall(r"[a-zA-Z]", line))
        if (cn+en)/len(line) < 0.5: continue
        if re.search(r"^(好的|没问题|当然|好的[,，])", line, re.I) and len(line) < 50: continue
        return line
    return None

# ---- 2b [改写] 依赖画布状态的辅助（改从会话 conv 取数，X2）----
def agent_last_results(conv):
    """取最近一条含生成结果的消息的图片结果列表（对齐 agentLastResults）。"""
    msgs = (conv or {}).get("messages", []) or []
    for i in range(len(msgs) - 1, -1, -1):
        results = []
        for g in (msgs[i].get("generations") or []):
            for r in (g.get("results") or []):
                if r and r.get("url"):
                    results.append(r)
        if results:
            return results
    return []

def agent_last_user_attachments(conv):
    """取最近一条用户消息的图片附件（对齐 agentLastUserAttachments）。"""
    msgs = (conv or {}).get("messages", []) or []
    for i in range(len(msgs) - 1, -1, -1):
        if msgs[i].get("role") == "user":
            imgs = [img for img in (msgs[i].get("images") or []) if img and img.get("url")]
            if imgs:
                return imgs
    return []

def agent_current_image_map(conv):
    """统一编号映射：上一轮生成图(图1~M) + 当前附件(图M+1~M+N)（对齐 agentCurrentImageMap）。"""
    gen_results = agent_last_results(conv)
    attachments = [a for a in ((conv or {}).get("attachments") or []) if a and a.get("url")]
    img_map = []
    for i, r in enumerate(gen_results):
        img_map.append({"num": i + 1, "url": r.get("url"), "name": r.get("name") or f"图{i + 1}", "source": "gen"})
    offset = len(gen_results)
    for i, a in enumerate(attachments):
        img_map.append({"num": offset + i + 1, "url": a.get("url"), "name": a.get("name") or f"图{offset + i + 1}", "source": "att"})
    return img_map

def agent_gen_providers():
    """可用的生图 provider 列表（对齐 agentGenProviders）。"""
    return [p for p in config.image_providers() if p.get("enabled", True) is not False and (p.get("image_models") or [])]

def provider_image_models(provider_id):
    """取指定 provider 的 image_models（解耦：config.provider_image_models）。"""
    if not provider_id:
        return []
    return config.provider_image_models(provider_id)

# 生图尺寸映射表（搬运自前端 SIZE_MAP）
_AGENT_SIZE_MAP = {
    "square": {'1k': '1024x1024', '2k': '2048x2048', '4k': '4096x4096'},
    "portrait": {'1k': '1024x1536', '2k': '1360x2048', '4k': '2352x3520'},
    "portrait43": {'1k': '1008x1344', '2k': '1536x2048', '4k': '2448x3264'},
    "landscape43": {'1k': '1344x1008', '2k': '2048x1536', '4k': '3264x2448'},
    "landscape": {'1k': '1536x1024', '2k': '2048x1360', '4k': '3520x2352'},
    "story": {'1k': '720x1280', '2k': '1152x2048', '4k': '2160x3840'},
    "wide": {'1k': '1280x720', '2k': '2048x1152', '4k': '3840x2160'},
    "ultrawide": {'1k': '1280x544', '2k': '2048x880', '4k': '3840x1648'},
    "ultratall": {'1k': '544x1280', '2k': '880x2048', '4k': '1648x3840'},
}
_AGENT_RES_LONG_SIDE = {'1k': 1536, '2k': 2048, '4k': 3840}
_AGENT_RES_PIXEL_LIMIT = {'1k': 1572864, '2k': 4194304, '4k': 8294400}

def _agent_parse_ratio_value(value):
    raw = str(value or "").strip()
    parts = raw.split(":") if ":" in raw else re.split(r"[xX*]", raw)
    if len(parts) != 2:
        return 0
    w = float(parts[0]); h = float(parts[1])
    return w / h if (w > 0 and h > 0) else 0

def api_image_size(ratio_value, resolution_value, custom_ratio_value="", custom_size_value=""):
    """生图尺寸纯计算（WxH 字符串），不依赖画布节点几何（对齐 apiImageSize）。"""
    if resolution_value == "auto":
        return "auto"
    if resolution_value == "custom":
        return str(custom_size_value or "").strip()
    resolution_key = resolution_value or "1k"
    if ratio_value in ("custom", "source"):
        parsed = _agent_parse_ratio_value(custom_ratio_value)
        long_side = _AGENT_RES_LONG_SIDE.get(resolution_key, 1024)
        if parsed:
            pixel_limit = _AGENT_RES_PIXEL_LIMIT.get(resolution_key, long_side * long_side)
            raw_width = parsed if parsed >= 1 else min(long_side * parsed, (pixel_limit * parsed) ** 0.5)
            raw_height = (long_side / parsed) if parsed >= 1 else min(long_side / parsed, (pixel_limit / parsed) ** 0.5)
            width = int(raw_width // 16) * 16
            height = int(raw_height // 16) * 16
            return f"{max(64, width)}x{max(64, height)}"
    ratio_key = ratio_value if (ratio_value and ratio_value in _AGENT_SIZE_MAP) else "square"
    return _AGENT_SIZE_MAP.get(ratio_key, {}).get(resolution_key) or _AGENT_SIZE_MAP["square"].get(resolution_key) or _AGENT_SIZE_MAP["square"]["1k"]

def agent_history_messages(conv):
    """取最近 AGENT_HISTORY_MAX 条对话历史（对齐 agentHistoryMessages）。"""
    msgs = (conv or {}).get("messages", []) or []
    out = []
    for m in msgs[-AGENT_HISTORY_MAX:]:
        if m.get("role") == "user":
            out.append({"role": "user", "content": m.get("text") or "(images only)"})
        else:
            content = m.get("text") or ""
            for g in (m.get("generations") or []):
                n = len(g.get("results") or [])
                if n:
                    content += f"{AGENT_NL}[generated {n} image(s) with prompt: {g.get('prompt') or ''}]"
            out.append({"role": "assistant", "content": content or "(no text)"})
    return out

def agent_system_prompt(conv, bypass_thinking=False, final_count=1):
    """构建 Agent 系统提示词（对齐 agentSystemPrompt，字段从 conv 取）。"""
    parts = []
    skills = (conv or {}).get("skills") or []
    has_skills = len(skills) > 0
    # 1. skill 最强指令（首因效应）+ 中英双语
    if has_skills:
        parts.append("""【最重要规则 - skill 完整保留 / MOST IMPORTANT: Keep skill document intact】
Skill 文档描述的是"单张图的样式"，包括：画面风格、背景、构图布局、画面内元素排列（如"横3竖4排列12个方案""九宫格"）、配色、文字排版、图形风格、质量要求等所有细节。
Skill 不决定生成几张图——出图数量由系统决定（综合工具栏和输入框），系统会告诉你需要几张。你无需从 skill 或用户消息中推断数量。
即使 skill 中出现"一整页""合集""系列探索板"等词，那也是描述单张图的样式，不代表只生成1张图。
你生成的每一条 prompt 都必须完整、逐字保留 skill 文档中的所有样式描述。
你只能在"主题/主体/变体方向"上做差异化，绝不能简化、改写、概括或丢失 skill 中的任何描述。
正确做法：把 skill 文档的完整描述作为每条 prompt 的主体，然后在末尾或开头添加变体差异。
错误做法：把"合集/一整页"理解为只出1张；简化 skill 内容；只写简短 prompt。
每条 prompt 长度应与 skill 文档相当。
When a skill document is provided, every prompt you generate MUST fully and verbatim retain all style descriptions from the skill document. The skill describes the style of a SINGLE image (including internal element layout like "3x4 grid"). It does NOT decide how many images to generate — that is decided by the system. Even words like "collection/series/full page" in the skill describe single-image style, not output count.""")
    # 2. skill 内容（清晰分隔符标记边界）
    for skill in skills:
        text = str((skill or {}).get("content") or "").strip()
        if text:
            name = (skill or {}).get("name") or "skill"
            parts.append(f"===== Skill 文档开始：{name} ====={AGENT_NL}{AGENT_NL}{text}{AGENT_NL}{AGENT_NL}===== Skill 文档结束：{name} =====")
    # 思维模式 / 非思维模式使用不同基础指令
    thinking_mode_on = bool((conv or {}).get("thinkingMode")) and not bypass_thinking
    if thinking_mode_on:
        parts.append("""You are an AI image-generation agent in Thinking Mode (progressive dimension collection mode).
Reply with raw JSON only (no markdown, no extra text):
{"reply":"回复用户的话","options":[{"label":"选项名","value":"选项值"}],"collected":{},"next_dimension":"","remaining_dimensions":[],"prompts":[],"generations":[]}

Fields: "reply"=对话回复; "options"=[{label,value}]按钮选项; "collected"=已确认的维度字典; "next_dimension"=下一轮维度; "remaining_dimensions"=剩余维度数组; "prompts"=待确认的中文提示词（仅最终轮返回）; "generations"=立即生成的图片（思维模式下始终为空）.

所有prompt必须中文，包含主体/风格/构图/光线/色彩/细节/氛围
文字规则：默认情况下prompt不要包含文字内容（标题、对白、台词、旁白、字幕），只描述画面视觉元素""")
    else:
        parts.append(AGENT_FORMAT_INSTRUCTION)
    # 注入最终出图数量
    final_count_val = max(1, min(8, int(final_count) or int((conv or {}).get("genCount") or 1) or 1))
    if final_count_val > 1:
        parts.append(f"【出图数量 / Output Count】系统要求生成 {final_count_val} 张图。每张是独立的图片，在主题/品牌方向/变体方向上必须有明显差异（不能只是换个颜色或微调）。数量已由系统决定（综合工具栏设置和输入框显式要求），你无需自行判断，只需返回恰好 {final_count_val} 条。")
    if thinking_mode_on:
        parts.append("""当前为思维模式（渐进式多维采集模式）。核心原则：通过多轮提问逐步收集用户需求，所有维度确认后生成详细提示词。

【流程规则 / Process Rules】

总体流程：逐轮提问维度 → 用户选择 → 下一轮提问下一个维度 → ... → 所有维度确认 → 生成最终提示词

★★★ 最高优先级规则 ★★★
当返回 options 时（即 options 数组非空），prompts 和 generations 必须为空数组 []。
绝对不允许在同一轮中同时返回 options 和 prompts。
如果 options 非空，prompts 必须为 []，generations 必须为 []。
违反此规则会导致流程被跳过，用户体验严重受损。

轮次判断规则：
- 如果还有 ≥2 个维度未确认 → 返回 options（2-4个选项），prompts=[]
- 如果只剩 1 个维度未确认 → 返回 options（2-4个选项），prompts=[]
- 如果所有维度已确认 → prompts 返回最终提示词，options=[]
- 每一轮只提问一个维度，不要一次性问多个
- 除非用户明确说"直接生成"或"不用选了"，否则必须逐轮提问

维度优先级（按重要性排序）：
1. 风格 (画风/艺术流派) - 如水墨风、油画风、赛博朋克、Q版卡通
2. 场景/背景 - 如留白山水、竹林、雪景、庭院、城市街道
3. 构图 - 如正面站姿、仰视特写、奔跑动态、侧卧休息、三分法
4. 配色 - 如暖色调、冷色调、低饱和度、高对比度
5. 细节特征 - 如毛发质感、光影效果、材质表现、装饰元素
6. 其他补充 - 如文字要求、品牌元素、特殊效果

【参考图分析规则】

当用户上传了参考图时，第一轮或第二轮必须先分析参考图并提问：
- 返回 reply 说明参考图的共同特征（风格、配色、构图、光影等）
- 选项必须包含用户对参考图特征的选择（全部保留/部分保留/不保留）
- 示例：{"reply":"我看到了7张参考图，它们有共同的特征：低饱和度配色、极简构图、柔和光影。你希望产品图保留哪些特征？","options":[{"label":"全部保留","value":"保留参考图的所有视觉特征：低饱和度配色、极简构图、柔和光影"},{"label":"只保留配色","value":"只保留参考图的低饱和度配色"},{"label":"只保留构图","value":"只保留参考图的极简构图"},{"label":"自定义输入","value":"CUSTOM_INPUT"}],"collected":{"参考图特征":"已分析"}}

【选项规则】

- 每轮返回 2-4 个选项（推荐数量为3）
- 每个选项必须是简洁明确的值，不是长句子
- 每轮 options 末尾必须追加一个 {"label":"自定义输入","value":"CUSTOM_INPUT"} 选项
- 选项示例：[水墨风, 油画风, 赛博朋克, 自定义输入]

【返回字段】

每轮必须返回以下字段：
{
  "reply": "简短的问题描述（如'请选择风格方向：'）",
  "options": [{"label":"选项1","value":"选项1值"}, {"label":"选项2","value":"选项2值"}, {"label":"自定义输入","value":"CUSTOM_INPUT"}],
  "collected": {"维度1":"已确认值1", "维度2":"已确认值2", ...},
  "next_dimension": "场景",
  "remaining_dimensions": ["场景", "构图", "配色"],
  "prompts": [],
  "generations": []
}

【最终轮规则】

当所有维度确认后（remaining_dimensions 为空或用户明确要求）：
- 返回 prompts 数组，每条是完整可直接生图的中文提示词
- 提示词要综合所有 collected 维度的信息
- 系统要求生成N张图时（见上方"出图数量"），prompts 数组返回恰好N条
- 每条 prompt 目标长度：200-500 字，尽可能详细丰富
- 每条必须包含：主体、风格、场景、构图、光线、色彩、细节、氛围

【参考图选择规则 / attachment_indices】

当用户上传了多张参考图，且需要生成多张图（每张参考不同的参考图风格/版式）时：
- 每条 prompt 可以指定 attachment_indices 字段（0-based 整数数组），精确控制该条 prompt 只使用哪些参考图
- 不指定 attachment_indices 时，默认使用全部参考图
- 示例：用户上传了8张图（7张版式参考+1张产品图，索引0-7），要求按7种版式各出1张产品图：
  {"prompts":[
    {"prompt":"产品图，版式A的描述...", "count":1, "use_attachments":true, "attachment_indices":[0, 7]},
    {"prompt":"产品图，版式B的描述...", "count":1, "use_attachments":true, "attachment_indices":[1, 7]},
    {"prompt":"产品图，版式C的描述...", "count":1, "use_attachments":true, "attachment_indices":[2, 7]},
    ...
  ]}
- 这样每条 prompt 只带2张参考图（1张版式+1张产品），避免生图模型混淆多张参考图
- 如果参考图是整体风格参考（不需要区分），则不需要指定 attachment_indices

【修改请求规则】

当用户说"换成...""改成..."等修改指令时：
- 返回 prompts，use_last_outputs 设为 true
- prompt 应简洁聚焦，只描述要修改的内容+保持原图其他部分不变

""" + ("""【Skill 规则】
当有 Skill 文档时，最终提示词必须完整包含 Skill 的所有描述，只在主题/变体上做差异化。Skill 描述单张图样式，不决定出图数量。""" if has_skills else ""))
    else:
        parts.append("当前为直接模式。能生成就生成，返回 generations 数组。")
    # 3. 末尾再强调 skill（近因效应）
    if has_skills:
        parts.append("【最后提醒 / FINAL REMINDER】你生成的每条 prompt 必须完整包含上方 Skill 文档的所有描述内容，不得简化、概括或遗漏。Skill 描述的是单张图样式（含画面内排列），不决定出图数量——出图数量按系统给定的执行。如果 prompt 长度明显短于 Skill 文档，说明你遗漏了内容，请重新生成。")
    return AGENT_NL + AGENT_NL.join(parts)

# ---- 2c [原样] 解析 + 主流程 + 状态机 ----
def extract_fields_with_regex(text):
    """正则兜底提取 JSON 字段（对齐 extractFieldsWithRegex）。"""
    result = {"reply": "", "options": [], "prompts": [], "generations": [], "collected": {}, "next_dimension": "", "remaining_dimensions": []}
    reply_match = re.search(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
    if reply_match:
        try:
            result["reply"] = json.loads('"' + reply_match.group(1) + '"')
        except Exception:
            result["reply"] = reply_match.group(1)
    options_match = re.search(r'"options"\s*:\s*\[([\s\S]*?)\]', text)
    if options_match:
        opt_re = re.compile(r'"label"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"value"\s*:\s*"((?:[^"\\]|\\.)*)"')
        for m in opt_re.finditer(options_match.group(1)):
            try:
                result["options"].append({"label": json.loads('"' + m.group(1) + '"'), "value": json.loads('"' + m.group(2) + '"')})
            except Exception:
                result["options"].append({"label": m.group(1), "value": m.group(2)})
    prompts_match = re.search(r'"prompts"\s*:\s*\[([\s\S]*?)\]', text)
    if prompts_match:
        prompt_re = re.compile(r'"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"')
        for m in prompt_re.finditer(prompts_match.group(1)):
            try:
                p = json.loads('"' + m.group(1) + '"')
            except Exception:
                p = m.group(1)
            result["prompts"].append({"prompt": p, "count": 1, "use_last_outputs": False, "use_attachments": False, "status": "pending"})
    gens_match = re.search(r'"generations"\s*:\s*\[([\s\S]*?)\]', text)
    if gens_match:
        gen_re = re.compile(r'"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"')
        for m in gen_re.finditer(gens_match.group(1)):
            try:
                p = json.loads('"' + m.group(1) + '"')
            except Exception:
                p = m.group(1)
            result["generations"].append({"prompt": p, "count": 1, "use_last_outputs": False, "use_attachments": False, "results": [], "status": "running"})
    nd_match = re.search(r'"next_dimension"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
    if nd_match:
        result["next_dimension"] = nd_match.group(1)
    rd_match = re.search(r'"remaining_dimensions"\s*:\s*\[([\s\S]*?)\]', text)
    if rd_match:
        items = re.findall(r'"([^"]+)"', rd_match.group(1))
        if items:
            result["remaining_dimensions"] = items
    return result

def parse_agent_response(raw, last_user_text):
    """解析 LLM 返回（对齐 parseAgentResponse）。"""
    text = str(raw or "").strip()
    candidates = [text]
    if "```" in text:
        first_fence = text.find("```")
        second_fence = text.find("```", first_fence + 3)
        if second_fence > first_fence:
            inner = text[first_fence + 3:second_fence].strip()
            if inner.startswith("json"):
                inner = inner[4:].strip()
            if inner:
                candidates.insert(0, inner)
    json_blocks = extract_json_blocks(text)
    for block in json_blocks:
        if block not in candidates:
            candidates.insert(0, block)
    parsed_candidates = []
    for candidate in candidates:
        data = None
        try:
            data = json.loads(candidate)
        except Exception:
            try:
                data = json.loads(repair_json_string(candidate))
            except Exception:
                continue
        if not data or not isinstance(data, dict):
            continue
        try:
            reply = data.get("reply") if isinstance(data.get("reply"), str) else (data.get("text") if isinstance(data.get("text"), str) else "")
            options = [o for o in (data.get("options") or []) if o and isinstance(o.get("label"), str) and isinstance(o.get("value"), str)][:8]
            options = [{"label": o["label"].strip(), "value": o["value"].strip()} for o in options]
            if 0 < len(options) < 8 and not any(o["value"] == "CUSTOM_INPUT" for o in options):
                options.append({"label": "自定义输入", "value": "CUSTOM_INPUT"})
            if not options and reply:
                numbered = extract_numbered_options(reply)
                if numbered:
                    options = numbered["options"]
            prompts = normalize_prompts(data.get("prompts"))[:AGENT_GEN_MAX_PER_MSG]
            generations = [g for g in (data.get("generations") or []) if g and isinstance(g.get("prompt"), str) and g["prompt"].strip()][:AGENT_GEN_MAX_PER_MSG]
            generations = [{
                "prompt": g["prompt"].strip(),
                "count": max(1, min(8, int(g.get("count") or 1) or 1)),
                "use_last_outputs": bool(g.get("use_last_outputs")),
                "use_attachments": bool(g.get("use_attachments")),
                "results": [],
                "status": "running",
                **({"attachment_indices": [int(i) for i in g["attachment_indices"] if isinstance(i, (int, float)) and i >= 0]} if isinstance(g.get("attachment_indices"), list) else {}),
            } for g in generations]
            collected = data["collected"] if isinstance(data.get("collected"), dict) else {}
            next_dimension = data["next_dimension"] if isinstance(data.get("next_dimension"), str) else ""
            remaining_dimensions = data["remaining_dimensions"] if isinstance(data.get("remaining_dimensions"), list) else []
            parsed_candidates.append({"reply": reply, "options": options, "prompts": prompts, "generations": generations,
                                       "collected": collected, "next_dimension": next_dimension, "remaining_dimensions": remaining_dimensions})
        except Exception:
            continue
    if parsed_candidates:
        def score(c):
            s = 0
            if c["options"] and not c["generations"]:
                s += 100
            elif c["options"]:
                s += 50
            if c["prompts"]:
                s += 30
            if c["generations"]:
                s += 20
            if c["reply"]:
                s += 10
            if c["collected"]:
                s += 5
            return s
        parsed_candidates.sort(key=score, reverse=True)
        return parsed_candidates[0]
    # fallback 链
    regex_result = extract_fields_with_regex(text)
    has_content = regex_result["reply"] or regex_result["options"] or regex_result["prompts"] or regex_result["generations"]
    if has_content:
        if 0 < len(regex_result["options"]) < 8 and not any(o["value"] == "CUSTOM_INPUT" for o in regex_result["options"]):
            regex_result["options"].append({"label": "自定义输入", "value": "CUSTOM_INPUT"})
        return regex_result
    numbered_fallback = extract_numbered_options(text)
    if numbered_fallback:
        fb = numbered_fallback.get("options") or []
        if 0 < len(fb) < 8 and not any(o["value"] == "CUSTOM_INPUT" for o in fb):
            fb.append({"label": "自定义输入", "value": "CUSTOM_INPUT"})
        return {"reply": numbered_fallback.get("reply") or text, "options": fb, "prompts": [], "generations": [], "collected": {}, "next_dimension": "", "remaining_dimensions": []}
    clarify = extract_clarify_options(text, last_user_text)
    if clarify:
        if 0 < len(clarify) < 8 and not any(o["value"] == "CUSTOM_INPUT" for o in clarify):
            clarify.append({"label": "自定义输入", "value": "CUSTOM_INPUT"})
        return {"reply": text, "options": clarify, "prompts": [], "generations": [], "collected": {}, "next_dimension": "", "remaining_dimensions": []}
    return {"reply": text, "options": [], "prompts": [], "generations": [], "collected": {}, "next_dimension": "", "remaining_dimensions": []}

def _reverse_find_user_msg(conv):
    for m in reversed((conv or {}).get("messages", []) or []):
        if m.get("role") == "user":
            return m
    return None

def _reverse_find_assistant_msg(conv):
    for m in reversed((conv or {}).get("messages", []) or []):
        if m.get("role") == "assistant":
            return m
    return None

def process_agent_llm_result(conv, result, text, attachments, user_msg):
    """处理 LLM 返回：解析、兜底、生成 assistant 消息、运行生图（对齐 processAgentLlmResult，conv 版）。"""
    parsed = parse_agent_response(result.get("text") or "", text)
    if not isinstance(parsed.get("options"), list):
        parsed["options"] = []
    if not isinstance(parsed.get("prompts"), list):
        parsed["prompts"] = []
    if not isinstance(parsed.get("generations"), list):
        parsed["generations"] = []
    bypass_thinking = bool(user_msg.get("bypassThinking")) if isinstance(user_msg, dict) else False
    thinking_mode_on = bool((conv or {}).get("thinkingMode")) and not bypass_thinking
    # 生图意图兜底 + 修改意图检测
    last_user = _reverse_find_user_msg(conv)
    if last_user and last_user.get("text") and parsed.get("reply"):
        user_text = str(last_user.get("text") or "").strip()
        reply_text = str(parsed.get("reply") or "")
        gen_prompt = extract_gen_prompt(reply_text)
        user_modify_re = re.compile(r"改成|转换成|换成|修改为|变成|转为|改为|转成|调整为|修改成|变回|调成|重新画|重画|重新生成|修改一下|改一下|调整一下", re.I)
        reply_modify_re = re.compile(r"为您(?:将|把).{0,30}?(?:转换|改成|换成|修改|变成|调整|转为|调成|重新画|重画)|(?:将|把).{0,20}?(?:转换|改成|换成|修改|变成).{0,10}?(?:风格|效果|版本|色调)", re.I)
        is_modify_scenario = bool(user_modify_re.search(user_text)) or bool(reply_modify_re.search(reply_text))
        if not is_modify_scenario:
            msgs = (conv or {}).get("messages", []) or []
            for i in range(len(msgs) - 1, -1, -1):
                if msgs[i].get("role") == "assistant":
                    prev_assistant = msgs[i]
                    if isinstance(prev_assistant.get("prompts"), list) and prev_assistant["prompts"]:
                        confirm_re = re.compile(r"^\s*(确认|生成|好的|好|可以|没问题|就这样|执行|继续|1|yes|ok)\s*$", re.I)
                        if confirm_re.search(user_text):
                            for j in range(i - 1, -1, -1):
                                if msgs[j].get("role") == "user":
                                    if user_modify_re.search(str(msgs[j].get("text") or "").strip()):
                                        is_modify_scenario = True
                                    break
                    break
        if not parsed["generations"] and not parsed["prompts"]:
            gen_in_progress_re = re.compile(r"正在生成|正在为你生成|正在为您生成|生成中|开始生成|马上生成|这就为你生成|这就为您生成|好的[,，]?\s*我来生成|好的[,，]?\s*马上|我将为你生成|我将为您生成|我来为你生成|我来为您生成|正在为你创建|正在为您创建|正在画|正在创建", re.I)
            user_gen_intent_re = re.compile(r"我要生成|帮我生成|帮我画|画一|生成一|创建一|制作一|来一张|来幅|来张|给我画|给我生成|帮我创建|帮我做", re.I)
            meaningless_confirm_re = re.compile(r"确认要生成|确认生成|确认要画|要为您生成.*吗|要生成.*吗|确认.*吗.*[？?]", re.I)
            no_options = not parsed["options"]
            has_gen_in_progress = not thinking_mode_on and bool(gen_in_progress_re.search(reply_text))
            has_user_gen_intent = no_options and bool(user_gen_intent_re.search(user_text))
            has_meaningless_confirm = no_options and bool(meaningless_confirm_re.search(reply_text))
            has_any_intent = has_gen_in_progress or has_user_gen_intent or is_modify_scenario or has_meaningless_confirm
            fallback_use_last_outputs = is_modify_scenario
            if has_any_intent:
                parsed["generations"] = [{
                    "prompt": gen_prompt or user_text,
                    "count": 1,
                    "use_last_outputs": fallback_use_last_outputs,
                    "use_attachments": bool(last_user.get("images") and len(last_user["images"])),
                    "results": [],
                    "status": "running",
                }]
        elif is_modify_scenario and parsed["generations"]:
            for g in parsed["generations"]:
                if g.get("use_last_outputs") is None:
                    g["use_last_outputs"] = True
    # 重新生成提示词 → 清空 generations
    last_user_msg = _reverse_find_user_msg(conv)
    if last_user_msg and "重新生成提示词" in str(last_user_msg.get("text") or ""):
        parsed["generations"] = []
    # 数量决策（输入框显式 > 工具栏）
    requested_count = int(user_msg.get("requestedCount") or 0) if isinstance(user_msg, dict) else 0
    if requested_count <= 1:
        prev = _reverse_find_user_msg(conv)
        if prev and int(prev.get("requestedCount") or 0) > 1:
            requested_count = int(prev["requestedCount"])
    if requested_count <= 1:
        requested_count = resolve_final_gen_count(text)["count"]
    if requested_count <= 1:
        requested_count = 0
    if thinking_mode_on:
        user_modify_re = re.compile(r"改成|换成|转换成|修改为|变成|转为|改为|转成|调整为|修改成|变回|调成|重新画|重画|重新生成|修改一下|改一下|调整一下", re.I)
        is_modify_request = bool(user_modify_re.search(text))
        if parsed["options"]:
            parsed["prompts"] = []
            parsed["generations"] = []
        if parsed["generations"]:
            converted = []
            for g in parsed["generations"]:
                ptext = str(g.get("prompt") or "").strip()
                if not ptext:
                    continue
                c = max(1, min(8, int(g.get("count") or 1) or 1))
                for _ in range(c):
                    p = {"prompt": ptext, "count": 1, "use_last_outputs": bool(g.get("use_last_outputs")),
                         "use_attachments": bool(g.get("use_attachments")), "status": "pending"}
                    if isinstance(g.get("attachment_indices"), list):
                        p["attachment_indices"] = g["attachment_indices"]
                    converted.append(p)
            parsed["prompts"] = converted + parsed["prompts"]
            parsed["generations"] = []
        if not is_modify_request and parsed["prompts"] and not parsed["options"] and is_vague_image_request(text):
            parsed["prompts"] = []
            parsed["options"] = [{"label": "水墨风", "value": "水墨风"}, {"label": "油画风", "value": "油画风"},
                                 {"label": "赛博朋克", "value": "赛博朋克"}, {"label": "Q版卡通", "value": "Q版卡通"}]
            parsed["reply"] = "你的输入比较简略，请先选择一个风格方向，我再为你扩写完整提示词："
        if not parsed["prompts"] and not parsed["options"] and not parsed["generations"]:
            reply_looks_json = parsed["reply"] and ("\"reply\"" in parsed["reply"] or "\"options\"" in parsed["reply"] or parsed["reply"].strip().startswith("{"))
            if reply_looks_json:
                reply_val_match = re.search(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"', parsed["reply"])
                if reply_val_match:
                    try:
                        parsed["reply"] = json.loads('"' + reply_val_match.group(1) + '"')
                    except Exception:
                        parsed["reply"] = reply_val_match.group(1)
                    parsed["prompts"] = [{"prompt": text, "count": 1, "use_last_outputs": is_modify_request, "use_attachments": False, "status": "pending"}]
                else:
                    parsed["reply"] = "抱歉，AI 回复格式异常。请重新描述你的需求，或者选择一个风格方向开始："
                    parsed["options"] = [{"label": "水墨风", "value": "水墨风"}, {"label": "油画风", "value": "油画风"},
                                         {"label": "赛博朋克", "value": "赛博朋克"}, {"label": "Q版卡通", "value": "Q版卡通"},
                                         {"label": "自定义输入", "value": "CUSTOM_INPUT"}]
            elif is_vague_image_request(text) and not is_modify_request:
                parsed["options"] = [{"label": "水墨风", "value": "水墨风"}, {"label": "油画风", "value": "油画风"},
                                     {"label": "赛博朋克", "value": "赛博朋克"}, {"label": "Q版卡通", "value": "Q版卡通"}]
                parsed["reply"] = "你的输入比较简略，请先选择一个风格方向，我再为你逐步完善："
            else:
                parsed["prompts"] = [{"prompt": text, "count": 1, "use_last_outputs": is_modify_request, "use_attachments": False, "status": "pending"}]
                if not parsed["reply"]:
                    parsed["reply"] = "请确认以下提示词："
        # 数量校准
        if requested_count > 1 and parsed["prompts"] and len(parsed["prompts"]) < requested_count:
            base_prompts = parsed["prompts"][:]
            variant_directions = ["不同姿态与动作", "不同场景与氛围", "不同视角与构图", "不同配色与光线",
                                  "不同细节与装饰", "不同表情与神态", "不同背景与环境", "不同材质与质感"]
            while len(parsed["prompts"]) < requested_count:
                base = base_prompts[len(parsed["prompts"]) % len(base_prompts)]
                variant_idx = len(parsed["prompts"]) // len(base_prompts)
                direction = variant_directions[variant_idx % len(variant_directions)]
                parsed["prompts"].append({"prompt": base["prompt"] + f"（变体{variant_idx + 1}，{direction}）",
                                          "count": 1, "use_last_outputs": base["use_last_outputs"],
                                          "use_attachments": base["use_attachments"], "status": "pending"})
        if requested_count > 1 and len(parsed["prompts"]) > requested_count:
            parsed["prompts"] = parsed["prompts"][:requested_count]
    # 直接模式数量校准
    if not thinking_mode_on and requested_count > 1 and parsed["generations"]:
        current = len(parsed["generations"])
        if current < requested_count:
            base = parsed["generations"][:]
            while len(parsed["generations"]) < requested_count:
                b = base[len(parsed["generations"]) % len(base)]
                variant_idx = len(parsed["generations"]) - len(base) + 1
                parsed["generations"].append({
                    "prompt": str(b.get("prompt") or text or "") + f"（请使用完全不同的品牌主题/行业方向作为变体{variant_idx}，确保与前面生成的内容有明显差异）",
                    "count": 1, "use_last_outputs": bool(b.get("use_last_outputs")),
                    "use_attachments": bool(b.get("use_attachments")), "results": [], "status": "running"})
        elif current > requested_count:
            parsed["generations"] = parsed["generations"][:requested_count]
    if not thinking_mode_on and parsed["generations"]:
        for g in parsed["generations"]:
            g["count"] = 1
    assistant_msg = {
        "id": uuid.uuid4().hex,
        "role": "assistant",
        "text": parsed["reply"],
        "options": parsed["options"] or [],
        "prompts": parsed["prompts"] or [],
        "generations": parsed["generations"],
        "ts": now_ms(),
        "collected": parsed["collected"] or {},
        "next_dimension": parsed["next_dimension"] or "",
        "remaining_dimensions": parsed["remaining_dimensions"] or [],
    }
    if requested_count > 0:
        assistant_msg["requestedCount"] = requested_count
    if assistant_msg["prompts"]:
        assistant_msg["promptIdx"] = 0
        if not assistant_msg["prompts"][0].get("status") or assistant_msg["prompts"][0].get("status") == "pending":
            assistant_msg["prompts"][0]["status"] = "current"
    (conv.setdefault("messages", [])).append(assistant_msg)
    conv["messages"] = conv["messages"][-AGENT_MSG_MAX:]
    if assistant_msg["generations"] and not assistant_msg["prompts"]:
        return assistant_msg
    return assistant_msg

def _find_user_msg_for(conv, assistant_msg):
    msgs = (conv or {}).get("messages", []) or []
    idx = msgs.index(assistant_msg) if assistant_msg in msgs else -1
    if idx < 0:
        return None
    for i in range(idx - 1, -1, -1):
        if msgs[i].get("role") == "user":
            return msgs[i]
    return None

async def _trigger_generations_if_all_done(conv, assistant_msg):
    prompts = assistant_msg.get("prompts") or []
    if any(p.get("status") in ("pending", "current", "editing") for p in prompts):
        return
    confirmed = [p for p in prompts if p.get("status") == "confirmed"]
    if not confirmed:
        return
    user_msg = _find_user_msg_for(conv, assistant_msg)
    assistant_msg["generations"] = [{
        "prompt": cp["prompt"],
        "count": cp.get("count") or 1,
        "use_last_outputs": bool(cp.get("use_last_outputs")),
        "use_attachments": bool(cp.get("use_attachments")),
        "results": [],
        "status": "running",
        **({"attachment_indices": cp["attachment_indices"]} if isinstance(cp.get("attachment_indices"), list) else {}),
    } for cp in confirmed]
    await run_agent_generations(conv, assistant_msg, user_msg)

async def _advance_to_next_or_generate(conv, assistant_msg):
    prompts = assistant_msg.get("prompts") or []
    next_idx = next((i for i, p in enumerate(prompts) if p.get("status") == "pending"), -1)
    if next_idx >= 0:
        prompts[next_idx]["status"] = "current"
        assistant_msg["promptIdx"] = next_idx
        return
    assistant_msg["promptIdx"] = len(prompts)
    await _trigger_generations_if_all_done(conv, assistant_msg)

async def confirm_agent_prompt(conv, assistant_msg):
    prompts = assistant_msg.get("prompts") or []
    idx = next((i for i, p in enumerate(prompts) if p.get("status") in ("current", "editing")), -1)
    if idx < 0:
        return
    prompts[idx]["status"] = "confirmed"
    await _advance_to_next_or_generate(conv, assistant_msg)

def edit_agent_prompt(assistant_msg):
    prompts = assistant_msg.get("prompts") or []
    idx = next((i for i, p in enumerate(prompts) if p.get("status") == "current"), -1)
    if idx < 0:
        return
    prompts[idx]["status"] = "editing"
    assistant_msg["promptIdx"] = idx

async def save_agent_prompt_edit(conv, assistant_msg, new_text):
    prompts = assistant_msg.get("prompts") or []
    idx = next((i for i, p in enumerate(prompts) if p.get("status") == "editing"), -1)
    if idx < 0:
        return
    new_text = str(new_text or "").strip()
    if not new_text:
        return
    prompts[idx]["prompt"] = new_text
    prompts[idx]["status"] = "confirmed"
    await _advance_to_next_or_generate(conv, assistant_msg)

def cancel_agent_prompt_edit(assistant_msg):
    prompts = assistant_msg.get("prompts") or []
    idx = next((i for i, p in enumerate(prompts) if p.get("status") == "editing"), -1)
    if idx < 0:
        return
    prompts[idx]["status"] = "current"

async def confirm_all_agent_prompts(conv, assistant_msg):
    prompts = assistant_msg.get("prompts") or []
    if not prompts:
        return
    for p in prompts:
        if p.get("status") not in ("skipped", "confirmed"):
            p["status"] = "confirmed"
    assistant_msg["promptIdx"] = len(prompts)
    await _trigger_generations_if_all_done(conv, assistant_msg)

def cancel_all_agent_prompts(assistant_msg):
    assistant_msg["prompts"] = []
    if "promptIdx" in assistant_msg:
        del assistant_msg["promptIdx"]
    if not assistant_msg.get("text"):
        assistant_msg["text"] = "已取消全部提示词，请重新输入需求。"

def reopen_agent_prompt(assistant_msg, idx):
    prompts = assistant_msg.get("prompts") or []
    if idx < 0 or idx >= len(prompts):
        return
    if any(p.get("status") in ("editing", "current") for p in prompts):
        return
    prompts[idx]["status"] = "current"
    assistant_msg["promptIdx"] = idx

def _image_refs_only(items):
    out = []
    for it in items or []:
        if isinstance(it, dict) and it.get("url"):
            out.append({"url": it["url"], "name": it.get("name") or "ref"})
    return out

async def _resolve_gen_refs(conv, gen, user_msg, provider_id):
    """解析某条 generation 的参考图列表（对齐前端 runAgentGenerations 的 refs 计算）。"""
    last_results = agent_last_results(conv)
    current_attach = [i for i in (user_msg.get("images") or []) if i and i.get("url")]
    attach_refs = current_attach if current_attach else agent_last_user_attachments(conv)
    refs = []
    if isinstance(gen.get("direct_refs"), list) and gen["direct_refs"]:
        refs = [r for r in gen["direct_refs"] if r and r.get("url")]
    else:
        if gen.get("use_last_outputs"):
            refs = refs + last_results
        if gen.get("use_attachments"):
            if isinstance(gen.get("attachment_indices"), list) and gen["attachment_indices"]:
                filtered = [attach_refs[i] for i in gen["attachment_indices"] if 0 <= i < len(attach_refs)]
                refs = refs + filtered
            else:
                refs = refs + attach_refs
    all_refs = _image_refs_only(refs)
    max_refs = config.max_reference_images(provider_id)
    if len(all_refs) > max_refs:
        all_refs = all_refs[:max_refs]
    return [AIReference(url=r["url"], name=r.get("name") or "ref") for r in all_refs], set(r["url"] for r in all_refs)

async def run_agent_generations(conv, assistant_msg, user_msg):
    """运行生图（对齐 runAgentGenerations）。T3 纪律：结果只写会话 gen.results，绝不碰画布节点。"""
    gens = assistant_msg.get("generations") or []
    if not gens:
        return
    gen_providers = agent_gen_providers()
    if not gen_providers:
        for g in gens:
            g["status"] = "error"
            g["error"] = "未配置生图模型"
        return
    provider_id = next((p["id"] for p in gen_providers if p.get("id") == (conv or {}).get("genProvider")), gen_providers[0]["id"])
    models = provider_image_models(provider_id)
    gen_model = (conv or {}).get("genModel") if (conv or {}).get("genModel") in models else (models[0] if models else "")
    (conv or {})["genProvider"] = provider_id
    (conv or {})["genModel"] = gen_model
    ratio = (conv or {}).get("genRatio") or "square"
    resolution = (conv or {}).get("genResolution") or "1k"
    size = api_image_size(ratio, resolution) or "1024x1024"
    quality = (conv or {}).get("genQuality") or "auto"
    pending_gens = [g for g in gens if not (g.get("results") and len(g["results"])) and g.get("status") not in ("done", "error")]
    for gen in pending_gens:
        gen["status"] = "running"
    for gen in pending_gens:
        try:
            ref_objs, ref_url_set = await _resolve_gen_refs(conv, gen, user_msg, provider_id)
            final_prompt = gen["prompt"]
            ref_list = [r.to_dict() for r in ref_objs] if ref_objs else None
            result = await client.generate_image(final_prompt, provider_id=provider_id, model=gen_model,
                                                 size=size, quality=quality, reference_images=ref_list, n=1)
            urls = result.get("images") or []
            items = []
            for i, url in enumerate(urls):
                items.append({"url": url, "name": f"agent-{now_ms()}-{i + 1}.png", "kind": "image"})
            items = [it for it in items if it["url"] and it["url"] not in ref_url_set][:max(1, min(8, int(gen.get("count") or 1)))]
            gen["results"] = items
            gen["status"] = "done"
        except Exception as e:
            gen["status"] = "error"
            gen["error"] = str(getattr(e, "detail", None) or e)[:200]
    return gens

async def recover_agent_generations(conv):
    """恢复中断的生图任务（刷新后）。后端版：会话中 running 的 gen 直接重新调用生图（无 task 轮询，结果幂等写回）。"""
    msgs = (conv or {}).get("messages", []) or []
    for i in range(len(msgs) - 1, -1, -1):
        msg = msgs[i]
        if msg.get("role") != "assistant":
            continue
        gens = msg.get("generations") or []
        running = [g for g in gens if g.get("status") == "running"]
        if not running:
            continue
        user_msg = _find_user_msg_for(conv, msg)
        await run_agent_generations(conv, msg, user_msg)
        break

def _resolve_chat_provider(conv):
    """解析思维模式下的 chat provider/model（对齐前端 chatApiProviders/resolveChatProviderId/resolveChatModel）。"""
    providers = [p for p in config.chat_providers() if p.get("enabled", True) is not False and (p.get("chat_models") or [])]
    if not providers:
        return None, ""
    pid = (conv or {}).get("chatProvider")
    provider = next((p for p in providers if p.get("id") == pid), None) or providers[0]
    models = provider.get("chat_models") or []
    mid = (conv or {}).get("chatModel")
    model = mid if mid in models else (models[0] if models else "")
    return provider.get("id"), model

async def send_agent_message(conv, text, attachments, bypass_thinking=False):
    """发送用户消息并处理（对齐 sendAgentMessage，conv 版）。返回 (user_msg, assistant_msg)。"""
    text = str(text or "").strip()
    attachments = list(attachments or [])
    if not text and not attachments:
        return None, None
    # 确认中拦截
    last_assistant = _reverse_find_assistant_msg(conv)
    if last_assistant and isinstance(last_assistant.get("prompts"), list) and last_assistant["prompts"]:
        pending = [p for p in last_assistant["prompts"] if p.get("status") in ("pending", "current", "editing")]
        if pending:
            last_assistant["prompts"] = []
            if "promptIdx" in last_assistant:
                del last_assistant["promptIdx"]
    thinking_mode_on = bool((conv or {}).get("thinkingMode")) and not bypass_thinking
    if not thinking_mode_on:
        # 直接生图模式
        gen_providers = agent_gen_providers()
        if not gen_providers:
            raise HTTPException(status_code=400, detail="未配置生图模型")
        provider_id = next((p["id"] for p in gen_providers if p.get("id") == (conv or {}).get("genProvider")), gen_providers[0]["id"])
        models = provider_image_models(provider_id)
        model = (conv or {}).get("genModel") if (conv or {}).get("genModel") in models else (models[0] if models else "")
        if not model:
            raise HTTPException(status_code=400, detail="生图模型不可用")
        ratio = (conv or {}).get("genRatio") or "square"
        resolution = (conv or {}).get("genResolution") or "1k"
        count = max(1, min(8, int((conv or {}).get("genCount") or 1) or 1))
        image_map = agent_current_image_map(conv)
        total = len(image_map)
        ref_tasks = parse_image_ref_tasks(text, total) if total > 0 else None
        generations = []
        requested_count = count
        final = resolve_final_gen_count(text)
        if final["count"] > 1:
            requested_count = final["count"]
        user_modify_re = re.compile(r"改成|换成|转换成|修改为|变成|转为|改为|转成|调整为|修改成|变回|调成|重新画|重画|重新生成|修改一下|改一下|调整一下", re.I)
        is_modify = bool(user_modify_re.search(text))
        use_last_outputs = is_modify and not ref_tasks
        use_attachments = bool(attachments) and not ref_tasks
        if ref_tasks and ref_tasks.get("tasks"):
            for task in ref_tasks["tasks"]:
                resolved = [{"url": image_map[idx]["url"], "name": image_map[idx].get("name") or f"图{idx + 1}"}
                            for idx in task.get("attachment_indices", []) if 0 <= idx < len(image_map)]
                generations.append({"prompt": text, "count": 1, "use_last_outputs": False, "use_attachments": False,
                                     "direct_refs": resolved, "results": [], "status": "running"})
            requested_count = len(generations)
        else:
            for i in range(max(requested_count, 1)):
                prompt_text = f"{text}（变体{i + 1}，不同构图/角度/场景）" if requested_count > 1 else text
                generations.append({"prompt": prompt_text, "count": 1, "use_last_outputs": use_last_outputs,
                                     "use_attachments": use_attachments, "results": [], "status": "running"})
        user_msg = {"id": uuid.uuid4().hex, "role": "user", "text": text, "images": attachments, "ts": now_ms()}
        if requested_count > 1:
            user_msg["requestedCount"] = requested_count
        (conv.setdefault("messages", [])).append(user_msg)
        conv["messages"] = conv["messages"][-AGENT_MSG_MAX:]
        conv["attachments"] = []
        assistant_msg = {"id": uuid.uuid4().hex, "role": "assistant", "text": "", "options": [], "prompts": [],
                         "generations": generations, "ts": now_ms(), "requestedCount": requested_count}
        (conv.setdefault("messages", [])).append(assistant_msg)
        conv["messages"] = conv["messages"][-AGENT_MSG_MAX:]
        await run_agent_generations(conv, assistant_msg, user_msg)
        return user_msg, assistant_msg
    # 思维模式：走 LLM 流程
    provider_id, model = _resolve_chat_provider(conv)
    if not provider_id:
        raise HTTPException(status_code=400, detail="未配置对话模型")
    (conv or {})["chatProvider"] = provider_id
    (conv or {})["chatModel"] = model
    user_msg = {"id": uuid.uuid4().hex, "role": "user", "text": text, "images": attachments, "ts": now_ms(), "bypassThinking": bypass_thinking}
    (conv.setdefault("messages", [])).append(user_msg)
    conv["messages"] = conv["messages"][-AGENT_MSG_MAX:]
    context_images = list(attachments)
    if (conv or {}).get("autoContext", True) is not False:
        for item in (agent_last_results(conv) + agent_last_user_attachments(conv)):
            if item.get("url") and len(context_images) < AGENT_LLM_IMAGE_MAX and not any(i.get("url") == item.get("url") for i in context_images):
                context_images.append(item)
    last_assistant = _reverse_find_assistant_msg(conv)
    prev_collected = (last_assistant or {}).get("collected") or {}
    message_text = text or "(please help me edit these images)"
    if prev_collected:
        message_text += f"{AGENT_NL}{AGENT_NL}【已确认维度】以下维度已在之前的对话中确认："
        for k, v in prev_collected.items():
            message_text += f"{AGENT_NL}- {k}：{v}"
    final = resolve_final_gen_count(text)
    if final["count"] <= 1:
        prev_user = _reverse_find_user_msg(conv)
        if prev_user and int(prev_user.get("requestedCount") or 0) > 1:
            final["count"] = prev_user["requestedCount"]
            final["source"] = "inherited"
    if final["count"] > 1:
        user_msg["requestedCount"] = final["count"]
    skills = (conv or {}).get("skills") or []
    if skills:
        skill_names = "、".join([s.get("name") for s in skills if s.get("name")])
        message_text += f"{AGENT_NL}{AGENT_NL}【重要提醒】你必须完整遵循 Skill 文档（{skill_names}）的所有描述。Skill 描述的是单张图的样式（含画面内元素排列、构图、配色、排版等），每条 prompt 必须逐字保留这些样式描述，只能改变主题/变体方向。不得简化、概括或遗漏。每条 prompt 长度应与 Skill 文档相当。注意：Skill 不决定生成几张图，出图数量由系统决定（{final['count']}张{final['source'] == 'input' and '，来自你的输入要求' or '，来自工具栏设置'}）。"
    llm_messages = agent_history_messages(conv)[:-1] if len(agent_history_messages(conv)) > 1 else []
    payload = CanvasLLMRequest(
        message=message_text,
        messages=llm_messages,
        images=[i.get("url") for i in context_images[:AGENT_LLM_IMAGE_MAX] if i.get("url")],
        videos=[],
        model=model,
        provider=provider_id,
        ms_model=model if provider_id == "modelscope" else "",
        system_prompt=agent_system_prompt(conv, bypass_thinking, final["count"]),
    )
    result = await client.chat_completion(
        [{"role": "system", "content": payload.system_prompt}] + payload.messages + [{"role": "user", "content": payload.message}],
        provider_id=payload.provider, model=payload.model, temperature=0.8)
    result = {"text": result}
    assistant_msg = process_agent_llm_result(conv, result, text, attachments, user_msg)
    if assistant_msg.get("generations") and not assistant_msg.get("prompts"):
        await run_agent_generations(conv, assistant_msg, user_msg)
    return user_msg, assistant_msg

async def regenerate_agent_prompts(conv, assistant_msg):
    """重新生成当前提示词（对齐 regenerateAgentPrompts，conv 版）。"""
    prompts = assistant_msg.get("prompts") or []
    current_idx = next((i for i, p in enumerate(prompts) if p.get("status") in ("current", "editing")), -1)
    if current_idx < 0:
        return
    current_prompt = prompts[current_idx]
    user_msg = _find_user_msg_for(conv, assistant_msg)
    original_user_text = user_msg.get("text") if user_msg else ""
    if not original_user_text:
        return
    provider_id, model = _resolve_chat_provider(conv)
    if not provider_id:
        return
    regen_message = original_user_text + AGENT_NL + AGENT_NL + f"请重新生成第{current_idx + 1}条提示词，要求与之前不同。当前第{current_idx + 1}条是：\"{current_prompt.get('prompt')}\"。请只返回一条新的提示词。"
    skills = (conv or {}).get("skills") or []
    if skills:
        skill_names = "、".join([s.get("name") for s in skills if s.get("name")])
        regen_message += f"{AGENT_NL}{AGENT_NL}【重要提醒】你必须完整遵循 Skill 文档（{skill_names}）的所有描述。重新生成的 prompt 必须逐字保留 Skill 文档的风格、背景、构图、配色、排版等全部细节，只能改变主题/变体方向。不得简化、概括或遗漏。"
    llm_messages = agent_history_messages(conv)[:-1] if len(agent_history_messages(conv)) > 1 else []
    payload = CanvasLLMRequest(
        message=regen_message,
        messages=llm_messages,
        images=[i.get("url") for i in (user_msg.get("images") or []) if i.get("url")],
        videos=[],
        model=model,
        provider=provider_id,
        ms_model=model if provider_id == "modelscope" else "",
        system_prompt=agent_system_prompt(conv, False, 1),
    )
    result = await client.chat_completion(
        [{"role": "system", "content": payload.system_prompt}] + payload.messages + [{"role": "user", "content": payload.message}],
        provider_id=payload.provider, model=payload.model, temperature=0.8)
    result = {"text": result}
    parsed = parse_agent_response(result.get("text") or "", original_user_text)
    new_prompt_text = ""
    new_count = current_prompt.get("count")
    new_use_last = current_prompt.get("use_last_outputs")
    new_use_attach = current_prompt.get("use_attachments")
    if parsed.get("prompts"):
        first = parsed["prompts"][0]
        new_prompt_text = first.get("prompt") or ""
        if first.get("count") is not None:
            new_count = first["count"]
        if first.get("use_last_outputs") is not None:
            new_use_last = bool(first["use_last_outputs"])
        if first.get("use_attachments") is not None:
            new_use_attach = bool(first["use_attachments"])
    elif parsed.get("generations"):
        first = parsed["generations"][0]
        new_prompt_text = first.get("prompt") or ""
        if first.get("count") is not None:
            new_count = first["count"]
        if first.get("use_last_outputs") is not None:
            new_use_last = bool(first["use_last_outputs"])
        if first.get("use_attachments") is not None:
            new_use_attach = bool(first["use_attachments"])
    if new_prompt_text.strip():
        prompts[current_idx]["prompt"] = new_prompt_text.strip()
        prompts[current_idx]["count"] = new_count
        prompts[current_idx]["use_last_outputs"] = new_use_last
        prompts[current_idx]["use_attachments"] = new_use_attach
    if parsed.get("reply"):
        assistant_msg["text"] = parsed["reply"]

# 模块 3 占位（实际定义见文件末尾）
# ============================================================================
# 模块 3：Agent 后端·实时通道（WebSocket /ws/agent）
# 复用画布既有 manager（仅追加广播方法，不改画布既有方法，C3-3）。
# 事件类型对齐原前端：agent_llm_done（已由 ws_manager.broadcast_agent_llm_done 推送）
# / agent_gen_done / agent_progress。
# ============================================================================

@agent_router.websocket("/ws/agent")
async def agent_ws_endpoint(websocket: WebSocket, client_id: str = None):
    await ws_manager.connect(websocket, client_id)
    try:
        while True:
            # 仅接收心跳，保持连接；业务事件由后端主动推送
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, client_id)
    except Exception as e:
        print(f"Agent WS Error: {e}")
        await ws_manager.disconnect(websocket, client_id)

# ============================================================================
# 模块 2c 路由：Agent 会话交互 API（挂在 agent_router，阶段 D 由 main 挂载）
# ============================================================================

class AgentSendMessageRequest(BaseModel):
    text: str = ""
    attachments: List[Dict[str, Any]] = []
    bypassThinking: bool = False

class AgentPromptActionRequest(BaseModel):
    messageId: str = ""
    promptIndex: int = -1
    newText: str = ""

def _find_msg_by_id(conv, msg_id):
    for m in (conv or {}).get("messages", []) or []:
        if m.get("id") == msg_id:
            return m
    return None

@agent_router.post("/api/agent/conversations/{conversation_id}/messages")
async def agent_send_message_route(conversation_id: str, payload: AgentSendMessageRequest, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    user_msg, assistant_msg = await send_agent_message(conv, payload.text, payload.attachments, payload.bypassThinking)
    if user_msg is None:
        return {"conversation": conv, "warn": "empty message"}
    conv["updated_at"] = now_ms()
    save_agent_conversation(user_id, conv)
    if assistant_msg:
        try:
            await ws_manager.broadcast_agent_llm_done(conversation_id, "succeeded")
        except Exception:
            pass
        try:
            await ws_manager.broadcast_agent_gen_done(conversation_id, {"message_id": assistant_msg["id"], "generations": assistant_msg.get("generations", [])})
        except Exception:
            pass
    return {"conversation": conv, "user_message": user_msg, "assistant_message": assistant_msg}

@agent_router.post("/api/agent/conversations/{conversation_id}/prompts/confirm")
async def agent_confirm_prompt_route(conversation_id: str, payload: AgentPromptActionRequest, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    msg = _find_msg_by_id(conv, payload.messageId)
    if not msg or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="消息不存在")
    if payload.promptIndex >= 0 and payload.promptIndex < len(msg.get("prompts") or []):
        prompts = msg["prompts"]
        prompts[payload.promptIndex]["status"] = "confirmed"
        await _advance_to_next_or_generate(conv, msg)
    else:
        await confirm_agent_prompt(conv, msg)
    conv["updated_at"] = now_ms()
    save_agent_conversation(user_id, conv)
    return {"conversation": conv, "assistant_message": msg}

@agent_router.post("/api/agent/conversations/{conversation_id}/prompts/confirm-all")
async def agent_confirm_all_route(conversation_id: str, payload: AgentPromptActionRequest, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    msg = _find_msg_by_id(conv, payload.messageId)
    if not msg or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="消息不存在")
    await confirm_all_agent_prompts(conv, msg)
    conv["updated_at"] = now_ms()
    save_agent_conversation(user_id, conv)
    return {"conversation": conv, "assistant_message": msg}

@agent_router.post("/api/agent/conversations/{conversation_id}/prompts/cancel-all")
async def agent_cancel_all_route(conversation_id: str, payload: AgentPromptActionRequest, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    msg = _find_msg_by_id(conv, payload.messageId)
    if not msg or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="消息不存在")
    cancel_all_agent_prompts(msg)
    conv["updated_at"] = now_ms()
    save_agent_conversation(user_id, conv)
    return {"conversation": conv, "assistant_message": msg}

@agent_router.post("/api/agent/conversations/{conversation_id}/prompts/edit")
async def agent_edit_prompt_route(conversation_id: str, payload: AgentPromptActionRequest, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    msg = _find_msg_by_id(conv, payload.messageId)
    if not msg or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="消息不存在")
    if payload.promptIndex >= 0:
        prompts = msg.get("prompts") or []
        if 0 <= payload.promptIndex < len(prompts):
            prompts[payload.promptIndex]["status"] = "editing"
            msg["promptIdx"] = payload.promptIndex
    else:
        edit_agent_prompt(msg)
    save_agent_conversation(user_id, conv)
    return {"conversation": conv, "assistant_message": msg}

@agent_router.post("/api/agent/conversations/{conversation_id}/prompts/save-edit")
async def agent_save_edit_route(conversation_id: str, payload: AgentPromptActionRequest, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    msg = _find_msg_by_id(conv, payload.messageId)
    if not msg or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="消息不存在")
    await save_agent_prompt_edit(conv, msg, payload.newText)
    conv["updated_at"] = now_ms()
    save_agent_conversation(user_id, conv)
    return {"conversation": conv, "assistant_message": msg}

@agent_router.post("/api/agent/conversations/{conversation_id}/prompts/cancel-edit")
async def agent_cancel_edit_route(conversation_id: str, payload: AgentPromptActionRequest, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    msg = _find_msg_by_id(conv, payload.messageId)
    if not msg or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="消息不存在")
    cancel_agent_prompt_edit(msg)
    save_agent_conversation(user_id, conv)
    return {"conversation": conv, "assistant_message": msg}

@agent_router.post("/api/agent/conversations/{conversation_id}/prompts/reopen")
async def agent_reopen_route(conversation_id: str, payload: AgentPromptActionRequest, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    msg = _find_msg_by_id(conv, payload.messageId)
    if not msg or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="消息不存在")
    reopen_agent_prompt(msg, payload.promptIndex)
    save_agent_conversation(user_id, conv)
    return {"conversation": conv, "assistant_message": msg}

@agent_router.post("/api/agent/conversations/{conversation_id}/prompts/regenerate")
async def agent_regenerate_route(conversation_id: str, payload: AgentPromptActionRequest, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    msg = _find_msg_by_id(conv, payload.messageId)
    if not msg or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="消息不存在")
    await regenerate_agent_prompts(conv, msg)
    conv["updated_at"] = now_ms()
    save_agent_conversation(user_id, conv)
    return {"conversation": conv, "assistant_message": msg}

@agent_router.post("/api/agent/conversations/{conversation_id}/recover")
async def agent_recover_route(conversation_id: str, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    await recover_agent_generations(conv)
    conv["updated_at"] = now_ms()
    save_agent_conversation(user_id, conv)
    return {"conversation": conv}

@agent_router.put("/api/agent/conversations/{conversation_id}/settings")
async def agent_update_settings(conversation_id: str, payload: dict, request: Request, x_user_id: str = Header(default="")):
    user_id = safe_user_id(x_user_id, request)
    conv = load_agent_conversation(user_id, conversation_id)
    for key in ("genProvider", "genModel", "genRatio", "genResolution", "genCount", "genQuality", "thinkingMode", "chatProvider", "chatModel", "skills"):
        if key in payload:
            conv[key] = payload[key]
    conv["updated_at"] = now_ms()
    save_agent_conversation(user_id, conv)
    return {"conversation": conv}
