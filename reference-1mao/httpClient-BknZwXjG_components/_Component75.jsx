import _cmp_Vf from './Vf.jsx';
import _cmp_Uf from './Uf.jsx';
import _cmp__Component72 from './_Component72.jsx';
import _cmp__Component73 from './_Component73.jsx';
import { $, cf, e } from './shared.js';
export default function _Component75() {
  let e = $(cf);
  if (e === `character`) {
    return <_cmp_Vf />;
  } else if (e === `prop`) {
    return <_cmp_Uf />;
  } else if (e === `camera`) {
    return <_cmp__Component72 />;
  } else {
    return <_cmp__Component73 />;
  }
}