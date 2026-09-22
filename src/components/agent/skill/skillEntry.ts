/**
 * 技能包**入口文件**（`SKILL.md`）的唯一口径 —— 包的身份与正文都住在它里面。
 *
 * 【为什么必须收成一处（TD-11-59）】此前这个名字以**字面量散在 8 个文件**，而
 * `find(f => f.relPath === 'SKILL.md')` 这个惯用法被**抄了 7 遍**。它不是普通字符串：
 * ① 它是**跨栈协议名** —— 前端建包/解析、后端落盘/供数都按这个名字找文件；
 * ② 任一处写错（大小写、扩展名、多一个空格）就是"包还在、但**这一个包谁也读不到**"，
 *    而且**没有类型错、没有测试拦**（各处单独看都"对"，本仓 M1 母体的典型形态）。
 *
 * 【两侧各留一份，靠机器对账】前后端是两个独立构建产物（vite 浏览器 / node + 独立 package.json），
 * 无共享模块机制 ⇒ 双写是**结构必然**。真正的缺口从来不是"有两份"，而是"**没有任何机器对账**"
 * —— 注释里写"勿单边漂移"拦不住人。故：本文件的 `SKILL_ENTRY_FILE` 与后端
 * `localTool/src/routes/skills.ts` 的同名常量，由 `check:arch` 的 `CROSS_STACK_CONSTS` **对账**
 * （必须都存在且值相等），并由同一份闸禁止"字面量在两侧定义文件之外再出现"。
 */
import type { SkillPackageFile } from './skillTypes.ts';

/** 入口文件名（**跨栈协议名**：与后端 `localTool/src/routes/skills.ts` 的 `SKILL_ENTRY_FILE` 必须相等） */
export const SKILL_ENTRY_FILE = 'SKILL.md';

/**
 * 从包内文件列表里取出**入口文件**（`null` = 包里没有它 / 列表没带 `contents`）。
 *
 * 【为什么收成函数而不是留字面量比较】调用方要的从来不是"某个字符串相等"，而是"**这个包的入口文件**"
 * —— 判据写一句，散成 7 遍时任意一处写错就是一个包静默消失（少一个包不会报错，只会"看不见"）。
 * 顺带容错 `contents` 缺省（列表接口不 `withContent` 时它不存在）。
 */
export function findSkillEntryFile(
  files: readonly SkillPackageFile[] | undefined,
): SkillPackageFile | null {
  return (files || []).find((f) => f.relPath === SKILL_ENTRY_FILE) || null;
}

/**
 * 入口文件的包内相对路径（`<分类>/<目录名>/SKILL.md`）。
 * 【为什么也要收】它此前在两处各拼一遍（视图层的 `relPath` 与"按索引造行"的 `relPath`）
 * ⇒ 拼法一分歧，界面显示的路径与磁盘上的实际落点就会不一致（用户按它找不到文件）。
 */
export function skillEntryRelPath(category: string, slug: string): string {
  return `${category}/${slug}/${SKILL_ENTRY_FILE}`;
}
