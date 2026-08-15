// TODO(全局, 无需 import): message, t, n
import _cmp_Sr from './Sr.jsx';
import _cmp__Component34 from './_Component34.jsx';
import { e, r } from './shared.js';
export default function Cr({
  message: e
}) {
  if (e.role === `user`) {
    const Component680 = `img`;
    const Component681 = `a`;
    const Component682 = `div`;
    const Component683 = `div`;
    const Component684 = `div`;
    const Component685 = `div`;
    return <Component685 className={`flex justify-end`}>
        <Component684 className={`max-w-[85%] flex flex-col items-end gap-1`}>
          {e.attachments && e.attachments.length > 0 && <Component682 className={`flex flex-wrap gap-1 justify-end`}>
              {e.attachments.map((e, t) => {
            return <Component681 href={e.url} target={`_blank`} rel={`noreferrer`} className={`block w-20 h-20 rounded-md overflow-hidden border border-white/20 hover:border-white/50 transition-colors`} title={`点击新窗口打开`} key={t}>
                    <Component680 src={e.url} alt={``} className={`w-full h-full object-cover`} />
                  </Component681>;
          })}
            </Component682>}
          {e.content && <Component683 className={`bg-[#2a2a2a] text-white text-sm rounded-lg rounded-br-sm px-3 py-2 whitespace-pre-wrap break-words border border-[#333]`}>
              {e.content}
            </Component683>}
        </Component684>
      </Component685>;
  }
  if (e.role === `assistant`) {
    const Component686 = `div`;
    const Component687 = `span`;
    const Component688 = `div`;
    const Component689 = `div`;
    const Component690 = `div`;
    return <Component690 className={`flex justify-start`}>
        <Component689 className={`max-w-[85%] w-full`}>
          {e.reasoning && <_cmp_Sr text={e.reasoning} streaming={e.streaming} />}
          {e.tool_calls && e.tool_calls.length > 0 && <Component686 className={`mb-1 space-y-1`}>
              {e.tool_calls.map((e, t) => {
            return <_cmp__Component34 name={e.function?.name} args={e.function?.arguments} key={t} />;
          })}
            </Component686>}
          {e.content && <Component688 className={`bg-[#0d0c0c] border border-[#2a2a2a] text-gray-200 text-sm rounded-lg rounded-bl-sm px-3 py-2 whitespace-pre-wrap break-words`}>
              {e.content}
              {e.streaming && <Component687 className={`inline-block w-1 h-3 bg-gray-400 ml-0.5 animate-pulse align-middle`} />}
            </Component688>}
        </Component689>
      </Component690>;
  }
  if (e.role === `tool`) {
    let t = e.content;
    let n = true;
    try {
      let r = JSON.parse(e.content);
      n = !!r.ok;
      t = r.error || (r.ok ? `操作成功${r.nodeId ? `：${r.nodeId}` : ``}` : `操作失败`);
    } catch {}
    const Component691 = `span`;
    const Component692 = `div`;
    const Component693 = `div`;
    return <Component693 className={`flex justify-start`}>
        <Component692 className={`max-w-[85%] text-[11px] text-gray-500 bg-[#0d0c0c] border border-[#222] rounded-md px-2 py-1`}>
          <Component691 className={n ? `text-green-500` : `text-red-400`}>{`●`}</Component691>
          {` `}
          {t}
        </Component692>
      </Component693>;
  }
  return null;
}