/**
 * 摄影参数面板（提取自 AI-Canvas-tauri/src/components/nodes/shared/PromptPanel.tsx）。
 *
 * 生图节点展开面板底部参数行右侧的「摄影参数」入口：
 *   - 一个相机图标按钮（已设参数 → 蓝底高亮 + 角标数量）
 *   - 点击后从按钮上方弹出：实时成像预览 + 焦距 / 快门效果 / 光圈 / 曝光时间 四个下拉
 *
 * 落地约定（对齐本仓库）：
 *   - 选项文案与顺序按参考包 1:1 保留（焦距 8 档 / 快门 4 档 / 光圈 8 档 / 曝光 11 档）；
 *   - 样式改用本仓库语义 token（bg-surface-1 / border-edge / text-caption-sm …），与
 *     ModelSelect / PromptLibraryButton 等参数行控件同族；
 *   - 全自动（value 为空 / onChange(undefined)）等价于「从未打开过面板」，不写任何提示词片段。
 */

import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { useOutsideClick } from '../../core/uiHooks.ts';
import './cameraParams.css';
import type {
  CameraAperture,
  CameraExposureTime,
  CameraGenerationSettings,
  CameraLens,
  CameraShutterEffect,
} from './types.ts';

const CAMERA_LENS_OPTIONS: Array<{ value: CameraLens; label: string }> = [
  { value: '15mm', label: '15mm 超广角' },
  { value: '24mm', label: '24mm 广角' },
  { value: '35mm', label: '35mm 电影感' },
  { value: '50mm', label: '50mm 标准' },
  { value: '85mm', label: '85mm 人像' },
  { value: '200mm', label: '200mm 长焦' },
  { value: 'macro', label: '100mm 微距' },
  { value: 'fisheye', label: '鱼眼' },
];

// 快门效果：已删「凝固动作」（静帧生图默认定格，该档对模型无引导力）
const CAMERA_SHUTTER_OPTIONS: Array<{ value: CameraShutterEffect; label: string }> = [
  { value: 'natural', label: '自然动态' },
  { value: 'motion', label: '动态拖影' },
  { value: 'light-trails', label: '光轨效果' },
];

// 光圈：数字越小 = 光圈越大 = 景深越浅（背景越虚化）。中文后缀按对应提示词语义标注。
const CAMERA_APERTURE_OPTIONS: Array<{ value: CameraAperture; label: string }> = [
  { value: 'f/1.4', label: 'f/1.4 极致虚化' },
  { value: 'f/2', label: 'f/2 强虚化' },
  { value: 'f/2.8', label: 'f/2.8 柔和虚化' },
  { value: 'f/4', label: 'f/4 均衡' },
  { value: 'f/5.6', label: 'f/5.6 中等景深' },
  { value: 'f/8', label: 'f/8 深景深' },
  { value: 'f/11', label: 'f/11 大景深' },
  { value: 'f/16', label: 'f/16 全景清晰' },
];

// 曝光时间：只留能翻译成明暗的两端（短曝压暗 / 长曝提亮）；中间无效档（1/250s~1/8s）已删
const CAMERA_EXPOSURE_OPTIONS: CameraExposureTime[] = [
  '1/2000s',
  '1/1000s',
  '1/500s',
  '1/2s',
  '1s',
  '5s',
];

/**
 * 黄昏猫场景的渐变/滤镜定义（对齐 mockup/camera-params-mockup.html 的 sprite <defs>）。
 * 只定义一次；场景本体按参数内联渲染（单实例弹层，无需 <use> 影子树）。
 */
function CameraSceneDefs() {
  return (
    <defs>
      <linearGradient id="cp-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#070a20" />
        <stop offset=".28" stopColor="#1b1a52" />
        <stop offset=".52" stopColor="#3d2b78" />
        <stop offset=".76" stopColor="#8a4a8f" />
        <stop offset="1" stopColor="#e08a68" />
      </linearGradient>
      <radialGradient id="cp-glow">
        <stop offset="0" stopColor="#fbbf24" stopOpacity=".55" />
        <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="cp-sun">
        <stop offset="0" stopColor="#fffbeb" />
        <stop offset="1" stopColor="#f59e0b" />
      </radialGradient>
      <linearGradient id="cp-mtn-far" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5b4b9c" />
        <stop offset="1" stopColor="#33295e" />
      </linearGradient>
      <linearGradient id="cp-mtn-near" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2e2657" />
        <stop offset="1" stopColor="#1a1540" />
      </linearGradient>
      <linearGradient id="cp-city" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1d1840" />
        <stop offset="1" stopColor="#0d0a22" />
      </linearGradient>
      <linearGradient id="cp-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#241d47" />
        <stop offset="1" stopColor="#060512" />
      </linearGradient>
      <linearGradient id="cp-sheen" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8b6fd6" stopOpacity="0" />
        <stop offset=".5" stopColor="#8b6fd6" stopOpacity=".22" />
        <stop offset="1" stopColor="#8b6fd6" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="cp-haze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8b5fa8" stopOpacity="0" />
        <stop offset="1" stopColor="#8b5fa8" stopOpacity=".9" />
      </linearGradient>
      <linearGradient id="cp-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#eaf2ff" stopOpacity=".10" />
        <stop offset=".34" stopColor="#eaf2ff" stopOpacity=".02" />
        <stop offset=".62" stopColor="#eaf2ff" stopOpacity="0" />
        <stop offset="1" stopColor="#ffe9c8" stopOpacity=".05" />
      </linearGradient>
      <linearGradient id="cp-reflect" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f9a86b" stopOpacity=".55" />
        <stop offset="1" stopColor="#f9a86b" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="cp-bokeh">
        <stop offset="0" stopColor="#fff7ed" stopOpacity=".95" />
        <stop offset=".45" stopColor="#fbbf24" stopOpacity=".7" />
        <stop offset=".82" stopColor="#f59e0b" stopOpacity=".32" />
        <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="cp-shadow">
        <stop offset="0" stopColor="#000" stopOpacity=".5" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="cp-petal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f5d0fe" />
        <stop offset="1" stopColor="#a78bfa" />
      </linearGradient>
      <radialGradient id="cp-core">
        <stop offset="0" stopColor="#fde047" />
        <stop offset="1" stopColor="#f59e0b" />
      </radialGradient>
      <radialGradient id="cp-vig" cx=".5" cy=".5" r=".72">
        <stop offset=".5" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity=".55" />
      </radialGradient>
    </defs>
  );
}

/** 坐姿橘猫剪影（残影复用同一形状，必须与主场景里的猫轮廓一致） */
function CameraCatSilhouette() {
  return (
    <g id="cp-cat-sil">
      <path d="M168 66 C 166 52 170 40 179 32 C 182 29 186 29 189 32 C 195 38 200 47 202 56 Z" />
      <path d="M232 66 C 234 52 230 40 221 32 C 218 29 214 29 211 32 C 205 38 200 47 198 56 Z" />
      <path d="M200 98 C 186 98 176 108 175 121 C 174 133 171 143 176 150 C 181 155 219 155 224 150 C 229 143 226 133 225 121 C 224 108 214 98 200 98 Z" />
      <ellipse cx="200" cy="80" rx="37" ry="34" />
    </g>
  );
}

/** 坐姿橘猫（正脸）主体 —— 与 mockup 精灵第 11 层逐字符一致 */
function CameraCat() {
  return (
    <g>
      <ellipse cx="200" cy="155" rx="28" ry="3.6" fill="url(#cp-shadow)" />

      <path
        fill="none"
        stroke="#f6a961"
        strokeWidth="8"
        strokeLinecap="round"
        d="M224 146 C 242 147 249 137 246 124"
      />
      <path
        fill="none"
        stroke="#fffaf3"
        strokeWidth="8"
        strokeLinecap="round"
        d="M246 124 C 245 119 242 116 238 114"
      />

      <path
        fill="#f6a961"
        d="M200 98 C 186 98 176 108 175 121 C 174 133 171 143 176 150 C 181 155 219 155 224 150 C 229 143 226 133 225 121 C 224 108 214 98 200 98 Z"
      />
      <path
        fill="#fffaf3"
        d="M200 100 C 188 100 180 109 179.6 121 C 179 133 179 145 183 152 C 189 155 211 155 217 152 C 221 145 221 133 220.4 121 C 220 109 212 100 200 100 Z"
      />
      <ellipse cx="191" cy="152" rx="9" ry="5" fill="#fffaf3" />
      <ellipse cx="209" cy="152" rx="9" ry="5" fill="#fffaf3" />

      <path
        fill="#f6a961"
        d="M168 66 C 166 52 170 40 179 32 C 182 29 186 29 189 32 C 195 38 200 47 202 56 Z"
      />
      <path
        fill="#f6a961"
        d="M232 66 C 234 52 230 40 221 32 C 218 29 214 29 211 32 C 205 38 200 47 198 56 Z"
      />
      <path
        fill="#f7b6c1"
        d="M175 62 C 173 51 177 42 183 36 C 185 34 187 34 189 36 C 193 41 197 49 198 56 Z"
      />
      <path
        fill="#f7b6c1"
        d="M225 62 C 227 51 223 42 217 36 C 215 34 213 34 211 36 C 207 41 203 49 202 56 Z"
      />

      <ellipse cx="200" cy="80" rx="37" ry="34" fill="#f6a961" />
      <path
        fill="#fffaf3"
        d="M200 74 C 188 74 179 79 175 86 C 171.6 92 172 98 175.6 102.6 C 180 107.4 189 110 200 110 C 211 110 220 107.4 224.4 102.6 C 228 98 228.4 92 225 86 C 221 79 212 74 200 74 Z"
      />
      <g fill="#dd8038" opacity=".75">
        <path d="M190 56 C 191 59.8 191.4 62.8 190.6 65.2 L 186.6 64.4 C 187.4 62 187.6 59 187 55.6 Z" />
        <path d="M210 56 C 209 59.8 208.6 62.8 209.4 65.2 L 213.4 64.4 C 212.6 62 212.4 59 213 55.6 Z" />
        <path d="M200 54 C 200.6 57.8 200.6 61 200 63.6 L 197.2 63.6 C 197.8 61 197.8 57.8 197.2 54 Z" />
      </g>

      <circle cx="186" cy="88" r="8.4" fill="#2f2119" />
      <circle cx="214" cy="88" r="8.4" fill="#2f2119" />
      <circle cx="183.4" cy="85" r="2.8" fill="#fff" />
      <circle cx="211.4" cy="85" r="2.8" fill="#fff" />
      <circle cx="188.6" cy="91.4" r="1.3" fill="#fff" opacity=".7" />
      <circle cx="216.6" cy="91.4" r="1.3" fill="#fff" opacity=".7" />

      <path d="M196.8 98.5 h6.4 l-3.2 3.4 Z" fill="#e8788f" />
      <path
        d="M200 101.9 c-2.2 2.6-4.8 2.2-5.8 0 M200 101.9 c2.2 2.6 4.8 2.2 5.8 0"
        stroke="#cf6274"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />

      <g stroke="#f6a961" strokeWidth="1" strokeLinecap="round" opacity=".55">
        <path d="M176 95 l-13 -3 M176 99 l-13 2" />
        <path d="M224 95 l13 -3 M224 99 l13 2" />
      </g>
    </g>
  );
}

/**
 * 根据参数实时绘制「黄昏猫场景」综合成像预览（景深、明暗、透视、动态趋势）。
 * 场景与 mockup/camera-params-mockup.html 的 <symbol id="cam-scene"> 逐层一致：
 * 天空 → 星点 → 落日 → 远山/近山 → 城市剪影 → 地面 → 雾霭 → 光斑 → 拖影 → 残影 → 主体(橘猫/微距花) → 曝光 → 暗角/画框。
 *
 * 纯趋势示意，不做真实曝光/景深计算；全场景 0 个 filter（虚化靠雾霭 + 光斑 + 低对比远山表达）。
 * 变量与 mockup 同名（--subj / --bk / --bkop / --haze / --dim / --bri 与 display 开关），
 * 通过内联 style 变量 + class 驱动，便于与 mockup 对照。
 */
function CameraSettingsPreview({ settings }: { settings: CameraGenerationSettings }) {
  const lens = settings.lens;
  const macro = lens === 'macro';
  const fisheye = lens === 'fisheye';
  const subjectScale =
    lens === '15mm'
      ? 0.66
      : lens === '24mm'
        ? 0.76
        : lens === '35mm'
          ? 0.88
          : lens === '50mm'
            ? 1
            : lens === '85mm'
              ? 1.18
              : lens === '200mm'
                ? 1.38
                : macro
                  ? 1.55
                  : 0.92;

  const apertureNumber = settings.aperture ? Number(settings.aperture.slice(2)) : 5.6;
  const bokehRadius =
    apertureNumber <= 1.4
      ? 1.7
      : apertureNumber <= 2
        ? 1.4
        : apertureNumber <= 2.8
          ? 1.15
          : apertureNumber <= 4
            ? 0.95
            : apertureNumber <= 5.6
              ? 0.75
              : 0.5;
  const bokehOpacity = apertureNumber <= 2.8 ? 0.8 : apertureNumber <= 5.6 ? 0.6 : 0.34;
  // 景深雾霭（代替高斯模糊：光圈越大 → 远景越「化」）
  const haze =
    apertureNumber <= 1.4
      ? 0.5
      : apertureNumber <= 2
        ? 0.42
        : apertureNumber <= 2.8
          ? 0.34
          : apertureNumber <= 4
            ? 0.24
            : apertureNumber <= 5.6
              ? 0.14
              : 0.06;

  // 曝光明暗：--dim（欠曝压暗）/ --bri（过曝提亮）
  const exposureBrightness =
    settings.exposureTime === '5s'
      ? 1.28
      : settings.exposureTime === '1s'
        ? 1.2
        : settings.exposureTime === '1/2s'
          ? 1.13
          : settings.exposureTime === '1/2000s'
            ? 0.68
            : settings.exposureTime === '1/1000s'
              ? 0.76
              : settings.exposureTime === '1/500s'
                ? 0.84
                : 1;
  const dim = exposureBrightness < 1 ? 1 - exposureBrightness : 0;
  const bri = exposureBrightness > 1 ? (exposureBrightness - 1) * 0.45 : 0;

  const trail = settings.shutterEffect === 'light-trails';
  const motion = settings.shutterEffect === 'motion';
  const showGhosts = !macro && (motion || trail);

  return (
    <svg
      viewBox="0 0 400 168"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-label="摄影参数综合成像预览"
      role="img"
      style={{
        // 与 mockup 同名的 CSS 变量：主体缩放 / 光斑大小 / 光斑强度 / 景深雾霭 / 欠曝 / 过曝
        ['--subj' as string]: String(subjectScale),
        ['--bk' as string]: String(bokehRadius),
        ['--bkop' as string]: String(bokehOpacity),
        ['--haze' as string]: String(haze),
        ['--dim' as string]: String(dim),
        ['--bri' as string]: String(bri),
        // display 开关
        ['--macro-d' as string]: macro ? 'block' : 'none',
        ['--subj-d' as string]: macro ? 'none' : 'block',
        ['--std-d' as string]: fisheye ? 'none' : 'block',
        ['--fish-d' as string]: fisheye ? 'block' : 'none',
        ['--arc-d' as string]: fisheye ? 'block' : 'none',
        ['--motion-d' as string]: motion || trail ? 'block' : 'none',
        ['--trail-d' as string]: trail ? 'block' : 'none',
        ['--ghost-d' as string]: showGhosts ? 'block' : 'none',
        ['--gh3-d' as string]: trail ? 'block' : 'none',
        ['--gx1' as string]: trail ? '42px' : '24px',
        ['--gx2' as string]: trail ? '28px' : '12px',
        ['--gx3' as string]: '14px',
      }}
    >
      <CameraSceneDefs />

      {/* 1 天空 */}
      <rect width="400" height="134" fill="url(#cp-sky)" />

      {/* 2 星点（同色档合并为 path） */}
      <g fill="#fff">
        <path
          opacity=".72"
          d="M50.7 18a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0 M334.6 22a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0 M194.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0"
        />
        <path
          opacity=".45"
          d="M117.1 34a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0 M261.1 30a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0 M87.2 52a.8.8 0 1 0 1.6 0a.8.8 0 1 0-1.6 0 M307.2 46a.8.8 0 1 0 1.6 0a.8.8 0 1 0-1.6 0"
        />
        <path
          opacity=".26"
          d="M151.4 20a.6.6 0 1 0 1.2 0a.6.6 0 1 0-1.2 0 M223.4 44a.6.6 0 1 0 1.2 0a.6.6 0 1 0-1.2 0 M371.4 36a.6.6 0 1 0 1.2 0a.6.6 0 1 0-1.2 0 M23.4 40a.6.6 0 1 0 1.2 0a.6.6 0 1 0-1.2 0"
        />
      </g>

      {/* 3 落日：三层叠加 */}
      <circle cx="76" cy="112" r="76" fill="url(#cp-glow)" opacity=".7" />
      <circle cx="76" cy="112" r="46" fill="url(#cp-glow)" />
      <circle cx="76" cy="112" r="16" fill="url(#cp-sun)" opacity=".55" />
      <circle cx="76" cy="112" r="11" fill="url(#cp-sun)" />

      {/* 4 远山（鱼眼时换弧形地平线）+ 近山 */}
      <path
        d="M-10 126 50 70l60 44 64-58 82 62 54-36 100 42V152H-10Z"
        fill="url(#cp-mtn-far)"
        style={{ display: 'var(--std-d, block)' }}
      />
      <path
        d="M-18 122Q200 58 418 122V174H-18Z"
        fill="url(#cp-mtn-far)"
        style={{ display: 'var(--fish-d, none)' }}
      />
      <path d="M-10 134 80 102l72 28 76-32 92 42 90-22V152H-10Z" fill="url(#cp-mtn-near)" />

      {/* 5 城市剪影 + 窗光 */}
      <path
        d="M14 130V96h22v34M40 130V84h20v46M64 130V104h18v26M86 130V92h20v38 M292 130V88h20v42M316 130V100h22v30M342 130V80h18v50M364 130V98h24v32Z"
        fill="url(#cp-city)"
      />
      <g opacity=".5">
        <path fill="#fcd34d" d="M19 102h4v5h-4zM45 90h4v5h-4zM297 94h4v5h-4zM354 98h4v5h-4z" />
        <path fill="#fef3c7" d="M26 112h4v5h-4zM91 98h4v5h-4zM304 106h4v5h-4zM369 104h4v5h-4z" />
        <path fill="#93c5fd" d="M52 102h4v5h-4zM347 86h4v5h-4z" />
      </g>

      {/* 6 地面 / 公路 */}
      <rect y="128" width="400" height="40" fill="url(#cp-ground)" />
      <rect x="40" y="128" width="72" height="40" fill="url(#cp-reflect)" opacity=".5" />
      <rect y="128" width="400" height="40" fill="url(#cp-sheen)" />
      <path
        d="M196 128 158 168M204 128 242 168"
        stroke="#fbbf24"
        strokeWidth="2"
        opacity=".28"
        strokeLinecap="round"
      />

      {/* 7 景深雾霭（光圈越大 → 远景越「化」） */}
      <rect
        y="46"
        width="400"
        height="122"
        fill="url(#cp-haze)"
        style={{ opacity: 'var(--haze, 0)' }}
      />

      {/* 8 光斑（径向渐变自带柔边，无需 filter） */}
      <g className="cp-bokeh" style={{ opacity: 'var(--bkop, .5)' }}>
        <circle className="cp-bk" cx="28" cy="100" r="12" fill="url(#cp-bokeh)" />
        <circle className="cp-bk" cx="62" cy="118" r="8" fill="url(#cp-bokeh)" />
        <circle className="cp-bk" cx="120" cy="96" r="10" fill="url(#cp-bokeh)" />
        <circle className="cp-bk" cx="286" cy="104" r="13" fill="url(#cp-bokeh)" />
        <circle className="cp-bk" cx="330" cy="120" r="7" fill="url(#cp-bokeh)" />
        <circle className="cp-bk" cx="372" cy="94" r="9" fill="url(#cp-bokeh)" />
      </g>

      {/* 9 动态拖影 / 光轨 */}
      <g strokeLinecap="round" style={{ display: 'var(--motion-d, none)' }}>
        <path d="M18 122h126" stroke="#22d3ee" strokeWidth="3" opacity=".45" />
        <path d="M258 108h124" stroke="#f472b6" strokeWidth="4" opacity=".45" />
        <path
          d="M8 140c88-34 204 31 384-18"
          stroke="#fde047"
          strokeWidth="3"
          opacity=".6"
          style={{ display: 'var(--trail-d, none)' }}
        />
      </g>

      {/* 10 残影（快门效果：主体后面拖几份半透明副本） */}
      <g style={{ display: 'var(--ghost-d, none)' }}>
        <use
          className="cp-ghost"
          href="#cp-cat-sil"
          style={{ ['--gx' as string]: 'var(--gx1, 24px)', opacity: '.08' }}
        />
        <use
          className="cp-ghost"
          href="#cp-cat-sil"
          style={{ ['--gx' as string]: 'var(--gx2, 12px)', opacity: '.13' }}
        />
        <use
          className="cp-ghost"
          href="#cp-cat-sil"
          style={{
            ['--gx' as string]: 'var(--gx3, 14px)',
            opacity: '.18',
            display: 'var(--gh3-d, none)',
          }}
        />
      </g>

      {/* 11 微距主体（花） */}
      <g transform="translate(200 100)" style={{ display: 'var(--macro-d, none)' }}>
        <g fill="url(#cp-petal)" opacity=".92">
          <ellipse cx="0" cy="-28" rx="17" ry="34" />
          <ellipse cx="0" cy="-28" rx="17" ry="34" transform="rotate(60)" />
          <ellipse cx="0" cy="-28" rx="17" ry="34" transform="rotate(120)" />
          <ellipse cx="0" cy="-28" rx="17" ry="34" transform="rotate(180)" />
          <ellipse cx="0" cy="-28" rx="17" ry="34" transform="rotate(240)" />
          <ellipse cx="0" cy="-28" rx="17" ry="34" transform="rotate(300)" />
        </g>
        <circle r="23" fill="url(#cp-core)" />
        <circle r="10" fill="#f59e0b" />
        <path d="M0 24c-4 30 5 42 18 60" stroke="#4ade80" strokeWidth="6" strokeLinecap="round" />
        <path d="M9 54c18-13 31-10 38 0-17 8-29 8-38 0Z" fill="#4ade80" opacity=".85" />
      </g>

      {/* 12 主体（坐姿橘猫） */}
      <g className="cp-subj-body" style={{ display: 'var(--subj-d, block)' }}>
        <CameraCat />
      </g>

      {/* 13 曝光（欠曝压暗 / 过曝提亮） */}
      <rect width="400" height="168" fill="#020617" style={{ opacity: 'var(--dim, 0)' }} />
      <rect width="400" height="168" fill="#fff1dc" style={{ opacity: 'var(--bri, 0)' }} />

      {/* 14 镜头玻璃反光 + 暗角 + 画框 */}
      <rect width="400" height="168" fill="url(#cp-glass)" />
      <rect width="400" height="168" fill="url(#cp-vig)" />
      <path
        d="M8 36Q200 8 392 36M8 142Q200 162 392 142"
        stroke="#fff"
        opacity=".16"
        fill="none"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        style={{ display: 'var(--arc-d, none)' }}
      />
      {/* 取景框角标不画在这里：容器用 preserveAspectRatio="slice" 会横向/纵向裁切，
          贴在 viewBox 边上的角标会被裁掉（表现为右侧/上下缺角）。改由外层容器
          绝对定位覆盖层绘制（见 CameraFrameCorners），四个角恒定贴住可视边界。 */}

      {/* 猫剪影定义（供残影 <use> 引用；必须与主场景猫轮廓一致） */}
      <defs>
        <CameraCatSilhouette />
      </defs>
    </svg>
  );
}

/**
 * 取景框角标（四个直角）—— 绝对定位覆盖在预览容器上，恒定贴住可视边界。
 *
 * 为什么不在场景 SVG 里画：场景容器用 preserveAspectRatio="xMidYMid slice"，
 * 容器比例与 viewBox 不一致时会被裁切；画在 viewBox 边上的角标会随之被裁掉
 * （右侧/上下缺角）。放到外层覆盖层后，不随 slice 缩放，四角始终完整。
 *
 * 用两层描边表达：外层深色底（在浅背景上也看得见）+ 内层白色细线。
 */
function CameraFrameCorners() {
  const corners = [
    { key: 'tl', d: 'M1 13V1h12' },
    { key: 'tr', d: 'M11 1h12v12' },
    { key: 'br', d: 'M23 11v12H11' },
    { key: 'bl', d: 'M13 23H1V11' },
  ];
  return (
    <>
      {corners.map((c) => (
        <svg
          key={c.key}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`absolute pointer-events-none ${
            c.key === 'tl'
              ? 'left-2 top-2'
              : c.key === 'tr'
                ? 'right-2 top-2'
                : c.key === 'br'
                  ? 'right-2 bottom-2'
                  : 'left-2 bottom-2'
          }`}
        >
          <path d={c.d} stroke="rgba(0,0,0,.45)" strokeWidth="3" fill="none" />
          <path d={c.d} stroke="#fff" strokeWidth="1.2" fill="none" opacity=".55" />
        </svg>
      ))}
    </>
  );
}

interface CameraSettingsSelectorProps {
  /** 当前节点的摄影参数；缺省 = 全自动 */
  value?: CameraGenerationSettings;
  /** 参数变化回调；全部清空时回调 undefined（等价于从未设置） */
  onChange: (value: CameraGenerationSettings | undefined) => void;
}

/** 底部参数行「摄影参数」按钮 + 弹出面板。 */
export default function CameraSettingsSelector({
  value = {},
  onChange,
}: CameraSettingsSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useOutsideClick(rootRef, open, () => setOpen(false));
  const activeCount = Object.values(value).filter(Boolean).length;

  const updateSetting = <K extends keyof CameraGenerationSettings>(
    key: K,
    settingValue: CameraGenerationSettings[K],
  ) => {
    const next = { ...value, [key]: settingValue || undefined };
    onChange(Object.values(next).some(Boolean) ? next : undefined);
  };

  return (
    <div ref={rootRef} className="relative nodrag flex items-center flex-shrink-0">
      <button
        type="button"
        className={`flex items-center gap-1 h-6 px-2 border rounded text-caption-sm transition-colors cursor-pointer ${
          activeCount > 0
            ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
            : 'bg-transparent border-transparent hover:bg-surface-hover hover:border-edge text-body hover:text-white'
        }`}
        aria-label={activeCount > 0 ? `摄影参数：已设置 ${activeCount} 项` : '选择摄影参数'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={activeCount > 0 ? `摄影参数 · ${activeCount} 项` : '摄影参数'}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Camera size={12} />
        {activeCount > 0 && <span className="tabular-nums">{activeCount}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="摄影参数"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-[344px] bg-surface-1 border border-edge rounded-lg shadow-popover p-3 z-popover nodrag"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-caption-sm font-semibold text-primary">摄影参数</span>
            <button
              type="button"
              className="text-caption text-muted hover:text-white transition-colors cursor-pointer"
              onClick={() => onChange(undefined)}
            >
              全部自动
            </button>
          </div>

          {/* 实时成像预览（角标覆盖层贴容器边界，不随 slice 裁切） */}
          <div className="relative h-[152px] overflow-hidden rounded-md border border-edge-muted bg-surface-sunken">
            <CameraSettingsPreview settings={value} />
            <CameraFrameCorners />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-caption text-muted">焦距</span>
              <select
                className="h-6 w-full px-1.5 rounded bg-input border border-edge-muted text-body text-caption-sm focus:outline-none focus:border-edge-strong cursor-pointer"
                value={value.lens ?? ''}
                onChange={(e) => updateSetting('lens', (e.target.value || undefined) as CameraLens)}
              >
                <option value="">自动</option>
                {CAMERA_LENS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-caption text-muted">快门效果</span>
              <select
                className="h-6 w-full px-1.5 rounded bg-input border border-edge-muted text-body text-caption-sm focus:outline-none focus:border-edge-strong cursor-pointer"
                value={value.shutterEffect ?? ''}
                onChange={(e) =>
                  updateSetting(
                    'shutterEffect',
                    (e.target.value || undefined) as CameraShutterEffect,
                  )
                }
              >
                <option value="">自动</option>
                {CAMERA_SHUTTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-caption text-muted">光圈</span>
              <select
                className="h-6 w-full px-1.5 rounded bg-input border border-edge-muted text-body text-caption-sm focus:outline-none focus:border-edge-strong cursor-pointer"
                value={value.aperture ?? ''}
                onChange={(e) =>
                  updateSetting('aperture', (e.target.value || undefined) as CameraAperture)
                }
              >
                <option value="">自动</option>
                {CAMERA_APERTURE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-caption text-muted">曝光时间</span>
              <select
                className="h-6 w-full px-1.5 rounded bg-input border border-edge-muted text-body text-caption-sm focus:outline-none focus:border-edge-strong cursor-pointer"
                value={value.exposureTime ?? ''}
                onChange={(e) =>
                  updateSetting('exposureTime', (e.target.value || undefined) as CameraExposureTime)
                }
              >
                <option value="">自动</option>
                {CAMERA_EXPOSURE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
