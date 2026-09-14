import { Settings } from 'lucide-react';
('use client');

export function EmptyView() {
  return (
    <div className="bg-background flex h-full flex-col items-center justify-center gap-3 p-4">
      <Settings className="text-muted-foreground size-10" strokeWidth={1} />
      <div className="flex flex-col gap-2 text-center">
        <p className="text-lg font-medium ">{'这里空空如也'}</p>
        <p className="text-muted-foreground text-sm text-balance">
          {'点击时间轴上的元素以编辑其属性'}
        </p>
      </div>
    </div>
  );
}
