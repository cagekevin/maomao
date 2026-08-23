// 简化版 cn()：不依赖 clsx / tailwind-merge。
// 只做 falsy 过滤 + 空格 join。tailwind-merge 的去重/优先级能力缺失，
// 对多数场景够用；如需完整版再接入 tailwind-merge。
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | boolean
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const parts: string[] = [];
  const flatten = (value: ClassValue) => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      parts.push(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(flatten);
    }
  };
  inputs.forEach(flatten);
  return parts.join(" ").trim();
}
