// TODO(全局, 无需 import): n, o, u, f, r, scale, i, panoramaYaw, panoramaRadius, groundHeight, m, axis, ariaLabel, step, value, onChange, position, rotation, p, backgroundColor, s, l, g, showLabels, snapToGrid, showGround, groundOpacity
import _cmp__Component63 from './_Component63.jsx';
import _cmp_Wf from './Wf.jsx';
import _cmp_Hf from './Hf.jsx';
import _cmp_Kf from './Kf.jsx';
import _cmp_Gf from './Gf.jsx';
import { $, e, t, c, bp, hp, gp, pp, mp, dp, fp, _p, vp, a, yp, h, d, _, Ot, _Component64 } from './shared.js';
import * as Z from 'react';
export default function _Component68() {
  let e = $(e => {
    return e.project.scene;
  });
  let t = $(e => {
    return e.project.assets;
  });
  let n = $(e => {
    return e.project.panoramaAssetId;
  });
  let r = $(e => {
    return e.updateScene;
  });
  let i = $(e => {
    return e.removePanoramaAsset;
  });
  let [a, o] = Z.useState(String(e.scale));
  let [s, c] = Z.useState(String(e.panoramaYaw));
  let [l, u] = Z.useState(String(e.panoramaRadius));
  let [d, f] = Z.useState(String(e.groundHeight));
  let p = t.find(e => {
    return e.id === n;
  });
  Z.useEffect(() => {
    o(String(e.scale));
  }, [e.scale]);
  Z.useEffect(() => {
    u(String(e.panoramaRadius));
  }, [e.panoramaRadius]);
  Z.useEffect(() => {
    c(String(e.panoramaYaw));
  }, [e.panoramaYaw]);
  Z.useEffect(() => {
    f(String(e.groundHeight));
  }, [e.groundHeight]);
  function m(t) {
    let n = Number(t);
    let i = Number.isFinite(n) ? bp(n, hp, gp) : e.scale;
    r({
      scale: i
    });
    o(String(i));
  }
  function h(t) {
    let n = Number(t);
    let i = Number.isFinite(n) ? bp(n, pp, mp) : e.panoramaYaw;
    r({
      panoramaYaw: i
    });
    c(String(i));
  }
  function g(t) {
    let n = Number(t);
    let i = Number.isFinite(n) ? bp(n, dp, fp) : e.panoramaRadius;
    r({
      panoramaRadius: i
    });
    u(String(i));
  }
  function _(t) {
    let n = Number(t);
    let i = Number.isFinite(n) ? bp(n, _p, vp) : e.groundHeight;
    r({
      groundHeight: i
    });
    f(String(i));
  }
  const Component1992 = `button`;
  const Component1993 = `img`;
  const Component1994 = `span`;
  const Component1995 = `div`;
  const Component1996 = `span`;
  const Component1997 = `span`;
  const Component1998 = `div`;
  const Component1999 = `input`;
  const Component2000 = `span`;
  const Component2001 = `div`;
  const Component2002 = `input`;
  const Component2003 = `span`;
  const Component2004 = `div`;
  const Component2005 = `input`;
  const Component2006 = `span`;
  const Component2007 = `div`;
  const Component2008 = `div`;
  return <_cmp__Component63 title={`3D场景`} ariaLabel={`3D场景右侧属性面板`} className={`scene-inspector`}>
      <_cmp_Wf label={`场景缩放`} rangeAriaLabel={`场景缩放滑杆`} numberAriaLabel={`场景缩放`} max={gp} min={hp} step={`0.01`} value={a} onValueChange={m} onRangeChange={m} onNumberBlur={m} onNumberChange={e => {
      o(e);
      if (e !== ``) {
        let t = Number(e);
        if (Number.isFinite(t)) {
          r({
            scale: t
          });
        }
      }
    }} />
      <_cmp_Hf label={`场景平移`} axes={[{
      axis: `X`,
      ariaLabel: `场景平移 X`,
      step: `0.1`,
      value: e.position[0],
      onChange: t => {
        return r({
          position: yp(e.position, 0, Number(t))
        });
      }
    }, {
      axis: `Y`,
      ariaLabel: `场景平移 Y`,
      step: `0.1`,
      value: e.position[1],
      onChange: t => {
        return r({
          position: yp(e.position, 1, Number(t))
        });
      }
    }, {
      axis: `Z`,
      ariaLabel: `场景平移 Z`,
      step: `0.1`,
      value: e.position[2],
      onChange: t => {
        return r({
          position: yp(e.position, 2, Number(t))
        });
      }
    }]} />
      <_cmp_Hf label={`场景旋转`} axes={[{
      axis: `X`,
      ariaLabel: `场景旋转 X`,
      step: `1`,
      value: e.rotation[0],
      onChange: t => {
        return r({
          rotation: yp(e.rotation, 0, Number(t))
        });
      }
    }, {
      axis: `Y`,
      ariaLabel: `场景旋转 Y`,
      step: `1`,
      value: e.rotation[1],
      onChange: t => {
        return r({
          rotation: yp(e.rotation, 1, Number(t))
        });
      }
    }, {
      axis: `Z`,
      ariaLabel: `场景旋转 Z`,
      step: `1`,
      value: e.rotation[2],
      onChange: t => {
        return r({
          rotation: yp(e.rotation, 2, Number(t))
        });
      }
    }]} />
      <_cmp_Kf title={`全景背景`}>
        {p ? <Component1995 className={`panorama-thumbnail-card`} aria-label={`全景图缩略图卡片`}>
            <Component1992 aria-label={`删除全景图`} className={`panorama-thumbnail-delete`} type={`button`} onClick={() => {
          return i();
        }}>
              <Ot aria-hidden={`true`} size={14} strokeWidth={1.9} />
            </Component1992>
            <Component1993 className={`panorama-thumbnail-image`} alt={`${p.fileName} 全景图缩略图`} src={p.url} />
            <Component1994 className={`panorama-thumbnail-name`}>{p.fileName}</Component1994>
          </Component1995> : <Component1998 className={`panorama-empty-card`} aria-label={`全景图连接状态`}>
            <Component1996 className={`panorama-empty-icon`} data-testid={`panorama-empty-icon`}>
              <_Component64 aria-hidden={`true`} size={16} strokeWidth={1.8} />
            </Component1996>
            <Component1997>{`未连接全景图`}</Component1997>
          </Component1998>}
        <_cmp_Gf label={`天空颜色`} colorAriaLabel={`天空颜色`} hexAriaLabel={`天空颜色 HEX`} value={e.backgroundColor} onColorChange={e => {
        return r({
          backgroundColor: e
        });
      }} onHexChange={e => {
        return r({
          backgroundColor: e
        });
      }} />
      </_cmp_Kf>
      <_cmp_Kf title={`全景球`}>
        <_cmp_Wf label={`水平旋转`} rangeAriaLabel={`全景球水平旋转滑杆`} numberAriaLabel={`全景球水平旋转`} max={mp} min={pp} step={`1`} value={s} onValueChange={h} onRangeChange={h} onNumberBlur={h} onNumberChange={e => {
        c(e);
        if (e !== ``) {
          let t = Number(e);
          if (Number.isFinite(t)) {
            r({
              panoramaYaw: t
            });
          }
        }
      }} />
        <_cmp_Wf label={`球形半径`} rangeAriaLabel={`全景球半径滑杆`} numberAriaLabel={`全景球半径`} max={fp} min={dp} step={`1`} value={l} onValueChange={g} onRangeChange={g} onNumberBlur={g} onNumberChange={e => {
        u(e);
        if (e !== ``) {
          let t = Number(e);
          if (Number.isFinite(t)) {
            r({
              panoramaRadius: t
            });
          }
        }
      }} />
      </_cmp_Kf>
      <_cmp_Kf title={`开关项`}>
        <Component2008 className={`scene-switch-row`} role={`group`} aria-label={`开关项设置`}>
          <Component2001 className={`inspector-toggle-row`}>
            <Component1999 aria-label={`角色标签`} checked={e.showLabels} type={`checkbox`} onChange={e => {
            return r({
              showLabels: e.target.checked
            });
          }} />
            <Component2000>{`角色标签`}</Component2000>
          </Component2001>
          <Component2004 className={`inspector-toggle-row`}>
            <Component2002 aria-label={`网格吸附`} checked={e.snapToGrid} type={`checkbox`} onChange={e => {
            return r({
              snapToGrid: e.target.checked
            });
          }} />
            <Component2003>{`网格吸附`}</Component2003>
          </Component2004>
          <Component2007 className={`inspector-toggle-row`}>
            <Component2005 aria-label={`地面`} checked={e.showGround} type={`checkbox`} onChange={e => {
            return r({
              showGround: e.target.checked
            });
          }} />
            <Component2006>{`地面`}</Component2006>
          </Component2007>
        </Component2008>
      </_cmp_Kf>
      {e.showGround ? <_cmp_Kf title={`地面`}>
          <_cmp_Wf label={`透明度`} rangeAriaLabel={`地面透明度滑杆`} numberAriaLabel={`地面透明度`} max={`1`} min={`0`} step={`0.01`} value={e.groundOpacity} onValueChange={e => {
        return r({
          groundOpacity: Number(e)
        });
      }} />
          <_cmp_Wf label={`高度`} rangeAriaLabel={`地面高度滑杆`} numberAriaLabel={`地面高度`} max={vp} min={_p} step={`0.1`} value={d} onValueChange={_} onRangeChange={_} onNumberBlur={_} onNumberChange={e => {
        f(e);
        if (e !== ``) {
          let t = Number(e);
          if (Number.isFinite(t)) {
            r({
              groundHeight: t
            });
          }
        }
      }} />
        </_cmp_Kf> : null}
    </_cmp__Component63>;
}