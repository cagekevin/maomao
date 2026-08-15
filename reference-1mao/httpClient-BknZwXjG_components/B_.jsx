import { Vt, e } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var B_ = Z.memo(() => {
  let e = Vt(e => {
    return e.transform[2];
  });
  return <Q.Fragment>
      {Math.round(e * 100)}
      {`%`}
    </Q.Fragment>;
});
export default B_;