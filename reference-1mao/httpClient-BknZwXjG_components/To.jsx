// TODO(全局, 无需 import): data, selected, n, s, r, i, o, width, height, unit
import _cmp__Component8 from './_Component8.jsx';
import _cmp_wo from './wo.jsx';
import { id, e, t, a, Ee, c, X, Se, Gt, _Component27, Kt } from './shared.js';
import * as Z from 'react';
export default function To({
  id: e,
  data: t,
  selected: n
}) {
  let [r, i] = Z.useState();
  let [a, o] = Z.useState();
  let s = Z.useRef(null);
  const Component469 = `span`;
  const Component470 = `span`;
  const Component471 = `button`;
  const Component472 = `span`;
  const Component473 = `button`;
  const Component474 = `div`;
  const Component475 = `div`;
  const Component476 = `img`;
  const Component477 = `div`;
  const Component478 = `div`;
  const Component479 = `div`;
  const Component480 = `div`;
  return <Component480 className={`relative flex flex-col ${n ? `z-50` : `z-40`}`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`裁剪模式`} icon={<Component469 className={`text-gray-500`}>{`✂️`}</Component469>} />
      <Component479 className={`relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <Component475 className={`p-2 bg-[#2a2a2a] flex justify-end items-center border-b border-[#333]`}>
          <Component474 className={`flex gap-2`}>
            <Component471 onClick={async () => {
            if (a && s.current && t.onCropComplete && a.width && a.height) {
              try {
                let n = await _cmp_wo(s.current, a);
                t.onCropComplete(e, n);
              } catch (e) {
                console.error(`Crop failed`, e);
              }
            }
          }} className={`p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-md transition-colors flex items-center gap-1`} title={`确认裁剪`}>
              <Se size={14} />
              <Component470 className={`text-xs`}>{`确认`}</Component470>
            </Component471>
            <Component473 onClick={() => {
            if (t.onCancel) {
              t.onCancel(e);
            }
          }} className={`p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors flex items-center gap-1`} title={`取消`}>
              <Gt size={14} />
              <Component472 className={`text-xs`}>{`取消`}</Component472>
            </Component473>
          </Component474>
        </Component475>
        <Component478 className={`p-4 bg-[#0d0c0c] min-w-[300px] min-h-[200px] flex items-center justify-center cursor-crosshair nodrag nowheel`} onMouseDownCapture={e => {
        return e.stopPropagation();
      }} onTouchStartCapture={e => {
        return e.stopPropagation();
      }} onWheelCapture={e => {
        return e.stopPropagation();
      }}>
          {t.imageUrl ? <_Component27 crop={r} onChange={e => {
          return i(e);
        }} onComplete={e => {
          return o(e);
        }} aspect={undefined} minWidth={10} minHeight={10} ruleOfThirds={true} className={`max-w-full max-h-full`}>
              <Component476 ref={s} src={t.imageUrl} onLoad={e => {
            let {
              width: t,
              height: n
            } = e.currentTarget;
            i(Ee(c({
              unit: `%`,
              width: 80
            }, t / n, t, n), t, n));
          }} alt={`Crop me`} className={`max-w-[600px] max-h-[600px] object-contain pointer-events-none select-none`} draggable={false} />
            </_Component27> : <Component477 className={`text-gray-500 text-sm`}>{`等待输入图片...`}</Component477>}
        </Component478>
        <Kt type={`target`} position={X.Left} className={`!bg-[#666] !w-4 !h-4 !border-2 !border-[#333]`} />
        <Kt type={`source`} position={X.Right} className={`!bg-[#666] !w-4 !h-4 !border-2 !border-[#333]`} />
      </Component479>
    </Component480>;
}