import { DraggableItem } from '@/components/videoEditor/ui/editor/panels/assets/draggable-item';
import { PanelBaseView as BaseView } from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup } from '@/components/videoEditor/ui/editor/panels/properties/property-item';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { DEFAULT_TEXT_ELEMENT } from '@/components/videoEditor/constants/text-constants';
import { buildTextElement } from '@/components/videoEditor/engine/timeline/element-utils';

export function TextView() {
  const editor = useEditor();

  const handleAddDefaultText = ({ currentTime }: { currentTime: number }) => {
    const activeScene = editor.scenes.getActiveScene();
    if (!activeScene) return;

    const element = buildTextElement({
      raw: DEFAULT_TEXT_ELEMENT,
      startTime: currentTime,
    });

    editor.timeline.insertElement({
      element,
      placement: { mode: 'auto' },
    });
  };

  // 统一语言：`<BaseView>` + 分区。原先的 `space-y-3` 是"自己排纵向节奏"的第二套语言。
  return (
    <BaseView>
      <PropertyGroup>
        <DraggableItem
          name={'默认文字'}
          preview={
            <div className="bg-muted text-foreground flex size-full items-center justify-center rounded">
              <span className="text-xs select-none">{'默认文字'}</span>
            </div>
          }
          dragData={{
            id: 'temp-text-id',
            type: DEFAULT_TEXT_ELEMENT.type,
            name: DEFAULT_TEXT_ELEMENT.name,
            content: DEFAULT_TEXT_ELEMENT.content,
          }}
          aspectRatio={1}
          onAddToTimeline={handleAddDefaultText}
          shouldShowLabel={false}
        />
      </PropertyGroup>
    </BaseView>
  );
}
