// TODO(全局, 无需 import): category, image, icon, label, video, text, r
import { _Component2, Le, _Component3, t, e } from './shared.js';
export default function T_({
  category: e
}) {
  let t = {
    image: {
      icon: _Component2,
      label: `图片`
    },
    video: {
      icon: Le,
      label: `视频`
    },
    text: {
      icon: _Component3,
      label: `文本`
    }
  };
  let {
    icon: _Component119,
    label: r
  } = t[e] || t.image;
  const Component2869 = `span`;
  return <Component2869 className={`flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/55 text-[11px] text-gray-200 backdrop-blur-sm`}>
      <_Component119 size={11} />
      {` `}
      {r}
    </Component2869>;
}