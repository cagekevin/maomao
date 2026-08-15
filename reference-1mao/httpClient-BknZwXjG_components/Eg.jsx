// TODO(全局, 无需 import): initialProject, initialPanoramaUrl, onExit, o, kind, n, preset, source, s, project, thumbnailDataUrl, r, i
import _cmp__Component109 from './_Component109.jsx';
import _cmp__Component108 from './_Component108.jsx';
import { $, a, kd, ph, t, Tg, kf, c, Se, Gt } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
export default function Eg({
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
      a(e ?? kd());
    } catch (e) {
      console.warn(`[Director3D] 载入工程失败，使用默认场景`, e);
      a(kd());
    }
  }, []);
  Z.useEffect(() => {
    if (!t || $.getState().project.panoramaAssetId) {
      return;
    }
    let e = false;
    (async () => {
      try {
        let n = await ph(t);
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
        if (Tg(e.target)) {
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
      if (Tg(e.target) || !e.metaKey && !e.ctrlKey) {
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
      return (await kf({
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
  const Component2215 = `div`;
  const Component2216 = `button`;
  const Component2217 = `button`;
  const Component2218 = `div`;
  const Component2219 = `span`;
  const Component2220 = `button`;
  const Component2221 = `button`;
  const Component2222 = `div`;
  const Component2223 = `div`;
  const Component2224 = `div`;
  const Component2225 = `div`;
  return <Component2225 className={`director3d-overlay app-shell`} data-theme={`dark`}>
      <Component2223 className={`director3d-topbar`}>
        <Component2215 className={`director3d-topbar-title`}>{`3D 导演台`}</Component2215>
        <Component2222 className={`director3d-topbar-actions`}>
          <Component2218 className={`director3d-viewmode-switch`}>
            <Component2216 className={r === `director` ? `is-active` : ``} onClick={() => {
            return i(`director`);
          }}>{`导演视角`}</Component2216>
            <Component2217 className={r === `camera` ? `is-active` : ``} onClick={() => {
            return i(`camera`);
          }}>{`机位视角`}</Component2217>
          </Component2218>
          <Component2220 className={`director3d-exit-btn`} onClick={c} title={`截图并返回画布`}>
            <Se size={14} />
            <Component2219>{`返回画布`}</Component2219>
          </Component2220>
          <Component2221 className={`director3d-close-btn`} onClick={c} title={`返回画布`}>
            <Gt size={16} />
          </Component2221>
        </Component2222>
      </Component2223>
      <Component2224 className={`director3d-body`}>
        <_cmp__Component109>
          <_cmp__Component108 />
        </_cmp__Component109>
      </Component2224>
    </Component2225>;
}