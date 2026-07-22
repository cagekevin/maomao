import { i as e } from "../../vendor/rolldown-runtime-aKtaBQYM.js";
import { Nr as le, Ar as o, Mr as ae } from "../../vendor/vendor-Cr1JWW-B.js";

var Y = e(le(), 1),
  Un = ae();
var X = o();
function Bg({
  importData: e,
  exportData: t
}) {
  let n = Y.useRef(e),
    r = Y.useRef(t);
  Y.useEffect(() => {
    n.current = e, r.current = t;
  }, [e, t]), Y.useEffect(() => {
    let e = () => {
        let e = document.createElement(`input`);
        e.type = `file`, e.accept = `.json`, e.onchange = e => n.current(e), e.click();
      },
      t = () => {
        r.current();
      };
    return window.addEventListener(`import-project`, e), window.addEventListener(`export-project`, t), () => {
      window.removeEventListener(`import-project`, e), window.removeEventListener(`export-project`, t);
    };
  }, []);
}

export { Bg };
