# -*- coding: utf-8 -*-
"""
Lovart 上游异步客户端（纯净网络层版）
===============================================

专注处理 HMAC 签名、连接池管理（DCL 防并发泄漏）、错误退避重试。
不再包含业务层的状态拦截，业务逻辑由 main.py 网关层处理。
"""

import asyncio
import hashlib
import hmac
import os
import ssl
import time
import uuid
from typing import Optional

import httpx

_ssl_ctx = ssl.create_default_context()
if os.environ.get("LOVART_INSECURE_SSL") == "1":
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE

_RETRYABLE = {404, 429, 502, 503}

_http_client_pool: Optional[httpx.AsyncClient] = None
_pool_lock: Optional[asyncio.Lock] = None

async def _get_http_client() -> httpx.AsyncClient:
    global _http_client_pool, _pool_lock
    if _http_client_pool is None:
        if _pool_lock is None:
            _pool_lock = asyncio.Lock()
        async with _pool_lock:
            if _http_client_pool is None:
                limits = httpx.Limits(max_keepalive_connections=50, max_connections=200)
                _http_client_pool = httpx.AsyncClient(verify=_ssl_ctx, limits=limits)
    return _http_client_pool

async def close_http_client() -> None:
    global _http_client_pool
    if _http_client_pool is not None:
        await _http_client_pool.aclose()
        _http_client_pool = None

class LovartError(Exception):
    def __init__(self, message: str, http_status: int = 502, code: int = 0):
        self.message = message
        self.http_status = http_status
        self.code = code
        super().__init__(message)

class LovartClient:
    def __init__(
        self,
        base_url: str,
        access_key: str,
        secret_key: str,
        path_prefix: str = "/v1/openapi",
        timeout: int = 600,
        cf_bm: str = "",
        retries: int = 3,
    ):
        self.base_url = base_url.rstrip("/")
        self.access_key = access_key
        self.secret_key = secret_key
        self.prefix = path_prefix
        self.timeout = timeout
        self.cf_bm = cf_bm
        self.retries = retries

    def _sign(self, method: str, path: str) -> dict:
        ts = str(int(time.time()))
        sig = hmac.new(
            self.secret_key.encode(),
            f"{method}\n{path}\n{ts}".encode(),
            hashlib.sha256,
        ).hexdigest()
        headers = {
            "X-Access-Key": self.access_key,
            "X-Timestamp": ts,
            "X-Signature": sig,
            "X-Signed-Method": method,
            "X-Signed-Path": path,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LovartRelay/1.0",
        }
        cf_bm = self.cf_bm or os.environ.get("CF_BM", "")
        if cf_bm:
            headers["Cookie"] = f"__cf_bm={cf_bm}"
        return headers

    async def _request(self, method: str, path: str, body=None, params=None) -> dict:
        url = f"{self.base_url}{path}"
        last_err: Optional[Exception] = None
        for attempt in range(self.retries):
            headers = self._sign(method, path)
            headers["Content-Type"] = "application/json"
            try:
                client = await _get_http_client()
                r = await client.request(
                    method, url, params=params, json=body, headers=headers, timeout=self.timeout
                )
            except httpx.HTTPError as e:
                last_err = e
                if attempt < self.retries - 1:
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                raise LovartError(f"连接 Lovart 失败: {e}", 502)

            if r.status_code in _RETRYABLE and attempt < self.retries - 1:
                last_err = RuntimeError(f"HTTP {r.status_code}")
                await asyncio.sleep(2 * (attempt + 1))
                continue
            break

        try:
            data = r.json()
        except Exception:
            if r.status_code >= 400:
                raise LovartError(f"HTTP {r.status_code}: {r.text[:200]}", r.status_code)
            raise LovartError("Lovart 返回非 JSON", 502)

        if r.status_code >= 400:
            msg = _extract_msg(data)
            code = data.get("code", 0) if isinstance(data, dict) else 0
            raise LovartError(msg, r.status_code, code)

        if isinstance(data, dict) and data.get("code", 0) != 0:
            raise LovartError(
                data.get("message", "Unknown error"),
                _biz_code_to_http(data.get("code", 0)),
                data.get("code", 0),
            )

        return data.get("data", data) if isinstance(data, dict) else data

    async def create_project(self, project_type: int = 3) -> str:
        body = {
            "project_id": "",
            "canvas": "",
            "project_cover_list": [],
            "pic_count": 0,
            "project_type": project_type,
        }
        r = await self._request("POST", f"{self.prefix}/project/save", body=body)
        return r.get("project_id", "")

    async def set_mode(self, unlimited: bool) -> dict:
        return await self._request(
            "POST", f"{self.prefix}/mode/set", body={"unlimited": unlimited}
        )

    async def query_mode(self) -> dict:
        return await self._request("POST", f"{self.prefix}/mode/query", body={})

    async def send(
        self,
        prompt: str,
        project_id: str,
        attachments=None,
        thread_id: Optional[str] = None,
        prefer_models=None,
        include_tools=None,
        exclude_tools=None,
        mode: Optional[str] = None,
    ) -> str:
        body = {"prompt": prompt, "project_id": project_id}
        if attachments:
            body["attachments"] = attachments
        if thread_id:
            body["thread_id"] = thread_id
        if mode:
            body["mode"] = mode
        tc = {}
        if prefer_models:
            tc["prefer_tool_categories"] = prefer_models
        if include_tools:
            tc["include_tools"] = include_tools
        if exclude_tools:
            tc["exclude_tools"] = exclude_tools
        if tc:
            body["tool_config"] = tc
        r = await self._request("POST", f"{self.prefix}/chat", body=body)
        return r["thread_id"]

    async def get_status(self, thread_id: str) -> dict:
        return await self._request(
            "GET", f"{self.prefix}/chat/status", params={"thread_id": thread_id}
        )

    async def get_result(self, thread_id: str) -> dict:
        return await self._request(
            "GET", f"{self.prefix}/chat/result", params={"thread_id": thread_id}
        )

    async def confirm(self, thread_id: str) -> dict:
        return await self._request(
            "POST", f"{self.prefix}/chat/confirm", body={"thread_id": thread_id}
        )

    async def upload_file(self, filename: str, content: bytes) -> str:
        path = f"{self.prefix}/file/upload"
        url = f"{self.base_url}{path}"
        last_err: Optional[Exception] = None
        
        for attempt in range(self.retries):
            headers = self._sign("POST", path)
            safe_filename = filename if filename else "image.png"
            files = {"file": (safe_filename, content, "application/octet-stream")}
            
            try:
                client = await _get_http_client()
                r = await client.post(url, files=files, headers=headers, timeout=self.timeout)
            except httpx.HTTPError as e:
                last_err = e
                if attempt < self.retries - 1:
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                raise LovartError(f"上传连接失败: {e}", 502)
            if r.status_code in _RETRYABLE and attempt < self.retries - 1:
                last_err = RuntimeError(f"HTTP {r.status_code}")
                await asyncio.sleep(2 * (attempt + 1))
                continue
            break

        try:
            data = r.json()
        except Exception:
            raise LovartError(f"上传失败 HTTP {r.status_code}: {r.text[:200]}", r.status_code)

        if r.status_code >= 400 or data.get("code", 0) != 0:
            raise LovartError(
                data.get("message", f"上传失败 HTTP {r.status_code}"),
                r.status_code if r.status_code >= 400 else _biz_code_to_http(data.get("code", 0)),
                data.get("code", 0),
            )
        return data["data"]["url"]

def _extract_msg(data) -> str:
    if isinstance(data, dict):
        msg = data.get("message") or data.get("error")
        details = data.get("details", "")
        if msg and details:
            return f"{msg}: {details}"
        if msg:
            return msg if isinstance(msg, str) else str(msg)
    return str(data)

def _biz_code_to_http(code: int) -> int:
    return {
        2011: 409, 
        2012: 402, 
        1429: 429, 
    }.get(code, 502)