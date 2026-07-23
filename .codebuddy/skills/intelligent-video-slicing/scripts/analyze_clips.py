"""分析切片质量脚本：统计每个视频的 clip 数量与时长，标记需要重切的。

判定标准（对齐真实业务需求）：
  - 合格 (OK)：大多数 clip 落在 4~8s，且不含 >12s 的“一刀没切”硬伤片段。
  - 欠切 (UNDERCUT)：长原片只切出极少段，导致 avg 远超 8s；或出现任何 >12s 的
    硬伤片段（固定机位静止镜头检测不出跳变，需降阈值重试）。
  - 过切 (OVERCUT)：avg 不足 2s（切太碎），需升阈值重试。

用法：
  analyze_clips.py <output_dir> <input_dir> [--max-sec 12] [--ideal-low 4] [--ideal-high 8]
输出每个视频的 clips 数、总时长、平均时长、源时长，并标记状态。
退出码：0 = 全部合格；1 = 存在需重切项。

作为模块导入时，可调用 classify_video() 与 collect_need_retry() 复用判定逻辑。
"""
import subprocess
import json
import sys
import argparse
from pathlib import Path

# 判定阈值
MAX_HARD_SEC = 12.0      # 单片段超过此值视为“一刀没切”硬伤
IDEAL_LOW = 4.0          # 理想区间下限
IDEAL_HIGH = 8.0         # 理想区间上限
OVERCUT_AVG = 2.0        # 平均时长低于此值视为过切
UNDERCUT_AVG = 8.0       # 平均时长高于此值视为欠切


def get_duration(filepath: Path) -> float:
    """通过 ffprobe 获取媒体时长 (秒)"""
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "json", str(filepath)],
        capture_output=True, text=True,
        timeout=30
    )
    try:
        return float(json.loads(r.stdout)["format"]["duration"])
    except Exception:
        return 0.0


def classify_video(clips_dir: Path, src_duration: float,
                   max_sec=MAX_HARD_SEC, ideal_low=IDEAL_LOW,
                   ideal_high=IDEAL_HIGH) -> dict:
    """对单个视频目录做质量判定，返回结构化结果。

    返回字段：
      name, clips(数量), total, avg, src, hard(最长硬伤秒数或None), flag
      flag: "" / "UNDERCUT" / "OVERCUT"
    """
    clips = sorted(clips_dir.glob("*.mp4"))
    n = len(clips)
    durations = [get_duration(c) for c in clips]
    total = sum(durations)
    avg = total / n if n else 0.0
    hard_list = [du for du in durations if du > max_sec]
    hard = max(hard_list) if hard_list else None

    flag = ""
    if n <= 1 or avg > UNDERCUT_AVG or hard is not None:
        flag = "UNDERCUT"
    elif avg < OVERCUT_AVG and n > 2:
        flag = "OVERCUT"

    return {
        "name": clips_dir.name, "clips": n, "total": total,
        "avg": avg, "src": src_duration, "hard": hard, "flag": flag,
    }


def collect_need_retry(out_dir: Path, inp_dir: Path,
                       max_sec=MAX_HARD_SEC) -> list:
    """遍历输出目录，收集所有需重切的视频信息列表。"""
    need = []
    for d in sorted(out_dir.iterdir()):
        if not d.is_dir():
            continue
        if not any(d.glob("*.mp4")):
            continue
        src = get_duration(inp_dir / (d.name + ".mp4"))
        info = classify_video(d, src, max_sec=max_sec)
        if info["flag"]:
            need.append(info)
    return need


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("output_dir")
    ap.add_argument("input_dir")
    ap.add_argument("--max-sec", type=float, default=MAX_HARD_SEC)
    ap.add_argument("--ideal-low", type=float, default=IDEAL_LOW)
    ap.add_argument("--ideal-high", type=float, default=IDEAL_HIGH)
    args = ap.parse_args()

    out_dir = Path(args.output_dir)
    inp_dir = Path(args.input_dir)

    print(f"{'video':45} {'clips':>5} {'total':>7} {'avg':>7} {'src':>7}  flag")
    print("-" * 90)

    need = []
    ok_count = 0
    for d in sorted(out_dir.iterdir()):
        if not d.is_dir():
            continue
        if not any(d.glob("*.mp4")):
            continue
        src = get_duration(inp_dir / (d.name + ".mp4"))
        info = classify_video(d, src, max_sec=args.max_sec,
                              ideal_low=args.ideal_low, ideal_high=args.ideal_high)
        note = f"hard={info['hard']:.1f}s" if info["hard"] is not None else ""
        print(f"{info['name']:45} {info['clips']:5d} {info['total']:7.1f} "
              f"{info['avg']:7.1f} {info['src']:7.1f}  {info['flag']} {note}")
        if info["flag"]:
            need.append(info)
        else:
            ok_count += 1

    print(f"\n合格: {ok_count}  需重切: {len(need)}")
    if need:
        print("需重切列表:")
        for info in need:
            extra = f"最长段 {info['hard']:.1f}s" if info["hard"] is not None else f"avg {info['avg']:.1f}s"
            print(f"  - {info['name']}  [{info['flag']}] {extra}")
    return need


if __name__ == "__main__":
    result = main()
    sys.exit(0 if not result else 1)
