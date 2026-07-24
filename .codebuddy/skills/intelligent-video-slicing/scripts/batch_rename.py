#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通用批量命名脚本 (batch_rename.py)
=================================

把 dedup_done_xxx 目录里的 *_clip_NNN.mp4 按"分类映射"重命名为:
    {原目录名}_{分类}_{序号:03d}.mp4
例如:
    dedup_done_glowupwithjennn-..._clip_003.mp4
      -> dedup_done_glowupwithjennn-..._展示脸部状态_001.mp4

用法
----
1) 准备一个映射文件 (JSON)，形如:
   {
     "003": "展示脸部状态",
     "004": "展示脸部状态",
     "005": "手持产品",
     ...
   }
   键 = clip 编号(字符串或整数皆可)，值 = 分类名。

2) 运行:
   python batch_rename.py --dir <视频目录> --map <映射JSON文件> [--dry-run]

参数
----
--dir / -d      视频目录路径 (必须含 *_clip_NNN.mp4)
--map / -m      分类映射 JSON 文件路径
--dry-run       只打印将要执行的改名，不真正改
--prefix        原文件名前缀 (默认 "dedup_done_"，仅用于识别，一般无需改)
--force         即使目标已存在也覆盖 (默认跳过)

特性
----
* 序号按"分类"在该目录内独立自增: 每类从 001 起，已有同名文件则续号。
* 已命名 (不含 _clip_) 的文件会被跳过，不会重复处理。
* 映射里没有的 clip 编号会列出警告，保持不动。
* 同一次运行内，同分类连续编号，避免冲突。
"""

import argparse
import json
import os
import re
import sys

CLIP_RE = re.compile(r"^(.*)_clip_(\d+)\.(mp4|mov|mkv|avi|webm)$", re.IGNORECASE)


def load_map(path):
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    # 归一化键为整数字符串
    return {str(int(k)): str(v) for k, v in raw.items()}


def collect_clips(video_dir):
    """返回 [(原路径, 前缀, clip编号int, 扩展名)]"""
    items = []
    for name in os.listdir(video_dir):
        m = CLIP_RE.match(name)
        if not m:
            continue
        prefix, num, ext = m.group(1), int(m.group(2)), m.group(3)
        items.append((os.path.join(video_dir, name), prefix, num, ext))
    items.sort(key=lambda x: x[2])
    return items


def already_renamed(name):
    return "_clip_" not in name


def sanitize_category(name: str) -> str:
    """清理分类名：去掉 Windows 非法字符，避免路径解析失败。"""
    # Windows 文件名非法字符: < > : " / \ | ? *
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name).strip()


def next_index(video_dir, prefix, category, existing_targets):
    """找该分类下下一个可用序号 (避免与目录内已有文件及本次已占用冲突)。"""
    idx = 1
    # 先看目录里已有的同类文件
    for name in os.listdir(video_dir):
        m = re.match(re.escape(prefix) + r"_" + re.escape(category) + r"_(\d+)\.", name)
        if m:
            idx = max(idx, int(m.group(1)) + 1)
    # 再看本次运行已占用的
    while f"{prefix}_{category}_{idx:03d}" in existing_targets:
        idx += 1
    return idx


def main():
    ap = argparse.ArgumentParser(description="通用 clip 批量命名脚本")
    ap.add_argument("-d", "--dir", required=True, help="视频目录")
    ap.add_argument("-m", "--map", required=True, help="分类映射 JSON 文件")
    ap.add_argument("--dry-run", action="store_true", help="只打印不执行")
    ap.add_argument("--force", action="store_true", help="覆盖已存在目标")
    args = ap.parse_args()

    video_dir = args.dir
    if not os.path.isdir(video_dir):
        print(f"[错误] 目录不存在: {video_dir}")
        sys.exit(1)

    cat_map = load_map(args.map)
    clips = collect_clips(video_dir)

    if not clips:
        print(f"[提示] 在 {video_dir} 未找到 *_clip_NNN.* 文件 (可能已全部命名完成)")
        sys.exit(0)

    used_targets = set()
    plan = []  # (src, dst)
    warned = []

    for src, prefix, num, ext in clips:
        key = str(num)
        if key not in cat_map:
            warned.append(os.path.basename(src))
            continue
        category = sanitize_category(cat_map[key])
        idx = next_index(video_dir, prefix, category, used_targets)
        base = f"{prefix}_{category}_{idx:03d}"
        dst = os.path.join(video_dir, base + "." + ext.lower())
        if os.path.exists(dst) and not args.force:
            # 目标已存在，尝试下一个序号
            while os.path.exists(os.path.join(video_dir, f"{prefix}_{category}_{idx:03d}.{ext.lower()}")) or \
                  f"{prefix}_{category}_{idx:03d}" in used_targets:
                idx += 1
            dst = os.path.join(video_dir, f"{prefix}_{category}_{idx:03d}.{ext.lower()}")
        used_targets.add(f"{prefix}_{category}_{idx:03d}")
        plan.append((src, dst))

    print(f"目录: {video_dir}")
    print(f"映射条目: {len(cat_map)}  待处理 clip: {len(plan)}  无映射跳过: {len(warned)}")
    print("-" * 60)
    for src, dst in plan:
        print(f"  {os.path.basename(src)}  ->  {os.path.basename(dst)}")
    if warned:
        print("-" * 60)
        print(f"[警告] 以下文件在映射中无对应分类，已跳过:")
        for w in warned:
            print(f"    {w}")

    if args.dry_run:
        print("-" * 60)
        print("[DRY-RUN] 未做实际修改")
        return

    if not plan:
        print("[提示] 无可执行改名")
        return

    for src, dst in plan:
        os.rename(src, dst)
    print("-" * 60)
    print(f"[完成] 已重命名 {len(plan)} 个文件")


if __name__ == "__main__":
    main()
