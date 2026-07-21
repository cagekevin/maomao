function Ks(e, t) {
  return new Promise((n, r) => {
    let i = new Image();
    i.crossOrigin = `anonymous`;
    let a = window.setTimeout(() => r(Error(`图片加载超时`)), t);
    i.onload = () => {
      window.clearTimeout(a), n(i);
    }, i.onerror = () => {
      window.clearTimeout(a), r(Error(`图片加载失败（可能是跨域或格式不支持）`));
    }, i.src = e;
  });
}
function qs(e, t, n) {
  return new Promise((r, i) => {
    e.toBlob(e => e ? r(e) : i(Error(`图片编码失败`)), t, n);
  });
}
async function $a(e, t) {
  let n = document.createElement(`canvas`),
    r = e.naturalWidth / e.width,
    i = e.naturalHeight / e.height;
  n.width = t.width * r, n.height = t.height * i;
  let a = n.getContext(`2d`);
  if (!a) throw Error(`No 2d context`);
  return a.drawImage(e, t.x * r, t.y * i, t.width * r, t.height * i, 0, 0, t.width * r, t.height * i), new Promise((e, t) => {
    n.toBlob(async n => {
      if (!n) {
        t(Error(`Canvas is empty`));
        return;
      }
      try {
        e(await yr(n, 2048, .85));
      } catch (e) {
        t(e);
      }
    }, `image/jpeg`, .9);
  });
}
export { Ks, qs, $a };
