#!/usr/bin/env python3
"""compose-nine-shot-storyboard.py — cinema-dna 九镜拼版（macOS / Linux 版）

对应原 scripts/compose-nine-shot-storyboard.ps1，功能完全一致：

  1. 校验正好 9 个源图文件且均可读
  2. 复制源图为 {Prefix}_shot01.png ~ _shot09.png
  3. 生成 3 张纵向三联图（每组 3 镜纵向拼接，单元宽 = CellWidth*2，高按 2.39:1）
  4. 生成 1 张 3x3 九宫格（9 镜按 1→9 从左到右、从上到下排列）
  5. 每张图按比例缩放居中放入格子（不拉伸），黑底 + 黑色呼吸间隔，无文字水印

用法：
  python3 compose-nine-shot-storyboard.py \
      -s shot01.png shot02.png ... shot09.png \
      -o /path/to/output -p story-name [-w 960] [-h 402] [-g 8]

依赖：python3 + Pillow (PIL)。如无 PIL：pip3 install Pillow
"""

import argparse
import math
import shutil
import sys
from pathlib import Path

from PIL import Image

# 默认参数与原 ps1 一致
DEFAULT_CELL_WIDTH = 960
DEFAULT_CELL_HEIGHT = 402
DEFAULT_GAP = 8
RANGE_WIDTH = (320, 3840)
RANGE_HEIGHT = (134, 1607)
RANGE_GAP = (0, 64)
ASPECT = 2.39  # 三联单元按 2.39:1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="cinema-dna 九镜拼版：9 张独立镜头 -> 3 张纵向三联 + 1 张 3x3 九宫格",
        add_help=False,  # -h 保留给 cell-height，help 用 --help
    )
    parser.add_argument("--help", action="help", help="show this help message and exit")
    parser.add_argument(
        "-s", "--sources", nargs="+", required=True,
        help="9 个源图路径（顺序即镜头 1~9）",
    )
    parser.add_argument("-o", "--output-dir", required=True, help="输出目录")
    parser.add_argument("-p", "--prefix", required=True, help="文件名前缀")
    parser.add_argument(
        "-w", "--cell-width", type=int, default=DEFAULT_CELL_WIDTH,
        help=f"九宫格单元宽 [{RANGE_WIDTH[0]},{RANGE_WIDTH[1]}]，默认 {DEFAULT_CELL_WIDTH}",
    )
    parser.add_argument(
        "-h", "--cell-height", type=int, default=DEFAULT_CELL_HEIGHT,
        help=f"九宫格单元高 [{RANGE_HEIGHT[0]},{RANGE_HEIGHT[1]}]，默认 {DEFAULT_CELL_HEIGHT}",
    )
    parser.add_argument(
        "-g", "--gap", type=int, default=DEFAULT_GAP,
        help=f"黑色呼吸间隔像素 [{RANGE_GAP[0]},{RANGE_GAP[1]}]，默认 {DEFAULT_GAP}",
    )
    return parser


def validate(args: argparse.Namespace) -> None:
    if len(args.sources) != 9:
        raise SystemExit(f"ERROR: Exactly 9 source images are required; received {len(args.sources)}.")
    if not re_fullmatch(args.prefix):
        raise SystemExit("ERROR: Prefix must match ^[a-zA-Z0-9_-]+$ .")
    if not (RANGE_WIDTH[0] <= args.cell_width <= RANGE_WIDTH[1]):
        raise SystemExit(f"ERROR: CellWidth must be in [{RANGE_WIDTH[0]}, {RANGE_WIDTH[1]}].")
    if not (RANGE_HEIGHT[0] <= args.cell_height <= RANGE_HEIGHT[1]):
        raise SystemExit(f"ERROR: CellHeight must be in [{RANGE_HEIGHT[0]}, {RANGE_HEIGHT[1]}].")
    if not (RANGE_GAP[0] <= args.gap <= RANGE_GAP[1]):
        raise SystemExit(f"ERROR: Gap must be in [{RANGE_GAP[0]}, {RANGE_GAP[1]}].")
    for src in args.sources:
        if not Path(src).is_file():
            raise SystemExit(f"ERROR: Missing source image: {src}")


def re_fullmatch(s: str) -> bool:
    import re
    return re.fullmatch(r"[a-zA-Z0-9_-]+", s) is not None


def draw_fit(canvas: Image.Image, img: Image.Image, x: int, y: int, w: int, h: int) -> None:
    """按比例缩放居中放入格子，不拉伸画面（对应 ps1 的 Draw-ImageFit）。"""
    scale = min(w / img.width, h / img.height)
    dw = max(1, round(img.width * scale))
    dh = max(1, round(img.height * scale))
    dx = x + (w - dw) // 2
    dy = y + (h - dh) // 2
    canvas.paste(img.resize((dw, dh), Image.LANCZOS), (dx, dy))


def main() -> None:
    args = build_parser().parse_args()
    validate(args)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    prefix = args.prefix
    cell_w = args.cell_width
    cell_h = args.cell_height
    gap = args.gap

    # 1) 读取 9 张源图并复制为 shot01..09
    loaded: list[Image.Image] = []
    for i, p in enumerate(args.sources):
        try:
            im = Image.open(p)
            im.load()
        except Exception as e:  # noqa: BLE001
            raise SystemExit(f"Unable to read source image {p}: {e}")
        if im.width < 1 or im.height < 1:
            raise SystemExit(f"Unreadable image dimensions: {p}")
        loaded.append(im.convert("RGB"))
        dest = out_dir / f"{prefix}_shot{i + 1:02d}.png"
        shutil.copyfile(p, dest)

    # 2) 生成 3 张纵向三联图
    triptych_cell_w = cell_w * 2
    triptych_cell_h = round(triptych_cell_w / ASPECT)
    triptych_h = (triptych_cell_h * 3) + (gap * 2)
    for group in range(3):
        canvas = Image.new("RGB", (triptych_cell_w, triptych_h), (0, 0, 0))
        for slot in range(3):
            index = group * 3 + slot
            y = slot * (triptych_cell_h + gap)
            draw_fit(canvas, loaded[index], 0, y, triptych_cell_w, triptych_cell_h)
        canvas.save(out_dir / f"{prefix}_triptych_{group + 1}.png", "PNG")

    # 3) 生成 1 张 3x3 九宫格
    sheet_w = (cell_w * 3) + (gap * 2)
    sheet_h = (cell_h * 3) + (gap * 2)
    sheet = Image.new("RGB", (sheet_w, sheet_h), (0, 0, 0))
    for i in range(9):
        col = i % 3
        row = i // 3
        x = col * (cell_w + gap)
        y = row * (cell_h + gap)
        draw_fit(sheet, loaded[i], x, y, cell_w, cell_h)
    contact_path = out_dir / f"{prefix}_3x3_contact_sheet.png"
    sheet.save(contact_path, "PNG")

    # 4) 摘要
    shots = sorted(out_dir.glob(f"{prefix}_shot*.png"))
    triptychs = sorted(out_dir.glob(f"{prefix}_triptych_*.png"))
    result = {
        "SourceCount": len(args.sources),
        "ShotCount": len(shots),
        "TriptychCount": len(triptychs),
        "ContactSheet": str(contact_path),
        "ContactWidth": sheet_w,
        "ContactHeight": sheet_h,
    }
    print(result)


if __name__ == "__main__":
    main()
