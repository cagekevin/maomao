/**
 * types 目录 barrel（唯一收口出口）
 *
 * 【约定】所有跨模块复用的共享类型收口到本目录：按领域拆文件（refToken.ts 等），
 *        统一在此 re-export。其他 src 代码统一 `import type { ... } from '@/types'`，
 *        不直接引用子模块路径，避免散落。
 * 【约束】组件 Props 就近定义在组件文件（保持内聚），不进这里；
 *        仅「跨模块复用的通用形状」才下沉到本目录。
 */
export * from './errors'
export * from './media'
export * from './refToken'