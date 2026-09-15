import { ScrollArea } from '@videoEditor/ui/ui/scroll-area';
import { Separator } from '@videoEditor/ui/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@videoEditor/ui/ui/tabs';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 面板纵向分区 · **统一语言**（2026-09-15 重写）
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 本文件是素材面板（`assets/views/*`）与属性面板**共同**的纵向布局契约。
 * 一个视图只允许用下面这几条描述"怎么往下排"，不许自己发明包装层级：
 *
 *   ① **一个滚动** —— 滚动**只在这里**发生（`ViewContent` 里的 `ScrollArea`）。
 *      视图内禁止 `ScrollArea` / `overflow-y-auto`。需要"滚到底加载更多"的视图，
 *      用 `scrollRef` + `onScrollCapture` 拿到**这一个**滚动容器，别再套第二层。
 *      （叠两层滚动的后果：外层永远滚不动、内层高度链对不上 → 布局塌陷 / 滚动条不出现。）
 *   ② **一次内边距** —— 内边距**只属于分区**（`.ve-pg-body` 自带 14px），壳不再叠一层。
 *      （原先壳还有 `px-1 py-2`，于是属性面板得写 `className="p-0"` 去抵消它 ——
 *      需要"抵消"就说明同一个职责被两处表达；现在那个 prop 已随之删除。）
 *      视图**禁止**写外层 `p-*` / `m-*`。
 *   ③ **一种分区** —— 一律 `<PropertyGroup>`（视觉在 `ve-theme.css §8` 的 `.ve-pg*`）：
 *        · 传 `title`   → 可折叠头（**一组 = 一次开合**，用户口径"一人一个"）
 *        · 不传 `title` → 静态段（工具条 / 搜索栏 / 拖放区 / 无可折叠意义的区块）
 *        · 组内并列段落用 `<PropertySubsection>`
 *      组间/组内节奏都由分区原语拥有 ⇒ 视图里**禁止**用 `space-y-*`、`gap-*` 表达"分区间距"。
 *   ④ **禁空转布局** —— `justify-between`（纵向 flex 上会把子项撑到两端 → **凭空多出一截留白**，
 *      正是"第 2、3 个区块前面空了一截"的直接成因）、无兄弟的 `flex-1` 占位、
 *      与父高度链对不上的 `h-full`：它们不表达任何意图，却会被读成"这里有间距"。
 *
 * **判据**：视图 JSX 顶层应当**只有** `<BaseView>` 与一串 `<PropertyGroup>`；
 *         出现 `ScrollArea` / `p-*` / `justify-between` / `flex-1` / `space-y-*` 即违反本契约。
 * ══════════════════════════════════════════════════════════════════════════════
 */
interface PanelBaseViewProps {
  children?: React.ReactNode;
  defaultTab?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  tabs?: {
    value: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
  }[];
  /** 那**唯一**的滚动视口（供无限滚动等使用）。禁止视图再建第二个滚动容器。 */
  scrollRef?: React.Ref<HTMLDivElement>;
  onScrollCapture?: React.UIEventHandler<HTMLDivElement>;
  ref?: React.Ref<HTMLDivElement>;
}

/** 唯一的滚动 + 唯一的内边距。视图不得复制这两个职责。 */
function ViewContent({
  children,
  scrollRef,
  onScrollCapture,
}: {
  children: React.ReactNode;
  scrollRef?: React.Ref<HTMLDivElement>;
  onScrollCapture?: React.UIEventHandler<HTMLDivElement>;
}) {
  return (
    <ScrollArea
      className="flex-1 scrollbar-hidden"
      ref={scrollRef}
      onScrollCapture={onScrollCapture}
    >
      <div>{children}</div>
    </ScrollArea>
  );
}

export function PanelBaseView({
  children,
  defaultTab,
  value,
  onValueChange,
  tabs,
  scrollRef,
  onScrollCapture,
  ref,
}: PanelBaseViewProps) {
  return (
    <div className="flex h-full flex-col" ref={ref}>
      {!tabs || tabs.length === 0 ? (
        <ViewContent scrollRef={scrollRef} onScrollCapture={onScrollCapture}>
          {children}
        </ViewContent>
      ) : (
        <Tabs
          defaultValue={defaultTab}
          value={value}
          onValueChange={onValueChange}
          className="flex h-full flex-col"
        >
          <div className="bg-background z-10">
            <div className="px-3 pt-3 pb-0">
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.icon ? (
                      <span className="mr-1 inline-flex items-center">{tab.icon}</span>
                    ) : null}
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <Separator className="mt-3" />
          </div>
          {tabs.map((tab) => (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="mt-0 flex min-h-0 flex-1 flex-col"
            >
              <ViewContent>{tab.content}</ViewContent>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
