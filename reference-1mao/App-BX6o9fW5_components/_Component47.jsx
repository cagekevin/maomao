// TODO(全局, 无需 import): open, hasPassword, onClose, onSuccess, newPassword, confirmPassword, t, s, l, d, p, h, o, n, v, m, c, y, i, u, b, f, x
import { a, ut, e, an, on, _, Ge, r, S, rn, C, g, R } from './shared.js';
import * as W from 'react';
export default function _Component47({
  open: e,
  hasPassword: t,
  onClose: n,
  onSuccess: r
}) {
  let [i, a] = W.useState(!!t);
  let [o, s] = W.useState(``);
  let [c, l] = W.useState(``);
  let [u, d] = W.useState(``);
  let [f, p] = W.useState({});
  let [m, h] = W.useState({
    newPassword: false,
    confirmPassword: false
  });
  let [g, _] = W.useState(false);
  W.useEffect(() => {
    a(!!t);
  }, [t]);
  W.useEffect(() => {
    if (!e) {
      return;
    }
    let t = false;
    ut(`/user/info`).then(e => {
      if (!t && e.success && e.data) {
        let t = e.data.user;
        if (t) {
          a(!!t.hasPassword);
        }
      }
    }).catch(() => {
      return undefined;
    });
    return () => {
      t = true;
    };
  }, [e]);
  W.useEffect(() => {
    if (!e) {
      s(``);
      l(``);
      d(``);
      p({});
      h({
        newPassword: false,
        confirmPassword: false
      });
    }
  }, [e]);
  let v = e => {
    let t = an(e);
    p(e => {
      return {
        ...e,
        newPassword: t.valid ? undefined : t.error
      };
    });
    return t.valid;
  };
  let y = (e, t = o) => {
    let n = on(t, e);
    p(e => {
      return {
        ...e,
        confirmPassword: n.valid ? undefined : n.error
      };
    });
    return n.valid;
  };
  let b = () => {
    h(e => {
      return {
        ...e,
        newPassword: true
      };
    });
    v(o);
    if (m.confirmPassword || c) {
      y(c, o);
    }
  };
  let x = () => {
    h(e => {
      return {
        ...e,
        confirmPassword: true
      };
    });
    y(c);
  };
  let S = async e => {
    e.preventDefault();
    d(``);
    let t = v(o);
    let i = y(c);
    h({
      newPassword: true,
      confirmPassword: true
    });
    if (!!t && !!i) {
      _(true);
      try {
        let e = await Ge(`/user/change-password`, {
          newPassword: o
        });
        if (e.success) {
          r?.();
          n();
        } else {
          d(e.error || `操作失败`);
        }
      } catch {
        d(`网络错误，请稍后重试`);
      } finally {
        _(false);
      }
    }
  };
  if (!e) {
    return null;
  }
  let C = e => {
    return `w-full bg-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${e ? `border border-red-500 focus:ring-2 focus:ring-red-500/30` : `border border-transparent focus:ring-2 focus:ring-white/20`}`;
  };
  const Component209 = `div`;
  const Component210 = `h2`;
  const Component211 = `button`;
  const Component212 = `div`;
  const Component213 = `p`;
  const Component214 = `div`;
  const Component215 = `label`;
  const Component216 = `input`;
  const Component217 = `p`;
  const Component218 = `div`;
  const Component219 = `label`;
  const Component220 = `input`;
  const Component221 = `p`;
  const Component222 = `div`;
  const Component223 = `button`;
  const Component224 = `form`;
  const Component225 = `div`;
  const Component226 = `div`;
  return <Component226 className={`fixed inset-0 z-[200] flex items-center justify-center px-4`}>
      <Component209 className={`absolute inset-0 bg-black/70 backdrop-blur-sm`} onClick={n} />
      <Component225 className={`relative w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl overflow-hidden`}>
        <Component212 className={`flex items-center justify-between px-5 py-4 border-b border-[#333]`}>
          <Component210 className={`text-lg font-bold text-white`}>
            {i ? `修改密码` : `设置密码`}
          </Component210>
          <Component211 type={`button`} onClick={n} className={`w-8 h-8 rounded-full hover:bg-[#333] flex items-center justify-center text-gray-400 hover:text-white transition-colors`}>
            <R size={16} />
          </Component211>
        </Component212>
        <Component224 onSubmit={S} className={`p-5 space-y-4`} autoComplete={`on`} noValidate={true}>
          <Component213 className={`text-xs text-gray-500`}>{rn}</Component213>
          {u && <Component214 className={`bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg text-center`}>
              {u}
            </Component214>}
          <Component218>
            <Component215 className={`block text-xs text-gray-400 mb-1.5`}>{`新密码`}</Component215>
            <Component216 type={`password`} name={`new-password`} autoComplete={`new-password`} value={o} onChange={e => {
            let t = e.target.value;
            s(t);
            if (m.newPassword) {
              v(t);
            }
            if (m.confirmPassword || c) {
              y(c, t);
            }
          }} onBlur={b} placeholder={`请输入符合要求的密码`} className={C(!!m.newPassword && !!f.newPassword)} />
            {m.newPassword && f.newPassword ? <Component217 className={`text-xs text-red-400 mt-1.5`}>{f.newPassword}</Component217> : null}
          </Component218>
          <Component222>
            <Component219 className={`block text-xs text-gray-400 mb-1.5`}>{`确认新密码`}</Component219>
            <Component220 type={`password`} name={`confirm-password`} autoComplete={`new-password`} value={c} onChange={e => {
            let t = e.target.value;
            l(t);
            if (m.confirmPassword) {
              y(t);
            }
          }} onBlur={x} placeholder={`再次输入新密码`} className={C(!!m.confirmPassword && !!f.confirmPassword)} />
            {m.confirmPassword && f.confirmPassword ? <Component221 className={`text-xs text-red-400 mt-1.5`}>
                {f.confirmPassword}
              </Component221> : null}
          </Component222>
          <Component223 type={`submit`} disabled={g} className={`w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-all disabled:opacity-50`}>
            {g ? `提交中...` : i ? `更新密码` : `设置密码`}
          </Component223>
        </Component224>
      </Component225>
    </Component226>;
}