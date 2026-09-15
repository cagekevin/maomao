/**
 * PresetGridView —— 创作库「风格 / 滤镜 / 运镜」网格视图。
 *
 * 卡片语言（对照 mockup/panel-kit-card 的 .rcard）：16:9 大横卡 + 底部渐变名条，无角标。
 * 运镜卡带 `video`（.mp4）→ 悬停播放、移出暂停复位；其余走静态封面（`preview`）。
 *
 * ⚠️ `preview` 恒为**静帧**（catalog 已把运镜的 mp4 与 poster 拆开，见 creativeCatalog.normalizeCreative），
 * 所以这里能安全地把它交给 <img>，不会出现「拿 mp4 当图片」的破图。
 *
 * 点卡片 → onApply(preset)（宿主负责落胶囊并关面板）。
 */

import { useRef } from 'react';
import { Play } from 'lucide-react';
import LazyImage from '../../ui/LazyImage.tsx';
import type { CreativePreset } from '../creativePresets.ts';

export interface PresetGridViewProps {
  presets: CreativePreset[];
  onApply: (preset: CreativePreset) => void;
}

export default function PresetGridView({ presets, onApply }: PresetGridViewProps) {
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());

  if (presets.length === 0) {
    return (
      <div className="cl-grid">
        <p className="cl-empty">没有匹配的结果</p>
      </div>
    );
  }

  return (
    <div className="cl-grid">
      {presets.map((p) => (
        <article
          key={p.id}
          className="cl-card-item"
          title={p.name}
          onClick={() => onApply(p)}
          onMouseEnter={() => {
            const v = videoRefs.current.get(p.id);
            // 悬停自动播放属「浏览器 API 预期不可用」：无用户手势 / 自动播放策略可能拒绝，
            // 拒绝即维持 poster 静帧，不是缺陷。
            if (v) void v.play().catch(() => undefined); // catch-ok: BROWSER_API
          }}
          onMouseLeave={() => {
            const v = videoRefs.current.get(p.id);
            if (v) {
              v.pause();
              v.currentTime = 0;
            }
          }}
        >
          {p.video ? (
            <>
              <video
                ref={(el) => {
                  if (el) videoRefs.current.set(p.id, el);
                  else videoRefs.current.delete(p.id);
                }}
                src={p.video}
                poster={p.preview}
                muted
                loop
                playsInline
                preload="metadata"
              />
              <span className="cl-play">
                <Play size={14} fill="currentColor" />
              </span>
            </>
          ) : (
            <LazyImage src={p.preview} alt={p.name} className="absolute inset-0" />
          )}
          <div className="cl-name">
            <p>{p.name}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
