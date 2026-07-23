"""删除欠切/过切视频的输出子目录，为重切腾出空间。

智能分割画面.py 带缓存跳过逻辑：输出子目录已存在即整段跳过。
因此重切前必须先删除对应输出子目录。

本脚本复用 analyze_clips 的判定，找出所有需重切 (UNDERCUT/OVERCUT)
的视频，删除其在 OUTPUT_DIR 下的对应子目录。

用法：
  delete_undercut.py <output_dir> <input_dir> [--dry-run]
  --dry-run  只打印将要删除的目录，不实际删除

安全校验：
  - 仅删除 OUTPUT_DIR 下、名称能与 INPUT_DIR 中源视频对应的子目录
  - 不会删除 OUTPUT_DIR 本身，也不会删除任何 .mp4 文件
"""
import shutil
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze_clips import collect_need_retry  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("output_dir")
    ap.add_argument("input_dir")
    ap.add_argument("--dry-run", action="store_true",
                    help="只打印将要删除的目录，不实际删除")
    args = ap.parse_args()

    out_dir = Path(args.output_dir)
    inp_dir = Path(args.input_dir)

    need = collect_need_retry(out_dir, inp_dir)
    if not need:
        print("无需删除任何目录，全部合格。")
        return

    deleted = 0
    for info in need:
        target = out_dir / info["name"]
        if not target.is_dir():
            continue
        if args.dry_run:
            print(f"[DRY-RUN] 将删除: {target}")
        else:
            shutil.rmtree(target, ignore_errors=True)
            print(f"已删除: {target}")
        deleted += 1

    verb = "计划" if args.dry_run else "实际"
    print(f"\n共 {verb}删除 {deleted} 个目录。"
          f"随后可重跑智能分割画面.py（合格目录会被缓存跳过，仅重切这 {deleted} 个）。")


if __name__ == "__main__":
    main()
