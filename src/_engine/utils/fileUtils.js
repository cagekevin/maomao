async function qr(e) {
  if (e instanceof File) {
    let t = e.name.includes(`.`) ? e.name.split(`.`).pop() : Jr(e.type);
    return {
      blob: e,
      suggestedName: e.name,
      ext: t
    };
  }
  if (e instanceof Blob) {
    let t = Jr(e.type);
    return {
      blob: e,
      suggestedName: `blob_${Date.now()}.${t}`,
      ext: t
    };
  }
  if (e.startsWith(`data:`)) {
    let t = Yr(e),
      n = Jr(t.type);
    return {
      blob: t,
      suggestedName: `data_${Date.now()}.${n}`,
      ext: n
    };
  }
  let t = await (await fetch(e)).blob(),
    n = Jr(t.type);
  return {
    blob: t,
    suggestedName: `remote_${Date.now()}.${n}`,
    ext: n
  };
}
function Jr(e) {
  return e ? e.includes(`png`) ? `png` : e.includes(`jpeg`) || e.includes(`jpg`) ? `jpg` : e.includes(`webp`) ? `webp` : e.includes(`gif`) ? `gif` : e.includes(`mp4`) ? `mp4` : e.includes(`webm`) ? `webm` : e.includes(`flac`) ? `flac` : e.includes(`aac`) ? `aac` : e.includes(`ogg`) ? `ogg` : e.includes(`opus`) ? `opus` : e.includes(`mpeg`) ? `mp3` : e.includes(`m4a`) || e.includes(`mp4a`) ? `m4a` : e.includes(`wav`) ? `wav` : e.includes(`aiff`) ? `aiff` : e.includes(`plain`) ? `txt` : (e.split(`/`)[1] || ``).replace(/^x-/, ``) || `bin` : `bin`;
}
function Yr(e) {
  let [t, n] = e.split(`,`),
    r = t.match(/data:([^;]+)/)?.[1] || `application/octet-stream`,
    i = t.includes(`;base64`) ? atob(n) : decodeURIComponent(n),
    a = new ArrayBuffer(i.length),
    o = new Uint8Array(a);
  for (let e = 0; e < i.length; e++) o[e] = i.charCodeAt(e);
  return new Blob([a], {
    type: r
  });
}
function Js(e) {
  return new Promise((t, n) => {
    let r = new FileReader();
    r.onload = () => t(r.result), r.onerror = () => n(Error(`读取结果失败`)), r.readAsDataURL(e);
  });
}
async function Ys(e) {
  try {
    if (e.startsWith(`data:`)) {
      let t = e.split(`,`)[1] || ``;
      return Math.floor(t.length * 3 / 4);
    }
    return (await (await fetch(e)).blob()).size;
  } catch {
    return 0;
  }
}
export { qr, Jr, Yr, Js, Ys };
