import { DraggableItem } from '@videoEditor/ui/editor/panels/assets/draggable-item';
import { PanelBaseView as BaseView } from '@videoEditor/ui/editor/panels/panel-base-view';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
import { DEFAULT_TEXT_ELEMENT } from '@videoEditor/constants/text-constants';
import { buildTextElement } from '@videoEditor/engine/timeline/element-utils';

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

  return (
    <BaseView>
      <div className="space-y-3">
        <DraggableItem
          name={'默认文字'}
          preview={
            <div className="bg-accent flex size-full items-center justify-center rounded">
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
      </div>
    </BaseView>
  );
}
