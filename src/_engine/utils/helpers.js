function Zi(e) {
  return Number.isFinite(e) ? parseFloat(e.toFixed(3)).toString() : `0`;
}
function uu(e, t, n = 1) {
  let r = n - 1;
  for (let n of e) {
    if (!n.startsWith(t)) continue;
    let e = n.slice(t.length);
    /^\d+$/.test(e) && (r = Math.max(r, Number.parseInt(e, 10)));
  }
  return `${t}${r + 1}`;
}
function pu(e) {
  return JSON.parse(JSON.stringify(e));
}
export { Zi, uu, pu };
