// TODO(全局, 无需 import): panelRef, style, onClose, b, m, x, i, n, o, r, p, v, g, f, color, display, alignItems, gap, width, height, borderRadius, border, borderTopColor, animation, flexShrink, u, l, s, geometryType, position, rotation, scale, args, name, kind, visible, locked, compositeShapes, transform
import { xa, Da, ka, y, Kr, Yi, $n, Qi, a, h, Zi, _, S, ca, ta, na, la, Oa, Mm, $, id, d, Gt, _Component36, _Component20, _Component100 } from "./shared.js";
import * as _shared from "./shared.js";
import * as Z from "react";
import * as Q from "react";
export default function Nm({
  panelRef: e,
  style: t,
  onClose: n
} = {}) {
  let [r, i] = Z.useState(``);
  let a = `#b0b8c4`;
  let [o, s] = Z.useState(false);
  let [c, l] = Z.useState(null);
  let [u, d] = Z.useState(null);
  let [f, p] = Z.useState(``);
  let [m, h] = Z.useState(localStorage.getItem(`director_ai_model`) || `gpt-4o`);
  let [g, _] = Z.useState(false);
  let v = Z.useRef(null);
  let [y, b] = Z.useState(() => {
    return xa().filter(e => {
      return e.enabled && e.category === `text`;
    });
  });
  Z.useEffect(() => {
    return Da(e => {
      b(e.filter(e => {
        return e.enabled && e.category === `text`;
      }));
    });
  }, []);
  let x = ka(m);
  let S = x ? y.find(e => {
    return e.id === x;
  }) : null;
  Z.useEffect(() => {
    let e = false;
    async function t() {
      let t = await Kr.getObject(`app_settings`);
      let n = `gpt-4o`;
      if (t && t.textModel) {
        n = t.textModel;
      }
      await Yi($n(``)).catch(() => {
        return null;
      });
      if (e) {
        return;
      }
      let r = Qi().text || [];
      let i = new Set();
      let a = [];
      let o = e => {
        let t = (e || ``).trim();
        if (!!t && !i.has(t)) {
          i.add(t);
          a.push(t);
        }
      };
      (n || ``).split(`
`).forEach(o);
      (r || []).forEach(o);
      p(a.join(`
`));
      let s = localStorage.getItem(`director_ai_model`);
      if (!s && a.length > 0) {
        h(a[0]);
      } else if (!s) {
        h(`gpt-4o`);
      }
    }
    t();
    let n = Zi(() => {
      t();
    });
    return () => {
      e = true;
      n();
    };
  }, []);
  Z.useEffect(() => {
    let e = e => {
      if (v.current && !v.current.contains(e.target)) {
        _(false);
      }
    };
    if (g) {
      document.addEventListener(`mousedown`, e, true);
    }
    return () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [g]);
  const Component2099 = `h2`;
  const Component2100 = `button`;
  const Component2101 = `div`;
  const Component2102 = `span`;
  const Component2103 = `span`;
  const Component2104 = `span`;
  const Component2105 = `span`;
  const Component2106 = `div`;
  const Component2107 = `button`;
  const Component2128 = `div`;
  const Component2129 = `div`;
  const Component2130 = `input`;
  const Component2131 = `div`;
  const Component2132 = `span`;
  const Component2133 = `div`;
  const Component2134 = `p`;
  const Component2135 = `p`;
  const Component2136 = `button`;
  const Component2137 = `div`;
  const Component2138 = `section`;
  return <Component2138 className={n ? `model-library-panel ai-model-generator-panel` : `panel-card mt-4`} ref={e} style={t} role={n ? `dialog` : undefined} aria-label={`AI 空间模型生成`}>
      <Component2101 className={n ? `model-library-header` : ``}>
        <Component2099 className={n ? `model-library-title` : ``}>{`AI 空间模型生成`}</Component2099>
        {n && <Component2100 aria-label={`关闭面板`} className={`top-bar-action-button model-library-close-button`} type={`button`} onClick={n}>
            <Gt aria-hidden={`true`} size={16} strokeWidth={1.8} />
          </Component2100>}
      </Component2101>
      <Component2137 className={`flex flex-col gap-3 ${n ? `p-4` : ``}`}>
        {(!!f && !!(f.split(`
`).filter(e => {
        return e.trim() !== ``;
      }).length > 0) || !!(y.length > 0)) && <Component2129 className={`relative flex flex-col gap-1`} ref={v}>
            <Component2102 className={`ai-model-field-label`}>{`选择文本大模型`}</Component2102>
            <Component2107 className={`ai-model-select-trigger`} onClick={e => {
          e.stopPropagation();
          _(!g);
        }} title={S ? `调度：${S.name}` : m ? `${m}（${ca(m) ? `内置` : `第三方`}）` : `选择模型`}>
              <Component2106 className={`flex items-center gap-1 truncate`}>
                {S ? <Component2103 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component2103> : m && <Component2104 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ca(m) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                      {ca(m) ? `内置` : `三方`}
                    </Component2104>}
                <Component2105 className={`whitespace-nowrap truncate`}>
                  {S ? S.name : m || `选择模型`}
                </Component2105>
              </Component2106>
              <_Component36 size={14} className={`text-gray-500 shrink-0`} />
            </Component2107>
            {g && <Component2128 className={`ai-model-select-dropdown absolute bottom-full left-0 mb-1 w-full min-w-[17rem] max-w-[29rem] rounded-lg shadow-xl p-2 z-[100] block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onWheel={e => {
          return e.stopPropagation();
        }} onClick={e => {
          return e.stopPropagation();
        }}>
                {(() => {
            let e = (f || ``).split(`
`).map(e => {
              return e.trim();
            }).filter(e => {
              return e !== ``;
            });
            let t = e.filter(e => {
              return ca(e);
            }).sort((e, t) => {
              return e.localeCompare(t);
            });
            let n = e.filter(e => {
              return !ca(e);
            }).sort((e, t) => {
              return e.localeCompare(t);
            });
            let r = (e, t, n) => {
              let r = n ? ta(e) : null;
              let i = n ? na(e) : null;
              const Component2108 = `span`;
              const Component2109 = `span`;
              const Component2110 = `span`;
              const Component2111 = `span`;
              const Component2112 = `div`;
              return <Component2112 role={`button`} className={`ai-model-option ${m === e ? `is-active` : ``}`} onClick={() => {
                h(e);
                localStorage.setItem(`director_ai_model`, e);
                _(false);
              }} title={e} key={`${n ? `b` : `o`}-${t}`}>
                        <Component2108 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${n ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                          {n ? `内置` : `三方`}
                        </Component2108>
                        <Component2109 className={`flex-1 whitespace-nowrap truncate`}>
                          {e}
                        </Component2109>
                        {r !== null && <Component2111 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                            <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                            <Component2110>
                              {la(r)}
                              {i ? `/${i}` : ``}
                            </Component2110>
                          </Component2111>}
                      </Component2112>;
            };
            const Component2113 = `span`;
            const Component2114 = `span`;
            const Component2115 = `span`;
            const Component2116 = `div`;
            const Component2121 = `div`;
            const Component2122 = `span`;
            const Component2123 = `span`;
            const Component2124 = `span`;
            const Component2125 = `div`;
            const Component2126 = `div`;
            const Component2127 = `div`;
            return <Q.Fragment>
                      {y.length > 0 && <Q.Fragment>
                          <Component2116 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between`}>
                            <Component2114 className={`flex items-center gap-1`}>
                              <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                              <Component2113>{`模型调度`}</Component2113>
                            </Component2114>
                            <Component2115 className={`ml-auto text-white/90 hover:text-white cursor-pointer transition-colors`} onClick={e => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent(`mutiwindow-open-schedule-settings`));
                  }}>{`配置 ›`}</Component2115>
                          </Component2116>
                          {y.map(e => {
                  let t = Oa(e.id);
                  const Component2117 = `span`;
                  const Component2118 = `span`;
                  const Component2119 = `span`;
                  const Component2120 = `div`;
                  return <Component2120 role={`button`} className={`ai-model-option ${m === t ? `is-active` : ``}`} onClick={() => {
                    h(t);
                    localStorage.setItem(`director_ai_model`, t);
                    _(false);
                  }} title={`${e.name}（${e.steps.length} 个模型按序重试）`} key={e.id}>
                                <Component2117 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component2117>
                                <Component2118 className={`flex-1 whitespace-nowrap truncate`}>
                                  {e.name}
                                </Component2118>
                                <Component2119 className={`shrink-0 text-[10px] text-gray-500`}>
                                  {e.steps.length}
                                  {` 模型`}
                                </Component2119>
                              </Component2120>;
                })}
                          {(t.length > 0 || n.length > 0) && <Component2121 className={`ai-model-divider`} />}
                        </Q.Fragment>}
                      {t.length > 0 && <Q.Fragment>
                          <Component2125 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`}>
                            <Component2122>{`✨`}</Component2122>
                            <Component2123>{`内置模型`}</Component2123>
                            <Component2124 className={`ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`} onClick={e => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`));
                    _(false);
                  }} title={`查看内置模型详情`}>{`详情 ›`}</Component2124>
                          </Component2125>
                          {t.map((e, t) => {
                  return r(e, t, true);
                })}
                        </Q.Fragment>}
                      {n.length > 0 && <Q.Fragment>
                          {t.length > 0 && <Component2126 className={`ai-model-divider`} />}
                          <Component2127 className={`text-[10px] text-gray-500 mb-1 px-1`}>{`第三方 API`}</Component2127>
                          {n.map((e, t) => {
                  return r(e, t, false);
                })}
                        </Q.Fragment>}
                    </Q.Fragment>;
          })()}
              </Component2128>}
          </Component2129>}
        <Component2131 className={`flex items-center gap-2`}>
          <Component2130 type={`text`} autoComplete={`off`} spellCheck={`false`} value={r} onChange={e => {
          return i(e.target.value);
        }} placeholder={`输入占位物体名称, 如: 桌子`} className={`ui-field flex-1 min-w-0`} />
        </Component2131>
        {o && <Component2133 className={`capture-status`} style={{
        color: `#93c5fd`,
        display: `flex`,
        alignItems: `center`,
        gap: 8
      }}>
            <Component2132 aria-hidden={`true`} style={{
          width: 12,
          height: 12,
          borderRadius: `50%`,
          border: `2px solid rgba(147,197,253,0.35)`,
          borderTopColor: `#93c5fd`,
          animation: `director-spin 0.8s linear infinite`,
          display: `inline-block`,
          flexShrink: 0
        }} />
            {`正在生成 3D 模型并添加到场景…`}
          </Component2133>}
        {c && !o && <Component2134 className={`capture-status`} style={{
        color: `#f87171`
      }}>
            {c}
          </Component2134>}
        {u && !o && !c && <Component2135 className={`capture-status`} style={{
        color: `#4ade80`
      }}>
            {u}
          </Component2135>}
        <Component2136 type={`button`} disabled={o} className={`ai-model-generate-button`} onClick={async () => {
        if (!r) {
          l(`请输入要生成的占位物体名称`);
          return;
        }
        l(null);
        s(true);
        let e = S ? S.steps[0].model : m || `gpt-4o`;
        let t = `请根据我的描述生成一个3D模型的JSON描述。
描述内容：${r}

规则如下：
返回一个严格的JSON对象，包含 shapes 数组。每个 shape 包含：
- type: "box" | "sphere" | "cylinder" | "cone" | "torus" | "pyramid"
- position: [x, y, z] (相对于模型中心的坐标)
- rotation: [x, y, z] (欧拉角，弧度)
- scale: [x, y, z] (缩放)
- color: 颜色字符串，如 "#ff0000"
- args: 几何体参数数组 (box: [长,高,宽], sphere: [半径,经纬度分段,经纬度分段], cylinder: [顶半径,底半径,高度,径向分段])

请确保只返回JSON，不要包含任何markdown包裹符号或解释文本。
示例格式：
{
  "shapes": [
    { "type": "box", "position": [0, 0.5, 0], "args": [1, 1, 1], "color": "#cccccc" }
  ]
}`;
        try {
          let n = await Mm(t, e);
          n = n.trim();
          if (n.startsWith('```json')) {
            n = n.replace(/^```json\s*/i, ``).replace(/```$/, ``).trim();
          } else if (n.startsWith('```')) {
            n = n.replace(/^```\s*/, ``).replace(/```$/, ``).trim();
          }
          let i = JSON.parse(n);
          let o = i.shapes || i;
          if (Array.isArray(o)) {
            let e = $.getState();
            let t = 0;
            let n = 1;
            let i = 0;
            if (e.project.activeCameraId) {
              let r = e.project.cameras.find(t => {
                return t.id === e.project.activeCameraId;
              });
              if (r) {
                t = r.target[0];
                n = r.target[2];
                i = r.target[1];
              }
            }
            let s = o.map(e => {
              let t = e.type;
              return {
                geometryType: [`box`, `sphere`, `cylinder`, `torus`, `cone`, `pyramid`].includes(t) ? t : `box`,
                position: e.position || [0, 0, 0],
                rotation: e.rotation || [0, 0, 0],
                scale: e.scale || [1, 1, 1],
                color: e.color || a,
                args: Array.isArray(e.args) ? e.args : undefined
              };
            });
            let c = Infinity;
            let l = -Infinity;
            let u = Infinity;
            let f = -Infinity;
            let p = Infinity;
            let m = -Infinity;
            s.forEach(e => {
              c = Math.min(c, e.position[0]);
              l = Math.max(l, e.position[0]);
              u = Math.min(u, e.position[1]);
              f = Math.max(f, e.position[1]);
              p = Math.min(p, e.position[2]);
              m = Math.max(m, e.position[2]);
            });
            let h = Number.isFinite(c) ? (c + l) / 2 : 0;
            let g = Number.isFinite(u) ? (u + f) / 2 : 0;
            let _ = Number.isFinite(p) ? (p + m) / 2 : 0;
            let v = s.map(e => {
              return {
                ...e,
                position: [e.position[0] - h, e.position[1] - g, e.position[2] - _]
              };
            });
            let y = r.trim() || `AI模型`;
            let b = e.project.objects.filter(e => {
              return e.name === y || e.name.startsWith(`${y}`);
            }).length;
            let x = b === 0 ? y : `${y}${String(b + 1).padStart(2, `0`)}`;
            let S = {
              id: `ai_${Math.random().toString(36).substr(2, 9)}`,
              name: x,
              kind: `prop`,
              visible: true,
              locked: false,
              color: a,
              compositeShapes: v,
              transform: {
                position: [t, i, n],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
              }
            };
            $.getState().addDirectorObject(S);
            d(`已添加「${x}」到场景`);
          } else {
            throw Error(`格式错误：未找到有效的 shapes 数组`);
          }
        } catch (e) {
          console.error(`Generate 3D Model Error:`, e);
          l(`生成失败：${e?.message ? String(e.message) : `未知错误`}`);
          d(null);
        } finally {
          s(false);
        }
      }}>
          <_Component100 size={14} />
          {` `}
          {o ? `AI 生成中...` : `生成 3D 模型并添加到场景`}
        </Component2136>
      </Component2137>
    </Component2138>;
}