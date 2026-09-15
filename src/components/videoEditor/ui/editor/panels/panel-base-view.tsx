import { Button } from '@videoEditor/ui/ui/button';
import { ScrollArea } from '@videoEditor/ui/ui/scroll-area';
import { Separator } from '@videoEditor/ui/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@videoEditor/ui/ui/tabs';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 面板纵向分区契约 —— 素材面板（`assets/views/*`）与属性面板的**唯一**面板语言
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 一个面板 = **一个纵向流**。下面四件事**只在这里发生**，视图一律不得再实现一遍：
 *
 *   ① **一个滚动** —— `ViewContent` 里那一个 `ScrollArea`。视图禁止 `ScrollArea` /
 *      `overflow-y-auto`。需要"滚到底加载更多"的视图，用 `scrollRef` + `onScrollCapture`
 *      拿这**一个**滚动容器（`tabs` 路径同样透传，见下），别再套第二层。
 *   ② **一次内边距** —— 内边距只属于分区（`.ve-pg-body` 自带 14px）。视图禁止外层 `p-*` / `m-*`。
 *   ③ **一种分区** —— 一律 `<PropertyGroup>`（视觉在 `ve-theme.css §7`）：
 *        · 传 `title`   → 可折叠头（一组 = 一次开合）
 *        · 不传 `title` → 静态段（工具条 / 搜索栏 / 拖放区）
 *        · `grow`       → **整块占位**（空态 / 错误态 / 加载态 / 拖放区）
 *      组间与组内节奏由分区原语拥有 ⇒ 视图禁止用 `space-y-*` / `gap-*` 表达"分区间距"。
 *   ④ **一条高度链** —— 从面板根一路钉到 `.ve-pg-body`，逐层 `min-h-0`：
 *        面板根 `flex h-full` → `Tabs` `flex-1 min-h-0` → `TabsContent` `flex-1 min-h-0`
 *        → `ViewContent` `flex-1 min-h-0`（滚动容器）→ 内层 `flex min-h-full flex-col`
 *        → `.ve-pg[data-grow]` `flex:1` → `.ve-pg-body` `flex:1` → 占位块 `flex-1`。
 *      更新(2026-09-15 · docs/135)：非激活 panel **不渲染**（原语 `TabsContent` 提前 `return null`），
 *      所以高度链只需激活那一条成立 —— 调用点不必再写任何"压掉 hidden"的 display 类。
 *      （内层那个 `min-h-full flex flex-col` 是 `grow` 能生效的**前提**：`flex:1` 要有
 *       flex 父容器可依。缺了它，整块占位就撑不开 —— 表现为"空态挤在顶上"或整块空白。）
 *
 * **判据**：视图 JSX 顶层应当**只有** `<BaseView>` 与一串 `<PropertyGroup>`。
 *   出现 `ScrollArea` / `p-*` / `justify-between` / 无兄弟的 `flex-1` / `h-full` /
 *   `space-y-*` / 自造绝对定位浮层 —— 即违反本契约。
 *   `justify-between` 尤其要注意：纵向流上它会把子项撑到两端，**凭空多出一截留白**。
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

/** 唯一的滚动 + 唯一的高度链。视图不得复制这两个职责。 */
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
      className="flex-1 min-h-0 scrollbar-hidden"
      ref={scrollRef}
      onScrollCapture={onScrollCapture}
    >
      {/* `min-h-full` + `flex-col`：内容少时撑满（让 `grow` 分区的 `flex:1` 有父可依），
          内容多时被内容顶开（滚动照常）。缺了它，整块占位型分区无处伸缩。 */}
      <div className="flex min-h-full flex-col">{children}</div>
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
    <div className="flex h-full min-h-0 flex-col" ref={ref}>
      {!tabs || tabs.length === 0 ? (
        <ViewContent scrollRef={scrollRef} onScrollCapture={onScrollCapture}>
          {children}
        </ViewContent>
      ) : (
        <Tabs
          defaultValue={defaultTab}
          value={value}
          onValueChange={onValueChange}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* tab 头是固定高度的一行：横向永不溢出（窄面板下自己滚），纵向不参与压缩。 */}
          <div className="shrink-0 overflow-x-auto scrollbar-hidden px-3 pt-3">
            <TabsList className="w-max">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.icon ? (
                    <span className="mr-1 inline-flex items-center">{tab.icon}</span>
                  ) : null}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <Separator className="mt-3" />
          </div>
          {tabs.map((tab) => (
            <TabsContent
              key={tab.value}
              value={tab.value}
              /* 更新(2026-09-15 · docs/135)：这里原来是
                 `hidden … data-[state=active]:flex` —— 那是**对抗 Radix `hidden` 属性**的补丁
                 （Radix 的 `hidden` 是 UA 样式 `[hidden]{display:none}`，任何作者 display 类都能压掉它，
                  于是空容器照样占一份高度 ⇒"内容只占 1/N、其余空白，且空白忽上忽下"）。
                 自研 `TabsContent` 已改为**非激活即不渲染**（`return null`）——
                 不渲染就不存在布局，display 类随便写。调用点从此不再需要任何占位补丁。 */
              className="mt-0 flex min-h-0 flex-1 flex-col"
            >
              {/* `tabs` 路径同样接 `scrollRef` / `onScrollCapture`：
                  否则"tab 里要无限滚动"的视图（如贴纸）拿不到那唯一的滚动容器。 */}
              <ViewContent scrollRef={scrollRef} onScrollCapture={onScrollCapture}>
                {tab.content}
              </ViewContent>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

interface PanelStateProps {
  /** 主文案（一句话说清"这里是空的 / 坏了"）。 */
  text: string;
  /** 补充说明（"放哪儿" / 错误原文 / 怎么恢复）。 */
  hint?: string;
  /** `error` = 失败态（主文案走危险色）；缺省 = 中性态（空 / 加载）。 */
  tone?: 'error';
  action?: { label: string; onClick: () => void };
}

/**
 * 面板级占位 —— 空态 / 错误态 / 加载态的**唯一**形态。
 *
 * 【为什么必须收口】此前每个视图各写一份（media 的失败块 / sounds 的 `PanelHint` /
 * 贴纸的 `EmptyView` / 已保存音效的三个裸 `h-full` div）：同一件事四份实现，
 * 于是"空的"和"坏的"长得不一样，且在滚动容器里 `h-full` 无参照 → 占位塌成一条。
 *
 * 【用法】放进 `grow` 分区里，由分区负责撑满：
 *   `<PropertyGroup grow><PanelState text="…" hint="…" /></PropertyGroup>`
 * 占位块自己用 `flex-1` 铺满 `.ve-pg-body`（`grow` 分区已把高度链钉好）。
 */
export function PanelState({ text, hint, tone, action }: PanelStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
      <p
        className={
          tone === 'error'
            ? 'text-destructive text-sm'
            : 'text-muted-foreground text-lg font-medium'
        }
      >
        {text}
      </p>
      {hint && <p className="text-muted-foreground text-xs text-balance">{hint}</p>}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
