/**
 * uploads/ 子目录中央常量表（docs/45 收口；TD-03-18 补齐嵌套登记）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【本表是什么】uploads 下**所有既知落盘目录**的登记册 —— 写侧（谁往哪写）与读侧（UI 显示哪些）
 * 共用的**唯一一份**事实。此前写侧（本表）与读侧（`resourceStore.FOLDERS`）各持一份靠人同步，
 * 人肉同步一停就出 TD-03-15（白名单过期 → 用户自建目录点不进去）。本表即该母体的收口点。
 *
 * 【分域原则（TD-03-18 新增 · 关键判据）】两类根**本性不同**，不能用同一把尺：
 *  · **用户数据根 `migrated`**：目录**用户可自建**（实测有 颜色 / HKH其他产品 等）⇒ 子目录**天然开放**，
 *    **禁止枚举校验**（枚举 = 用户建一个新目录就落盘失败）。UI 侧由 `libraryFoldersOf` 从磁盘实况派生。
 *  · **系统产物根 `tasks` / `canvas` / `web` / `director3d`**：目录由代码决定，**用户建不出来** ⇒ 子目录
 *    **应当封闭**，走登记（本表的 STATIC 段）。这里正是孤儿目录（`canvas/cleaned` / `canvas/template` /
 *    `canvas/upload`，128 文件、全仓零引用）得以出现的缺口 —— 旧注释只讲了 migrated 那半，
 *    把这半也一并放行了。
 * ════════════════════════════════════════════════════════════════
 *
 * 硬约束：**一律不改名**——tasks/web/canvas/migrated 与嵌套 canvas/drop、canvas/video-process
 * 全部沿用现有值，避免任何存量 /files/... URL 与物理目录破链接。
 *
 * ⚠️ **改这里之前先读**：后端 `localTool/src/utils/fileStore.ts::UPLOAD_ROOT_ALLOW` 是**执行校验的一方**
 * （真源），它只认【顶层根】。新增/删除一个**顶层根**时**必须同时改两处** ——
 * 前端加了后端没加 ⇒ 落盘被后端拒（静默失败）；后端加了前端没加 ⇒ 该根永远传不出去（功能死）。
 *
 * 更新(2026-09-15)：原先这条"两端必须一致"由闸 `scripts/check-upload-dirs.mjs` 守。
 * 该闸已按用户裁定**删除**（实测常绿：两端各 5 个手写根，一年最多动一次，性价比不合格）。
 *
 * 更新(2026-09-18 · TD-03-18)：**闸恢复**，但判据换成了有价值的那条 ——
 * 不再是"两端常量对账"（几乎不会红），而是**「代码里实际传的 subfolder 值域 ⊆ 本表登记」**
 * （`scripts/check-upload-dirs.mjs`）：新增一处裸写字面量的落盘调用、或用了未登记的目录，即变红。
 * 这才是真正会漏的那件事（孤儿目录就是这么来的）。
 */
export const UPLOAD_DIRS: Record<
  | 'tasks'
  | 'web'
  | 'canvas'
  | 'canvasDrop'
  | 'videoProcess'
  | 'migrated'
  | 'director3d'
  | 'videoEditor'
  | 'faceMosaic',
  string
> = {
  tasks: 'tasks', // 生成结果（生成面板读 uploads/tasks）
  web: 'web', // 网页拖图本地化
  canvas: 'canvas', // 主画布内部图 / 外部化 base64 通用落盘
  canvasDrop: 'canvas/drop', // 拖放上传（嵌套，保持）
  videoProcess: 'canvas/video-process', // 视频帧处理（嵌套，保持）
  migrated: 'migrated', // 迁移 / 导入
  director3d: 'director3d', // director3d 工程素材（docs/45 批次A）
  videoEditor: 'canvas/video-editor', // 视频剪辑器（影片编辑）产物：与 videoProcess（帧处理）语义不同，故不复用；混目录后无法按目录清理/迁移
  faceMosaic: 'canvas/face_mosaic', // 人脸打码产物（FaceMosaicNode，TD-03-18 补登记：此前只在本表外裸写）
};

/** 顶层根类型：用户数据根（子目录开放） / 系统产物根（子目录封闭）。 */
export type UploadRootKind = 'user' | 'system';

/**
 * 各顶层根的**分域归属**（TD-03-18）—— 决定其子目录是否受登记约束。
 *
 * · `migrated` = `user`：用户可自建子目录 ⇒ **不校验子目录层级**（只能靠磁盘实况驱动 UI）。
 * · 其余 = `system`：产物目录由代码决定 ⇒ 子目录**须在 `KNOWN_SUB_DIRS` 登记**。
 *
 * 【为什么必须有这张表而不是在代码里 if 猜】"哪个根算用户数据"是一条**语义判据**，
 * 必须有唯一居所；散在若干 `if (root === 'migrated')` 里就是又一次"同一真相多份"。
 */
export const UPLOAD_ROOT_KIND: Record<string, UploadRootKind> = {
  tasks: 'system',
  web: 'system',
  canvas: 'system',
  migrated: 'user',
  director3d: 'system',
  'local-patch': 'system', // 后端自有产物根（前端不传，见 fileStore 注释）
};

/**
 * **系统产物根**下的既知子目录登记（多级用 `/`，如 `canvas/drop`）。
 * 判据：`UPLOAD_ROOT_KIND[root] === 'system'` 时，`subfolder` 必须在本集合内。
 * 用户数据根（`migrated`）**不进本表** —— 它的子目录由用户自由创建。
 */
export const KNOWN_SUB_DIRS: ReadonlySet<string> = new Set([
  'canvas/drop',
  'canvas/video-process',
  'canvas/video-editor',
  'canvas/face_mosaic',
]);

/**
 * **代码生成的 `migrated` 子目录**（备案用，**不参与校验**）。
 *
 * 与"用户自建目录"性质不同：这些由代码写死（改名即破存量 URL），但因落在**用户数据根**下，
 * 按分域原则仍**不做落盘校验**（同一根内不能既放行用户自建、又拦住代码自建 —— 无法区分）。
 * 登记于此的**唯一目的**：让"盘上有哪些目录是代码造的"可查，避免日后又被当成孤儿。
 *
 * ⚠️ 改名须同步 `scripts/` 迁移逻辑与存量 URL，**不做静默改名**。
 */
export const CODE_GENERATED_USER_SUB_DIRS: ReadonlySet<string> = new Set([
  'migrated/人物', // 剧本角色资产（FOLDERS.character）
  'migrated/场景', // 剧本场景资产（FOLDERS.scene）
  'migrated/道具', // 剧本道具资产（FOLDERS.prop）
  'migrated/脚本/尾帧变体', // 剧本盒尾帧变体（scriptBoxEngine；三级嵌套，对齐官方）
]);

/**
 * 判断某个 `subfolder`（uploads 相对路径）在当前登记下是否**允许落盘**。
 *
 * 判据顺序（每条都必要）：
 *  1. 顶层根必须已登记（`UPLOAD_ROOT_KIND` 有键）；
 *  2. 顶层根是**用户数据根**（`user`）⇒ 放行（用户可自建任意层级）；
 *  3. 顶层根是**系统产物根**（`system`）⇒ 放行顶层根本身，与**已登记的子目录**；
 *     未登记子目录 ⇒ 拒绝（这正是孤儿目录的来源）。
 *
 * 【纯函数 · 无 IO】前端写侧可先自查（早失败、报错近发生点），后端仍独立校验（不信任客户端）。
 *
 * @param subfolder uploads 相对路径（已规范化，如 `canvas/drop`；**未规范化的请先 normalizeSubfolder**）
 * @returns 允许 → true；未登记 → false
 */
export function isKnownUploadDir(subfolder: string): boolean {
  const kind = UPLOAD_ROOT_KIND[subfolder];
  if (kind === undefined) {
    // 不是顶层根本身 —— 取其顶层根再看
    const slash = subfolder.indexOf('/');
    if (slash < 0) return false; // 无斜杠又不是已登记根 ⇒ 未知根
    const root = subfolder.slice(0, slash);
    const rootKind = UPLOAD_ROOT_KIND[root];
    if (rootKind === undefined) return false; // 未知顶层根
    if (rootKind === 'user') return true; // 用户数据根：子目录自由
    return KNOWN_SUB_DIRS.has(subfolder); // 系统产物根：须登记
  }
  return true; // 顶层根本身：均已登记
}
