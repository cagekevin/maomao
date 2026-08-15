// TODO(全局, 无需 import): visible, text, background, animation, filter, strokeDasharray
import { e, Ci, t } from './shared.js';
export default function _Component127({
  visible: e,
  text: t = `正在渲染画布...`
}) {
  const Component137 = `style`;
  const Component138 = `div`;
  const Component139 = `circle`;
  const Component140 = `circle`;
  const Component141 = `svg`;
  const Component142 = `path`;
  const Component143 = `path`;
  const Component144 = `svg`;
  const Component145 = `div`;
  const Component146 = `div`;
  const Component147 = `div`;
  const Component148 = `div`;
  return <Component148 className={`absolute inset-0 z-50 flex items-center justify-center bg-[#0d0c0c]/92 backdrop-blur-md transition-all duration-500 ${e ? `opacity-100 pointer-events-auto` : `opacity-0 pointer-events-none`}`}>
      <Component137>{`
                @keyframes clPenDraw {
                    0% { stroke-dashoffset: 90; }
                    55% { stroke-dashoffset: 0; }
                    78% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: 90; }
                }
                @keyframes clPenFill {
                    0%, 100% { opacity: 0.1; }
                    55%, 78% { opacity: 1; }
                }
                @keyframes clPenFloat {
                    0%, 100% { transform: translateY(0) rotate(-2deg); }
                    50% { transform: translateY(-6px) rotate(2deg); }
                }
                @keyframes clHalo {
                    0%, 100% { opacity: 0.18; transform: scale(0.88); }
                    50% { opacity: 0.5; transform: scale(1.18); }
                }
                @keyframes clRing {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes clText {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
            `}</Component137>
      <Component147 className={`flex flex-col items-center gap-7`}>
        <Component145 className={`relative w-28 h-28 flex items-center justify-center`}>
          <Component138 className={`absolute w-24 h-24 rounded-full`} style={{
          background: `radial-gradient(circle, rgba(210,2,7,0.45) 0%, rgba(210,2,7,0) 70%)`,
          animation: `clHalo 2.4s ease-in-out infinite`
        }} />
          <Component141 className={`absolute`} width={`104`} height={`104`} viewBox={`0 0 104 104`} fill={`none`} style={{
          animation: `clRing 3.2s linear infinite`
        }}>
            <Component139 cx={`52`} cy={`52`} r={`49`} stroke={`rgba(255,255,255,0.07)`} strokeWidth={`1.5`} />
            <Component140 cx={`52`} cy={`52`} r={`49`} stroke={`rgba(210,2,7,0.7)`} strokeWidth={`1.5`} strokeLinecap={`round`} strokeDasharray={`40 240`} />
          </Component141>
          <Component144 viewBox={`0 0 20.7624 28.8621`} width={`60`} height={`84`} fill={`none`} style={{
          animation: `clPenFloat 3s ease-in-out infinite`,
          filter: `drop-shadow(0 4px 14px rgba(210,2,7,0.45))`
        }}>
            <Component142 d={Ci} fill={`rgb(210,2,7)`} fillRule={`evenodd`} style={{
            animation: `clPenFill 2s ease-in-out infinite`
          }} />
            <Component143 d={Ci} fill={`none`} stroke={`#ffffff`} strokeWidth={`0.7`} strokeLinecap={`round`} strokeLinejoin={`round`} style={{
            strokeDasharray: 90,
            animation: `clPenDraw 2s ease-in-out infinite`
          }} />
          </Component144>
        </Component145>
        <Component146 className={`text-white text-xl font-bold tracking-[0.2em]`} style={{
        animation: `clText 1.8s ease-in-out infinite`
      }}>
          {t}
        </Component146>
      </Component147>
    </Component148>;
}