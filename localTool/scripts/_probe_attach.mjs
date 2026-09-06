import fs from 'node:fs';
import path, { fileURLToPath } from 'node:path';
import { resolveLovartAttachments } from '../src/ai-relay/providers/lovart/lovart_attachments.ts';
import { stableRequest } from '../src/ai-relay/httpTransport.ts';
import { fetchWithProxy } from '../src/utils/netProxy.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const envRaw = fs.readFileSync(envPath, 'utf-8');
const g = (k) =>
  (envRaw.match(new RegExp(k + '\\s*=\\s*(\\S+)')) || [])[1]?.replace(/['"]/g, '') || '';
const ak = g('LOVART_ACCESS_KEY');
const sk = g('LOVART_SECRET_KEY');
const base = g('LOVART_BASE_URL') || 'https://lgw.lovart.ai';

const auth = { type: 'hmac', accessKey: ak, secretKey: sk };
const proxyTransport = (opts) => stableRequest({ ...opts, fetchImpl: fetchWithProxy });
// 1x1 红点 PNG base64
const pngB64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const dataUrl = `data:image/png;base64,${pngB64}`;
const deps = { baseUrl: base, auth, timeoutMs: 60000, transport: proxyTransport };

try {
  const out = await resolveLovartAttachments(deps, [dataUrl]);
  console.log('SUCCESS attachments:', JSON.stringify(out));
} catch (e) {
  console.log('ERROR msg:', e.message);
  console.log('cause:', e.cause?.message || e.cause || '(none)');
  console.log('stack head:', e.stack?.split('\n').slice(0, 5).join('\n'));
}
