import { logger } from '@videoEditor/lib/logger';
import { Button } from '@videoEditor/ui/ui/button';
import { PanelBaseView as BaseView } from '@videoEditor/ui/editor/panels/panel-base-view';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@videoEditor/ui/ui/select';
import { useState, useRef, useMemo } from 'react';
import { useLocalStorage } from '@videoEditor/hooks-cutia/storage/use-local-storage';
import { extractTimelineAudio } from '@videoEditor/engine/lib/media/mediabunny';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
import {
  TRANSCRIPTION_LANGUAGES,
  TRANSCRIPTION_MODELS,
  DEFAULT_TRANSCRIPTION_MODEL,
} from '@videoEditor/constants/transcription-constants';
import {
  SUBTITLE_TEMPLATES,
  createSubtitleFromTemplate,
} from '@videoEditor/constants/subtitle-constants';
import type {
  TranscriptionLanguage,
  TranscriptionModelId,
  TranscriptionProgress,
} from '@videoEditor/types/transcription';
import { transcriptionService } from '@videoEditor/engine/services/transcription/service';
import { decodeAudioToFloat32 } from '@videoEditor/engine/lib/media/audio';
import { buildCaptionChunks } from '@videoEditor/engine/lib/transcription/caption';
import { Spinner } from '@videoEditor/ui/ui/spinner';
import { Progress } from '@videoEditor/ui/ui/progress';
import { Label } from '@videoEditor/ui/ui/label';

export function Captions() {
  const [selectedLanguage, setSelectedLanguage] = useLocalStorage<TranscriptionLanguage>({
    key: 'editor-caption-language',
    defaultValue: 'auto',
  });
  const [selectedModelId, setSelectedModelId] = useLocalStorage<TranscriptionModelId>({
    key: 'editor-caption-model-id',
    defaultValue: DEFAULT_TRANSCRIPTION_MODEL,
  });
  const [selectedTemplateId, setSelectedTemplateId] = useLocalStorage<string>({
    key: 'editor-caption-template-id',
    defaultValue: SUBTITLE_TEMPLATES[0].templateId,
  });
  const selectedTemplate = useMemo(
    () =>
      SUBTITLE_TEMPLATES.find((t) => t.templateId === selectedTemplateId) ?? SUBTITLE_TEMPLATES[0],
    [selectedTemplateId],
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [progressValue, setProgressValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editor = useEditor();

  const handleProgress = (progress: TranscriptionProgress) => {
    if (progress.status === 'loading-model') {
      setProgressValue(progress.progress);
      setProcessingStep(`Loading model ${Math.round(progress.progress)}%`);
    } else if (progress.status === 'transcribing') {
      setProgressValue(progress.progress);
      setProcessingStep(`Transcribing ${Math.round(progress.progress)}%`);
    }
  };

  const handleGenerateTranscript = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      setProgressValue(0);
      setProcessingStep('正在分离音频…');

      const audioBlob = await extractTimelineAudio({
        tracks: editor.timeline.getTracks(),
        mediaAssets: editor.media.getAssets(),
        totalDuration: editor.timeline.getTotalDuration(),
      });

      setProcessingStep('正在准备音频…');
      const { samples } = await decodeAudioToFloat32({
        audioBlob,
        targetSampleRate: 16000,
      });

      const result = await transcriptionService.transcribe({
        audioData: samples,
        language: selectedLanguage,
        modelId: selectedModelId,
        onProgress: handleProgress,
      });

      setProcessingStep('正在生成字幕…');
      const captionChunks = buildCaptionChunks({ segments: result.segments });

      const captionTrackId = editor.timeline.addTrack({
        type: 'text',
        index: 0,
      });

      const baseCaptionElement = createSubtitleFromTemplate({
        template: selectedTemplate,
        startTime: 0,
      });

      for (let i = 0; i < captionChunks.length; i++) {
        const caption = captionChunks[i];
        editor.timeline.insertElement({
          placement: { mode: 'explicit', trackId: captionTrackId },
          element: {
            ...baseCaptionElement,
            name: `Caption ${i + 1}`,
            content: caption.text,
            duration: caption.duration,
            startTime: caption.startTime,
            trimStart: 0,
            trimEnd: 0,
          },
        });
      }
    } catch (error) {
      logger.error('Transcription failed:', error);
      setError(error instanceof Error ? error.message : '发生意外错误');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
      setProgressValue(0);
    }
  };

  const handleLanguageChange = ({ value }: { value: string }) => {
    if (value === 'auto') {
      setSelectedLanguage({ value: 'auto' });
      return;
    }

    const matchedLanguage = TRANSCRIPTION_LANGUAGES.find((language) => language.code === value);
    if (!matchedLanguage) return;
    setSelectedLanguage({ value: matchedLanguage.code });
  };

  const handleTemplateChange = ({ value }: { value: string }) => {
    const template = SUBTITLE_TEMPLATES.find((t) => t.templateId === value);
    if (template) {
      setSelectedTemplateId({ value: template.templateId });
    }
  };

  return (
    <BaseView ref={containerRef} className="flex h-full flex-col justify-between">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Label>{'模型'}</Label>
          <Select
            value={selectedModelId}
            onValueChange={(value) =>
              setSelectedModelId({
                value: value as TranscriptionModelId,
              })
            }
            disabled={isProcessing}
          >
            <SelectTrigger>
              <SelectValue placeholder={'选择模型'} />
            </SelectTrigger>
            <SelectContent>
              {TRANSCRIPTION_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {TRANSCRIPTION_MODELS.find((m) => m.id === selectedModelId)?.description ?? ''}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Label>{'语言'}</Label>
          <Select
            value={selectedLanguage}
            onValueChange={(value) => handleLanguageChange({ value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={'选择语言'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{'自动检测'}</SelectItem>
              {TRANSCRIPTION_LANGUAGES.map((language) => (
                <SelectItem key={language.code} value={language.code}>
                  {language.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3">
          <Label>{'字幕样式'}</Label>
          <Select
            value={selectedTemplate.templateId}
            onValueChange={(value) => handleTemplateChange({ value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={'选择样式'} />
            </SelectTrigger>
            <SelectContent>
              {SUBTITLE_TEMPLATES.map((template) => (
                <SelectItem key={template.templateId} value={template.templateId}>
                  {template.templateName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            className="flex items-center justify-center rounded-md border p-4"
            style={{ backgroundColor: '#1a1a2e', minHeight: 60 }}
          >
            <span
              style={{
                fontSize: 14,
                // 样式字段在 `template.styles` 里（覆盖差形状，见 subtitle-constants.ts）
                fontFamily: selectedTemplate.styles.fontFamily,
                color: selectedTemplate.styles.color,
                backgroundColor: selectedTemplate.styles.backgroundColor,
                fontWeight: selectedTemplate.styles.fontWeight,
                fontStyle: selectedTemplate.styles.fontStyle,
                textDecoration: selectedTemplate.styles.textDecoration,
                padding: '2px 6px',
                borderRadius: 2,
              }}
            >
              {`${selectedTemplate.templateName} Preview`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {error && (
          <div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {isProcessing && (
          <div className="flex flex-col gap-1.5">
            <Progress value={progressValue} className="w-full" />
            <p className="text-muted-foreground text-center text-xs">{processingStep}</p>
          </div>
        )}

        <Button
          className="w-full"
          type="button"
          onClick={handleGenerateTranscript}
          disabled={isProcessing}
        >
          {isProcessing && <Spinner className="mr-1" />}
          {isProcessing ? '处理中…' : '生成文稿'}
        </Button>
      </div>
    </BaseView>
  );
}
