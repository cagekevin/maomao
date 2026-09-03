/**
 * lovart_errors — 直连 adapter 的错误信封。
 *
 * 错误契约（与 httpTransport 一致）：上游返回什么文案就透传什么，绝不翻译/静默。
 * 外部用 LOVART_ERR_TYPES 区分失败类型（no_artifact / abort / timeout / ...）。
 */

import { LOVART_ERR_TYPES } from './lovart_config.js';

export type LovartErrType = (typeof LOVART_ERR_TYPES)[keyof typeof LOVART_ERR_TYPES];

export { LOVART_ERR_TYPES };

export class LovartError extends Error {
  /** 上游 code（数字）或内部标记（-1） */
  code: number | string;
  /** 与 LOVART_ERR_TYPES 对应的失败类型 */
  type: string;

  constructor(message: string, code: number | string = -1, type: string = LOVART_ERR_TYPES.UPSTREAM) {
    super(message);
    this.name = 'LovartError';
    this.code = code;
    this.type = type;
  }
}
