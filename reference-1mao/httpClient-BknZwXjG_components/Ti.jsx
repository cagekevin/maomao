// TODO(全局, 无需 import): backgroundUrl, label, children, backgroundImage, background, animation, n
import { e, t } from './shared.js';
export default function Ti({
  backgroundUrl: e,
  label: t = `生成中...`,
  children: n
}) {
  const Component149 = `style`;
  const Component150 = `div`;
  const Component151 = `div`;
  const Component152 = `div`;
  const Component153 = `span`;
  const Component154 = `div`;
  const Component155 = `circle`;
  const Component156 = `path`;
  const Component157 = `svg`;
  const Component158 = `div`;
  const Component159 = `div`;
  const Component160 = `div`;
  const Component161 = `div`;
  return <Component161 className={`absolute inset-0 z-10 flex items-center overflow-hidden bg-[#0d0c0c]`}>
      <Component149>{`
                @keyframes npbSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes npbGlow { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.7; } }
                @keyframes npbShimmer { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(220%) skewX(-20deg); } }
            `}</Component149>
      {e && <Component150 className={`absolute inset-0 bg-cover bg-center opacity-25 blur-xl scale-110`} style={{
      backgroundImage: `url(${e})`
    }} />}
      <Component151 className={`absolute inset-0 bg-black/30`} />
      <Component152 className={`absolute inset-y-0 w-1/2 pointer-events-none`} style={{
      background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)`,
      animation: `npbShimmer 2.2s ease-in-out infinite`
    }} />
      <Component159 className={`absolute top-3 right-3 z-20 flex items-center gap-2`}>
        <Component153 className={`text-[11px] font-medium tracking-wider text-white/80`}>
          {t}
        </Component153>
        <Component158 className={`relative w-6 h-6 flex items-center justify-center`}>
          <Component154 className={`absolute w-8 h-8 rounded-full`} style={{
          background: `radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)`,
          animation: `npbGlow 1.8s ease-in-out infinite`
        }} />
          <Component157 width={`24`} height={`24`} viewBox={`0 0 36 36`} fill={`none`} className={`relative`} style={{
          animation: `npbSpin 0.9s linear infinite`
        }}>
            <Component155 cx={`18`} cy={`18`} r={`15`} stroke={`rgba(255,255,255,0.2)`} strokeWidth={`2.5`} />
            <Component156 d={`M18 3 a15 15 0 0 1 15 15`} stroke={`#ffffff`} strokeWidth={`2.5`} strokeLinecap={`round`} />
          </Component157>
        </Component158>
      </Component159>
      <Component160 className={`relative z-10 max-w-[78%] pl-5 pr-4`}>{n}</Component160>
    </Component161>;
}