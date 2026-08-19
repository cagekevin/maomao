(function () {
  let e = document.createElement(`link`).relList;
  if (e && e.supports && e.supports(`modulepreload`)) {
    return;
  }
  for (let e of document.querySelectorAll(`link[rel="modulepreload"]`)) {
    n(e);
  }
  new MutationObserver(e => {
    for (let t of e) {
      if (t.type === `childList`) {
        for (let e of t.addedNodes) {
          if (e.tagName === `LINK` && e.rel === `modulepreload`) {
            n(e);
          }
        }
      }
    }
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function t(e) {
    let t = {};
    if (e.integrity) {
      t.integrity = e.integrity;
    }
    if (e.referrerPolicy) {
      t.referrerPolicy = e.referrerPolicy;
    }
    if (e.crossOrigin === `use-credentials`) {
      t.credentials = `include`;
    } else if (e.crossOrigin === `anonymous`) {
      t.credentials = `omit`;
    } else {
      t.credentials = `same-origin`;
    }
    return t;
  }
  function n(e) {
    if (e.ep) {
      return;
    }
    e.ep = true;
    let n = t(e);
    fetch(e.href, n);
  }
})();