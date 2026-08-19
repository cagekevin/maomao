// TODO(全局, 无需 import): open, nodeCount, onClose, onSave, l, s, i, r, n, o, u
import { e, a, t, c } from './shared.js';
import * as Z from 'react';
export default function H_({
  open: e,
  nodeCount: t,
  onClose: n,
  onSave: r
}) {
  let [i, a] = Z.useState(``);
  let [o, s] = Z.useState(false);
  let [c, l] = Z.useState(``);
  Z.useEffect(() => {
    if (e) {
      a(``);
      l(``);
      s(false);
    }
  }, [e]);
  if (!e) {
    return null;
  }
  let u = async () => {
    let e = i.trim();
    if (!e) {
      l(`请输入模板名称`);
      return;
    }
    s(true);
    l(``);
    try {
      await r(e);
      n();
    } catch (e) {
      l(e?.message || `保存失败`);
      s(false);
    }
  };
  const Component2965 = `h3`;
  const Component2966 = `p`;
  const Component2967 = `label`;
  const Component2968 = `input`;
  const Component2969 = `p`;
  const Component2970 = `button`;
  const Component2971 = `span`;
  const Component2972 = `button`;
  const Component2973 = `div`;
  const Component2974 = `div`;
  const Component2975 = `div`;
  return <Component2975 className={`absolute inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm nowheel nopan nodrag`} onClick={() => {
    return !o && n();
  }}>
      <Component2974 className={`bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl p-6 w-[380px]`} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component2965 className={`text-gray-100 text-lg font-bold text-center mb-1`}>{`创建模板`}</Component2965>
        <Component2966 className={`text-gray-400 text-xs text-center mb-5`}>
          {`将已选 `}
          {t}
          {` 个节点的资料和参数保存到我的模板。当前仅会云端化图片相关资源，视频资源会保留原样不上传。`}
        </Component2966>
        <Component2967 className={`block text-gray-300 text-sm mb-2`}>{`模板名称`}</Component2967>
        <Component2968 className={`w-full bg-[#151414] border border-[#333] rounded-lg px-3 py-2.5 text-gray-100 text-sm mb-1 focus:outline-none focus:border-white/40`} placeholder={`给模板起个名字`} value={i} onChange={e => {
        return a(e.target.value);
      }} disabled={o} autoFocus={true} onKeyDown={e => {
        if (e.key === `Enter`) {
          u();
        }
      }} />
        {c && <Component2969 className={`text-red-400 text-xs mb-1`}>{c}</Component2969>}
        <Component2973 className={`flex items-center gap-3 mt-5`}>
          <Component2970 onClick={() => {
          return !o && n();
        }} disabled={o} className={`flex-1 py-2.5 rounded-lg text-sm font-medium bg-[#2a2a2a] text-gray-300 hover:bg-[#333] border border-[#444] transition-colors disabled:opacity-50`}>{`取消`}</Component2970>
          <Component2972 onClick={u} disabled={o} className={`flex-1 py-2.5 rounded-lg text-sm font-medium bg-white text-[#141414] hover:bg-gray-200 transition-colors disabled:opacity-60 flex items-center justify-center gap-2`}>
            {o && <Component2971 className={`w-4 h-4 border-2 border-[#141414]/30 border-t-[#141414] rounded-full animate-spin`} />}
            {o ? `保存中...` : `保存模板`}
          </Component2972>
        </Component2973>
      </Component2974>
    </Component2975>;
}