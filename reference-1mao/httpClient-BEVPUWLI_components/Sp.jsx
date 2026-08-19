import _cmp__Component65 from './_Component65.jsx';
import _cmp__Component66 from './_Component66.jsx';
import _cmp__Component67 from './_Component67.jsx';
import _cmp__Component68 from './_Component68.jsx';
import { $, kf, e } from './shared.js';
export default function Sp() {
  let e = $(kf);
  if (e === `character`) {
    return <_cmp__Component65 />;
  } else if (e === `prop`) {
    return <_cmp__Component66 />;
  } else if (e === `camera`) {
    return <_cmp__Component67 />;
  } else {
    return <_cmp__Component68 />;
  }
}