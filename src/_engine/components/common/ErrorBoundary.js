import { i as e } from "../../rolldown-runtime-aKtaBQYM.js";
import { Nr as le, Ar as o, Mr as ae } from "../../vendor-Cr1JWW-B.js";

var Y = e(le(), 1),
  Un = ae();
var X = o();
var Tf = class extends Y.Component {
  state = {
    hasError: false
  };
  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
};

export { Tf };
