// TODO(全局, 无需 import): i, r, n, mode, crowdId, crowdMembers, crowdAnchor, role, name, color, label, active, onClick, x, o, v, axis, ariaLabel, value, b, onChange, position, s, rotation, step, scale, u, l, f, m, p, title, controls, key, g
import _cmp__Component69 from './_Component69.jsx';
import _cmp__Component66 from './_Component66.jsx';
import _cmp__Component68 from './_Component68.jsx';
import _cmp_Cf from './Cf.jsx';
import _cmp__Component70 from './_Component70.jsx';
import _cmp_Tf from './Tf.jsx';
import { $, e, qd, t, _, a, c, Bf, y, d, Ql, h } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function Vf() {
  let [e, t] = Z.useState(`properties`);
  let n = $(e => {
    return e.selectedCrowdId;
  });
  let r = $(e => {
    return e.selectedObjectId;
  });
  let i = $(e => {
    return e.project.objects;
  });
  let a = $(e => {
    return e.updateObjectName;
  });
  let o = $(e => {
    return e.updateCrowdLabel;
  });
  let s = $(e => {
    return e.updateObjectTransform;
  });
  let c = $(e => {
    return e.updateCrowdTransform;
  });
  let l = $(e => {
    return e.updateUniformScale;
  });
  let u = $(e => {
    return e.updateCrowdUniformScale;
  });
  let d = $(e => {
    return e.updateObjectColor;
  });
  let f = $(e => {
    return e.updateCrowdColor;
  });
  let p = $(e => {
    return e.applyPosePreset;
  });
  let m = $(e => {
    return e.applyCrowdPosePreset;
  });
  let h = $(e => {
    return e.updatePoseControl;
  });
  let g = $(e => {
    return e.updateCrowdPoseControl;
  });
  let _ = Z.useMemo(() => {
    let e = i.find(e => {
      return e.id === r && e.kind === `character`;
    });
    if (n) {
      let e = i.filter(e => {
        return e.kind === `character` && e.crowdId === n;
      });
      let t = qd(i, n);
      if (e.length && t) {
        return {
          mode: `crowd`,
          crowdId: n,
          crowdMembers: e,
          crowdAnchor: t,
          role: e[e.length - 1] ?? e[0],
          name: e[0]?.crowdLabel ?? `群众`,
          color: e[0]?.color ?? `#4F8EF7`
        };
      }
    }
    if (e) {
      return {
        mode: `single`,
        crowdId: null,
        crowdMembers: [e],
        crowdAnchor: e.transform,
        role: e,
        name: e.name,
        color: e.color ?? `#4F8EF7`
      };
    } else {
      return null;
    }
  }, [i, n, r]);
  if (!_) {
    return null;
  }
  let v = _.role;
  let y = _.color;
  let b = _.crowdAnchor;
  let x = _.mode === `crowd`;
  const Component1964 = `button`;
  const Component1965 = `div`;
  const Component1966 = `h4`;
  const Component1967 = `section`;
  const Component1968 = `div`;
  const Component1969 = `p`;
  return <_cmp__Component69 title={`角色`} ariaLabel={`角色右侧属性面板`} className={`character-inspector`} tabs={[{
    label: `属性`,
    active: e === `properties`,
    onClick: () => {
      return t(`properties`);
    }
  }, {
    label: `姿势`,
    active: e === `pose`,
    onClick: () => {
      return t(`pose`);
    }
  }]}>
      {e === `properties` ? <Q.Fragment>
          <_cmp__Component66 label={`名称`} ariaLabel={`角色名称`} value={_.name} onChange={e => {
        if (x && _.crowdId) {
          o(_.crowdId, e);
          return;
        }
        a(v.id, e);
      }} />
          <_cmp__Component68 label={`位置`} axes={[{
        axis: `X`,
        ariaLabel: `角色位置 X`,
        value: b.position[0],
        onChange: e => {
          if (x && _.crowdId) {
            return c(_.crowdId, {
              position: Bf(b.position, 0, Number(e))
            });
          } else {
            return s(v.id, {
              position: Bf(b.position, 0, Number(e))
            });
          }
        }
      }, {
        axis: `Y`,
        ariaLabel: `角色位置 Y`,
        value: b.position[1],
        onChange: e => {
          if (x && _.crowdId) {
            return c(_.crowdId, {
              position: Bf(b.position, 1, Number(e))
            });
          } else {
            return s(v.id, {
              position: Bf(b.position, 1, Number(e))
            });
          }
        }
      }, {
        axis: `Z`,
        ariaLabel: `角色位置 Z`,
        value: b.position[2],
        onChange: e => {
          if (x && _.crowdId) {
            return c(_.crowdId, {
              position: Bf(b.position, 2, Number(e))
            });
          } else {
            return s(v.id, {
              position: Bf(b.position, 2, Number(e))
            });
          }
        }
      }]} />
          <_cmp__Component68 label={`旋转`} axes={[{
        axis: `X`,
        ariaLabel: `角色旋转 X`,
        value: b.rotation[0],
        onChange: e => {
          if (x && _.crowdId) {
            return c(_.crowdId, {
              rotation: Bf(b.rotation, 0, Number(e))
            });
          } else {
            return s(v.id, {
              rotation: Bf(b.rotation, 0, Number(e))
            });
          }
        }
      }, {
        axis: `Y`,
        ariaLabel: `角色旋转 Y`,
        value: b.rotation[1],
        onChange: e => {
          if (x && _.crowdId) {
            return c(_.crowdId, {
              rotation: Bf(b.rotation, 1, Number(e))
            });
          } else {
            return s(v.id, {
              rotation: Bf(b.rotation, 1, Number(e))
            });
          }
        }
      }, {
        axis: `Z`,
        ariaLabel: `角色旋转 Z`,
        value: b.rotation[2],
        onChange: e => {
          if (x && _.crowdId) {
            return c(_.crowdId, {
              rotation: Bf(b.rotation, 2, Number(e))
            });
          } else {
            return s(v.id, {
              rotation: Bf(b.rotation, 2, Number(e))
            });
          }
        }
      }]} />
          <_cmp__Component68 label={`缩放`} axes={[{
        axis: `X`,
        ariaLabel: `角色缩放 X`,
        step: `0.01`,
        value: b.scale[0],
        onChange: e => {
          if (x && _.crowdId) {
            return c(_.crowdId, {
              scale: Bf(b.scale, 0, Number(e))
            });
          } else {
            return s(v.id, {
              scale: Bf(b.scale, 0, Number(e))
            });
          }
        }
      }, {
        axis: `Y`,
        ariaLabel: `角色缩放 Y`,
        step: `0.01`,
        value: b.scale[1],
        onChange: e => {
          if (x && _.crowdId) {
            return c(_.crowdId, {
              scale: Bf(b.scale, 1, Number(e))
            });
          } else {
            return s(v.id, {
              scale: Bf(b.scale, 1, Number(e))
            });
          }
        }
      }, {
        axis: `Z`,
        ariaLabel: `角色缩放 Z`,
        step: `0.01`,
        value: b.scale[2],
        onChange: e => {
          if (x && _.crowdId) {
            return c(_.crowdId, {
              scale: Bf(b.scale, 2, Number(e))
            });
          } else {
            return s(v.id, {
              scale: Bf(b.scale, 2, Number(e))
            });
          }
        }
      }]} />
          <_cmp_Cf label={`统一缩放`} rangeAriaLabel={`角色统一缩放滑杆`} numberAriaLabel={`角色统一缩放`} max={`3`} min={`0.2`} step={`0.01`} value={b.scale[0]} onValueChange={e => {
        if (x && _.crowdId) {
          return u(_.crowdId, Number(e));
        } else {
          return l(v.id, Number(e));
        }
      }} />
          <_cmp__Component70 label={`颜色`} colorAriaLabel={`角色颜色`} hexAriaLabel={`角色颜色 HEX`} value={y} onColorChange={e => {
        if (x && _.crowdId) {
          return f(_.crowdId, e);
        } else {
          return d(v.id, e);
        }
      }} onHexChange={e => {
        if (x && _.crowdId) {
          return f(_.crowdId, e);
        } else {
          return d(v.id, e);
        }
      }} />
        </Q.Fragment> : <_cmp_Tf title={`姿势预设`} className={`pose-preset-section`}>
          {v.characterRig ? <Q.Fragment>
              <Component1965 className={`preset-grid`}>
                {Ql.map(e => {
            return <Component1964 className={v.characterRig?.posePresetId === e.id ? `is-active` : undefined} type={`button`} onClick={() => {
              if (x && _.crowdId) {
                return m(_.crowdId, e.id);
              } else {
                return p(v.id, e.id);
              }
            }} key={e.id}>
                      {e.label}
                    </Component1964>;
          })}
              </Component1965>
              <_cmp_Tf title={`姿势调节`} className={`pose-adjust-section`}>
                <Component1968 className={`pose-groups`}>
                  {[{
              title: `身体`,
              controls: [{
                key: `body.pitch`,
                label: `前倾`
              }, {
                key: `body.yaw`,
                label: `转身`
              }, {
                key: `body.roll`,
                label: `侧倾`
              }]
            }, {
              title: `躯干`,
              controls: [{
                key: `torso.pitch`,
                label: `前倾`
              }, {
                key: `torso.yaw`,
                label: `扭转`
              }, {
                key: `torso.roll`,
                label: `侧倾`
              }]
            }, {
              title: `头部`,
              controls: [{
                key: `head.pitch`,
                label: `点头`
              }, {
                key: `head.yaw`,
                label: `转头`
              }, {
                key: `head.roll`,
                label: `歪头`
              }]
            }, {
              title: `左肩`,
              controls: [{
                key: `leftShoulder.pitch`,
                label: `前举`
              }, {
                key: `leftShoulder.spread`,
                label: `外展`
              }, {
                key: `leftShoulder.twist`,
                label: `扭转`
              }]
            }, {
              title: `右肩`,
              controls: [{
                key: `rightShoulder.pitch`,
                label: `前举`
              }, {
                key: `rightShoulder.spread`,
                label: `外展`
              }, {
                key: `rightShoulder.twist`,
                label: `扭转`
              }]
            }, {
              title: `左肘`,
              controls: [{
                key: `leftElbow.bend`,
                label: `弯曲`
              }]
            }, {
              title: `右肘`,
              controls: [{
                key: `rightElbow.bend`,
                label: `弯曲`
              }]
            }, {
              title: `左髋`,
              controls: [{
                key: `leftHip.pitch`,
                label: `前抬`
              }, {
                key: `leftHip.spread`,
                label: `外展`
              }, {
                key: `leftHip.twist`,
                label: `扭转`
              }]
            }, {
              title: `右髋`,
              controls: [{
                key: `rightHip.pitch`,
                label: `前抬`
              }, {
                key: `rightHip.spread`,
                label: `外展`
              }, {
                key: `rightHip.twist`,
                label: `扭转`
              }]
            }, {
              title: `左膝`,
              controls: [{
                key: `leftKnee.bend`,
                label: `弯曲`
              }]
            }, {
              title: `右膝`,
              controls: [{
                key: `rightKnee.bend`,
                label: `弯曲`
              }]
            }].map(e => {
              return <Component1967 className={`pose-group`} key={e.title}>
                        <Component1966>{e.title}</Component1966>
                        {e.controls.map(t => {
                  return <_cmp_Cf label={t.label} rangeAriaLabel={`${e.title} · ${t.label} 滑杆`} numberAriaLabel={`${e.title} · ${t.label}`} max={`90`} min={`-90`} step={`1`} value={v.characterRig?.controls[t.key] ?? 0} onValueChange={e => {
                    if (x && _.crowdId) {
                      return g(_.crowdId, t.key, Number(e));
                    } else {
                      return h(v.id, t.key, Number(e));
                    }
                  }} key={t.key} />;
                })}
                      </Component1967>;
            })}
                </Component1968>
              </_cmp_Tf>
            </Q.Fragment> : <Component1969>{`该模型未识别到标准 humanoid 骨骼，暂不支持姿势编辑。`}</Component1969>}
        </_cmp_Tf>}
    </_cmp__Component69>;
}