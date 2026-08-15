// TODO(全局, 无需 import): data, selected, updateNodeData, getNode, setNodes, i, n, f, p, r, aspectRatio, highQuality, m, style, width, height, k, HTMLTextAreaElement, handleType, b, imageUrl, url, label, s, debounce, preserveDrawingBuffer, antialias, alpha, powerPreference, position, left, display, u, o, g, v, WebkitAppearance, MozAppearance, justifyContent, alignItems, maxHeight, maxWidth, l, panoType, margin
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_Xl from './Xl.jsx';
import { id, We, t, e, c, w, h, C, T, a, Qt, Lt, N, y, M, A, j, _, S, D, X, P, F, E, O, d, Fn, _Component60, _Component61, Et, _Component28, Ke, _Component0, Gt } from './shared.js';
import * as Z from 'react';
var Zl = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r,
    getNode: i,
    setNodes: a
  } = We();
  let [o, s] = Z.useState(75);
  let [c, l] = Z.useState(false);
  let [u, d] = Z.useState(t.panoType || `sphere`);
  let f = i(e)?.measured?.width;
  let p = i(e)?.measured?.height;
  Z.useEffect(() => {
    let e = [10, 50, 150, 300].map(e => {
      return setTimeout(() => {
        return window.dispatchEvent(new Event(`resize`));
      }, e);
    });
    return () => {
      return e.forEach(clearTimeout);
    };
  }, [c, n, f, p]);
  let [m, h] = Z.useState(t.highQuality === undefined ? false : t.highQuality);
  let [g, _] = Z.useState(false);
  let [v, y] = Z.useState(null);
  let b = Z.useRef(null);
  let S = Z.useRef(null);
  let [C, w] = Z.useState(t.aspectRatio || `16:9`);
  let [T, E] = Z.useState({
    w: 16,
    h: 9
  });
  let D = C === `custom` ? `${T.w}/${T.h}` : C.replace(`:`, `/`);
  Z.useEffect(() => {
    r(e, {
      aspectRatio: C,
      highQuality: m
    });
  }, [C, m, e]);
  Z.useEffect(() => {
    a(t => {
      return t.map(t => {
        if (t.id === e) {
          let e = t.measured?.width || t.width || 512;
          let n = Math.round(e / (16 / 9));
          let r = t.style?.height || t.measured?.height || t.height || 288;
          if (Math.abs(r - n) > 1) {
            return {
              ...t,
              style: {
                ...t.style,
                width: e,
                height: n
              }
            };
          }
        }
        return t;
      });
    });
  }, [e]);
  let [O, k] = Z.useState(null);
  let A = e => {
    k(e);
    setTimeout(() => {
      return k(null);
    }, 2500);
  };
  let j = e => {
    if (e >= 12) {
      return `正在截取12大视角…`;
    } else {
      if (e >= 4) {
        return `正在截取四大视角…`;
      } else {
        return `正在截取当前视角…`;
      }
    }
  };
  let M = e => {
    if (e >= 12) {
      return `twelve`;
    } else {
      if (e >= 4) {
        return `four`;
      } else {
        return `current`;
      }
    }
  };
  Z.useEffect(() => {
    if (!c) {
      return;
    }
    let e = e => {
      if (!(e.target instanceof HTMLInputElement)) {
        e.target instanceof HTMLTextAreaElement;
      }
    };
    window.addEventListener(`keydown`, e);
    return () => {
      window.removeEventListener(`keydown`, e);
    };
  }, [c, t.showToast]);
  let N = Qt(Lt({
    handleType: `target`
  }).map(e => {
    return e.source;
  }));
  let P = Z.useMemo(() => {
    if (N) {
      let e = (Array.isArray(N) ? N : [N]).find(e => {
        let t = e?.data?.imageUrl;
        return !!t && !t.startsWith(`data:video/`) && !t.startsWith(`data:audio/`) && !t.startsWith(`data:text/`);
      });
      if (e) {
        return e.data.imageUrl;
      }
    }
    if (t.imageUrl) {
      return t.imageUrl;
    } else {
      return null;
    }
  }, [N, t.imageUrl]);
  let F = Z.useCallback(async (n = [0]) => {
    if (b.current) {
      y(M(n.length));
      A(j(n.length));
      _(true);
      if (!i(e)) {
        _(false);
        return;
      }
      try {
        let i = await S.current?.capture(n, D);
        if (i && i.length > 0) {
          if (n.length === 1 && i[0]) {
            r(e, {
              imageUrl: i[0]
            });
          }
          if (typeof t.onCaptureToBox == `function`) {
            let r = i.map((e, t) => {
              return {
                url: e,
                label: `全景截图 ${n[t]}度`
              };
            });
            t.onCaptureToBox(e, r);
          }
          if (typeof t.showToast == `function`) {
            t.showToast(`已截图并放入图片盒子`);
          }
          A(`截图已放入图片盒子`);
        }
      } catch (e) {
        console.error(`Screenshot failed`, e);
        A(`截图失败，请重试`);
      } finally {
        _(false);
        y(null);
      }
    }
  }, [e, r, t, D, i]);
  const Component1768 = `div`;
  const Component1769 = `div`;
  const Component1770 = `button`;
  const Component1771 = `button`;
  const Component1772 = `button`;
  const Component1773 = `div`;
  const Component1774 = `span`;
  const Component1775 = `option`;
  const Component1776 = `option`;
  const Component1777 = `option`;
  const Component1778 = `option`;
  const Component1779 = `select`;
  const Component1780 = `input`;
  const Component1781 = `span`;
  const Component1782 = `input`;
  const Component1783 = `div`;
  const Component1784 = `div`;
  const Component1785 = `span`;
  const Component1786 = `div`;
  const Component1787 = `div`;
  const Component1788 = `div`;
  const Component1789 = `span`;
  const Component1790 = `div`;
  const Component1791 = `div`;
  const Component1792 = `div`;
  const Component1793 = `div`;
  const Component1794 = `button`;
  const Component1795 = `div`;
  const Component1796 = `span`;
  const Component1797 = `span`;
  const Component1798 = `div`;
  const Component1799 = `div`;
  const Component1800 = `span`;
  const Component1801 = `div`;
  const Component1802 = `div`;
  const Component1803 = `span`;
  const Component1804 = `span`;
  const Component1805 = `option`;
  const Component1806 = `option`;
  const Component1807 = `option`;
  const Component1808 = `option`;
  const Component1809 = `select`;
  const Component1810 = `input`;
  const Component1811 = `span`;
  const Component1812 = `input`;
  const Component1813 = `div`;
  const Component1814 = `div`;
  const Component1815 = `div`;
  const Component1816 = `div`;
  const Component1817 = `span`;
  const Component1818 = `input`;
  const Component1819 = `span`;
  const Component1820 = `label`;
  const Component1821 = `option`;
  const Component1822 = `option`;
  const Component1823 = `select`;
  const Component1824 = `div`;
  const Component1825 = `div`;
  const Component1826 = `div`;
  const Component1827 = `button`;
  const Component1828 = `div`;
  const Component1829 = `div`;
  const Component1830 = `div`;
  const Component1831 = `span`;
  const Component1832 = `button`;
  const Component1833 = `button`;
  const Component1834 = `div`;
  const Component1835 = `span`;
  const Component1836 = `option`;
  const Component1837 = `option`;
  const Component1838 = `option`;
  const Component1839 = `option`;
  const Component1840 = `select`;
  const Component1841 = `input`;
  const Component1842 = `span`;
  const Component1843 = `input`;
  const Component1844 = `div`;
  const Component1845 = `div`;
  const Component1846 = `button`;
  const Component1847 = `button`;
  const Component1848 = `button`;
  const Component1849 = `div`;
  const Component1850 = `span`;
  const Component1851 = `div`;
  const Component1852 = `div`;
  const Component1853 = `div`;
  const Component1854 = `span`;
  const Component1855 = `div`;
  const Component1856 = `div`;
  const Component1857 = `div`;
  const Component1858 = `div`;
  const Component1859 = `div`;
  const Component1860 = `div`;
  const Component1861 = `div`;
  const Component1862 = `div`;
  return <Component1862 className={`flex flex-col items-center group/node transition-shadow duration-200 w-full h-full ${n ? `z-50` : `z-10`}`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`720全景图`} icon={<_Component60 size={11} className={`text-gray-500`} />} />
      <_cmp__Component9 visible={!!n} minWidth={512} keepAspectRatio={true} />
      <_cmp__Component12 type={`target`} position={X.Left} />
      <Component1799 className={`relative w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-[border-color,box-shadow] duration-200 group/image flex-1 flex flex-col ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`} id={`pano-container-${e}`} style={{
      width: `100%`,
      height: `100%`
    }} onWheel={e => {
      e.stopPropagation();
      s(t => {
        let n = t + (e.deltaY > 0 ? 5 : -5);
        return Math.min(Math.max(n, 30), 120);
      });
    }}>
        <Component1769 className={`absolute top-0 left-0 w-full h-8 z-20 flex items-start justify-center pt-2 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors opacity-0 group-hover/image:opacity-100`}>
          <Component1768 className={`w-12 h-1.5 bg-white/20 rounded-full pointer-events-none`} />
        </Component1769>
        {P ? <Component1795 className={`absolute inset-0 cursor-move nowheel nodrag z-0 overflow-hidden bg-black`}>
            <_Component61 resize={{
          debounce: 0
        }} gl={{
          preserveDrawingBuffer: true,
          antialias: m,
          alpha: true,
          powerPreference: `high-performance`
        }} dpr={m ? window.devicePixelRatio ? Math.max(window.devicePixelRatio, 2) : 2 : [1, 1.5]} style={{
          position: `absolute`,
          top: 0,
          left: 0,
          width: `100%`,
          height: `100%`,
          display: `block`
        }}>
              <_cmp_Xl ref={S} url={P} panoType={u} fov={o} highQuality={m} orbitControlsRefLocal={b} />
            </_Component61>
            <Component1773 className={`absolute top-1/2 left-4 -translate-y-1/2 flex flex-col items-center gap-1 z-30 bg-black/60 p-1.5 rounded-xl backdrop-blur-md border border-white/10 shadow-lg nodrag transition-opacity duration-300 ${g ? `opacity-100 pointer-events-none` : `opacity-0 group-hover/image:opacity-100`}`} onClick={e => {
          return e.stopPropagation();
        }}>
              <Component1770 className={`p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 ${v === `current` ? `text-white bg-white/10` : ``}`} onClick={() => {
            return F([0]);
          }} title={`当前视角截图`}>
                <_Component60 size={16} className={v === `current` ? `animate-spin` : ``} />
              </Component1770>
              <Component1771 className={`p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 ${v === `four` ? `text-white bg-white/10` : ``}`} onClick={() => {
            return F([90, 180, 270, 0]);
          }} title={`四大视角截图 (90, 180, 270, 0度)`}>
                <Et size={16} className={v === `four` ? `animate-spin` : ``} />
              </Component1771>
              <Component1772 className={`p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 ${v === `twelve` ? `text-white bg-white/10` : ``}`} onClick={() => {
            return F([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
          }} title={`12大视角截图 (每30度)`}>
                <_Component28 size={16} className={v === `twelve` ? `animate-spin` : ``} />
              </Component1772>
            </Component1773>
            <Component1784 className={`absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-1 nodrag shadow-lg max-w-[90%] overflow-hidden opacity-0 group-hover/image:opacity-100 transition-opacity duration-300`} onClick={e => {
          return e.stopPropagation();
        }}>
              <Component1774 className={`text-[10px] text-gray-400 px-2 whitespace-nowrap shrink-0`}>{`截图比例`}</Component1774>
              <Component1779 value={C} onChange={e => {
            return w(e.target.value);
          }} className={`bg-transparent text-gray-200 text-[10px] pl-1 pr-4 py-0.5 outline-none cursor-pointer appearance-none text-center font-bold shrink-0`} style={{
            WebkitAppearance: `none`,
            MozAppearance: `none`
          }}>
                <Component1775 value={`16:9`} className={`bg-[#222]`}>{`16:9`}</Component1775>
                <Component1776 value={`9:16`} className={`bg-[#222]`}>{`9:16`}</Component1776>
                <Component1777 value={`1:1`} className={`bg-[#222]`}>{`1:1`}</Component1777>
                <Component1778 value={`custom`} className={`bg-[#222]`}>{`自定义`}</Component1778>
              </Component1779>
              {C === `custom` && <Component1783 className={`flex items-center gap-1 ml-2 mr-2 border-l border-white/20 pl-2 shrink-0`}>
                  <Component1780 type={`number`} value={T.w} onChange={e => {
              return E(t => {
                return {
                  ...t,
                  w: Number(e.target.value)
                };
              });
            }} className={`w-8 bg-transparent text-gray-200 text-[10px] outline-none text-center border-b border-transparent focus:border-white/50 min-w-[32px]`} />
                  <Component1781 className={`text-gray-500`}>{`:`}</Component1781>
                  <Component1782 type={`number`} value={T.h} onChange={e => {
              return E(t => {
                return {
                  ...t,
                  h: Number(e.target.value)
                };
              });
            }} className={`w-8 bg-transparent text-gray-200 text-[10px] outline-none text-center border-b border-transparent focus:border-white/50 min-w-[32px]`} />
                </Component1783>}
            </Component1784>
            {O && <Component1787 className={`absolute top-0 left-1/2 z-50 pointer-events-none nodrag flex items-center justify-center`}>
                <Component1786 className={`animate-[dropIn_2.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/30 px-6 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-2 mt-12`}>
                  <Component1785 className={`text-white font-bold tracking-wider text-sm`}>
                    {O}
                  </Component1785>
                </Component1786>
              </Component1787>}
            {g && <Component1791 className={`absolute inset-0 z-40 pointer-events-none nodrag flex items-center justify-center bg-black/20 backdrop-blur-[1px]`}>
                <Component1790 className={`bg-black/80 border border-white/20 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3`}>
                  <Component1788 className={`w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin`} />
                  <Component1789 className={`text-white text-sm font-semibold`}>{`截图处理中…`}</Component1789>
                </Component1790>
              </Component1791>}
            {!g && <Component1793 className={`absolute inset-0 pointer-events-none z-[5]`} style={{
          display: `flex`,
          justifyContent: `center`,
          alignItems: `center`
        }}>
                <Component1792 className={`border-[2px] border-dashed border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] transition-all duration-300`} style={{
            aspectRatio: D,
            height: `100%`,
            maxHeight: `100%`,
            maxWidth: `100%`
          }} />
              </Component1793>}
            <Component1794 className={`absolute top-6 right-4 p-2.5 bg-black/60 text-gray-300 hover:text-white hover:bg-white/20 rounded-lg backdrop-blur-md transition-all z-40 opacity-0 group-hover/image:opacity-100 border border-white/10 nodrag cursor-pointer shadow-lg duration-300`} title={`全屏漫游`} onPointerDown={e => {
          return e.stopPropagation();
        }} onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          l(true);
        }}>
              <Ke size={18} />
            </Component1794>
          </Component1795> : <Component1798 className={`w-full h-full flex flex-col items-center justify-center text-gray-600 bg-[#151515] transition-colors z-30 relative`}>
            <_Component0 size={24} className={`mb-2`} />
            <Component1796 className={`text-sm`}>{`等待输入全景图`}</Component1796>
            <Component1797 className={`text-xs mt-1 text-gray-500`}>{`请将图片节点连接到此节点`}</Component1797>
          </Component1798>}
        <_cmp__Component12 type={`source`} position={X.Right} />
      </Component1799>
      <Component1830 className={`hidden absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl w-[400px] flex-col nodrag cursor-default transition-all duration-300 z-50 overflow-hidden`} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component1802 className={`flex items-center justify-between px-3 py-2 border-b border-[#222] bg-[#1a1a1a]`}>
          <Component1801 className={`flex items-center gap-2`}>
            <_Component60 size={14} className={`text-white`} />
            <Component1800 className={`text-gray-200 text-xs font-medium`}>
              {typeof t.label == `string` && t.label.trim() !== `` ? t.label : `720全景图`}
            </Component1800>
          </Component1801>
        </Component1802>
        <Component1829 className={`flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-4 nodrag`}>
          <Component1816 className={`flex flex-col gap-2 shrink-0 hidden`}>
            <Component1803 className={`text-xs text-gray-500 font-medium`}>{`画布设置`}</Component1803>
            <Component1815 className={`flex flex-wrap gap-3`}>
              <Component1814 className={`flex-1 min-w-[140px] flex items-center justify-between gap-2 bg-[#222] p-2 rounded-lg border border-[#444] nodrag`}>
                <Component1804 className={`text-[10px] text-gray-400 whitespace-nowrap`}>{`截图比例`}</Component1804>
                <Component1809 value={C} onChange={e => {
                return w(e.target.value);
              }} className={`flex-1 min-w-0 bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none cursor-pointer focus:border-white/50`}>
                  <Component1805 value={`16:9`}>{`16:9`}</Component1805>
                  <Component1806 value={`9:16`}>{`9:16`}</Component1806>
                  <Component1807 value={`1:1`}>{`1:1`}</Component1807>
                  <Component1808 value={`custom`}>{`自定义`}</Component1808>
                </Component1809>
                {C === `custom` && <Component1813 className={`flex items-center gap-1`}>
                    <Component1810 type={`number`} value={T.w} onChange={e => {
                  return E(t => {
                    return {
                      ...t,
                      w: Number(e.target.value)
                    };
                  });
                }} className={`w-8 bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none text-center focus:border-white/50`} />
                    <Component1811 className={`text-gray-500`}>{`:`}</Component1811>
                    <Component1812 type={`number`} value={T.h} onChange={e => {
                  return E(t => {
                    return {
                      ...t,
                      h: Number(e.target.value)
                    };
                  });
                }} className={`w-8 bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none text-center focus:border-white/50`} />
                  </Component1813>}
              </Component1814>
            </Component1815>
          </Component1816>
          <Component1826 className={`flex flex-col gap-2 shrink-0`}>
            <Component1825 className={`flex items-center justify-between mb-2`}>
              <Component1817 className={`text-xs text-gray-500 font-medium`}>{`全景设置`}</Component1817>
              <Component1824 className={`flex items-center gap-3`}>
                <Component1820 className={`flex items-center gap-1.5 cursor-pointer`}>
                  <Component1818 type={`checkbox`} checked={m} onChange={e => {
                  return h(e.target.checked);
                }} className={`w-3 h-3 rounded border-[#444] bg-[#111] accent-white`} />
                  <Component1819 className={`text-[10px] text-gray-400 select-none`} title={`开启抗锯接、原画分辨率，可能会导致卡顿`}>{`高画质`}</Component1819>
                </Component1820>
                <Component1823 value={u} onChange={t => {
                d(t.target.value);
                r(e, {
                  panoType: t.target.value
                });
              }} className={`ml-auto bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none cursor-pointer`}>
                  <Component1821 value={`sphere`}>{`球状全景`}</Component1821>
                  <Component1822 value={`cylinder`}>{`柱状全景`}</Component1822>
                </Component1823>
              </Component1824>
            </Component1825>
          </Component1826>
          <Component1828 className={`mt-auto pt-3`}>
            <Component1827 type={`button`} className={`w-full py-2.5 bg-white hover:bg-gray-200 text-black text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.15)] transform hover:scale-[1.02]`} onClick={() => {
            return F();
          }}>
              <_Component60 size={16} />
              {` 截图并生成节点`}
            </Component1827>
          </Component1828>
        </Component1829>
      </Component1830>
      {c && P && Fn.createPortal(<Component1861 className={`fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col`} onClick={e => {
      return e.stopPropagation();
    }}>
            <Component1834 className={`absolute top-4 right-4 z-10 flex gap-2`}>
              <Component1832 className={`bg-white hover:bg-gray-200 text-black px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all transform hover:scale-105`} onClick={() => {
          F();
        }}>
                <_Component60 size={18} />
                <Component1831 className={`text-sm font-bold`}>{`截图`}</Component1831>
              </Component1832>
              <Component1833 className={`bg-black/50 hover:bg-white/10 text-white p-2.5 rounded-lg backdrop-blur border border-white/10 transition-colors`} onClick={() => {
          return l(false);
        }}>
                <Gt size={22} />
              </Component1833>
            </Component1834>
            <Component1845 className={`absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-1 shadow-lg`} onClick={e => {
        return e.stopPropagation();
      }}>
              <Component1835 className={`text-[12px] text-gray-400 px-3 whitespace-nowrap`}>{`截图比例`}</Component1835>
              <Component1840 value={C} onChange={e => {
          return w(e.target.value);
        }} className={`bg-transparent text-gray-200 text-[12px] pl-2 pr-6 py-1 outline-none cursor-pointer appearance-none text-center font-bold`} style={{
          WebkitAppearance: `none`,
          MozAppearance: `none`
        }}>
                <Component1836 value={`16:9`} className={`bg-[#222]`}>{`16:9`}</Component1836>
                <Component1837 value={`9:16`} className={`bg-[#222]`}>{`9:16`}</Component1837>
                <Component1838 value={`1:1`} className={`bg-[#222]`}>{`1:1`}</Component1838>
                <Component1839 value={`custom`} className={`bg-[#222]`}>{`自定义`}</Component1839>
              </Component1840>
              {C === `custom` && <Component1844 className={`flex items-center gap-2 ml-3 mr-3 border-l border-white/20 pl-3`}>
                  <Component1841 type={`number`} value={T.w} onChange={e => {
            return E(t => {
              return {
                ...t,
                w: Number(e.target.value)
              };
            });
          }} className={`w-10 bg-transparent text-gray-200 text-[12px] outline-none text-center border-b border-transparent focus:border-white/50`} />
                  <Component1842 className={`text-gray-500`}>{`:`}</Component1842>
                  <Component1843 type={`number`} value={T.h} onChange={e => {
            return E(t => {
              return {
                ...t,
                h: Number(e.target.value)
              };
            });
          }} className={`w-10 bg-transparent text-gray-200 text-[12px] outline-none text-center border-b border-transparent focus:border-white/50`} />
                </Component1844>}
            </Component1845>
            <Component1860 className={`flex-1 w-full h-full flex items-center justify-center p-8`}>
              <Component1859 className={`relative shadow-[0_0_50px_rgba(0,0,0,0.8)]`} id={`pano-container-fullscreen-${e}`} style={{
          aspectRatio: `16/9`,
          width: `100%`,
          maxHeight: `calc(100vh - 6rem)`,
          maxWidth: `calc((100vh - 6rem) * (16/9))`,
          margin: `auto`
        }} onWheel={e => {
          e.stopPropagation();
          s(t => {
            let n = t + (e.deltaY > 0 ? 5 : -5);
            return Math.min(Math.max(n, 30), 120);
          });
        }}>
                <_Component61 resize={{
            debounce: 0
          }} gl={{
            preserveDrawingBuffer: true,
            antialias: m,
            powerPreference: `high-performance`
          }} dpr={m ? window.devicePixelRatio ? Math.max(window.devicePixelRatio, 2) : 2 : [1, 1.5]} style={{
            position: `absolute`,
            top: 0,
            left: 0,
            width: `100%`,
            height: `100%`
          }}>
                  <_cmp_Xl url={P} panoType={u} fov={o} highQuality={m} orbitControlsRefLocal={b} />
                </_Component61>
                <Component1849 className={`absolute top-1/2 left-4 -translate-y-1/2 flex flex-col items-center gap-2 z-10 bg-black/60 p-2.5 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg nodrag ${g ? `pointer-events-none` : ``}`} onClick={e => {
            return e.stopPropagation();
          }}>
                  <Component1846 className={`p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 ${v === `current` ? `text-white bg-white/10` : ``}`} onClick={() => {
              return F([0]);
            }} title={`当前视角截图`}>
                    <_Component60 size={20} className={v === `current` ? `animate-spin` : ``} />
                  </Component1846>
                  <Component1847 className={`p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 ${v === `four` ? `text-white bg-white/10` : ``}`} onClick={() => {
              return F([90, 180, 270, 0]);
            }} title={`四大视角截图 (90, 180, 270, 0度)`}>
                    <Et size={20} className={v === `four` ? `animate-spin` : ``} />
                  </Component1847>
                  <Component1848 className={`p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 ${v === `twelve` ? `text-white bg-white/10` : ``}`} onClick={() => {
              return F([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
            }} title={`12大视角截图 (每30度)`}>
                    <_Component28 size={20} className={v === `twelve` ? `animate-spin` : ``} />
                  </Component1848>
                </Component1849>
                {O && <Component1852 className={`absolute top-0 left-1/2 z-50 pointer-events-none nodrag flex items-center justify-center`}>
                    <Component1851 className={`animate-[dropIn_2.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/30 px-8 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center gap-3 mt-16`}>
                      <Component1850 className={`text-white font-bold text-xl tracking-wider`}>
                        {O}
                      </Component1850>
                    </Component1851>
                  </Component1852>}
                {g && <Component1856 className={`absolute inset-0 z-40 pointer-events-none nodrag flex items-center justify-center bg-black/20 backdrop-blur-[1px]`}>
                    <Component1855 className={`bg-black/80 border border-white/20 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-3`}>
                      <Component1853 className={`w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin`} />
                      <Component1854 className={`text-white text-base font-semibold`}>{`截图处理中…`}</Component1854>
                    </Component1855>
                  </Component1856>}
                {!g && <Component1858 className={`absolute inset-0 pointer-events-none z-[5]`} style={{
            display: `flex`,
            justifyContent: `center`,
            alignItems: `center`
          }}>
                    <Component1857 className={`border-[2px] border-dashed border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-all duration-300`} style={{
              aspectRatio: D,
              height: `100%`,
              maxHeight: `100%`,
              maxWidth: `100%`
            }} />
                  </Component1858>}
              </Component1859>
            </Component1860>
          </Component1861>, document.body)}
    </Component1862>;
});
export default Zl;