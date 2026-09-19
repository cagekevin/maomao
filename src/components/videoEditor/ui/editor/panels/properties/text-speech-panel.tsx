'use client';
import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';

import { useState } from 'react';

// 更新(2026-09-14)：i18next 已随直写中文移除（文案已中文化）。
import { toast } from '@/components/videoEditor/lib/toast';
import { Button } from '@/components/videoEditor/ui/ui/button';
import { Checkbox } from '@/components/videoEditor/ui/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/videoEditor/ui/ui/select';
import { PanelBaseView } from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup, PropertyItem, PropertyItemLabel, PropertyItemValue } from './property-item';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { generateAndInsertSpeech } from '@/components/videoEditor/engine/lib/tts/service';
import { VOICE_PACKS, DEFAULT_VOICE_PACK } from '@/components/videoEditor/constants/tts-constants';
import type { TextElement } from '@/components/videoEditor/types/timeline';

interface TextElementRef {
  element: TextElement;
  trackId: string;
}

export function TextSpeechPanel({ elements: elementRefs }: { elements: TextElementRef[] }) {
  const editor = useEditor();
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE_PACK);
  const [alignDuration, setAlignDuration] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (elementRefs.length === 0) return;

    setIsGenerating(true);
    const toastId = 'tts-generate';

    toast.loading('正在生成语音…', { id: toastId });

    let successCount = 0;
    let failCount = 0;

    for (const { element, trackId: textTrackId } of elementRefs) {
      try {
        const { duration } = await generateAndInsertSpeech({
          editor,
          text: element.content,
          startTime: element.startTime,
          voice: selectedVoice,
        });

        if (alignDuration) {
          editor.timeline.updateElementDuration({
            trackId: textTrackId,
            elementId: element.id,
            duration,
          });
        }

        successCount++;
      } catch (error) {
        videoEditorLogger.error('TTS generation failed:', error);
        failCount++;
      }
    }

    if (failCount === 0) {
      toast.success('语音生成成功', { id: toastId });
    } else {
      toast.warning(`${successCount} 条成功，${failCount} 条失败`, { id: toastId });
    }

    setIsGenerating(false);
  };

  return (
    <PanelBaseView>
      <PropertyGroup title={'文字转语音'} hasBorderTop={false} collapsible={false}>
        <div className="space-y-6">
          <PropertyItem>
            <PropertyItemLabel>{'音色'}</PropertyItemLabel>
            <PropertyItemValue>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger>
                  <SelectValue placeholder={'选择音色'} />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_PACKS.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyItemValue>
          </PropertyItem>

          <div className="flex items-center gap-2">
            <Checkbox
              id="align-text-duration"
              checked={alignDuration}
              onCheckedChange={(checked) => setAlignDuration(checked === true)}
            />
            <label htmlFor="align-text-duration" className="cursor-pointer text-sm">
              {'对齐文字时长'}
            </label>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={isGenerating || elementRefs.length === 0}
            onClick={handleGenerate}
          >
            {isGenerating ? '正在生成…' : '生成语音'}
          </Button>
        </div>
      </PropertyGroup>
    </PanelBaseView>
  );
}
