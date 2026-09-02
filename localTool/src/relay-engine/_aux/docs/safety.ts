/**
 * docs/safety — 文档 URL 的安全校验（SSRF 防护的第一道闸）。
 *
 * 「读对方的文档再自动适配」意味着要按用户给的 URL 去发请求，
 * 这个 URL 可能来自模型输出、可能指向内网。所以在发出之前先卡死：
 * 只允许无凭据的标准 HTTPS（443）公网地址，其余一律拒绝。
 *
 * 注意：这只是前端侧的形状校验。**真正的防护必须在原生侧做 DNS pinning**
 * （解析后校验 IP 再连接，防止 DNS rebinding），见 `rust/provider_docs.rs`。
 */

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
];

/** 判断主机名是否指向本机 / 内网 / 保留网段。 */
export function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    normalized === 'localhost'
    || normalized === '::1'
    || BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  ) return true;

  // 纯 IPv4 字面量走网段判断；域名交给原生侧的 DNS pinning
  const octets = normalized.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }
  return octets[0] === 0        // 0.0.0.0/8
    || octets[0] === 10         // 私有
    || octets[0] === 127        // 回环
    || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) // CGNAT
    || (octets[0] === 169 && octets[1] === 254)  // link-local
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)  // 私有
    || (octets[0] === 192 && octets[1] === 168)  // 私有
    || octets[0] >= 224;        // 组播与保留
}

/**
 * 规范化并校验一个文档 URL。
 * @returns 通过则返回去掉 hash 的规范 URL，否则返回 `null`。
 */
export function normalizeDocUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.port && url.port !== '443') return null;
    if (isBlockedHostname(url.hostname)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** 从一个 URL 是否安全可用（布尔版）。 */
export function isDocUrlAllowed(rawUrl: string): boolean {
  return normalizeDocUrl(rawUrl) !== null;
}

/** 两个 URL 是否同源（协议 + 主机 + 端口）。 */
export function isSameOrigin(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.protocol === b.protocol
      && a.hostname.toLowerCase() === b.hostname.toLowerCase()
      && (a.port || '443') === (b.port || '443');
  } catch {
    return false;
  }
}

/** 从一段文本里抽出所有合规的 HTTPS 文档链接（用于从正文中发现下一层页面）。 */
export function extractDocUrls(text: string): string[] {
  const matches = text.match(/https:\/\/[^\s<>"'`]+/gi) ?? [];
  const urls = new Set<string>();
  for (const match of matches) {
    // 剥掉中文/英文标点尾巴：
    // 文档里 "详见 https://x.com/docs。" 的句号不属于 URL
    const normalized = normalizeDocUrl(
      match.replace(/[),.;:!?\]}>，。；：！？）】》]+$/u, ''),
    );
    if (normalized) urls.add(normalized);
  }
  return [...urls];
}
