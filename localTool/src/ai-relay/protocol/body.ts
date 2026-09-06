/**
 * protocol/body — 声明式协议请求体的序列化（json / form-urlencoded / multipart）。
 * 对应 AI-Canvas-tauri 的 modelProtocolBody.ts。
 */

const MIME_TYPE_RE = /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function findHeaderName(headers: Record<string, string>, target: string): string | undefined {
  return Object.keys(headers).find((name) => name.toLowerCase() === target.toLowerCase());
}

function setContentType(headers: Record<string, string>, value: string, force = false): void {
  const existingName = findHeaderName(headers, 'content-type');
  if (existingName && !force) return;
  if (existingName) delete headers[existingName];
  headers['Content-Type'] = value;
}

function appendUrlEncodedValue(params: URLSearchParams, name: string, value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((item) => appendUrlEncodedValue(params, name, item));
    return;
  }
  if (value && typeof value === 'object') {
    params.append(name, JSON.stringify(value));
    return;
  }
  params.append(name, value === null ? '' : String(value));
}

function parseBase64DataUrl(value: string): { mimeType: string; bytes: Uint8Array } {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/i.exec(value);
  if (!match || !MIME_TYPE_RE.test(match[1])) {
    throw new Error('multipart 文件只支持 data URL');
  }
  try {
    const binary = atob(match[2].replace(/\s/g, ''));
    return {
      mimeType: match[1],
      bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    };
  } catch {
    throw new Error('multipart 文件 data URL 的 Base64 内容无效');
  }
}

function sanitizeMultipartToken(value: string, fallback: string): string {
  const sanitized = value.trim().replace(/[\r\n"]/g, '_');
  return sanitized || fallback;
}

function createMultipartBoundary(): string {
  const randomPart =
    globalThis.crypto?.randomUUID?.().replace(/-/g, '') ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `----ai-canvas-${randomPart}`;
}

function concatBytes(chunks: Uint8Array[]): ArrayBuffer {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const combined = new Uint8Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return combined.buffer;
}

function serializeMultipartBody(body: Record<string, unknown>, boundary: string): ArrayBuffer {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const appendText = (value: string) => chunks.push(encoder.encode(value));
  const appendPart = (name: string, value: unknown) => {
    const safeName = sanitizeMultipartToken(name, 'field');
    if (isRecord(value) && Object.hasOwn(value, '$file')) {
      const fileSource = value.$file;
      if (typeof fileSource !== 'string')
        throw new Error(`multipart 文件字段 ${name} 的 $file 必须是字符串`);
      const parsed = parseBase64DataUrl(fileSource);
      const configuredMime = value.contentType;
      if (
        configuredMime !== undefined &&
        (typeof configuredMime !== 'string' || !MIME_TYPE_RE.test(configuredMime))
      ) {
        throw new Error(`multipart 文件字段 ${name} 的 contentType 无效`);
      }
      const filename = sanitizeMultipartToken(
        typeof value.filename === 'string' ? value.filename : 'upload.bin',
        'upload.bin',
      );
      appendText(`--${boundary}\r\n`);
      appendText(`Content-Disposition: form-data; name="${safeName}"; filename="${filename}"\r\n`);
      appendText(`Content-Type: ${configuredMime ?? parsed.mimeType}\r\n\r\n`);
      chunks.push(parsed.bytes);
      appendText('\r\n');
      return;
    }
    const serialized =
      value && typeof value === 'object'
        ? JSON.stringify(value)
        : value === null
          ? ''
          : String(value);
    appendText(`--${boundary}\r\n`);
    appendText(`Content-Disposition: form-data; name="${safeName}"\r\n\r\n`);
    appendText(`${serialized}\r\n`);
  };

  for (const [name, value] of Object.entries(body)) {
    if (Array.isArray(value)) value.forEach((item) => appendPart(name, item));
    else appendPart(name, value);
  }
  appendText(`--${boundary}--\r\n`);
  return concatBytes(chunks);
}

export function serializeModelProtocolBody(
  body: unknown,
  encoding: 'json' | 'form-urlencoded' | 'multipart' | undefined,
  headers: Record<string, string>,
): string | ArrayBuffer {
  const resolvedEncoding = encoding ?? 'json';
  if (resolvedEncoding === 'json') {
    setContentType(headers, 'application/json');
    return JSON.stringify(body);
  }
  if (!isRecord(body)) {
    throw new Error(`${resolvedEncoding} 请求体必须是 JSON 对象`);
  }
  if (resolvedEncoding === 'form-urlencoded') {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([name, value]) => appendUrlEncodedValue(params, name, value));
    setContentType(headers, 'application/x-www-form-urlencoded;charset=UTF-8');
    return params.toString();
  }
  const boundary = createMultipartBoundary();
  setContentType(headers, `multipart/form-data; boundary=${boundary}`, true);
  return serializeMultipartBody(body, boundary);
}

export function redactModelProtocolMultipartPreview(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactModelProtocolMultipartPreview);
  if (isRecord(value) && Object.hasOwn(value, '$file') && typeof value.$file === 'string') {
    const parsed = parseBase64DataUrl(value.$file);
    return {
      ...value,
      $file: `[data URL ${parsed.mimeType}, ${parsed.bytes.byteLength} bytes]`,
    };
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactModelProtocolMultipartPreview(item)]),
    );
  }
  return value;
}
