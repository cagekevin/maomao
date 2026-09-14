import { ScrollArea } from '@videoEditor/ui/ui/scroll-area';
import { Separator } from '@videoEditor/ui/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@videoEditor/ui/ui/tabs';
import { cn } from '@videoEditor/utils/ui';

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
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * 面板内容壳。
 *
 * 【内边距为什么这么小】（2026-09-15 用户："整体看起来要紧凑，不要这么稀疏"）
 * 原为 `p-5`（四周各 20px）—— 而里层每个分区（`.ve-pg-toggle` / `.ve-pg-body`）
 * **自己还有 12px 左右内边距** → 实际文字离面板边 32px，纵向也被上下各吃掉 20px。
 * 留白应由**最贴近内容的层**（分区头/体）给，外壳只留最小呼吸：
 * 横向 `px-1`（分区自带的 12px 已足够，加起来 16px 是舒服的读距）、纵向 `py-2`。
 */
function ViewContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <ScrollArea className="flex-1 scrollbar-hidden">
      <div className={cn('px-1 py-2', className)}>{children}</div>
    </ScrollArea>
  );
}

export function PanelBaseView({
  children,
  defaultTab,
  value,
  onValueChange,
  tabs,
  className = '',
  ref,
}: PanelBaseViewProps) {
  return (
    <div className={cn('flex h-full flex-col', className)} ref={ref}>
      {!tabs || tabs.length === 0 ? (
        <ViewContent className={className}>{children}</ViewContent>
      ) : (
        <Tabs
          defaultValue={defaultTab}
          value={value}
          onValueChange={onValueChange}
          className="flex h-full flex-col"
        >
          <div className="bg-background sticky top-0 z-10">
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
              <ViewContent className={className}>{tab.content}</ViewContent>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
