"""批量提取每个 clip 的 3 帧（首/中/尾）为 jpg，供 AI 视觉分类使用。

用法:
    python extract_frames.py <clips_dir> [frames_dir]

- clips_dir: 含 *.mp4 的切片目录 (或任意含 mp4 的目录)
- frames_dir: 截图输出目录，默认 <clips_dir>_frames
每个 clip 产出 3 张图: <stem>_f0.jpg(首) _f1.jpg(中) _f2.jpg(尾)
"""
import subprocess
import sys
from pathlib import Path


def get_duration(clip: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(clip)],
        capture_output=True, text=True, timeout=30
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def extract(clip: Path, out_dir: Path):
    dur = get_duration(clip)
    if dur <= 0:
        stamps = [0.0, 0.0, 0.0]
    else:
        stamps = [0.0, dur / 2.0, max(0.0, dur - 0.1)]
    for i, ts in enumerate(stamps):
        out_path = out_dir / f"{clip.stem}_f{i}.jpg"
        subprocess.run(
            ["ffmpeg", "-y", "-ss", f"{ts:.3f}", "-i", str(clip),
             "-frames:v", "1", "-q:v", "2", str(out_path)],
            capture_output=True, text=True, timeout=60
        )


def main():
    if len(sys.argv) < 2:
        print("Usage: extract_frames.py <clips_dir> [frames_dir]")
        sys.exit(1)

    clips_dir = Path(sys.argv[1])
    frames_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else \
        Path(str(clips_dir) + "_frames")
    frames_dir.mkdir(parents=True, exist_ok=True)

    clips = sorted(clips_dir.glob("*.mp4"))
    if not clips:
        print(f"未找到 mp4: {clips_dir}")
        sys.exit(1)

    for clip in clips:
        extract(clip, frames_dir)

    print(f"已为 {len(clips)} 个片段生成 {len(clips)*3} 张截图 -> {frames_dir}")


if __name__ == "__main__":
    main()
