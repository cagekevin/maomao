// TODO(全局, 无需 import): onLoginSuccess, t, b, x, n, i, o, s, y, phone, h, m, v, code, c, account, password, u, f, l, d, p
import { H, r, a, e, Ge, _, Et, g, qe, et } from './shared.js';
import * as W from 'react';
import * as G from 'react';
export default function It({
  onLoginSuccess: e
}) {
  let t = H();
  let [n, r] = W.useState(`phone`);
  let [i, a] = W.useState(``);
  let [o, s] = W.useState(``);
  let [c, l] = W.useState(t?.account ?? ``);
  let [u, d] = W.useState(t?.password ?? ``);
  let [f, p] = W.useState(!!t);
  let [m, h] = W.useState(0);
  let [g, _] = W.useState(false);
  let [v, y] = W.useState(false);
  let [b, x] = W.useState(``);
  const Component = `div`;
  const Component2 = `button`;
  const Component3 = `button`;
  const Component4 = `div`;
  const Component5 = `input`;
  const Component6 = `div`;
  const Component7 = `input`;
  const Component8 = `button`;
  const Component9 = `div`;
  const Component10 = `div`;
  const Component11 = `button`;
  const Component12 = `input`;
  const Component13 = `input`;
  const Component14 = `input`;
  const Component15 = `label`;
  const Component16 = `button`;
  const Component17 = `form`;
  const Component18 = `div`;
  return <Component18 className={`space-y-5 mt-4`}>
      {b && <Component className={`bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg text-center`}>
          {b}
        </Component>}
      <Component4 className={`flex rounded-xl border border-[#333] bg-[#1a1a1a] p-1`}>
        <Component2 type={`button`} onClick={() => {
        r(`phone`);
        x(``);
      }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${n === `phone` ? `bg-red-600 text-white` : `text-gray-400 hover:text-white`}`}>{`手机验证码`}</Component2>
        <Component3 type={`button`} onClick={() => {
        r(`password`);
        x(``);
      }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${n === `password` ? `bg-red-600 text-white` : `text-gray-400 hover:text-white`}`}>{`账号密码`}</Component3>
      </Component4>
      {n === `phone` ? <G.Fragment>
          <Component6 className={`space-y-1.5`}>
            <Component5 type={`tel`} value={i} onChange={e => {
          return a(e.target.value);
        }} placeholder={`请输入手机号`} className={`w-full bg-[#2a2a2a] rounded-xl px-5 py-4 text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all`} maxLength={11} />
          </Component6>
          <Component10 className={`space-y-1.5`}>
            <Component9 className={`flex gap-3`}>
              <Component7 type={`text`} value={o} onChange={e => {
            return s(e.target.value.replace(/\D/g, ``));
          }} placeholder={`请输入验证码`} className={`flex-1 bg-[#2a2a2a] rounded-xl px-5 py-4 text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all`} maxLength={6} />
              <Component8 type={`button`} onClick={async () => {
            if (!i || !/^1[3-9]\d{9}$/.test(i)) {
              x(`请输入有效的手机号`);
              return;
            }
            y(true);
            x(``);
            try {
              let e = await Ge(`/auth/send-code`, {
                phone: i
              });
              if (e.success) {
                h(60);
                let e = setInterval(() => {
                  h(t => {
                    if (t <= 1) {
                      clearInterval(e);
                      return 0;
                    } else {
                      return t - 1;
                    }
                  });
                }, 1000);
              } else {
                x(e.error || `发送验证码失败`);
              }
            } catch {
              x(`网络错误，请稍后重试`);
            } finally {
              y(false);
            }
          }} disabled={m > 0 || v} className={`px-5 py-4 rounded-xl text-sm font-bold transition-colors whitespace-nowrap ${m > 0 ? `bg-[#333] text-gray-500 cursor-not-allowed` : `bg-[#2a2a2a] text-gray-300 hover:bg-[#333]`}`}>
                {v ? `发送中...` : m > 0 ? `${m}s` : `获取验证码`}
              </Component8>
            </Component9>
          </Component10>
          <Component11 type={`button`} onClick={async () => {
        if (!i || !o) {
          x(`请填写手机号和验证码`);
          return;
        }
        _(true);
        x(``);
        try {
          let t = await Ge(`/auth/login-phone`, {
            phone: i,
            code: o
          });
          if (t.success && t.data) {
            let n = t.data;
            Et(n.token);
            e(n.user);
          } else {
            x(t.error || `登录失败`);
          }
        } catch {
          x(`网络错误，请稍后重试`);
        } finally {
          _(false);
        }
      }} disabled={g} className={`w-full py-4 mt-2 bg-red-600 text-white rounded-xl text-base font-bold hover:bg-red-500 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50`}>
            {g ? `处理中...` : `一键注册/登录`}
          </Component11>
        </G.Fragment> : <Component17 onSubmit={async t => {
      t.preventDefault();
      if (!c.trim() || !u) {
        x(`请填写账号和密码`);
        return;
      }
      _(true);
      x(``);
      try {
        let t = await Ge(`/auth/login-password`, {
          account: c.trim(),
          password: u
        });
        if (t.success && t.data) {
          let n = t.data;
          Et(n.token);
          if (f) {
            qe({
              account: c.trim(),
              password: u
            });
          } else {
            et();
          }
          e(n.user);
        } else {
          x(t.error || `登录失败`);
        }
      } catch {
        x(`网络错误，请稍后重试`);
      } finally {
        _(false);
      }
    }} className={`space-y-4`} autoComplete={`on`}>
          <Component12 type={`text`} name={`username`} id={`plugin-login-account`} autoComplete={`username`} value={c} onChange={e => {
        return l(e.target.value);
      }} placeholder={`用户名 / 手机号`} className={`w-full bg-[#2a2a2a] rounded-xl px-5 py-4 text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all`} />
          <Component13 type={`password`} name={`password`} id={`plugin-login-password`} autoComplete={`current-password`} value={u} onChange={e => {
        return d(e.target.value);
      }} placeholder={`请输入密码`} className={`w-full bg-[#2a2a2a] rounded-xl px-5 py-4 text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all`} />
          <Component15 className={`flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none`}>
            <Component14 type={`checkbox`} checked={f} onChange={e => {
          return p(e.target.checked);
        }} className={`h-4 w-4 accent-red-600`} />
            {`记住密码`}
          </Component15>
          <Component16 type={`submit`} disabled={g} className={`w-full py-4 mt-2 bg-red-600 text-white rounded-xl text-base font-bold hover:bg-red-500 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50`}>
            {g ? `处理中...` : `登录`}
          </Component16>
        </Component17>}
    </Component18>;
}