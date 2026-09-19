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
import LazyImage from '@/components/base/ui/LazyImage';
import type { CreativePreset } from '../creativePresets';
import { logger } from '@/components/base/core/logger';

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
          // 【TD-05-19】悬停显示提示词正文。原为 `title={p.name}` —— 只给名字，
          // 而 `p.prompt` 数据早已归一化齐备（`creativeCatalog.ts:92/106`）、**285/285 全有值**。
          // 名条（下方 `.cl-name`）仍只显示名字：名字用于「识别」，prompt 是「内容」，分工不同。
          // 【实测长度】min 21 / 中位 54 / max 97 字 ⇒ 原生 tooltip 完全放得下（**不会截断**），
          // 故不引入自定义 tooltip 组件（那是为长文本设计的，此处用不上）。
          // 【为什么不需要判 kind】MJ 与 prompt 类**不走本组件**（各有专属视图，见 CreativeLibrary.tsx:34），
          // 能进这里的只有 style / filter / motion —— 三者都要显示（用户 2026-09-19 裁定）。
          title={`${p.name}\n${p.prompt}`}
          onClick={() => onApply(p)}
          onMouseEnter={() => {
            const v = videoRefs.current.get(p.id);
            // 悬停自动播放属「浏览器 API 预期不可用」：无用户手势 / 自动播放策略可能拒绝，
            // 拒绝即维持 poster 静帧，不是缺陷。
            // 播放被拒（autoplay 政策）属环境预期 → 不阻断；但**降级必留痕**（2026-09-17 拆 catch-ok）。
            if (v)
              void v
                .play()
                .catch((e: unknown) => logger.debug('提示词', '预览播放被拒（不阻断）', e));
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
