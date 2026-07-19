/**
 * 节点类型: director3dNode
 * 原版函数名: Th
 * 原版行号: L28284-L28405
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _r → Rl
// a → ZK
// bt → Fd
// c → tK
// d → zG
// e → i
// f → MG
// h → xW
// i → jq
// l → VG
// n → Fq
// o → oK
// r → Nq
// s → iK
// t → e1
// u → BG
// ut → Gd
// w → xT
 */

var Th = Y.memo(({
  id: e,
  data: n,
  selected: r
}) => {
  let {
      updateNodeData: i
    } = Gt(),
    a = n,
    [o, s] = Y.useState(false),
    c = a.imageUrl,
    l = t({
      handleType: `target`
    }),
    u = ut(Y.useMemo(() => l.map(e => e.source), [l])),
    d = Y.useMemo(() => {
      if (!u) return null;
      let e = Array.isArray(u) ? u : [u];
      for (let t of e) {
        if (!t) continue;
        let e = t.data?.imageUrl;
        if (typeof e == `string` && (e.startsWith(`http`) || e.startsWith(`data:image`))) return e;
        if (t.type === `imageBoxNode` && Array.isArray(t.data?.images)) {
          let e = typeof t.data.activeIndex == `number` ? t.data.activeIndex : 0,
            n = t.data.images[e]?.url;
          if (typeof n == `string`) return n;
        }
      }
      return null;
    }, [u]),
    f = Y.useCallback(async t => {
      s(false);
      let n = [],
        r = [],
        o = new Set(a.syncedCaptureIds || []);
      if (t.project.cameras.forEach(e => {
        e.captures && e.captures.forEach(t => {
          r.push(t.id), o.has(t.id) || n.push({
            url: t.dataUrl,
            label: e.name || `机位截图`
          });
        });
      }), n.length > 0 && a.onCaptureToBox?.(e, n), i(e, {
        directorProject: t.project,
        syncedCaptureIds: r
      }), t.thumbnailDataUrl) {
        i(e, {
          imageUrl: t.thumbnailDataUrl
        });
        try {
          let n = await ii(t.thumbnailDataUrl, {
            subfolder: `tasks`,
            preferThumbnail: true,
            thumbMaxDim: 480,
            thumbQuality: 75
          });
          n.url && /^https?:\/\//i.test(n.url) && i(e, {
            imageUrl: n.url,
            thumbnailUrl: n.thumbnailUrl
          });
        } catch (e) {
          console.warn(`[Director3DNode] 缩略图 URL 化失败，保留 base64`, e);
        }
      }
    }, [e, i, a]);
  return X.jsxs(`div`, {
    className: `relative w-full h-full flex flex-col group/node`,
    children: [X.jsx(ci, {
      visible: !!r,
      minWidth: 220,
      minHeight: 200
    }), X.jsx(si, {
      id: e,
      data: n,
      defaultTitle: `3D 导演台`,
      icon: X.jsx(be, {
        size: 11,
        className: `text-gray-500`
      })
    }), X.jsxs(`div`, {
      className: `relative flex-1 bg-[#151515] rounded-xl overflow-hidden border border-[#333] shadow-xl cursor-pointer`,
      onClick: () => s(true),
      children: [c ? X.jsx(`img`, {
        src: c,
        className: `w-full h-full object-cover`,
        alt: `导演台预览`
      }) : X.jsxs(`div`, {
        className: `flex flex-col items-center justify-center absolute inset-0 gap-2 text-gray-600 pointer-events-none`,
        children: [X.jsx(Jt, {
          size: 56,
          strokeWidth: 1.2
        }), X.jsx(`span`, {
          className: `text-xs text-gray-500`,
          children: `点击打开 3D 导演台`
        })]
      }), X.jsx(`div`, {
        className: `absolute inset-0 bg-black/0 group-hover/node:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/node:opacity-100`,
        children: X.jsxs(`button`, {
          className: `flex items-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black text-xs font-medium rounded-full shadow-lg transition-colors`,
          onClick: e => {
            e.stopPropagation(), s(true);
          },
          children: [X.jsx(bt, {
            size: 13
          }), `打开导演台`]
        })
      })]
    }), X.jsx(_r, {
      type: `target`,
      position: J.Left,
      variant: `large`
    }), X.jsx(_r, {
      type: `source`,
      position: J.Right,
      variant: `large`
    }), o && Un.createPortal(X.jsx(wh, {
      initialProject: a.directorProject ?? null,
      initialPanoramaUrl: d,
      onExit: f
    }), document.body)]
  });
});