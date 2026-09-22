/**
 * 磁盘**目录名的规则**：新造名字的安全化 · 直接给出落点的围栏 · 撞名去重。
 *
 * 【本文件管的是跨栈对齐面】这里的取值必须与后端 `isSafeSegment` 同族（前端是"早退"，
 * 后端才是**权威**）⇒ 变更理由 = "后端收不收这个名字"，与预算/文案/读权限/组措辞都无关。
 *
 * 【历史上它与另外四类一起住在 `skillCatalog.ts`（TD-11-60 六类混居）】
 */

/**
 * 目录名**单段长度上限** —— **跨栈契约常量**
 * （后端 `localTool/src/routes/skills.ts:37` 同名常量，由 `check:arch` 的跨栈对账保证两侧相等）。
 * 【为什么必须双写】前后端是两个独立构建产物、无共享模块 ⇒ 双写是结构必然，缺口在**机器对账**
 * （此前前端内联两处 + 后端一份，改一处另两处静默留旧值 ⇒ 产出名后端收不收取决于改没改全 —— TD-11-78）。
 */
export const SKILL_MAX_DIR_SEGMENT_LEN = 64;

/**
 * 技能名 → 目录名（slug）：只做**安全化**（去路径敌意字符与首尾空白、限长），不改语义、不转拼音。
 * 【唯一入口】迁移、新建、导入都必须走它 —— 否则同一个名字会产出两种目录名（同语义两套规则的母体）。
 * 【职责边界（TD-11-25）】它只管"**新造**一个名字"；**磁盘上已存在的组名不许经它**（那等于给已有目录改名）
 * —— 见 `skillPersist.resolveGroupName`。剥离集**故意宽于**后端 `isSafeSegment` 的拒收集
 * （多剥 `*?"<>|`：这些在 POSIX 上合法、在 Windows 上建不出来），但因此**绝不能**让它去处理
 * 一个已有的目录名：`客户*项目` 会被静默改成 `客户 项目`，技能落到另一个目录（"明明有这个分组却进了别处"）。
 * 【产出必须被后端接受】收尾再 `trim` 一次：`slice(64)` 可能刚好切在空格上 ⇒ 产出带尾空格的名字，
 * 后端 `isSafeSegment` 判"前后空白"直接 400（前端只该产出后端一定能收的名字）。
 */
export function slugifySkillName(name: string): string {
  const cleaned = String(name || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // 前导点必须去掉：后端 `isSafeSegment` 会拒 `.` 开头（那是 `.tmp`/`.trash` 内部目录的保留面），
    // 留着它用户只会看到一句"非法分类或名称"——把可预防的失败变成难懂的报错。
    .replace(/^\.+/, '')
    .trim()
    .slice(0, SKILL_MAX_DIR_SEGMENT_LEN)
    .trim();
  return cleaned || '未命名';
}

/**
 * 目录名（分组名 / 包目录名）的**合法性**判据 —— 与后端 `isSafeSegment` 同族（TD-11-53）。
 *
 * 【为什么需要它】`slugifySkillName` 只负责把**用户输入**安全化；而"调用方直接给出的落点"
 * （`SaveSkillInput.slug`，恢复原位用）是**第二个入口**，它绕过了安全化 ⇒ 必须有围栏：
 * 非法值要在**产出点**被拦住，而不是等后端 400（那时错误离成因已经很远）。
 * 【与后端判据的关系】两处都必须拒：分隔符 `/\`、冒号、控制字符、`.`/`..`、前导点（内部目录保留面）、
 * 前后空白、超长。前端这份是"早退"，后端的才是**权威**（跨栈各一份，见 TD-11-25）。
 */
export function isLegalDirSegment(name: unknown): boolean {
  if (typeof name !== 'string' || !name) return false;
  if (name !== name.trim()) return false;
  if (name.length > SKILL_MAX_DIR_SEGMENT_LEN) return false;
  if (name === '.' || name === '..') return false;
  if (name.startsWith('.')) return false;
  // eslint-disable-next-line no-control-regex
  return !/[/\\:\u0000-\u001f]/.test(name);
}

/** 在已占用集合内取一个不撞的 slug（`base` / `base-2` / `base-3` …），并把它记入集合 */
export function uniqueSlugIn(base: string, used: Set<string>): string {
  let s = base;
  let i = 2;
  while (used.has(s)) {
    s = `${base}-${i}`;
    i += 1;
  }
  used.add(s);
  return s;
}
