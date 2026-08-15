// TODO(全局, 无需 import): projectionMode, url, width, height, n, r, o, i
import { uh, e, Jm, t, ch, Zm, a, lh, sh } from './shared.js';
export default async function dh(e) {
  let t = await uh(e);
  try {
    if (Jm(t.width, t.height)) {
      return {
        projectionMode: `equirectangular`,
        url: URL.createObjectURL(e)
      };
    }
    let {
      width: n,
      height: r
    } = ch(t.width, t.height);
    let i = Zm(t.width, t.height, n, r);
    let a = document.createElement(`canvas`);
    a.width = n;
    a.height = r;
    let o = a.getContext(`2d`);
    if (!o) {
      throw Error(`当前环境无法生成全景图，请稍后重试`);
    }
    o.fillStyle = `#06080D`;
    o.fillRect(0, 0, n, r);
    lh(o, t, i);
    sh(o, n, r);
    return {
      projectionMode: `backdrop`,
      url: a.toDataURL(`image/jpeg`, 0.92)
    };
  } finally {
    t.close?.();
  }
}