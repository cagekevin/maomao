"""
split_server.py — LayerDivider 深模块（终极完美版）

优化点：
1. 修复了 Pandas 在 merge 后 index 乱序导致的图层错位问题，强制按坐标轴复原顺序。
2. 引入 MPS 硬件自愈机制：若 Apple Silicon 处理 SAM 张量操作抛出不支持异常，自动降级至 CPU 重新计算。
3. 对齐底层矩阵运算维度，彻底保障稳定性与一致性。
"""

import os
import argparse
import requests
import uuid

import numpy as np
import pandas as pd
import cv2
from PIL import Image
from tqdm import tqdm

import pytoshop
from pytoshop import layers
from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
import torch

# ===================== 内联：ld_convertor =====================
def pil2cv(image):
    new_image = np.array(image, dtype=np.uint8)
    if new_image.ndim == 2:
        pass
    elif new_image.shape[2] == 3:
        new_image = new_image[:, :, ::-1]
    elif new_image.shape[2] == 4:
        new_image = new_image[:, :, [2, 1, 0, 3]]
    return new_image

def cv2pil(image):
    new_image = image.copy()
    if new_image.ndim == 2:
        pass
    elif new_image.shape[2] == 3:
        new_image = new_image[:, :, ::-1]
    elif new_image.shape[2] == 4:
        new_image = new_image[:, :, [2, 1, 0, 3]]
    new_image = Image.fromarray(new_image)
    return new_image

def rgba2df(img):
    h, w, _ = img.shape
    x_l, y_l = np.meshgrid(np.arange(h), np.arange(w), indexing='ij')
    r, g, b, a = img[:, :, 0], img[:, :, 1], img[:, :, 2], img[:, :, 3]
    df = pd.DataFrame({
        "x_l": x_l.ravel(), "y_l": y_l.ravel(),
        "r": r.ravel(), "g": g.ravel(), "b": b.ravel(), "a": a.ravel(),
    })
    return df

def hsv2df(img):
    x_l, y_l = np.meshgrid(np.arange(img.shape[0]), np.arange(img.shape[1]), indexing='ij')
    h, s, v = np.transpose(img, (2, 0, 1))
    df = pd.DataFrame({'x_l': x_l.flatten(), 'y_l': y_l.flatten(),
                       'h': h.flatten(), 's': s.flatten(), 'v': v.flatten()})
    return df

def df2rgba(img_df):
    r_img = img_df.pivot_table(index="x_l", columns="y_l", values="r").reset_index(drop=True).values
    g_img = img_df.pivot_table(index="x_l", columns="y_l", values="g").reset_index(drop=True).values
    b_img = img_df.pivot_table(index="x_l", columns="y_l", values="b").reset_index(drop=True).values
    a_img = img_df.pivot_table(index="x_l", columns="y_l", values="a").reset_index(drop=True).values
    return np.stack([r_img, g_img, b_img, a_img], 2).astype(np.uint8)

def mask2df(mask):
    h, w = mask.shape
    x_l, y_l = np.meshgrid(np.arange(h), np.arange(w), indexing='ij')
    flg = mask.astype(int)
    df = pd.DataFrame({"x_l_m": x_l.ravel(), "y_l_m": y_l.ravel(), "m_flg": flg.ravel()})
    return df


# ===================== 内联：ld_processor =====================
def mode_fast(series):
    if series.empty:
        return 0
    val_counts = series.value_counts()
    return val_counts.index[0] if not val_counts.empty else 0

def split_img_df(df, show=False):
    img_list = []
    for cls_no in tqdm(list(df["label"].unique()), desc="Split Layers"):
        img_df = df.copy()
        img_df.loc[df["label"] != cls_no, ["a"]] = 0
        df_img = df2rgba(img_df).astype(np.uint8)
        img_list.append(df_img)
    return img_list

def get_seg_base(input_image, sorted_masks, th):
    df = rgba2df(input_image)
    df["label"] = -1
    for idx, mask in tqdm(enumerate(sorted_masks), total=len(sorted_masks), desc="Merge Masks"):
        if int(mask["area"]) < th:
            continue
        mask_df = mask2df(mask["segmentation"])
        # merge 会导致索引乱序
        df = df.merge(mask_df, left_on=["x_l", "y_l"], right_on=["x_l_m", "y_l_m"], how="inner")
        df["label"] = np.where(df["m_flg"] == True, idx, df["label"])
        df.drop(columns=["x_l_m", "y_l_m", "m_flg"], inplace=True)
    
    # 强制排序恢复原始像素次序，根除后续图层坐标错位危机
    df = df.sort_values(by=['x_l', 'y_l']).reset_index(drop=True)
    
    df['r'] = df.groupby('label')['r'].transform(mode_fast)
    df['g'] = df.groupby('label')['g'].transform(mode_fast)
    df['b'] = df.groupby('label')['b'].transform(mode_fast)
    return df

def get_normal_layer(input_image, df):
    base_layer_list = split_img_df(df, show=False)
    org_df = rgba2df(input_image)
    hsv_df = hsv2df(cv2.cvtColor(df2rgba(df).astype(np.uint8), cv2.COLOR_RGB2HSV))
    hsv_org = hsv2df(cv2.cvtColor(input_image, cv2.COLOR_RGB2HSV))
    
    hsv_org["bright_flg"] = hsv_df["v"] < hsv_org["v"]
    bright_df = org_df.copy()
    bright_df["bright_flg"] = hsv_org["bright_flg"]
    bright_df["a"] = np.where(bright_df["bright_flg"] == True, 255, 0)
    bright_df["label"] = df["label"]
    bright_layer_list = split_img_df(bright_df, show=False)
    
    hsv_org["shadow_flg"] = hsv_df["v"] >= hsv_org["v"]
    shadow_df = rgba2df(input_image)
    shadow_df["shadow_flg"] = hsv_org["shadow_flg"]
    shadow_df["a"] = np.where(shadow_df["shadow_flg"] == True, 255, 0)
    shadow_df["label"] = df["label"]
    shadow_layer_list = split_img_df(shadow_df, show=True)
    
    return base_layer_list, bright_layer_list, shadow_layer_list

def get_composite_layer(input_image, df):
    base_layer_list = split_img_df(df, show=False)
    org_df = rgba2df(input_image)
    
    org_df["r"] = org_df["r"].astype(int)
    org_df["g"] = org_df["g"].astype(int)
    org_df["b"] = org_df["b"].astype(int)
    
    org_df["diff_r"] = df["r"] - org_df["r"]
    org_df["diff_g"] = df["g"] - org_df["g"]
    org_df["diff_b"] = df["b"] - org_df["b"]
    
    org_df["shadow_flg"] = (org_df["diff_r"] >= 0) & (org_df["diff_g"] >= 0) & (org_df["diff_b"] >= 0)
    org_df["screen_flg"] = (org_df["diff_r"] < 0) & (org_df["diff_g"] < 0) & (org_df["diff_b"] < 0)
    
    shadow_df = org_df.copy()
    shadow_df["a"] = np.where(shadow_df["shadow_flg"], 255, 0)
    df_r_safe = df["r"].replace(0, 1)
    df_g_safe = df["g"].replace(0, 1)
    df_b_safe = df["b"].replace(0, 1)
    shadow_df["r"] = (shadow_df["r"] * 255 / df_r_safe).clip(0, 255)
    shadow_df["g"] = (shadow_df["g"] * 255 / df_g_safe).clip(0, 255)
    shadow_df["b"] = (shadow_df["b"] * 255 / df_b_safe).clip(0, 255)
    shadow_df["label"] = df["label"]
    shadow_layer_list = split_img_df(shadow_df, show=True)
    
    screen_df = org_df.copy()
    screen_df["a"] = np.where(screen_df["screen_flg"], 255, 0)
    df_r_inv = (1 - df["r"] / 255).replace(0, 0.01)
    df_g_inv = (1 - df["g"] / 255).replace(0, 0.01)
    df_b_inv = (1 - df["b"] / 255).replace(0, 0.01)
    screen_df["r"] = ((screen_df["r"] - df["r"]) / df_r_inv).clip(0, 255)
    screen_df["g"] = ((screen_df["g"] - df["g"]) / df_g_inv).clip(0, 255)
    screen_df["b"] = ((screen_df["b"] - df["b"]) / df_b_inv).clip(0, 255)
    screen_df["label"] = df["label"]
    screen_layer_list = split_img_df(screen_df, show=True)
    
    addition_df = org_df.copy()
    addition_df["a"] = np.where(~addition_df["screen_flg"] & ~addition_df["shadow_flg"], 255, 0)
    addition_df["r"] = (org_df["r"] - df["r"]).clip(0, 255)
    addition_df["g"] = (org_df["g"] - df["g"]).clip(0, 255)
    addition_df["b"] = (org_df["b"] - df["b"]).clip(0, 255)
    addition_df["label"] = df["label"]
    addition_layer_list = split_img_df(addition_df, show=True)
    
    subtract_df = org_df.copy()
    subtract_df["a"] = np.where(~subtract_df["screen_flg"] & ~subtract_df["shadow_flg"], 255, 0)
    subtract_df["r"] = (df["r"] - org_df["r"]).clip(0, 255)
    subtract_df["g"] = (df["g"] - org_df["g"]).clip(0, 255)
    subtract_df["b"] = (df["b"] - org_df["b"]).clip(0, 255)
    subtract_df["label"] = df["label"]
    subtract_layer_list = split_img_df(subtract_df, show=True)
    
    return base_layer_list, shadow_layer_list, screen_layer_list, addition_layer_list, subtract_layer_list

# ===================== 内联：ld_utils =====================
def add_psd(psd, img, name, mode):
    layer_1 = layers.ChannelImageData(image=img[:, :, 3], compression=1)
    layer0 = layers.ChannelImageData(image=img[:, :, 0], compression=1)
    layer1 = layers.ChannelImageData(image=img[:, :, 1], compression=1)
    layer2 = layers.ChannelImageData(image=img[:, :, 2], compression=1)
    new_layer = layers.LayerRecord(
        channels={-1: layer_1, 0: layer0, 1: layer1, 2: layer2},
        top=0, bottom=img.shape[0], left=0, right=img.shape[1],
        blend_mode=mode, name=name, opacity=255)
    psd.layer_and_mask_info.layer_info.layer_records.append(new_layer)
    return psd

def load_seg_model(model_dir):
    file_name = 'sam_vit_h_4b8939.pth'
    url = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"
    file_path = os.path.join(model_dir, file_name)
    if not os.path.exists(file_path):
        print(f"首次运行，正在下载 SAM 模型权重 ({file_name})...")
        response = requests.get(url, stream=True)
        total_size = int(response.headers.get('content-length', 0))
        with open(file_path, 'wb') as f, tqdm(
                desc=file_name, total=total_size, unit='iB',
                unit_scale=True, unit_divisor=1024) as bar:
            for data in response.iter_content(chunk_size=1024):
                size = f.write(data)
                bar.update(size)

def save_psd(input_image, layers_list, names, modes, output_dir, layer_mode, output_path=None):
    psd = pytoshop.core.PsdFile(num_channels=3, height=input_image.shape[0], width=input_image.shape[1])
    
    for idx, _ in enumerate(layers_list[0]):
        for layer_idx, layer_group in enumerate(layers_list):
            if idx < len(layer_group):
                psd = add_psd(psd, layer_group[idx], names[layer_idx] + str(idx), modes[layer_idx])
                
    if output_path:
        out = output_path
    else:
        name = uuid.uuid4().hex[:10]
        out = f"{output_dir}/output_{name}.psd"
        
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'wb') as fd2:
        psd.write(fd2)
    return out


# ===================== 内联：ld_segment =====================
def get_mask_generator(pred_iou_thresh, stability_score_thresh, min_mask_region_area, model_path):
    sam_checkpoint = os.path.join(model_path, "sam_vit_h_4b8939.pth")
    
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
        print("警告：未检测到 GPU，正在使用 CPU 运行，可能较慢。")
        
    sam = sam_model_registry["default"](checkpoint=sam_checkpoint)
    sam.to(device=device)
    
    return SamAutomaticMaskGenerator(
        model=sam,
        pred_iou_thresh=pred_iou_thresh,
        stability_score_thresh=stability_score_thresh,
        min_mask_region_area=min_mask_region_area)


# ===================== 深模块：路径与预置参数 =====================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
MODEL_DIR = os.path.join(BASE_DIR, "segment_model")
for d in (OUTPUT_DIR, MODEL_DIR):
    os.makedirs(d, exist_ok=True)

DEFAULT_PARAMS = {
    "area_threshold": 1000,
    "pred_iou_thresh": 0.8,
    "stability_score_thresh": 0.8,
    "min_mask_region_area": 100,
    "layer_mode": "normal",
}

# ---------- 内部（深）：完整分割 + 写 PSD ----------
def _run_segment(pil_image: Image.Image, params: dict, output_path: str = None) -> str:
    cv_img = pil2cv(pil_image)
    rgba = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGBA)

    # 1) SAM 生成掩码
    mask_gen = get_mask_generator(
        params["pred_iou_thresh"],
        params["stability_score_thresh"],
        params["min_mask_region_area"],
        MODEL_DIR
    )
    
    print("正在通过 SAM 模型分析图像特征...")
    
    # 增加 MPS 崩溃自愈保护
    try:
        masks = mask_gen.generate(cv_img)
    except Exception as e:
        if mask_gen.predictor.model.device.type == 'mps':
            print("⚠️ 检测到当前 MPS(Apple Silicon) 不支持该张量算子，正在自动降级回退至 CPU...")
            mask_gen.predictor.model.to('cpu')
            masks = mask_gen.generate(cv_img)
        else:
            raise e

    if not masks:
        raise ValueError("SAM 未生成任何掩码，请检查图片或调小 area_threshold")
    
    sorted_masks = sorted(masks, key=(lambda x: x['area']), reverse=True)

    # 2) 按掩码建立分层 DataFrame
    df = get_seg_base(rgba, sorted_masks, params["area_threshold"])

    # 3) 生成图层并写 PSD
    layer_mode = params["layer_mode"]
    print(f"正在合成层数据 (模式: {layer_mode})...")
    
    if layer_mode == "composite":
        base, shadow, screen, addition, subtract = get_composite_layer(rgba, df)
        filename = save_psd(
            rgba,
            [base, screen, shadow, subtract, addition],
            ["base", "screen", "multiply", "subtract", "addition"],
            [pytoshop.enums.BlendMode.normal, pytoshop.enums.BlendMode.screen,
             pytoshop.enums.BlendMode.multiply, pytoshop.enums.BlendMode.subtract,
             pytoshop.enums.BlendMode.linear_dodge],
            OUTPUT_DIR, layer_mode, output_path=output_path)
    else:
        base, bright, shadow = get_normal_layer(rgba, df)
        filename = save_psd(
            rgba,
            [base, bright, shadow],
            ["base", "bright", "shadow"],
            [pytoshop.enums.BlendMode.normal, pytoshop.enums.BlendMode.normal,
             pytoshop.enums.BlendMode.normal],
            OUTPUT_DIR, layer_mode, output_path=output_path)
    return filename


# ---------- 对外（浅）：命令行一进一出 ----------
def main():
    parser = argparse.ArgumentParser(description="文字海报 → 分层 PSD（完美兼容版）")
    parser.add_argument("image", help="输入图片路径，如 ./poster.png")
    parser.add_argument("--area-threshold", type=int, default=DEFAULT_PARAMS["area_threshold"],
                        help="小字保留阈值，默认 1000")
    parser.add_argument("--pred-iou-thresh", type=float, default=DEFAULT_PARAMS["pred_iou_thresh"])
    parser.add_argument("--stability-score-thresh", type=float,
                        default=DEFAULT_PARAMS["stability_score_thresh"])
    parser.add_argument("--min-mask-region-area", type=int,
                        default=DEFAULT_PARAMS["min_mask_region_area"])
    parser.add_argument("--layer-mode", choices=["normal", "composite"],
                        default=DEFAULT_PARAMS["layer_mode"])
    parser.add_argument("--output", default=None,
                        help="输出 PSD 完整路径（如 /tmp/out.psd）")
    args = parser.parse_args()

    load_seg_model(MODEL_DIR)

    params = {
        "area_threshold": args.area_threshold,
        "pred_iou_thresh": args.pred_iou_thresh,
        "stability_score_thresh": args.stability_score_thresh,
        "min_mask_region_area": args.min_mask_region_area,
        "layer_mode": args.layer_mode,
    }

    if not os.path.exists(args.image):
        raise SystemExit(f"❌ 找不到图片：{args.image}")
    
    pil_image = Image.open(args.image).convert("RGB")
    psd_path = _run_segment(pil_image, params, args.output)
    print(f"✅ 完成 → {psd_path}")

if __name__ == "__main__":
    main()