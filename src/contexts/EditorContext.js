import { i as e } from "../vendor/rolldown-runtime.js";
import { Nr as le, Ar as o, Mr as ae } from "../vendor/vendor.js";

var Y = e(le(), 1),
  Un = ae();
var X = o();
var lr = {
    useThumbnail: true,
    lodLevel: 0,
    viewportMoving: false,
    nodeCount: 0,
    handleFollowLimit: 60,
    edgeFxLimit: 100
  },
  ur = Y.createContext(lr.useThumbnail),
  dr = Y.createContext({
    lodLevel: lr.lodLevel,
    viewportMoving: lr.viewportMoving,
    nodeCount: lr.nodeCount,
    handleFollowLimit: lr.handleFollowLimit,
    edgeFxLimit: lr.edgeFxLimit
  });
function fr({
  value: e,
  children: t
}) {
  let n = e.lodLevel ?? lr.lodLevel,
    r = e.viewportMoving ?? lr.viewportMoving,
    i = e.nodeCount ?? lr.nodeCount,
    a = e.handleFollowLimit ?? lr.handleFollowLimit,
    o = e.edgeFxLimit ?? lr.edgeFxLimit,
    s = Y.useMemo(() => ({
      lodLevel: n,
      viewportMoving: r,
      nodeCount: i,
      handleFollowLimit: a,
      edgeFxLimit: o
    }), [n, r, i, a, o]);
  return X.jsx(ur.Provider, {
    value: e.useThumbnail,
    children: X.jsx(dr.Provider, {
      value: s,
      children: t
    })
  });
}
function pr() {
  return {
    useThumbnail: Y.useContext(ur)
  };
}
function mr() {
  return Y.useContext(dr);
}

export { lr, ur, dr, fr, pr, mr };
