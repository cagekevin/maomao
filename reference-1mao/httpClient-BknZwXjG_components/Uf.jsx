// TODO(全局, 无需 import): n, axis, ariaLabel, value, onChange, position, rotation, step, scale, r, i
import _cmp__Component69 from './_Component69.jsx';
import _cmp__Component66 from './_Component66.jsx';
import _cmp__Component68 from './_Component68.jsx';
import _cmp_Cf from './Cf.jsx';
import _cmp__Component70 from './_Component70.jsx';
import { $, e, t, Hf, a } from './shared.js';
export default function Uf() {
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
  return <_cmp__Component69 title={`模型`} ariaLabel={`模型右侧属性面板`} className={`prop-inspector`}>
      <_cmp__Component66 label={`名称`} ariaLabel={`模型名称`} value={e.name} onChange={n => {
      return t(e.id, n);
    }} />
      <_cmp__Component68 label={`位置`} axes={[{
      axis: `X`,
      ariaLabel: `模型位置 X`,
      value: e.transform.position[0],
      onChange: t => {
        return n(e.id, {
          position: Hf(e.transform.position, 0, Number(t))
        });
      }
    }, {
      axis: `Y`,
      ariaLabel: `模型位置 Y`,
      value: e.transform.position[1],
      onChange: t => {
        return n(e.id, {
          position: Hf(e.transform.position, 1, Number(t))
        });
      }
    }, {
      axis: `Z`,
      ariaLabel: `模型位置 Z`,
      value: e.transform.position[2],
      onChange: t => {
        return n(e.id, {
          position: Hf(e.transform.position, 2, Number(t))
        });
      }
    }]} />
      <_cmp__Component68 label={`旋转`} axes={[{
      axis: `X`,
      ariaLabel: `模型旋转 X`,
      value: e.transform.rotation[0],
      onChange: t => {
        return n(e.id, {
          rotation: Hf(e.transform.rotation, 0, Number(t))
        });
      }
    }, {
      axis: `Y`,
      ariaLabel: `模型旋转 Y`,
      value: e.transform.rotation[1],
      onChange: t => {
        return n(e.id, {
          rotation: Hf(e.transform.rotation, 1, Number(t))
        });
      }
    }, {
      axis: `Z`,
      ariaLabel: `模型旋转 Z`,
      value: e.transform.rotation[2],
      onChange: t => {
        return n(e.id, {
          rotation: Hf(e.transform.rotation, 2, Number(t))
        });
      }
    }]} />
      <_cmp__Component68 label={`缩放`} axes={[{
      axis: `X`,
      ariaLabel: `模型缩放 X`,
      step: `0.01`,
      value: e.transform.scale[0],
      onChange: t => {
        return n(e.id, {
          scale: Hf(e.transform.scale, 0, Number(t))
        });
      }
    }, {
      axis: `Y`,
      ariaLabel: `模型缩放 Y`,
      step: `0.01`,
      value: e.transform.scale[1],
      onChange: t => {
        return n(e.id, {
          scale: Hf(e.transform.scale, 1, Number(t))
        });
      }
    }, {
      axis: `Z`,
      ariaLabel: `模型缩放 Z`,
      step: `0.01`,
      value: e.transform.scale[2],
      onChange: t => {
        return n(e.id, {
          scale: Hf(e.transform.scale, 2, Number(t))
        });
      }
    }]} />
      <_cmp_Cf label={`统一缩放`} rangeAriaLabel={`模型统一缩放滑杆`} numberAriaLabel={`模型统一缩放`} max={`3`} min={`0.2`} step={`0.01`} value={e.transform.scale[0]} onValueChange={t => {
      return r(e.id, Number(t));
    }} />
      <_cmp__Component70 label={`颜色`} colorAriaLabel={`模型颜色`} hexAriaLabel={`模型颜色 HEX`} value={a} onColorChange={t => {
      return i(e.id, t);
    }} onHexChange={t => {
      return i(e.id, t);
    }} />
    </_cmp__Component69>;
}