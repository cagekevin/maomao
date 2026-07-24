"""
好莱坞级 3D 切片引擎 (全功能集结·控制台版)
专治“背景不动人在动”的跳剪，帧级精准，无花屏，GPU满血并发加速。
修复了时间膨胀 Bug，并在顶部暴露了核心调参区。
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

from scenedetect import open_video, SceneManager
from scenedetect.detectors import AdaptiveDetector, ContentDetector
from tqdm import tqdm

# ================= 🎬 核心调参控制台 (导演专属) =================
DEFAULT_INPUT_DIR = "./inputs"      # 📁 默认输入母盘目录
DEFAULT_OUTPUT_DIR = "./outputs"    # 📁 默认输出轨道目录

# ✂️ 核心视觉雷达
DETECTOR_MODE = "adaptive"              # 视觉雷达模式: "hsv" = HSV 色彩直方图(人物动作连续不误切); "adaptive" = 灰度自适应(纯静止背景明暗突变)
DEFAULT_THRESHOLD = 12             # 跳剪灵敏度 (2.0~5.0，数值越大越迟钝。如果23秒被切得太碎，请调高至 3.5 或 4.0)
DEFAULT_MIN_SCENE_LEN = 2         # ⏱️ 最小防碎帧安全锁 (秒)。低于0.5秒的局部闪动(如眨眼)会被无视

# 💎 编码与画质基准 (剪映/PR 专供)
DEFAULT_CQ = 18                     # 视觉无损画质甜点 (建议18-20，再低体积暴增，再高画质发糊)
DEFAULT_GOP = 30                    # 关键帧间隔 (设为30保证在剪辑软件里拖拽丝滑不卡顿)
DEFAULT_B_FRAMES = 2                # 限制 B 帧数量，降低剪辑软件解码压力

# 🚀 算力调配
DEFAULT_WORKERS = 0                 # 并发路数 (0 = 自动接管，榨干当前 GPU/CPU)
# ================================================================

print_lock = Lock()


def detect_encoder():
    """雷达探测：寻找 NVIDIA GPU 加速"""
    try:
        res = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        if "h264_nvenc" in res.stdout + res.stderr:
            return "h264_nvenc"
    except Exception:
        pass
    return "libx264"


def split_video_frame_accurate(input_path: str, scenes: list, output_dir: str, video_stem: str, encoder: str):
    """
    FFmpeg 物理切割台 (时间轴绝对精准版)
    - 强制使用 -t duration 锁定切片物理时长，彻底修复时间膨胀 Bug。
    - -fps_mode cfr 修复手机变帧率素材引发的切片音画脱节。
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    clips = []
    for idx, (start, end) in enumerate(scenes):
        start_ts = start.get_timecode()
        
        # 🎯 物理时长计算，精确到毫秒
        duration = end.get_seconds() - start.get_seconds()
        duration_str = f"{duration:.3f}"

        clip_name = f"{video_stem}_clip_{idx:03d}.mp4"
        clip_path = output_dir / clip_name

        if duration < DEFAULT_MIN_SCENE_LEN:
            continue

        cmd = [
            "ffmpeg", "-y", "-nostdin",
            "-ss", start_ts,
            "-i", str(input_path),
            "-t", duration_str,       # 锁死绝对时长
            "-fps_mode", "cfr"        # 强制恒定帧率防脱节
        ]

        if encoder == "h264_nvenc":
            cmd.extend([
                "-c:v", "h264_nvenc", 
                "-preset", "p6", 
                "-tune", "hq", 
                "-cq", str(DEFAULT_CQ), 
                "-b:v", "0",
                "-g", str(DEFAULT_GOP),    
                "-bf", str(DEFAULT_B_FRAMES)     
            ])
        else:
            cmd.extend([
                "-c:v", "libx264", 
                "-preset", "superfast", 
                "-crf", str(DEFAULT_CQ),
                "-g", str(DEFAULT_GOP),
                "-bf", str(DEFAULT_B_FRAMES)
            ])

        cmd.extend(["-c:a", "aac", "-b:a", "192k", str(clip_path)])

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            clips.append(clip_path)
        except subprocess.CalledProcessError as e:
            with print_lock:
                print(f"\n  ❌ 切片失败 {clip_name}: {e.stderr}")

    return clips


def detect_jump_cuts(video_path: str, threshold: float, min_scene_len: float):
    """视觉雷达调度：根据顶部 DETECTOR_MODE 选择灰度自适应或 HSV 色彩检测"""
    video = open_video(video_path)
    scene_manager = SceneManager()
    min_frames = int(min_scene_len * video.frame_rate)

    if DETECTOR_MODE == "hsv":
        # 🎯 HSV 色彩内容雷达：人物肤色在 HSV 空间连续，挥手不会被误判为切镜，
        # 只有姿态发生“瞬间断层位移(Jump Cut)”时直方图才突变触发切割。
        detector = ContentDetector(
            threshold=threshold,
            min_scene_len=min_frames
        )
    else:
        # 灰度自适应雷达：忽略颜色干扰，专盯明暗突变（适合纯静止背景）。
        detector = AdaptiveDetector(
            adaptive_threshold=threshold,
            min_scene_len=min_frames,
            luma_only=True
        )

    scene_manager.add_detector(detector)
    scene_manager.detect_scenes(video, show_progress=False)
    return scene_manager.get_scene_list()


def process_video_pipeline(input_path: Path, output_base: str, threshold: float, min_scene_len: float, encoder: str):
    """单轨处理流水线"""
    video_stem = input_path.stem
    output_dir = Path(output_base) / video_stem

    if output_dir.exists() and any(output_dir.glob("*.mp4")):
        return len(list(output_dir.glob("*.mp4")))

    try:
        scenes = detect_jump_cuts(str(input_path), threshold, min_scene_len)
    except Exception:
        return 0

    if len(scenes) <= 1:
        output_dir.mkdir(parents=True, exist_ok=True)
        clip_path = output_dir / f"{video_stem}_clip_000.mp4"
        cmd = ["ffmpeg", "-y", "-i", str(input_path), "-c:v", "copy", "-c:a", "copy", str(clip_path)]
        subprocess.run(cmd, capture_output=True)
        return 1

    clips = split_video_frame_accurate(str(input_path), scenes, str(output_dir), video_stem, encoder)
    return len(clips)


def main():
    # 允许命令行传参，如果没传，则默认读取顶部的控制台配置
    parser = argparse.ArgumentParser(description="好莱坞级 3D 切片引擎 (全功能集结·控制台版)")
    parser.add_argument("--input", default=DEFAULT_INPUT_DIR, help="目标素材母盘目录")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_DIR, help="输出轨道路径")
    parser.add_argument("-t", "--threshold", type=float, default=DEFAULT_THRESHOLD, help="跳剪捕捉灵敏度")
    parser.add_argument("--min-scene-len", type=float, default=DEFAULT_MIN_SCENE_LEN, help="防碎帧安全锁时长/秒")
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS, help="并发数")
    parser.add_argument("--pattern", default="*.mp4", help="格式锁定")

    args = parser.parse_args()
    input_dir = Path(args.input)
    
    # 自动创建输入输出目录
    input_dir.mkdir(parents=True, exist_ok=True)
    
    video_files = sorted(input_dir.glob(args.pattern))
    if not video_files:
        print(f"⚠️ 在 {input_dir} 目录下未找到任何匹配的视频素材！")
        sys.exit(1)

    encoder = detect_encoder()
    print(f"🎬 引擎点火：探测到 {len(video_files)} 个素材")
    print(f"⚙️ 渲染器锁定：{'NVIDIA NVENC (全火力硬件加速)' if encoder == 'h264_nvenc' else 'CPU 备用模式'}")
    print(f"📐 当前灵敏度：{args.threshold} (切得太碎请调高，没切开请调低)")

    cpu_count = os.cpu_count() or 4
    workers = args.workers if args.workers > 0 else min(4, cpu_count)
    print(f"🔥 并发路数锁定：{workers} 线程同步切割\n" + "="*50)

    total_clips = 0
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                process_video_pipeline, vf, args.output, args.threshold, args.min_scene_len, encoder
            ): vf for vf in video_files
        }
        
        for future in tqdm(as_completed(futures), total=len(video_files), desc="🎞️ 总体进度"):
            try:
                clips_count = future.result()
                total_clips += clips_count
            except Exception as e:
                with print_lock:
                    print(f"\n❌ 素材崩盘 {futures[future].name}: {str(e)}")

    print("="*50 + f"\n🎉 Cut！全片切割完毕，共计爆出 {total_clips} 个帧级精准的独立分镜！")

if __name__ == "__main__":
    main()