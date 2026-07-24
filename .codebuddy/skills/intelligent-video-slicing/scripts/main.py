#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能视频切片引擎 —— 统一入口（深模块 / Deep Module）

使用者只需记住四个高层命令，无需了解 scripts/ 下 6 个内部脚本如何协作：

  cut     自动切片 + 分析 + 调参 + 重跑，直到收敛（每段 4~8 秒）
  frames  为切片批量抽帧（供人工视觉分类）
  rename  按类别映射 JSON 批量改名
  cleanup 清理抽帧目录（会要求二次确认）

所有内部实现细节都隐藏在 scripts/ 下的子脚本中，本文件只做编排，
且所有子脚本路径都相对本文件定位，因此整个 skill 目录可整体迁移。
"""
import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

# 复用 analyze_clips 的判定函数（仅 import 常量与纯函数，无副作用）
from analyze_clips import collect_need_retry  # noqa: E402

# 阈值边界（对齐 SKILL 实战经验）
THRESH_LOW = 1.5
THRESH_HIGH = 12.0


def _run(script: str, *args) -> int:
    """在 scripts/ 目录内执行一个内部脚本"""
    cmd = [sys.executable, str(HERE / script), *args]
    return subprocess.run(cmd).returncode


def cmd_cut(input_dir, output_dir, threshold=3.0, min_scene_len=2, max_retry=3):
    """Step 1-4：自动切片并调参重跑直到收敛"""
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)
    thr = float(threshold)
    msl = int(min_scene_len)

    print(f"[cut] 输入={input_dir}")
    print(f"[cut] 输出={output_dir}")
    print(f"[cut] 初始阈值={thr}  最小镜头={msl}s  最大重试={max_retry}")

    for attempt in range(1, max_retry + 1):
        print(f"\n===== 第 {attempt}/{max_retry} 轮切片 =====")
        _run("智能分割画面.py", "--input", str(input_dir),
             "--output", str(output_dir), "-t", str(thr),
             "--min-scene-len", str(msl))

        need = collect_need_retry(output_dir, input_dir)
        if not need:
            print("\n[cut] ✅ 全部视频已合格，收敛完成。")
            return 0

        has_under = any(i["flag"] == "UNDERCUT" for i in need)
        has_over = any(i["flag"] == "OVERCUT" for i in need)

        next_thr = thr
        if has_under:
            next_thr = max(THRESH_LOW, thr * 0.7)
        elif has_over:
            next_thr = min(THRESH_HIGH, thr * 1.5)

        max_src = max((i["src"] for i in need), default=0.0)
        next_msl = 2 if max_src <= 30 else 4

        print(f"[cut] 需重切 {len(need)} 个；"
              f"{'欠切→降阈值' if has_under else ('过切→升阈值' if has_over else '维持')} "
              f"{thr}→{round(next_thr, 2)}，min_scene_len {msl}→{next_msl}")

        # 删除需重切目录（智能分割画面.py 有缓存跳过，必须删后才重切）
        _run("delete_undercut.py", str(output_dir), str(input_dir))

        thr = round(next_thr, 2)
        msl = next_msl

    print(f"\n[cut] ⚠️ 已达 {max_retry} 次重试上限或阈值触限，停止。"
          f"剩余不合格视频见上方分析，可人工判定是否为固定机位静止镜头硬伤（SKILL 踩坑2）。")
    return 1


def cmd_frames(clips_dir, frames_dir=None):
    """Step 5.1：批量抽帧"""
    clips_dir = Path(clips_dir)
    if frames_dir:
        _run("extract_frames.py", str(clips_dir), str(frames_dir))
        return
    # 若传入的是总输出目录（含多个切片子目录），逐个子目录抽帧
    sub_dirs = [d for d in sorted(clips_dir.iterdir())
                if d.is_dir() and any(d.glob("*.mp4"))]
    if sub_dirs and not any(clips_dir.glob("*.mp4")):
        print(f"[frames] 检测到 {len(sub_dirs)} 个切片子目录，逐个抽帧")
        for d in sub_dirs:
            _run("extract_frames.py", str(d))
    else:
        _run("extract_frames.py", str(clips_dir))


def cmd_rename(clips_dir, map_json, dry_run=False, force=False):
    """Step 5.2：按映射改名"""
    args = ["-d", str(clips_dir), "-m", str(map_json)]
    if dry_run:
        args.append("--dry-run")
    if force:
        args.append("--force")
    _run("batch_rename.py", *args)


def cmd_cleanup(frames_dir):
    """Step 5.3：清理抽帧目录（需二次确认）"""
    frames_dir = Path(frames_dir)
    if not frames_dir.name.endswith("_frames"):
        print(f"[cleanup] 拒绝：目录名必须以 _frames 结尾 ({frames_dir.name})")
        return 1
    ans = input(f"[cleanup] 确认删除整个截图目录？\n  {frames_dir}\n输入 yes 继续：").strip().lower()
    if ans != "yes":
        print("[cleanup] 已取消。")
        return 0
    _run("cleanup_frames.py", str(frames_dir))
    return 0


def main():
    ap = argparse.ArgumentParser(
        description="智能视频切片引擎 - 统一入口（深模块）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_cut = sub.add_parser("cut", help="自动切片并收敛 (4~8s/段)")
    p_cut.add_argument("--input", required=True, help="源视频母盘目录")
    p_cut.add_argument("--output", required=True, help="输出目录")
    p_cut.add_argument("-t", "--threshold", type=float, default=3.0,
                       help="初始灵敏度(1.5~12)，默认 3.0")
    p_cut.add_argument("--min-scene-len", type=float, default=2,
                       help="最小镜头长度(秒)，默认 2")
    p_cut.add_argument("--max-retry", type=int, default=3,
                       help="最大重切轮数，默认 3")

    p_frames = sub.add_parser("frames", help="批量抽帧")
    p_frames.add_argument("clips_dir", help="切片目录或总输出目录")
    p_frames.add_argument("--frames-dir", default=None,
                          help="截图输出目录(默认 <clips_dir>_frames)")

    p_rename = sub.add_parser("rename", help="按类别映射改名")
    p_rename.add_argument("-d", "--dir", required=True, help="切片目录")
    p_rename.add_argument("-m", "--map", required=True, help="分类映射 JSON")
    p_rename.add_argument("--dry-run", action="store_true", help="只预览不改名")
    p_rename.add_argument("--force", action="store_true", help="覆盖已存在目标")

    p_cleanup = sub.add_parser("cleanup", help="清理抽帧目录(需确认)")
    p_cleanup.add_argument("frames_dir", help="以 _frames 结尾的截图目录")

    args = ap.parse_args()

    if args.cmd == "cut":
        sys.exit(cmd_cut(args.input, args.output,
                         args.threshold, args.min_scene_len, args.max_retry))
    elif args.cmd == "frames":
        cmd_frames(args.clips_dir, args.frames_dir)
    elif args.cmd == "rename":
        cmd_rename(args.dir, args.map, args.dry_run, args.force)
    elif args.cmd == "cleanup":
        sys.exit(cmd_cleanup(args.frames_dir))


if __name__ == "__main__":
    main()
