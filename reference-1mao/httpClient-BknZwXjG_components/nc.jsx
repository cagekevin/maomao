// TODO(全局, 无需 import): i, r, n
import { e, t, a } from './shared.js';
export default function nc(e, t) {
  return new Promise((n, r) => {
    let i = document.createElement(`video`);
    i.crossOrigin = `anonymous`;
    i.preload = `auto`;
    i.muted = true;
    i.playsInline = true;
    i.src = e;
    let a = window.setTimeout(() => {
      r(Error(`视频加载超时`));
    }, t);
    i.onloadedmetadata = () => {
      window.clearTimeout(a);
      n(i);
    };
    i.onerror = () => {
      window.clearTimeout(a);
      r(Error(`视频加载失败（可能是跨域或格式不支持）`));
    };
  });
}