// TODO(全局, 无需 import): message, t, n
import _cmp_Mr from './Mr.jsx';
import _cmp_Pr from './Pr.jsx';
import { e, r } from './shared.js';
export default function Nr({
  message: e
}) {
  if (e.role === `user`) {
    const Component682 = `img`;
    const Component683 = `a`;
    const Component684 = `div`;
    const Component685 = `div`;
    const Component686 = `div`;
    const Component687 = `div`;
    return <Component687 className={`flex justify-end`}>
        <Component686 className={`max-w-[85%] flex flex-col items-end gap-1`}>
          {e.attachments && e.attachments.length > 0 && <Component684 className={`flex flex-wrap gap-1 justify-end`}>
              {e.attachments.map((e, t) => {
            return <Component683 href={e.url} target={`_blank`} rel={`noreferrer`} className={`block w-20 h-20 rounded-md overflow-hidden border border-white/20 hover:border-white/50 transition-colors`} title={`点击新窗口打开`} key={t}>
                    <Component682 src={e.url} alt={``} className={`w-full h-full object-cover`} />
                  </Component683>;
          })}
            </Component684>}
          {e.content && <Component685 className={`bg-[#2a2a2a] text-white text-sm rounded-lg rounded-br-sm px-3 py-2 whitespace-pre-wrap break-words border border-[#333]`}>
              {e.content}
            </Component685>}
        </Component686>
      </Component687>;
  }
  if (e.role === `assistant`) {
    const Component688 = `div`;
    const Component689 = `span`;
    const Component690 = `div`;
    const Component691 = `div`;
    const Component692 = `div`;
    return <Component692 className={`flex justify-start`}>
        <Component691 className={`max-w-[85%] w-full`}>
          {e.reasoning && <_cmp_Mr text={e.reasoning} streaming={e.streaming} />}
          {e.tool_calls && e.tool_calls.length > 0 && <Component688 className={`mb-1 space-y-1`}>
              {e.tool_calls.map((e, t) => {
            return <_cmp_Pr name={e.function?.name} args={e.function?.arguments} key={t} />;
          })}
            </Component688>}
          {e.content && <Component690 className={`bg-[#0d0c0c] border border-[#2a2a2a] text-gray-200 text-sm rounded-lg rounded-bl-sm px-3 py-2 whitespace-pre-wrap break-words`}>
              {e.content}
              {e.streaming && <Component689 className={`inline-block w-1 h-3 bg-gray-400 ml-0.5 animate-pulse align-middle`} />}
            </Component690>}
        </Component691>
      </Component692>;
  }
  if (e.role === `tool`) {
    let t = e.content;
    let n = true;
    try {
      let r = JSON.parse(e.content);
      n = !!r.ok;
      t = r.error || (r.ok ? `操作成功${r.nodeId ? `：${r.nodeId}` : ``}` : `操作失败`);
    } catch {}
    const Component693 = `span`;
    const Component694 = `div`;
    const Component695 = `div`;
    return <Component695 className={`flex justify-start`}>
        <Component694 className={`max-w-[85%] text-[11px] text-gray-500 bg-[#0d0c0c] border border-[#222] rounded-md px-2 py-1`}>
          <Component693 className={n ? `text-green-500` : `text-red-400`}>{`●`}</Component693>
          {` `}
          {t}
        </Component694>
      </Component695>;
  }
  return null;
}