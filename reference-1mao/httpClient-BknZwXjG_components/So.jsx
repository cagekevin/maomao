// TODO(全局, 无需 import): resources, onSelect, onClose, className, o, i, f, n, p, u, r, s, l, g, m
import _cmp__Component24 from './_Component24.jsx';
import { e, t, c, d, a, h, _Component4 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function So({
  resources: e,
  onSelect: t,
  onClose: n,
  className: r = ``
}) {
  let [i, a] = Z.useState(`all`);
  let [o, s] = Z.useState(`materials`);
  let [c, l] = Z.useState(``);
  let [u, d] = Z.useState(1);
  let f = o === `generated` ? `tasks` : `migrated`;
  let p = e.filter(e => {
    if (i === `favorite` && !e.isFavorite) {
      return false;
    }
    let t = (e.folder || ``).trim().replace(/^[/\\]+|[/\\]+$/g, ``);
    if (t !== f && !t.startsWith(`${f}/`) && !t.startsWith(`${f}\\`) && e.name !== f) {
      return false;
    }
    let n = c ? `${f}/${c}` : f;
    return t === n || t === n.replace(/\//g, `\\`);
  });
  p.sort((e, t) => {
    let n = new Date(e.timestamp || 0).getTime();
    return new Date(t.timestamp || 0).getTime() - n;
  });
  let m = Math.ceil(p.length / 16);
  let h = p.slice((u - 1) * 16, u * 16);
  let g = e => {
    return e.type === `audio` || e.type?.startsWith(`audio`) || /\.(flac|mp3|wav|ogg|m4a|aac|opus|wma|aiff)(\?|$)/i.test(e.url || ``);
  };
  const Component355 = `button`;
  const Component356 = `button`;
  const Component357 = `div`;
  const Component358 = `button`;
  const Component359 = `button`;
  const Component360 = `div`;
  const Component361 = `button`;
  const Component362 = `div`;
  const Component363 = `div`;
  const Component364 = `span`;
  const Component365 = `button`;
  const Component366 = `div`;
  const Component367 = `div`;
  const Component368 = `video`;
  const Component369 = `div`;
  const Component370 = `img`;
  const Component371 = `div`;
  const Component372 = `span`;
  const Component373 = `div`;
  const Component374 = `video`;
  const Component375 = `polygon`;
  const Component376 = `svg`;
  const Component377 = `div`;
  const Component378 = `div`;
  const Component379 = `path`;
  const Component380 = `circle`;
  const Component381 = `circle`;
  const Component382 = `svg`;
  const Component383 = `span`;
  const Component384 = `div`;
  const Component385 = `img`;
  const Component386 = `span`;
  const Component387 = `div`;
  const Component388 = `div`;
  const Component389 = `div`;
  const Component390 = `div`;
  const Component391 = `button`;
  const Component392 = `span`;
  const Component393 = `button`;
  const Component394 = `div`;
  const Component395 = `div`;
  return <Component395 className={`w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[100] flex flex-col overflow-hidden ${r}`} onClick={e => {
    return e.stopPropagation();
  }} onWheel={e => {
    return e.stopPropagation();
  }}>
      <Component363 className={`flex items-center justify-between p-1 border-b border-[#333] bg-[#1a1a1a]`}>
        <Component357 className={`flex gap-1`}>
          <Component355 className={`px-3 py-1 rounded text-xs font-bold ${o === `materials` ? `bg-[#333] text-white` : `text-gray-500 hover:text-gray-300`}`} onClick={() => {
          s(`materials`);
          l(``);
          d(1);
        }}>{`素材`}</Component355>
          <Component356 className={`px-3 py-1 rounded text-xs font-bold ${o === `generated` ? `bg-[#333] text-white` : `text-gray-500 hover:text-gray-300`}`} onClick={() => {
          s(`generated`);
          l(``);
          d(1);
        }}>{`生成`}</Component356>
        </Component357>
        <Component362 className={`flex items-center gap-2`}>
          <Component360 className={`flex bg-[#111] rounded p-0.5`}>
            <Component358 className={`px-2 py-0.5 rounded-[4px] text-[10px] ${i === `all` ? `bg-[#333] text-white` : `text-gray-500`}`} onClick={() => {
            a(`all`);
            d(1);
          }}>{`全部`}</Component358>
            <Component359 className={`px-2 py-0.5 rounded-[4px] text-[10px] ${i === `favorite` ? `bg-[#333] text-white` : `text-gray-500`}`} onClick={() => {
            a(`favorite`);
            d(1);
          }}>{`收藏`}</Component359>
          </Component360>
          <Component361 className={`text-gray-500 hover:text-white pr-1`} onClick={n}>{`×`}</Component361>
        </Component362>
      </Component363>
      {c && <Component366 className={`px-2 py-1 bg-[#1a1a1a] border-b border-[#333]`}>
          <Component365 onClick={() => {
        let e = c.split(`/`);
        e.pop();
        l(e.join(`/`));
        d(1);
      }} className={`flex items-center gap-1 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-bold transition-colors`}>
            <Component364 className={`text-sm mb-0.5 leading-none`}>{`‹`}</Component364>
            {c.split(`/`).pop()}
          </Component365>
        </Component366>}
      <Component390 className={`p-2 h-48 overflow-y-auto custom-scrollbar`}>
        {p.length === 0 ? <Component367 className={`text-center text-gray-500 text-xs py-10`}>{`当前目录为空`}</Component367> : <Component389 className={`grid grid-cols-4 gap-1.5`}>
            {h.map(n => {
          return <Component388 className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group flex flex-col items-center justify-center`} onClick={() => {
            if (n.type === `folder`) {
              l(c ? `${c}/${n.name}` : n.name || ``);
              d(1);
            } else {
              t(n);
            }
          }} title={n.pageTitle || n.name || `素材`} key={n.id}>
                  {n.type === `folder` ? <Q.Fragment>
                      <Component371 className={`absolute inset-0 p-1 grid grid-cols-2 gap-0.5 overflow-hidden opacity-40 mix-blend-screen pointer-events-none`}>
                        {e.filter(e => {
                  return e.type !== `folder` && e.folder === `${f}${n.folder ? `/${n.folder}` : ``}/${n.name}`;
                }).sort((e, t) => {
                  return (t.timestamp || 0) - (e.timestamp || 0);
                }).slice(0, 3).map(e => {
                  if (e.type?.startsWith(`video`)) {
                    return <Component368 src={e.url} className={`w-full h-full object-cover rounded-[1px]`} key={e.id} />;
                  } else {
                    if (e.type?.startsWith(`text`)) {
                      return <Component369 className={`w-full h-full bg-[#111] rounded-[1px] text-[3px] text-gray-500 overflow-hidden break-all`} key={e.id}>
                                    {e.url.substring(0, 10)}
                                    {`...`}
                                  </Component369>;
                    } else {
                      return <Component370 src={e.url} className={`w-full h-full object-cover rounded-[1px]`} key={e.id} />;
                    }
                  }
                })}
                      </Component371>
                      <_Component4 size={24} className={`text-orange-400 opacity-80 z-10 drop-shadow-md`} strokeWidth={1.5} />
                      <Component372 className={`text-[8px] text-gray-400 mt-1 w-full text-center truncate px-1 z-10 drop-shadow-md`}>
                        {n.name}
                      </Component372>
                    </Q.Fragment> : n.type === `text` ? <Component373 className={`p-1 text-[8px] text-gray-400 break-all overflow-hidden h-full w-full bg-[#1a1a1a]`}>
                      <_cmp__Component24 url={n.url} />
                    </Component373> : n.type.startsWith(`video/`) || n.type === `video` ? <Q.Fragment>
                      <Component374 src={n.url} className={`w-full h-full object-cover bg-black`} />
                      <Component378 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                        <Component377 className={`w-6 h-6 rounded-full bg-black/40 flex items-center justify-center border border-white/20 backdrop-blur-sm`}>
                          <Component376 width={`12`} height={`12`} viewBox={`0 0 24 24`} fill={`white`} stroke={`white`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`} className={`ml-0.5`}>
                            <Component375 points={`5 3 19 12 5 21 5 3`} />
                          </Component376>
                        </Component377>
                      </Component378>
                    </Q.Fragment> : g(n) ? <Component384 className={`w-full h-full bg-gradient-to-b from-[#1d2230] to-[#0e0f12] flex flex-col items-center justify-center gap-1`}>
                      <Component382 width={`20`} height={`20`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#60a5fa`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                        <Component379 d={`M9 18V5l12-2v13`} />
                        <Component380 cx={`6`} cy={`18`} r={`3`} />
                        <Component381 cx={`18`} cy={`16`} r={`3`} />
                      </Component382>
                      <Component383 className={`text-[8px] text-blue-300/70`}>{`音频`}</Component383>
                    </Component384> : <Component385 src={n.url} className={`w-full h-full object-cover bg-black`} />}
                  {n.type !== `folder` && <Component387 className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}>
                      <Component386 className={`text-[10px] text-white`}>{`选择`}</Component386>
                    </Component387>}
                </Component388>;
        })}
          </Component389>}
      </Component390>
      {m > 1 && <Component394 className={`flex items-center justify-between p-1.5 border-t border-[#333] bg-[#1a1a1a]`}>
          <Component391 disabled={u === 1} onClick={() => {
        return d(e => {
          return Math.max(1, e - 1);
        });
      }} className={`text-[10px] px-2 py-0.5 bg-[#333] rounded disabled:opacity-30 text-gray-300`}>{`上一页`}</Component391>
          <Component392 className={`text-[10px] text-gray-500`}>
            {u}
            {` / `}
            {m}
          </Component392>
          <Component393 disabled={u === m} onClick={() => {
        return d(e => {
          return Math.min(m, e + 1);
        });
      }} className={`text-[10px] px-2 py-0.5 bg-[#333] rounded disabled:opacity-30 text-gray-300`}>{`下一页`}</Component393>
        </Component394>}
    </Component395>;
}