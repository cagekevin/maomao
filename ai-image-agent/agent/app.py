# ============================================================================
# Agent 独立 Web 应用（不依赖 main.py）
#
# 挂载：
#   - /api/agent/*  和 /ws/agent  （来自 agent.backend.agent_router）
#   - /api/upload    （附件上传，落 agent/uploads/）
#   - /agent/output/* （生图结果静态目录）
#   - /agent/uploads/*（附件静态目录）
#   - /static/*      （agent 自带 vendor/theme/logo，完全自包含）
#   - /              （返回 agent/static/agent.html）
#
# 启动：python agent_server.py   或   uvicorn agent.app:app --port 8788
# ============================================================================

import os
import uuid
import time

from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import backend

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AGENT_STATIC = os.path.join(BASE_DIR, "static")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="AI 生图 Agent")

# 静态目录（全部自带，不依赖外部项目）
app.mount("/agent/static", StaticFiles(directory=AGENT_STATIC), name="agent_static")
app.mount("/static", StaticFiles(directory=AGENT_STATIC), name="static")
app.mount("/agent/output", StaticFiles(directory=OUTPUT_DIR), name="agent_output")
app.mount("/agent/uploads", StaticFiles(directory=UPLOAD_DIR), name="agent_uploads")

# 业务路由
app.include_router(backend.agent_router)


# ---- 附件上传（替代 main 的 /api/upload）----
@app.post("/api/upload")
async def agent_upload(file: UploadFile = File(...), x_user_id: str = Header(default="")):
    ext = os.path.splitext(file.filename or "")[-1].lower() or ".png"
    allowed = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    fname = f"{uuid.uuid4().hex[:12]}{ext}"
    path = os.path.join(UPLOAD_DIR, fname)
    data = await file.read()
    with open(path, "wb") as f:
        f.write(data)
    return {"url": "/agent/uploads/" + fname, "name": file.filename or fname}


@app.get("/")
async def index():
    return FileResponse(os.path.join(AGENT_STATIC, "agent.html"))
