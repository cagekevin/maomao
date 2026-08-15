// TODO(全局, 无需 import): size, className, width, height, animation
import { t, e } from './shared.js';
export default function Si({
  size: e = 32,
  className: t = ``
}) {
  const Component132 = `style`;
  const Component133 = `circle`;
  const Component134 = `path`;
  const Component135 = `svg`;
  const Component136 = `div`;
  return <Component136 className={t} style={{
    width: e,
    height: e
  }}>
      <Component132>{`
                @keyframes nodeSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</Component132>
      <Component135 width={e} height={e} viewBox={`0 0 36 36`} fill={`none`} style={{
      animation: `nodeSpin 0.9s linear infinite`
    }}>
        <Component133 cx={`18`} cy={`18`} r={`15`} stroke={`rgba(255,255,255,0.18)`} strokeWidth={`3`} />
        <Component134 d={`M18 3 a15 15 0 0 1 15 15`} stroke={`rgb(210,2,7)`} strokeWidth={`3`} strokeLinecap={`round`} />
      </Component135>
    </Component136>;
}