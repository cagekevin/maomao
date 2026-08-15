// TODO(全局, 无需 import): toasts, onRemove, animation, n, t
import { e, r, O, L, _Component, _Component2, R } from './shared.js';
var Lt = ({
  toasts: e,
  onRemove: t
}) => {
  let n = e => {
    switch (e) {
      case `success`:
        {
          return <O size={20} className={`text-green-300`} />;
        }
      case `error`:
        {
          return <L size={20} className={`text-red-300`} />;
        }
      case `warning`:
        {
          return <_Component size={20} className={`text-yellow-300`} />;
        }
      case `info`:
        {
          return <_Component2 size={20} className={`text-blue-300`} />;
        }
    }
  };
  let r = e => {
    switch (e) {
      case `success`:
        {
          return `from-green-500/10 to-emerald-500/10 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]`;
        }
      case `error`:
        {
          return `from-red-500/10 to-rose-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]`;
        }
      case `warning`:
        {
          return `from-yellow-500/10 to-amber-500/10 border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.15)]`;
        }
      case `info`:
        {
          return `from-blue-500/10 to-indigo-500/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]`;
        }
    }
  };
  const Component19 = `div`;
  const Component20 = `p`;
  const Component21 = `div`;
  const Component22 = `button`;
  const Component23 = `div`;
  const Component24 = `div`;
  const Component25 = `div`;
  const Component26 = `div`;
  const Component27 = `style`;
  const Component28 = `div`;
  return <Component28 className={`fixed top-20 right-4 z-[9999] flex flex-col gap-3 max-w-sm`}>
      {e.map(e => {
      return <Component26 className={`relative overflow-hidden bg-gradient-to-r ${r(e.type)} backdrop-blur-xl rounded-lg border p-4 animate-slide-in`} style={{
        animation: `slideIn 0.3s ease-out`
      }} key={e.id}>
            <Component23 className={`flex items-start gap-3`}>
              <Component19 className={`flex-shrink-0 mt-0.5`}>{n(e.type)}</Component19>
              <Component21 className={`flex-1`}>
                <Component20 className={`text-sm font-medium text-gray-200`}>
                  {e.message}
                </Component20>
              </Component21>
              <Component22 onClick={() => {
            return t(e.id);
          }} className={`flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors`}>
                <R size={16} />
              </Component22>
            </Component23>
            <Component25 className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gray-700/50`}>
              <Component24 className={`h-full bg-gradient-to-r from-white/40 to-white/20`} style={{
            animation: `shrink ${e.duration || 3000}ms linear forwards`
          }} />
            </Component25>
          </Component26>;
    })}
      <Component27>{`
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
      `}</Component27>
    </Component28>;
};
export default Lt;