// TODO(全局, 无需 import): fileName, url
import _cmp__Component88 from './_Component88.jsx';
import _cmp__Component89 from './_Component89.jsx';
import { e, t } from './shared.js';
export default function _Component91({
  fileName: e,
  url: t
}) {
  if (/\.fbx$/i.test(e)) {
    return <_cmp__Component88 url={t} />;
  } else if (/\.obj$/i.test(e)) {
    return <_cmp__Component89 url={t} />;
  } else {
    return null;
  }
}