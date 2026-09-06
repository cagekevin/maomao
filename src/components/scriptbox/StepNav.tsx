import React from 'react';
import type { ScriptBoxShot, ScriptBoxAsset } from './scriptBoxSchema';

interface StepNavProps {
  step: number;
  setStep: (next: number) => void;
  shots?: ScriptBoxShot[];
  assets?: ScriptBoxAsset[];
}

interface StepNavItem {
  n: number;
  title: string;
  desc: string;
  p: number;
}

/**
 * 剧本盒子 三步圆环导航（进度环：镜头/资产/提示词 完成度）。
 * 窗口模式（ScriptBoxNode）与全屏模式（ScriptBoxFullscreen）共用此导航，保证两种视图 UI 一致。
 */
export default function StepNav({ step, setStep, shots, assets }: StepNavProps) {
  const t = (shots || []).length;
  const n = (assets || []).length;
  const i = (assets || []).filter((a) => a.has).length;
  const a = (shots || []).filter((s) => s.prompt || s.videoPrompt).length;
  const steps: StepNavItem[] = [
    { n: 1, title: '确认镜头', desc: t ? `${t}镜头` : '暂无镜头', p: +(t > 0) },
    { n: 2, title: '准备资产', desc: n ? `${i}/${n}` : '暂无资产', p: n ? i / n : 0 },
    { n: 3, title: '合成提示词', desc: t ? `${a}/${t}` : '暂无镜头', p: t ? a / t : 0 },
  ];
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 shrink-0">
      {steps.map((s, k) => {
        const active = step === s.n;
        const off = 2 * Math.PI * 11 * (1 - s.p);
        return (
          <React.Fragment key={s.n}>
            <button
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition-colors ${active ? 'bg-surface-hover' : 'hover:bg-surface-1'}`}
              onClick={() => setStep(s.n)}
            >
              <svg width="28" height="28" className="shrink-0">
                <circle
                  cx="14"
                  cy="14"
                  r="11"
                  fill="none"
                  stroke={active ? '#3a3a3a' : '#2a2a2a'}
                  strokeWidth="2"
                />
                <circle
                  cx="14"
                  cy="14"
                  r="11"
                  fill="none"
                  stroke={active ? '#fff' : '#666'}
                  strokeWidth="2"
                  strokeDasharray={2 * Math.PI * 11}
                  strokeDashoffset={off}
                  transform="rotate(-90 14 14)"
                  style={{ transition: 'all .3s' }}
                />
                <text
                  x="14"
                  y="18"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={active ? '#fff' : '#9ca3af'}
                >
                  {s.n}
                </text>
              </svg>
              <span className="text-left">
                <span
                  className={`block text-body-xs font-medium ${active ? 'text-white' : 'text-muted'}`}
                >
                  {s.title}
                </span>
                <span className="block text-caption text-muted">{s.desc}</span>
              </span>
            </button>
            {k < steps.length - 1 && <div className="w-10 h-px bg-surface-hover-strong" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
