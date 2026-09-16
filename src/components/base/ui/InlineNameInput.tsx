import { memo } from 'react';

/**
 * 面板内联「新建文件夹 / 重命名」输入条（TD-19-3 收口 · 母体 SSOT 第二份）。
 *
 * 【为什么抽出来】`panels/ResourceLibrary.tsx` 与 `panels/GeneratedView.tsx` 曾各自**逐字复制**
 * 这段 UI（卡片容器 + 输入框 + 「回车确认」提示 + onFocus/onKeyDown/onBlur 提交逻辑），连 className、
 * 注释、`isComposing` 缺失都一致 —— 典型 SSOT 第二份。抽为唯一实现后，改一处即两处生效，
 * 并顺带补上表格体系已有的 IME 守卫（TD-19-3 利息实证：两处体系已分叉）。
 *
 * 【职责边界】本组件只负责**输入条 UI + 键盘语义**（回车提交 / Esc 取消 / 失焦提交）；
 * 「提交后做什么」（建文件夹 / 改名）与「何时显示」由调用方通过 props 决定
 * （探测可收口、判据留调用方 —— 7 步法 Step 3）。
 *
 * @param tone        蓝色 = 重命名；橙色 = 新建文件夹（沿用既有配色语义）
 * @param onCommit    回车触发（新建文件夹路径此处会无条件建；调用方自行判空）
 * @param onBlurCommit 失焦触发（默认 = onCommit）；新建文件夹路径两者语义不同（失焦仅在改名时建、且无 toast）
 * @param onFocusSelectBody 聚焦时自动选中「文件名主体（不含后缀）」，便于直接改名
 */
const InlineNameInput = memo(function InlineNameInput({
  value,
  onChange,
  onCommit,
  onBlurCommit,
  onCancel,
  tone = 'blue',
  placeholder,
  onFocusSelectBody = false,
}: {
  value: string;
  onChange: (next: string) => void;
  /** 回车触发（调用方自行判空、判是否变化） */
  onCommit: () => void | Promise<void>;
  /** 失焦触发；缺省时等价于 onCommit */
  onBlurCommit?: () => void | Promise<void>;
  /** Esc 触发 */
  onCancel: () => void;
  tone?: 'blue' | 'orange';
  placeholder?: string;
  onFocusSelectBody?: boolean;
}) {
  const isBlue = tone === 'blue';
  return (
    <div className="px-2.5 pt-2 flex-shrink-0">
      <div
        className={`flex items-center gap-1.5 bg-surface-deep border rounded-lg p-1.5 ${
          isBlue ? 'border-blue-500/40' : 'border-orange-500/40'
        }`}
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={
            onFocusSelectBody
              ? (e) => {
                  const v = e.target.value || '';
                  const dot = v.lastIndexOf('.');
                  const end = dot > 0 ? dot : v.length;
                  e.target.setSelectionRange(0, end);
                }
              : undefined
          }
          onKeyDown={(e) => {
            // IME 组合期间的回车不提交（表格体系既有守卫，此处补齐以防两处再分叉）
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') {
              void onCommit();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          onBlur={() => void (onBlurCommit ?? onCommit)()}
          className={`flex-1 h-7 bg-surface-strong border rounded-md px-2 text-caption-sm text-white outline-none box-border ${
            isBlue
              ? 'border-blue-500/40 focus:border-blue-500'
              : 'border-orange-500/40 focus:border-orange-500'
          }`}
          placeholder={placeholder}
        />
        <span className="text-caption text-faint whitespace-nowrap">回车确认</span>
      </div>
    </div>
  );
});

export default InlineNameInput;
