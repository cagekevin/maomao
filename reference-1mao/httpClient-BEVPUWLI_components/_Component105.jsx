// TODO(全局, 无需 import): visible, fps, nodeCount, edgeCount, memoryMb, engineConnected, zoom, isFpsThrottled, onClose, color, s, n, r, i, o
import { e, Fn, c, t, a } from './shared.js';
export default function _Component105({
  visible: e,
  fps: t,
  nodeCount: n,
  edgeCount: r,
  memoryMb: i,
  engineConnected: a,
  zoom: o,
  isFpsThrottled: s,
  onClose: c
}) {
  if (e) {
    const Component2895 = `span`;
    const Component2896 = `path`;
    const Component2897 = `svg`;
    const Component2898 = `button`;
    const Component2899 = `div`;
    const Component2900 = `span`;
    const Component2901 = `span`;
    const Component2902 = `div`;
    const Component2903 = `span`;
    const Component2904 = `span`;
    const Component2905 = `div`;
    const Component2906 = `span`;
    const Component2907 = `span`;
    const Component2908 = `div`;
    const Component2909 = `span`;
    const Component2910 = `span`;
    const Component2911 = `div`;
    const Component2912 = `span`;
    const Component2913 = `span`;
    const Component2914 = `div`;
    const Component2915 = `span`;
    const Component2916 = `span`;
    const Component2917 = `div`;
    const Component2918 = `span`;
    const Component2919 = `span`;
    const Component2920 = `div`;
    const Component2921 = `div`;
    const Component2922 = `div`;
    return Fn.createPortal(<Component2922 className={`fixed top-3 left-3 z-[9999] select-none pointer-events-auto`} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component2921 className={`bg-black/75 backdrop-blur-md border border-[#444] rounded-xl shadow-2xl p-3 min-w-[180px] text-[11px] font-mono`}>
          <Component2899 className={`flex items-center justify-between mb-2 pb-1.5 border-b border-[#444]`}>
            <Component2895 className={`text-gray-400 font-semibold text-[10px] tracking-wide uppercase`}>{`诊断监控`}</Component2895>
            <Component2898 onClick={c} className={`text-gray-500 hover:text-white hover:bg-white/10 rounded w-4 h-4 flex items-center justify-center transition-colors`}>
              <Component2897 width={`10`} height={`10`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`}>
                <Component2896 d={`M18 6L6 18M6 6l12 12`} />
              </Component2897>
            </Component2898>
          </Component2899>
          <Component2902 className={`flex items-center justify-between mb-1`}>
            <Component2900 className={`text-gray-400`}>{`FPS`}</Component2900>
            <Component2901 className={`font-bold tabular-nums`} style={{
            color: t >= 50 ? `#4ade80` : t >= 30 ? `#facc15` : `#ef4444`
          }}>
              {t}
            </Component2901>
          </Component2902>
          {s && <Component2905 className={`flex items-center justify-between mb-1`}>
              <Component2903 className={`text-gray-400`}>{`卡顿`}</Component2903>
              <Component2904 className={`text-red-400 font-bold`}>{`是`}</Component2904>
            </Component2905>}
          <Component2908 className={`flex items-center justify-between mb-1`}>
            <Component2906 className={`text-gray-400`}>{`节点`}</Component2906>
            <Component2907 className={`text-gray-200 tabular-nums`}>{n}</Component2907>
          </Component2908>
          <Component2911 className={`flex items-center justify-between mb-1`}>
            <Component2909 className={`text-gray-400`}>{`连线`}</Component2909>
            <Component2910 className={`text-gray-200 tabular-nums`}>{r}</Component2910>
          </Component2911>
          <Component2914 className={`flex items-center justify-between mb-1`}>
            <Component2912 className={`text-gray-400`}>{`内存`}</Component2912>
            <Component2913 className={`tabular-nums`} style={{
            color: i > 400 ? `#ef4444` : i > 200 ? `#facc15` : `#4ade80`
          }}>
              {i > 0 ? `${i} MB` : `-`}
            </Component2913>
          </Component2914>
          <Component2917 className={`flex items-center justify-between mb-1`}>
            <Component2915 className={`text-gray-400`}>{`缩放`}</Component2915>
            <Component2916 className={`text-gray-200 tabular-nums`}>
              {(o * 100).toFixed(0)}
              {`%`}
            </Component2916>
          </Component2917>
          <Component2920 className={`flex items-center justify-between`}>
            <Component2918 className={`text-gray-400`}>{`引擎`}</Component2918>
            <Component2919 className={a ? `text-green-400` : `text-red-400`}>
              {a ? `已连接` : `断开`}
            </Component2919>
          </Component2920>
        </Component2921>
      </Component2922>, document.body);
  } else {
    return null;
  }
}