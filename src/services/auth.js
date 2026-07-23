// 本地模式：已删除所有云端登录/token/会员相关函数。
// 仅保留本地提示词历史记录（Ga/Ka）和未登录心跳（Ha）。
import { Va } from '../config/constants.js';

function Ha() {
  try {
    window.dispatchEvent(new CustomEvent(Va));
  } catch {}
}
var Wa = `maomao:promptRecent`;
function Ga() {
  try {
    let e = localStorage.getItem(Wa);
    return e ? JSON.parse(e) : [];
  } catch {
    return [];
  }
}
function Ka(e) {
  try {
    let t = Ga().filter(t => t !== e);
    t.unshift(e), localStorage.setItem(Wa, JSON.stringify(t.slice(0, 50)));
  } catch {}
}
export {
  Ha, Wa, Ga, Ka
};
