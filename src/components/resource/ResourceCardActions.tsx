import { FolderOpen, Pencil, Trash2 } from 'lucide-react';
import type { ResourceItem } from '../base/api/localToolApi.ts';

interface ResourceCardActionsProps {
  item: ResourceItem;
  onOpenDir: (item: ResourceItem) => void;
  onRename: (item: ResourceItem) => void;
  onDelete: (item: ResourceItem) => void;
}

/**
 * 资源卡片右上角的操作浮层：打开所在目录 / 重命名 / 删除（悬停显现）。
 *
 * 【为什么存在（TD-04-57）】此前同一段 40 行 JSX 在 `generate/GeneratedView` 与
 * `resource/ResourceLibrary` **逐字相同**（SSOT 第二份 ⇒ 改一处必漏另一处）。
 * 现收口成唯一实现，两个消费方只声明自己的**域差异**（三个回调）。
 *
 * 【落点】属**素材域**：操作对象是 `ResourceItem`、界面是素材卡片 ⇒ `components/resource/`。
 * `generate/` 消费它（生成域 → 素材域的方向本已存在：GeneratedView 已 import `ResourcePreview`）。
 *
 * 【回调形态】传 `item` + **稳定 handler**，而非每张卡片现造闭包 —— 两个消费方的
 * `handleOpenFileDir` / `handleDelete` 签名本就是 `(item: ResourceItem) => void`。
 *
 * 【点击一律 stopPropagation】卡片本身有选中 / 打开行为，操作按钮不得触发它们。
 */
export function ResourceCardActions({
  item,
  onOpenDir,
  onRename,
  onDelete,
}: ResourceCardActionsProps) {
  return (
    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-white hover:bg-black/80 cursor-pointer border-none"
        title="打开所在目录"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDir(item);
        }}
      >
        <FolderOpen size={10} />
      </button>
      <button
        className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-white hover:bg-black/80 cursor-pointer border-none"
        title="重命名"
        onClick={(e) => {
          e.stopPropagation();
          onRename(item);
        }}
      >
        <Pencil size={10} />
      </button>
      <button
        className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-red-300 hover:bg-black/80 cursor-pointer border-none"
        title="删除"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item);
        }}
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}
