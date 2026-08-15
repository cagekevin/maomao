// TODO(全局, 无需 import): n, o, u, f, r, scale, i, panoramaYaw, panoramaRadius, groundHeight, m, axis, ariaLabel, step, value, onChange, position, rotation, p, backgroundColor, s, l, g, showLabels, snapToGrid, showGround, groundOpacity
import _cmp__Component69 from './_Component69.jsx';
import _cmp_Cf from './Cf.jsx';
import _cmp__Component68 from './_Component68.jsx';
import _cmp_Tf from './Tf.jsx';
import _cmp__Component70 from './_Component70.jsx';
import { $, e, t, c, $f, Jf, Yf, Kf, qf, Wf, Gf, Xf, Zf, a, Qf, h, d, _, Ot, _Component71 } from './shared.js';
import * as Z from 'react';
export default function _Component73() {
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
    let i = Number.isFinite(n) ? $f(n, Jf, Yf) : e.scale;
    r({
      scale: i
    });
    o(String(i));
  }
  function h(t) {
    let n = Number(t);
    let i = Number.isFinite(n) ? $f(n, Kf, qf) : e.panoramaYaw;
    r({
      panoramaYaw: i
    });
    c(String(i));
  }
  function g(t) {
    let n = Number(t);
    let i = Number.isFinite(n) ? $f(n, Wf, Gf) : e.panoramaRadius;
    r({
      panoramaRadius: i
    });
    u(String(i));
  }
  function _(t) {
    let n = Number(t);
    let i = Number.isFinite(n) ? $f(n, Xf, Zf) : e.groundHeight;
    r({
      groundHeight: i
    });
    f(String(i));
  }
  const Component1970 = `button`;
  const Component1971 = `img`;
  const Component1972 = `span`;
  const Component1973 = `div`;
  const Component1974 = `span`;
  const Component1975 = `span`;
  const Component1976 = `div`;
  const Component1977 = `input`;
  const Component1978 = `span`;
  const Component1979 = `div`;
  const Component1980 = `input`;
  const Component1981 = `span`;
  const Component1982 = `div`;
  const Component1983 = `input`;
  const Component1984 = `span`;
  const Component1985 = `div`;
  const Component1986 = `div`;
  return <_cmp__Component69 title={`3D场景`} ariaLabel={`3D场景右侧属性面板`} className={`scene-inspector`}>
      <_cmp_Cf label={`场景缩放`} rangeAriaLabel={`场景缩放滑杆`} numberAriaLabel={`场景缩放`} max={Yf} min={Jf} step={`0.01`} value={a} onValueChange={m} onRangeChange={m} onNumberBlur={m} onNumberChange={e => {
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
      <_cmp__Component68 label={`场景平移`} axes={[{
      axis: `X`,
      ariaLabel: `场景平移 X`,
      step: `0.1`,
      value: e.position[0],
      onChange: t => {
        return r({
          position: Qf(e.position, 0, Number(t))
        });
      }
    }, {
      axis: `Y`,
      ariaLabel: `场景平移 Y`,
      step: `0.1`,
      value: e.position[1],
      onChange: t => {
        return r({
          position: Qf(e.position, 1, Number(t))
        });
      }
    }, {
      axis: `Z`,
      ariaLabel: `场景平移 Z`,
      step: `0.1`,
      value: e.position[2],
      onChange: t => {
        return r({
          position: Qf(e.position, 2, Number(t))
        });
      }
    }]} />
      <_cmp__Component68 label={`场景旋转`} axes={[{
      axis: `X`,
      ariaLabel: `场景旋转 X`,
      step: `1`,
      value: e.rotation[0],
      onChange: t => {
        return r({
          rotation: Qf(e.rotation, 0, Number(t))
        });
      }
    }, {
      axis: `Y`,
      ariaLabel: `场景旋转 Y`,
      step: `1`,
      value: e.rotation[1],
      onChange: t => {
        return r({
          rotation: Qf(e.rotation, 1, Number(t))
        });
      }
    }, {
      axis: `Z`,
      ariaLabel: `场景旋转 Z`,
      step: `1`,
      value: e.rotation[2],
      onChange: t => {
        return r({
          rotation: Qf(e.rotation, 2, Number(t))
        });
      }
    }]} />
      <_cmp_Tf title={`全景背景`}>
        {p ? <Component1973 className={`panorama-thumbnail-card`} aria-label={`全景图缩略图卡片`}>
            <Component1970 aria-label={`删除全景图`} className={`panorama-thumbnail-delete`} type={`button`} onClick={() => {
          return i();
        }}>
              <Ot aria-hidden={`true`} size={14} strokeWidth={1.9} />
            </Component1970>
            <Component1971 className={`panorama-thumbnail-image`} alt={`${p.fileName} 全景图缩略图`} src={p.url} />
            <Component1972 className={`panorama-thumbnail-name`}>{p.fileName}</Component1972>
          </Component1973> : <Component1976 className={`panorama-empty-card`} aria-label={`全景图连接状态`}>
            <Component1974 className={`panorama-empty-icon`} data-testid={`panorama-empty-icon`}>
              <_Component71 aria-hidden={`true`} size={16} strokeWidth={1.8} />
            </Component1974>
            <Component1975>{`未连接全景图`}</Component1975>
          </Component1976>}
        <_cmp__Component70 label={`天空颜色`} colorAriaLabel={`天空颜色`} hexAriaLabel={`天空颜色 HEX`} value={e.backgroundColor} onColorChange={e => {
        return r({
          backgroundColor: e
        });
      }} onHexChange={e => {
        return r({
          backgroundColor: e
        });
      }} />
      </_cmp_Tf>
      <_cmp_Tf title={`全景球`}>
        <_cmp_Cf label={`水平旋转`} rangeAriaLabel={`全景球水平旋转滑杆`} numberAriaLabel={`全景球水平旋转`} max={qf} min={Kf} step={`1`} value={s} onValueChange={h} onRangeChange={h} onNumberBlur={h} onNumberChange={e => {
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
        <_cmp_Cf label={`球形半径`} rangeAriaLabel={`全景球半径滑杆`} numberAriaLabel={`全景球半径`} max={Gf} min={Wf} step={`1`} value={l} onValueChange={g} onRangeChange={g} onNumberBlur={g} onNumberChange={e => {
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
      </_cmp_Tf>
      <_cmp_Tf title={`开关项`}>
        <Component1986 className={`scene-switch-row`} role={`group`} aria-label={`开关项设置`}>
          <Component1979 className={`inspector-toggle-row`}>
            <Component1977 aria-label={`角色标签`} checked={e.showLabels} type={`checkbox`} onChange={e => {
            return r({
              showLabels: e.target.checked
            });
          }} />
            <Component1978>{`角色标签`}</Component1978>
          </Component1979>
          <Component1982 className={`inspector-toggle-row`}>
            <Component1980 aria-label={`网格吸附`} checked={e.snapToGrid} type={`checkbox`} onChange={e => {
            return r({
              snapToGrid: e.target.checked
            });
          }} />
            <Component1981>{`网格吸附`}</Component1981>
          </Component1982>
          <Component1985 className={`inspector-toggle-row`}>
            <Component1983 aria-label={`地面`} checked={e.showGround} type={`checkbox`} onChange={e => {
            return r({
              showGround: e.target.checked
            });
          }} />
            <Component1984>{`地面`}</Component1984>
          </Component1985>
        </Component1986>
      </_cmp_Tf>
      {e.showGround ? <_cmp_Tf title={`地面`}>
          <_cmp_Cf label={`透明度`} rangeAriaLabel={`地面透明度滑杆`} numberAriaLabel={`地面透明度`} max={`1`} min={`0`} step={`0.01`} value={e.groundOpacity} onValueChange={e => {
        return r({
          groundOpacity: Number(e)
        });
      }} />
          <_cmp_Cf label={`高度`} rangeAriaLabel={`地面高度滑杆`} numberAriaLabel={`地面高度`} max={Zf} min={Xf} step={`0.1`} value={d} onValueChange={_} onRangeChange={_} onNumberBlur={_} onNumberChange={e => {
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
        </_cmp_Tf> : null}
    </_cmp__Component69>;
}