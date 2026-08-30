/**
 * refToken 参考图 token 相关共享类型。
 * 收口于 src/types/ 目录（由 index.ts barrel 统一导出），供 refToken.ts / 执行层复用。
 */

/** 参考图 token 编码入参（encodeRefToken）。url 非空才会产出 token */
export interface RefImageAttrs {
  url?: string
  name?: string
  label?: string
  nodeId?: string
  x?: number
  y?: number
  refIndex?: number
}

/** 参考图 token 解析出的「图」节点 */
export interface RefImageNode {
  type: 'image'
  url?: string
  name?: string
  nodeId?: string
  x?: number
  y?: number
  refIndex?: number
}

/** 参考图 token 解析出的「文本」节点（间隔文本保留，供执行层还原上下文顺序） */
export interface RefTextNode {
  type: 'text'
  text: string
}

export type RefTokenNode = RefImageNode | RefTextNode

/** 旧格式 token 反查用的已知参考图目录项 */
export type RefKnownImage = RefImageNode & { name?: string }