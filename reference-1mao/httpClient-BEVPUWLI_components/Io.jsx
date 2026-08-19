// TODO(全局, 无需 import): data, selected, n, s, r, i, o, width, height, unit
import _cmp_Ti from './Ti.jsx';
import _cmp_Fo from './Fo.jsx';
import { id, e, t, a, Ee, c, X, Se, Gt, _Component24, Kt } from './shared.js';
import * as Z from 'react';
export default function Io({
  id: e,
  data: t,
  selected: n
}) {
  let [r, i] = Z.useState();
  let [a, o] = Z.useState();
  let s = Z.useRef(null);
  const Component475 = `span`;
  const Component476 = `span`;
  const Component477 = `button`;
  const Component478 = `span`;
  const Component479 = `button`;
  const Component480 = `div`;
  const Component481 = `div`;
  const Component482 = `img`;
  const Component483 = `div`;
  const Component484 = `div`;
  const Component485 = `div`;
  const Component486 = `div`;
  return <Component486 className={`relative flex flex-col ${n ? `z-50` : `z-40`}`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`裁剪模式`} icon={<Component475 className={`text-gray-500`}>{`✂️`}</Component475>} />
      <Component485 className={`relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <Component481 className={`p-2 bg-[#2a2a2a] flex justify-end items-center border-b border-[#333]`}>
          <Component480 className={`flex gap-2`}>
            <Component477 onClick={async () => {
            if (a && s.current && t.onCropComplete && a.width && a.height) {
              try {
                let n = await _cmp_Fo(s.current, a);
                t.onCropComplete(e, n);
              } catch (e) {
                console.error(`Crop failed`, e);
              }
            }
          }} className={`p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-md transition-colors flex items-center gap-1`} title={`确认裁剪`}>
              <Se size={14} />
              <Component476 className={`text-xs`}>{`确认`}</Component476>
            </Component477>
            <Component479 onClick={() => {
            if (t.onCancel) {
              t.onCancel(e);
            }
          }} className={`p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors flex items-center gap-1`} title={`取消`}>
              <Gt size={14} />
              <Component478 className={`text-xs`}>{`取消`}</Component478>
            </Component479>
          </Component480>
        </Component481>
        <Component484 className={`p-4 bg-[#0d0c0c] min-w-[300px] min-h-[200px] flex items-center justify-center cursor-crosshair nodrag nowheel`} onMouseDownCapture={e => {
        return e.stopPropagation();
      }} onTouchStartCapture={e => {
        return e.stopPropagation();
      }} onWheelCapture={e => {
        return e.stopPropagation();
      }}>
          {t.imageUrl ? <_Component24 crop={r} onChange={e => {
          return i(e);
        }} onComplete={e => {
          return o(e);
        }} aspect={undefined} minWidth={10} minHeight={10} ruleOfThirds={true} className={`max-w-full max-h-full`}>
              <Component482 ref={s} src={t.imageUrl} onLoad={e => {
            let {
              width: t,
              height: n
            } = e.currentTarget;
            i(Ee(c({
              unit: `%`,
              width: 80
            }, t / n, t, n), t, n));
          }} alt={`Crop me`} className={`max-w-[600px] max-h-[600px] object-contain pointer-events-none select-none`} draggable={false} />
            </_Component24> : <Component483 className={`text-gray-500 text-sm`}>{`等待输入图片...`}</Component483>}
        </Component484>
        <Kt type={`target`} position={X.Left} className={`!bg-[#666] !w-4 !h-4 !border-2 !border-[#333]`} />
        <Kt type={`source`} position={X.Right} className={`!bg-[#666] !w-4 !h-4 !border-2 !border-[#333]`} />
      </Component485>
    </Component486>;
}