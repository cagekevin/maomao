"""一键删除所有由 extract_frames.py 生成的截图目录。

用法:
    python cleanup_frames.py <frames_dir>

仅删除传入的 frames_dir 整个目录，不碰源视频。
需人类确认后再运行。
"""
import sys
import shutil
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print("Usage: cleanup_frames.py <frames_dir>")
        sys.exit(1)

    frames_dir = Path(sys.argv[1])
    if not frames_dir.exists():
        print(f"目录不存在: {frames_dir}")
        sys.exit(1)

    # 防御性检查：必须是 *_frames 结尾，避免误删视频目录
    if not frames_dir.name.endswith("_frames"):
        print(f"拒绝删除：目录名必须以 _frames 结尾 ({frames_dir.name})")
        sys.exit(1)

    shutil.rmtree(frames_dir)
    print(f"已删除截图目录: {frames_dir}")


if __name__ == "__main__":
    main()
