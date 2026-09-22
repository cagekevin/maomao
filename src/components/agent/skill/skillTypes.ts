/**
 * Skill 模块的类型真源（唯一）—— 对外只暴露 `UserSkill` / `SkillBinding` / `SkillConfig`
 * 与包读写的数据形状，其余（Manifest 等）属模块内部。
 *
 * 【关于"内置 Skill"】内置 skill 目前仍住在 `agent/runtime/skillStore.ts`（代码常量）。它的
 * `RuntimeSkill = BuiltinSkill | UserSkill` 判别联合与配套的 `isUserSkill` 收窄**曾经**在这里，
 * 但当时零消费者（UI 走的是 legacy `Skill` 形状）⇒ 已按 ADR-0053 删除（幽灵预留）。
 * **将来 UI 改用模块类型（或内置 skill 迁进本模块）时，与第一个真实消费者同批加回**，
 * 不要先把类型放回来占位。
 *
 * 【失败契约】对外结果一律 `SkillApiResult<T>`（`{ok:true,data}` | `{ok:false,message}`）——
 * 禁 `T | null`：那让"失败"与"合法的空"长得一样，消费者只能猜（本仓红线「异常 0 猜测」）。
 */
export type SkillOrigin = 'builtin' | 'user';

/**
 * `SKILL.md` frontmatter 的解析产物（模块内部类型，**不进 `index.ts` 门面**）。
 * 定义在类型真源里（`skillManifest.ts` 只实现解析/序列化，不持有类型）—— 避免两文件互相 import 成环。
 */
export interface SkillManifest {
  name: string;
  description: string;
  whenToUse?: string;
  version?: string;
  /** 稳定 UUID（由本模块在创建时写入 frontmatter，不在用户手填） */
  id?: string;
  /** 声明了但**不生效**：本仓工具集固定，skill 开关只有 `agent_skill_enabled` */
  allowedTools?: string[];
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
  /** 未识别字段原样保留（往返幂等 + 外部 skill 包可直接放入） */
  unknown: Record<string, string>;
  /** 因多行写法被整体作废的安全字段名（可见，不静默） */
  rejectedMultiLine: string[];
}

/** 导入来源追踪（跨仓库去重与"可检查更新"用；本期只存） */
export interface SkillSource {
  sourceRepo?: string;
  sourceCommit?: string;
  importedAt?: number;
}

/** 用户 Skill：磁盘 `<分类>/<名称>/SKILL.md` 的镜像（`content` 是正文副本，磁盘才是真相源） */
export interface UserSkill {
  kind: 'user';
  /** 稳定 UUID，写进 `SKILL.md` frontmatter，与目录名解耦（改名/换组不动它） */
  id: string;
  category: string;
  slug: string;
  name: string;
  description: string;
  whenToUse?: string;
  version?: string;
  content: string;
  /** 正文指纹（变更检测权威基线；持久化在索引项里，重启不失） */
  contentHash: string;
  /** 迁移期旧 id（`skill_${now}`）登记于此，运行时按 alias 命中，不改写旧键 */
  aliases?: string[];
  source?: SkillSource;
  /** legacy 展示字段（设置页显示创建/更新时间）。磁盘上没有，由旧缓存带入，缺失即不显示 */
  createdAt?: number;
  updatedAt?: number;
}

/** 发送时冻结的不可变绑定（P2）：正文/版本/指纹一次性固化，之后改文件不影响已发出的对话 */
export interface SkillBinding {
  skillId: string;
  name: string;
  version?: string;
  contentHash: string;
  content: string;
  origin: SkillOrigin;
  category?: string;
  slug?: string;
}

/** Skill 模块的可调设置（落 `agent_skill_config`，跨设备同步） */
export interface SkillConfig {
  /** ① 元数据清单是否常驻 system（默认 false = 只有手动选中才发 skill，D8） */
  catalogToModel: boolean;
  contentLimits: {
    singleSkillChars: number;
    expansionTotalChars: number;
    maxExplicitBindings: number;
  };
}

/** 包内单个文件（`encoding` 区分文本与二进制；技能包通常全是文本） */
export interface SkillPackageFile {
  relPath: string;
  encoding: 'utf8' | 'base64';
  content: string;
}

/** 列包的结果项（`files` 恒有；`contents` 仅在 `withContent` 时带，避免 N+1） */
export interface SkillPackageSummary {
  category: string;
  slug: string;
  files: string[];
  /** 只含 `SKILL.md` + `references/**`（后端默认排除 `scripts/**`） */
  contents?: SkillPackageFile[];
}

/** 单包读取结果 */
export interface SkillPackage {
  category: string;
  slug: string;
  scope: 'content' | 'package';
  files: SkillPackageFile[];
}

/** 技能库列举结果（`root` 如实回传：UI 凭它告诉用户"文件放哪儿"，前端不自己拼路径） */
export interface SkillLibrary {
  root: string;
  /** 分组名 = 技能库下的一级目录（`.tmp`/`.trash` 等内部目录不在内） */
  groups: string[];
  packages: SkillPackageSummary[];
  /**
   * `.trash/` 的保留上限（后端常量，**由生产者给全**）：界面据此如实说明"覆盖/删除能捞回多少份"。
   * 前端不自己写这个数字 —— 它是后端的行为参数，抄一份必然漂移。
   */
  trashKeep?: number;
}

/**
 * 对外统一结果契约：失败必须带可展示文案（消费方只转发，不自己编话术）。
 * `status` / `notFound` 供调用方**按事实**分支（如"磁盘上本来就没有这个包"⇒ 删缓存不是失败），
 * 而不是去猜 message 文案 —— 猜文案是脆弱判据。
 */
export type SkillApiResult<T> =
  { ok: true; data: T } | { ok: false; message: string; status?: number; notFound?: boolean };
