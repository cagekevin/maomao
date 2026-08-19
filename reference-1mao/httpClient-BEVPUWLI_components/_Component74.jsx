// TODO(全局, 无需 import): fileName, url
import _cmp__Component73 from './_Component73.jsx';
import _cmp_Am from './Am.jsx';
import { e, t } from './shared.js';
export default function _Component74({
  fileName: e,
  url: t
}) {
  if (/\.fbx$/i.test(e)) {
    return <_cmp__Component73 url={t} />;
  } else if (/\.obj$/i.test(e)) {
    return <_cmp_Am url={t} />;
  } else {
    return null;
  }
}