#!/usr/bin/env python3
"""
aliyun-models.py — 把 runtime-models 二进制打包成 zip 镜像到阿里云盘（资源盘）

背景
----
localTool/runtime-models/<tool>/ 下的模型资产（权重 / 推理运行时 / 模型文件）不入库
（规则见 localTool/.gitignore，体系规范见 docs/plan/147）。离线还原靠本脚本：
把整个 <tool>/ 压成 <tool>.zip 放到阿里云盘资源盘，换机一条命令下载解压即可。
zip 内结构: <tool>/...（相对 localTool/runtime-models/），extractall 到该目录即还原。
sha256 一致性由 fetch-runtime-models.mjs 的 MANIFEST 兜底校验。

依赖
----
  pip install aligo
  首次运行会弹二维码扫码登录；登录态持久化在 ~/.aligo，之后免登录。
  登录即用你现有 aliyun.py 那套约定：默认切到「资源盘」(resource_drive_id)。

用法
----
  python aliyun-models.py login              # 仅触发扫码登录（持久化后免登）
  python aliyun-models.py upload [tool]      # 打包 + 上传 <tool>.zip（默认 depth-video）
  python aliyun-models.py download [tool]    # 下载 <tool>.zip 并解压到 runtime-models/
  python aliyun-models.py download all       # ★ 一次还原云端全部模型包（换机就这一条）
  python aliyun-models.py ls                 # 列出资源盘 /runtime-models 下文件
  python aliyun-models.py reset              # 清空资源盘 /runtime-models（删除零散旧文件）

云盘结构
--------
  资源盘 /runtime-models/<tool>.zip        （解压后 = 本机 localTool/runtime-models/<tool>/）
"""
import os
import sys
import zipfile
from pathlib import Path

try:
    from aligo import Aligo
except ModuleNotFoundError:
    # 可见失败 + 指路（禁裸 traceback 甩给用户：本脚本的全部能力都依赖它）
    print('❌ 缺少依赖 aligo —— 先跑: pip install aligo')
    print('   （装完再跑一次: python localTool/scripts/aliyun-models.py login  ← 扫码，登录态持久化在 ~/.aligo/）')
    sys.exit(1)

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


def _list_remote_zips(ali, base_id):
    """列出资源盘 /runtime-models 下所有 <模型名>.zip（按名排序，输出稳定）。"""
    return sorted(
        (f for f in ali.get_file_list(base_id)
         if f and getattr(f, 'type', None) == 'file' and f.name.endswith('.zip')),
        key=lambda f: f.name,
    )


def _fetch_and_extract(ali, remote_file, name):
    """下载并以 zip 内 `<模型名>/...` 结构解压到 RUNTIME_ROOT（本地已有同大小的包则跳过下载只解压）。"""
    zip_path = RUNTIME_ROOT / name
    if zip_path.exists() and zip_path.stat().st_size == (remote_file.size or 0):
        print(f'ℹ️ 本地已存在同大小 {name}，直接解压')
    else:
        ali.download_file(file=remote_file, local_folder=str(RUNTIME_ROOT))
        print(f'📥 已下载 {name}')
    print(f'📦 解压到 {RUNTIME_ROOT} ...')
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(str(RUNTIME_ROOT))
    print(f'✅ {name} 解压完成')


def download(tool='depth-video'):
    """还原**单个**模型（`<tool>.zip` → `runtime-models/<tool>/`）。"""
    ali = make_ali()
    base_id = _ensure_base(ali)
    name = f'{tool}.zip'
    found = next((f for f in _list_remote_zips(ali, base_id) if f.name == name), None)
    if not found:
        print(f'❌ 云端没有 {name}，请先 upload（或跑 download all 看云端都有什么）')
        return
    _fetch_and_extract(ali, found, name)
    print(f'建议跑校验: node localTool/scripts/runtime-model.mjs doctor {tool}')


def download_all():
    """**一次还原全部模型** —— 云端每个 `<模型名>.zip` 逐个下载解压。

    为什么需要它：网盘是按 `<模型名>.zip` 分开存的，换机要还原 N 个模型就得敲 N 条 download。
    它**不猜模型清单** —— 云端有什么就还原什么（云端即真相）；本地已有同大小的包会跳过下载、只解压。
    """
    ali = make_ali()
    base_id = _ensure_base(ali)
    zips = _list_remote_zips(ali, base_id)
    if not zips:
        print('❌ 云端 /runtime-models 下没有任何 <模型名>.zip')
        print('   请先在装有模型的那台机器上跑: python localTool/scripts/aliyun-models.py upload <模型名>')
        return
    print(f'云端共 {len(zips)} 个模型包：' + '、'.join(f.name for f in zips) + '\n')
    for f in zips:
        _fetch_and_extract(ali, f, f.name)
    print('\n全部解压完成。**校验（唯一的防损坏防线）**：')
    print('  node localTool/scripts/runtime-model.mjs doctor')


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
            arg = sys.argv[2] if len(sys.argv) > 2 else 'depth-video'
            if arg == 'all':
                download_all()
            else:
                download(arg)
        elif cmd == 'ls':
            ls_remote()
        elif cmd == 'reset':
            reset()
        else:
            print(f'未知命令: {cmd}')
    except KeyboardInterrupt:
        print('\n已取消')
