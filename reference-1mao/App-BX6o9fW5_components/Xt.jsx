// TODO(全局, 无需 import): active, controller, onClick, n, t
import { e, _Component3 } from './shared.js';
export default function Xt({
  active: e,
  controller: t,
  onClick: n
}) {
  const Component29 = `span`;
  const Component30 = `button`;
  return <Component30 onClick={n} className={`relative text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${e ? `bg-[#252525] text-blue-500 font-bold border border-[#333] shadow-sm` : `text-gray-300 hover:bg-[#222] hover:text-gray-100 border border-transparent`}`}>
      <_Component3 size={16} />
      {` 版本升级`}
      {t.hasUpdate && <Component29 className={`absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full animate-pulse`} />}
    </Component30>;
}