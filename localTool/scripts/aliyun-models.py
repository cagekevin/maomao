#!/usr/bin/env python3
"""
aliyun-models.py — 把 runtime-models 二进制打包成 zip 镜像到阿里云盘（资源盘）

背景
----
localTool/runtime-models/<tool> 下的模型权重(.onnx) + 推理运行时(.wasm/.js)
约 470MB，不入库（见 docs/95）。HuggingFace / jsDelivr CDN 在部分网络下不稳，
因此把整套资源压成 <tool>.zip 放到阿里云盘资源盘；换机一条命令下载解压即可。
zip 内结构: depth-video/models/... 与 depth-video/vendor/...
解压到 localTool/runtime-models/ 即还原。sha256 一致性由
fetch-runtime-models.mjs 的 MANIFEST 兜底校验。

依赖
----
  pip install aligo
  首次运行会弹二维码扫码登录；登录态持久化在 ~/.aligo，之后免登录。
  登录即用你现有 aliyun.py 那套约定：默认切到「资源盘」(resource_drive_id)。

用法
----
  python aliyun-models.py login            # 仅触发扫码登录（持久化后免登）
  python aliyun-models.py upload [tool]    # 打包 + 上传 <tool>.zip（默认 depth-video）
  python aliyun-models.py download [tool]  # 下载 <tool>.zip 并解压到 runtime-models/
  python aliyun-models.py ls               # 列出资源盘 /runtime-models 下文件
  python aliyun-models.py reset            # 清空资源盘 /runtime-models（删除零散旧文件）

云盘结构
--------
  资源盘 /runtime-models/<tool>.zip        （解压后 = 本机 localTool/runtime-models/<tool>/）
"""
import os
import sys
import zipfile
from pathlib import Path

from aligo import Aligo

HERE = Path(__file__).resolve().parent
RUNTIME_ROOT = HERE.parent / 'runtime-models'      # localTool/runtime-models
REMOTE_BASE = '/runtime-models'                     # 资源盘根目录


def make_ali():
    ali = Aligo(level=30)
    try:
        u = ali.v2_user_get()
        if getattr(u, 'resource_drive_id', None):
            ali.default_drive_id = u.resource_drive_id
            print(f'ℹ️ 操作盘: 资源盘 ({u.resource_drive_id})')
        else:
            print('⚠️ 未拿到 resource_drive_id，使用默认盘')
    except Exception as e:
        print('⚠️ 切资源盘失败，使用默认盘:', e)
    return ali


def _ensure_base(ali):
    folder = ali.get_folder_by_path(REMOTE_BASE)
    if folder:
        return folder.file_id
    parent_id = 'root'
    for part in REMOTE_BASE.strip('/').split('/'):
        cur = None
        for f in ali.get_file_list(parent_id):
            if f and getattr(f, 'type', None) == 'folder' and f.name == part:
                cur = f
                break
        if cur is None:
            cur = ali.create_folder(part, parent_file_id=parent_id)
        parent_id = cur.file_id
    return parent_id


def _make_zip(tool):
    """把 localTool/runtime-models/<tool> 压成 <tool>.zip（含 depth-video/... 结构）。"""
    base = RUNTIME_ROOT / tool
    if not base.exists():
        print(f'❌ 本地目录不存在: {base}')
        sys.exit(1)
    zip_path = RUNTIME_ROOT / f'{tool}.zip'
    print(f'🗜️  打包 {base} → {zip_path} ...')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(base):
            for f in files:
                fp = Path(root) / f
                arcname = fp.relative_to(RUNTIME_ROOT)
                z.write(fp, arcname)
    print(f'✅ 打包完成: {zip_path.stat().st_size/1e6:.1f} MB')
    return zip_path


def upload(tool='depth-video'):
    ali = make_ali()
    zip_path = _make_zip(tool)
    base_id = _ensure_base(ali)
    name = f'{tool}.zip'
    for f in ali.get_file_list(base_id):
        if f and getattr(f, 'type', None) == 'file' and f.name == name and (f.size or 0) == zip_path.stat().st_size:
            print(f'ℹ️ 云端已存在同大小 {name}，跳过')
            return
    ali.upload_file(str(zip_path), parent_file_id=base_id)
    print(f'✅ 上传完成: /runtime-models/{name}')


def download(tool='depth-video'):
    ali = make_ali()
    base_id = _ensure_base(ali)
    name = f'{tool}.zip'
    found = None
    for f in ali.get_file_list(base_id):
        if f and getattr(f, 'type', None) == 'file' and f.name == name:
            found = f
            break
    if not found:
        print(f'❌ 云端没有 {name}，请先 upload')
        return
    zip_path = RUNTIME_ROOT / name
    if zip_path.exists() and zip_path.stat().st_size == (found.size or 0):
        print(f'ℹ️ 本地已存在同大小 {name}，直接解压')
    else:
        ali.download_file(file=found, local_folder=str(RUNTIME_ROOT))
        print(f'📥 已下载 {name}')
    print(f'📦 解压到 {RUNTIME_ROOT} ...')
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(str(RUNTIME_ROOT))
    print(f'✅ 解压完成。建议跑: node localTool/scripts/fetch-runtime-models.mjs {tool} --check')


def ls_remote():
    ali = make_ali()
    base_id = _ensure_base(ali)
    for f in ali.get_file_list(base_id):
        if f:
            t = '📁' if getattr(f, 'type', None) == 'folder' else '📄'
            print(f'  {t} {f.name}  {f.size or 0}')


def reset():
    ali = make_ali()
    folder = ali.get_folder_by_path(REMOTE_BASE)
    if not folder:
        print('ℹ️ /runtime-models 不存在，无需清理')
        return
    ali.move_file_to_trash(folder.file_id)
    print('🗑️  已把 /runtime-models 移入回收站（云端文件不立即删，可在 App 回收站恢复）')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    try:
        if cmd == 'login':
            make_ali()
            print('✅ 登录成功（如已扫码）；登录态已持久化')
        elif cmd == 'upload':
            upload(sys.argv[2] if len(sys.argv) > 2 else 'depth-video')
        elif cmd == 'download':
            download(sys.argv[2] if len(sys.argv) > 2 else 'depth-video')
        elif cmd == 'ls':
            ls_remote()
        elif cmd == 'reset':
            reset()
        else:
            print(f'未知命令: {cmd}')
    except KeyboardInterrupt:
        print('\n已取消')
