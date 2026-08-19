// TODO(全局, 无需 import): n, axis, ariaLabel, value, onChange, position, rotation, step, scale, r, i
import _cmp__Component63 from './_Component63.jsx';
import _cmp_Bf from './Bf.jsx';
import _cmp_Hf from './Hf.jsx';
import _cmp_Wf from './Wf.jsx';
import _cmp_Gf from './Gf.jsx';
import { $, e, t, lp, a } from './shared.js';
export default function _Component66() {
  let e = $(e => {
    let t = e.project.objects.find(t => {
      return t.id === e.selectedObjectId;
    });
    let n = t?.assetRefId ? e.project.assets.find(e => {
      return e.id === t.assetRefId;
    }) : undefined;
    if (t && (t.kind === `prop` || n?.sourceType === `model`)) {
      return t;
    }
  });
  let t = $(e => {
    return e.updateObjectName;
  });
  let n = $(e => {
    return e.updateObjectTransform;
  });
  let r = $(e => {
    return e.updateUniformScale;
  });
  let i = $(e => {
    return e.updateObjectColor;
  });
  if (!e) {
    return null;
  }
  let a = e.color ?? `#d7e7ff`;
  return <_cmp__Component63 title={`模型`} ariaLabel={`模型右侧属性面板`} className={`prop-inspector`}>
      <_cmp_Bf label={`名称`} ariaLabel={`模型名称`} value={e.name} onChange={n => {
      return t(e.id, n);
    }} />
      <_cmp_Hf label={`位置`} axes={[{
      axis: `X`,
      ariaLabel: `模型位置 X`,
      value: e.transform.position[0],
      onChange: t => {
        return n(e.id, {
          position: lp(e.transform.position, 0, Number(t))
        });
      }
    }, {
      axis: `Y`,
      ariaLabel: `模型位置 Y`,
      value: e.transform.position[1],
      onChange: t => {
        return n(e.id, {
          position: lp(e.transform.position, 1, Number(t))
        });
      }
    }, {
      axis: `Z`,
      ariaLabel: `模型位置 Z`,
      value: e.transform.position[2],
      onChange: t => {
        return n(e.id, {
          position: lp(e.transform.position, 2, Number(t))
        });
      }
    }]} />
      <_cmp_Hf label={`旋转`} axes={[{
      axis: `X`,
      ariaLabel: `模型旋转 X`,
      value: e.transform.rotation[0],
      onChange: t => {
        return n(e.id, {
          rotation: lp(e.transform.rotation, 0, Number(t))
        });
      }
    }, {
      axis: `Y`,
      ariaLabel: `模型旋转 Y`,
      value: e.transform.rotation[1],
      onChange: t => {
        return n(e.id, {
          rotation: lp(e.transform.rotation, 1, Number(t))
        });
      }
    }, {
      axis: `Z`,
      ariaLabel: `模型旋转 Z`,
      value: e.transform.rotation[2],
      onChange: t => {
        return n(e.id, {
          rotation: lp(e.transform.rotation, 2, Number(t))
        });
      }
    }]} />
      <_cmp_Hf label={`缩放`} axes={[{
      axis: `X`,
      ariaLabel: `模型缩放 X`,
      step: `0.01`,
      value: e.transform.scale[0],
      onChange: t => {
        return n(e.id, {
          scale: lp(e.transform.scale, 0, Number(t))
        });
      }
    }, {
      axis: `Y`,
      ariaLabel: `模型缩放 Y`,
      step: `0.01`,
      value: e.transform.scale[1],
      onChange: t => {
        return n(e.id, {
          scale: lp(e.transform.scale, 1, Number(t))
        });
      }
    }, {
      axis: `Z`,
      ariaLabel: `模型缩放 Z`,
      step: `0.01`,
      value: e.transform.scale[2],
      onChange: t => {
        return n(e.id, {
          scale: lp(e.transform.scale, 2, Number(t))
        });
      }
    }]} />
      <_cmp_Wf label={`统一缩放`} rangeAriaLabel={`模型统一缩放滑杆`} numberAriaLabel={`模型统一缩放`} max={`3`} min={`0.2`} step={`0.01`} value={e.transform.scale[0]} onValueChange={t => {
      return r(e.id, Number(t));
    }} />
      <_cmp_Gf label={`颜色`} colorAriaLabel={`模型颜色`} hexAriaLabel={`模型颜色 HEX`} value={a} onColorChange={t => {
      return i(e.id, t);
    }} onHexChange={t => {
      return i(e.id, t);
    }} />
    </_cmp__Component63>;
}