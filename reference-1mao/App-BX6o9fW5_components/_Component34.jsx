// TODO(全局, 无需 import): name, args, t, n
import { e } from './shared.js';
export default function _Component34({
  name: e,
  args: t
}) {
  let n = t || ``;
  try {
    let e = JSON.parse(t || `{}`);
    n = Object.entries(e).map(([e, t]) => {
      return `${e}=${typeof t == `string` ? t : JSON.stringify(t)}`;
    }).join(`, `);
  } catch {}
  const Component694 = `path`;
  const Component695 = `svg`;
  const Component696 = `span`;
  const Component697 = `span`;
  const Component698 = `div`;
  return <Component698 className={`inline-flex items-center gap-1 text-[11px] text-purple-300 bg-purple-950/30 border border-purple-800/30 rounded-md px-2 py-0.5`}>
      <Component695 width={`10`} height={`10`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2.5`} strokeLinecap={`round`} strokeLinejoin={`round`}>
        <Component694 d={`M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z`} />
      </Component695>
      <Component696 className={`font-mono`}>{e}</Component696>
      {n && <Component697 className={`text-purple-400 truncate max-w-[200px]`}>{n}</Component697>}
    </Component698>;
}