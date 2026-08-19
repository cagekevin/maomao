// TODO(全局, 无需 import): initialProject, initialPanoramaUrl, onExit, o, kind, n, preset, source, s, project, thumbnailDataUrl, r, i
import _cmp_Cp from './Cp.jsx';
import _cmp_Gg from './Gg.jsx';
import { $, a, Xd, Ph, t, Kg, Xf, c, Se, Gt } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
export default function _Component84({
  initialProject: e,
  initialPanoramaUrl: t,
  onExit: n
}) {
  let r = $(e => {
    return e.viewMode;
  });
  let i = $(e => {
    return e.setViewMode;
  });
  let a = $(e => {
    return e.replaceProject;
  });
  let o = $(e => {
    return e.addImportedAsset;
  });
  Z.useEffect(() => {
    try {
      a(e ?? Xd());
    } catch (e) {
      console.warn(`[Director3D] 载入工程失败，使用默认场景`, e);
      a(Xd());
    }
  }, []);
  Z.useEffect(() => {
    if (!t || $.getState().project.panoramaAssetId) {
      return;
    }
    let e = false;
    (async () => {
      try {
        let n = await Ph(t);
        if (e) {
          return;
        }
        o({
          kind: `panorama`,
          ...n
        });
      } catch (e) {
        console.warn(`[Director3D] 全景图导入失败`, e);
      }
    })();
    return () => {
      e = true;
    };
  }, [t]);
  Z.useEffect(() => {
    function e(e) {
      if (e.key === `Delete` || e.key === `Backspace`) {
        if (Kg(e.target)) {
          return;
        }
        e.stopPropagation();
        let t = $.getState();
        if (t.selectedObjectId || t.selectedObjectIds.length || t.selectedCrowdId) {
          e.preventDefault();
          t.deleteSelectedObject();
        }
        return;
      }
      if (Kg(e.target) || !e.metaKey && !e.ctrlKey) {
        return;
      }
      let t = e.key.toLowerCase();
      if (t === `c`) {
        e.preventDefault();
        e.stopPropagation();
        $.getState().copySelectedObjects();
      } else if (t === `v`) {
        e.preventDefault();
        e.stopPropagation();
        $.getState().pasteClipboardObjects();
      } else if (t === `z` && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        $.getState().undo();
      } else if (t === `z` && e.shiftKey || t === `y`) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener(`keydown`, e, true);
    return () => {
      return window.removeEventListener(`keydown`, e, true);
    };
  }, []);
  async function s() {
    try {
      return (await Xf({
        preset: `current`,
        source: `capture-panel`
      }))?.[0]?.dataUrl ?? null;
    } catch (e) {
      console.warn(`[Director3D] 截图失败`, e);
      return null;
    }
  }
  async function c() {
    let e = await s();
    let t = $.getState().project;
    n({
      project: t,
      thumbnailDataUrl: e
    });
  }
  const Component2237 = `div`;
  const Component2238 = `button`;
  const Component2239 = `button`;
  const Component2240 = `div`;
  const Component2241 = `span`;
  const Component2242 = `button`;
  const Component2243 = `button`;
  const Component2244 = `div`;
  const Component2245 = `div`;
  const Component2246 = `div`;
  const Component2247 = `div`;
  return <Component2247 className={`director3d-overlay app-shell`} data-theme={`dark`}>
      <Component2245 className={`director3d-topbar`}>
        <Component2237 className={`director3d-topbar-title`}>{`3D 导演台`}</Component2237>
        <Component2244 className={`director3d-topbar-actions`}>
          <Component2240 className={`director3d-viewmode-switch`}>
            <Component2238 className={r === `director` ? `is-active` : ``} onClick={() => {
            return i(`director`);
          }}>{`导演视角`}</Component2238>
            <Component2239 className={r === `camera` ? `is-active` : ``} onClick={() => {
            return i(`camera`);
          }}>{`机位视角`}</Component2239>
          </Component2240>
          <Component2242 className={`director3d-exit-btn`} onClick={c} title={`截图并返回画布`}>
            <Se size={14} />
            <Component2241>{`返回画布`}</Component2241>
          </Component2242>
          <Component2243 className={`director3d-close-btn`} onClick={c} title={`返回画布`}>
            <Gt size={16} />
          </Component2243>
        </Component2244>
      </Component2245>
      <Component2246 className={`director3d-body`}>
        <_cmp_Cp>
          <_cmp_Gg />
        </_cmp_Cp>
      </Component2246>
    </Component2247>;
}