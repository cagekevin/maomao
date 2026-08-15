// TODO(全局, 无需 import): open, title, onClose, children, n, o, i, r, s, l, width, height, maxWidth, maxHeight
import { w, h, e, t, a, c, Fn, Ke, Gt } from './shared.js';
import * as Z from 'react';
var Ai = ({
  open: e,
  title: t = `编辑输入`,
  onClose: n,
  children: r
}) => {
  let [i, a] = Z.useState(() => {
    return {
      w: Math.min(1152, Math.round(window.innerWidth * 0.8)),
      h: Math.round(window.innerHeight * 0.8)
    };
  });
  let o = Z.useRef(null);
  Z.useEffect(() => {
    if (!e) {
      return;
    }
    let t = e => {
      if (e.key === `Escape`) {
        n();
      }
    };
    window.addEventListener(`keydown`, t);
    return () => {
      return window.removeEventListener(`keydown`, t);
    };
  }, [e, n]);
  let s = Z.useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    let t = e.clientX;
    let n = e.clientY;
    let r = o.current?.offsetWidth ?? i.w;
    let s = o.current?.offsetHeight ?? i.h;
    let c = e => {
      a({
        w: Math.max(480, Math.min(window.innerWidth - 40, r + (e.clientX - t))),
        h: Math.max(320, Math.min(window.innerHeight - 40, s + (e.clientY - n)))
      });
    };
    let l = () => {
      window.removeEventListener(`mousemove`, c);
      window.removeEventListener(`mouseup`, l);
    };
    window.addEventListener(`mousemove`, c);
    window.addEventListener(`mouseup`, l);
  }, [i.w, i.h]);
  if (e) {
    const Component173 = `span`;
    const Component174 = `div`;
    const Component175 = `span`;
    const Component176 = `button`;
    const Component177 = `div`;
    const Component178 = `div`;
    const Component179 = `div`;
    const Component180 = `line`;
    const Component181 = `line`;
    const Component182 = `line`;
    const Component183 = `svg`;
    const Component184 = `div`;
    const Component185 = `div`;
    const Component186 = `div`;
    return Fn.createPortal(<Component186 className={`fixed inset-0 z-[2147483646] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 input-panel-fullscreen-root`} onMouseDown={e => {
      return e.stopPropagation();
    }} onWheel={e => {
      return e.stopPropagation();
    }} onClick={e => {
      if (e.target === e.currentTarget) {
        n();
      }
    }}>
        <Component185 ref={o} className={`relative bg-[#1c1c1c] border border-[#333] rounded-xl shadow-2xl flex flex-col overflow-visible`} style={{
        width: i.w,
        height: i.h,
        maxWidth: `95vw`,
        maxHeight: `95vh`
      }}>
          <Component178 className={`flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a2a] bg-[#222] flex-shrink-0`}>
            <Component174 className={`flex items-center gap-2 text-sm text-gray-200`}>
              <Ke size={14} className={`text-blue-400`} />
              <Component173>{t}</Component173>
            </Component174>
            <Component177 className={`flex items-center gap-2`}>
              <Component175 className={`text-[11px] text-gray-500`}>{`Esc 关闭 · 点击空白处关闭`}</Component175>
              <Component176 className={`p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors`} onClick={n} title={`关闭全屏`}>
                <Gt size={16} />
              </Component176>
            </Component177>
          </Component178>
          <Component179 className={`flex-1 min-h-0 p-5 input-panel-fullscreen overflow-auto custom-scrollbar flex flex-col`}>
            {r}
          </Component179>
          <Component184 className={`absolute right-1 bottom-1 w-5 h-5 flex items-end justify-end cursor-nwse-resize select-none z-10`} title={`拖动调整窗口大小`} onMouseDown={s}>
            <Component183 viewBox={`0 0 16 16`} width={`16`} height={`16`} className={`block text-gray-500 hover:text-blue-400 transition-colors pointer-events-none`} aria-hidden={`true`}>
              <Component180 x1={`14`} y1={`6`} x2={`6`} y2={`14`} stroke={`currentColor`} strokeWidth={`1.6`} strokeLinecap={`round`} />
              <Component181 x1={`14`} y1={`9.5`} x2={`9.5`} y2={`14`} stroke={`currentColor`} strokeWidth={`1.6`} strokeLinecap={`round`} />
              <Component182 x1={`14`} y1={`13`} x2={`13`} y2={`14`} stroke={`currentColor`} strokeWidth={`1.6`} strokeLinecap={`round`} />
            </Component183>
          </Component184>
        </Component185>
      </Component186>, document.body);
  } else {
    return null;
  }
};
export default Ai;