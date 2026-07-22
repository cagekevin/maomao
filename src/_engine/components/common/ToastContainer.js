import { i as e } from "../../vendor/rolldown-runtime-aKtaBQYM.js";
import { Nr as le, Ar as o, Mr as ae, dr as ot, cr as nt, fr as pt, On as H, ut as yn } from "../../vendor/vendor-Cr1JWW-B.js";

var Y = e(le(), 1),
  Un = ae();
var X = o();
var Hg = ({
    toasts: e,
    onRemove: t
  }) => {
    let n = e => {
        switch (e) {
          case `success`:
            return X.jsx(ot, {
              size: 20,
              className: `text-green-300`
            });
          case `error`:
            return X.jsx(nt, {
              size: 20,
              className: `text-red-300`
            });
          case `warning`:
            return X.jsx(pt, {
              size: 20,
              className: `text-yellow-300`
            });
          case `info`:
            return X.jsx(H, {
              size: 20,
              className: `text-blue-300`
            });
        }
      },
      r = e => {
        switch (e) {
          case `success`:
            return `from-green-500/10 to-emerald-500/10 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]`;
          case `error`:
            return `from-red-500/10 to-rose-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]`;
          case `warning`:
            return `from-yellow-500/10 to-amber-500/10 border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.15)]`;
          case `info`:
            return `from-blue-500/10 to-indigo-500/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]`;
        }
      };
    return X.jsxs(`div`, {
      className: `fixed top-20 right-4 z-[9999] flex flex-col gap-3 max-w-sm`,
      children: [e.map(e => X.jsxs(`div`, {
        className: `relative overflow-hidden bg-gradient-to-r ${r(e.type)} backdrop-blur-xl rounded-lg border p-4 animate-slide-in`,
        style: {
          animation: `slideIn 0.3s ease-out`
        },
        children: [X.jsxs(`div`, {
          className: `flex items-start gap-3`,
          children: [X.jsx(`div`, {
            className: `flex-shrink-0 mt-0.5`,
            children: n(e.type)
          }), X.jsx(`div`, {
            className: `flex-1`,
            children: X.jsx(`p`, {
              className: `text-sm font-medium text-gray-200`,
              children: e.message
            })
          }), X.jsx(`button`, {
            onClick: () => t(e.id),
            className: `flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors`,
            children: X.jsx(yn, {
              size: 16
            })
          })]
        }), X.jsx(`div`, {
          className: `absolute bottom-0 left-0 right-0 h-0.5 bg-gray-700/50`,
          children: X.jsx(`div`, {
            className: `h-full bg-gradient-to-r from-white/40 to-white/20`,
            style: {
              animation: `shrink ${e.duration || 3e3}ms linear forwards`
            }
          })
        })]
      }, e.id)), X.jsx(`style`, {
        children: `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `
      })]
    });
  };

export { Hg };
