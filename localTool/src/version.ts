/**
 * 系统端（localTool）对外产品版本号 —— 全库唯一单源。
 *
 * 收口说明：
 * - 之前版本号散落在 index.ts / system.ts / platform.ts 三处各自硬编码 '1.4.2'，
 *   且 localTool/package.json 还是 '2.0.0'，互相不一致（git 快照即现状）。
 * - 现统一：改版本号只改这一处，其余模块 import 本常量；测试也从本常量断言。
 * - 语义化版本（SemVer）：主版本.次版本.补丁。
 *   · 主版本：破坏数据兼容/架构级大改（需同时 bump 各 schema 版本，如 CANVAS_SCHEMA_VERSION）
 *   · 次版本：新增功能
 *   · 补丁：修 bug / 小改
 * - 与 Chrome 插件 manifest（public/manifest.json 的 version）保持同一版本号，对外一体发布。
 *
 * 与内部 schema 版本的关系（重要，勿混淆）：
 * - 本文件是【对外产品版本】，给用户/Chrome 看，回答"发布到哪个版本"。
 * - 内部【数据格式版本】由各数据域各自独立管理，回答"这份数据用什么格式写的"，
 *   供代码做兼容迁移：CANVAS_SCHEMA_VERSION（画布快照）、cloudSync version（云配置）、
 *   backupStore version（备份）、project_meta version（项目并发保护）、directorProject version（3D）。
 * - 两者正交、独立演进：改 UI/逻辑不升内部 schema；只有数据结构真的变了才升对应 schema 版本，
 *   并写迁移。禁止把内部 schema 版本绑定到对外版本号（也不反向绑定）。
 * - 唯一交集：对外主版本号（X.0.0）的破坏性大改，通常伴随某几个内部 schema 版本 bump，但节奏各自独立。
 */
export const VERSION = '1.0';
