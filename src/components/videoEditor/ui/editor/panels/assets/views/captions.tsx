import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import { Button } from '@/components/videoEditor/ui/ui/button';
import { PanelBaseView as BaseView } from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/videoEditor/ui/ui/select';
import { useState, useRef, useMemo } from 'react';
import { useLocalStorage } from '@/components/videoEditor/hooks-cutia/storage/use-local-storage';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import {
  TRANSCRIPTION_LANGUAGES,
  TRANSCRIPTION_MODELS,
  DEFAULT_TRANSCRIPTION_MODEL,
} from '@/components/videoEditor/constants/transcription-constants';
import {
  SUBTITLE_TEMPLATES,
  createSubtitleFromTemplate,
} from '@/components/videoEditor/constants/subtitle-constants';
import type {
  TranscriptionLanguage,
  TranscriptionModelId,
  TranscriptionProgress,
} from '@/components/videoEditor/types/transcription';
import { transcriptionService } from '@/components/videoEditor/engine/services/transcription/service';
import {
  createTimelineAudioBuffer,
  toMonoSamples,
} from '@/components/videoEditor/engine/lib/media/audio';
import { buildCaptionChunks } from '@/components/videoEditor/engine/lib/transcription/caption';
import { Spinner } from '@/components/videoEditor/ui/ui/spinner';
import { Progress } from '@/components/videoEditor/ui/ui/progress';
import { PropertyGroup } from '@/components/videoEditor/ui/editor/panels/properties/property-item';
import {
  KEY_EDITOR_CAPTION_LANGUAGE,
  KEY_EDITOR_CAPTION_MODEL_ID,
  KEY_EDITOR_CAPTION_TEMPLATE_ID,
} from '@/components/base/core/contracts';

export function Captions() {
  const [selectedLanguage, setSelectedLanguage] = useLocalStorage<TranscriptionLanguage>({
    key: KEY_EDITOR_CAPTION_LANGUAGE,
    defaultValue: 'auto',
  });
  const [selectedModelId, setSelectedModelId] = useLocalStorage<TranscriptionModelId>({
    key: KEY_EDITOR_CAPTION_MODEL_ID,
    defaultValue: DEFAULT_TRANSCRIPTION_MODEL,
  });
  const [selectedTemplateId, setSelectedTemplateId] = useLocalStorage<string>({
    key: KEY_EDITOR_CAPTION_TEMPLATE_ID,
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

      const totalDuration = editor.timeline.getTotalDuration();
      // 与主导出共用**同一套求值**（TD-22-29 档 1）。此前这里是第二套混音实现
      // （mediabunny 内联 `decodeAndMixAudioSource` + WAV 编码），产出 Blob 后又要
      // `decodeAudioToFloat32` 解码回样本 —— 两次转换只为得到"一串样本"，且与主导出**行为漂移**
      // （不应用 volume / reversed）。现直接产 ASR 需要的采样率，再取单声道样本。
      const audioBuffer = await createTimelineAudioBuffer({
        tracks: editor.timeline.getTracks(),
        mediaAssets: editor.media.getAssets(),
        duration: totalDuration,
        sampleRate: 16000,
      });

      setProcessingStep('正在准备音频…');
      // 无音源 / 空时间轴 ⇒ 给一段静音：ASR 需要可解码的输入，静音得到空转写而不是报错。
      const samples =
        audioBuffer && audioBuffer.length > 0
          ? toMonoSamples({ buffer: audioBuffer })
          : new Float32Array(Math.ceil(Math.max(1, totalDuration) * 16000));

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
          },
        });
      }
    } catch (error) {
      videoEditorLogger.error('Transcription failed:', error);
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
    <BaseView ref={containerRef}>
      {/* 统一语言：设置项 = 分区（**组头即标签**，不再额外写 `Label` + `gap-3` 包装层）。 */}
      <PropertyGroup title={'模型'}>
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
      </PropertyGroup>

      <PropertyGroup title={'语言'}>
        <Select value={selectedLanguage} onValueChange={(value) => handleLanguageChange({ value })}>
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
      </PropertyGroup>

      <PropertyGroup title={'字幕样式'}>
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
      </PropertyGroup>

      {/* 动作区：用分区语言的 `hasBorderTop` 表达"这是另一段"——
          原先靠 `justify-between` 把上下两段撑到两端，中间那截空白正是"区块前空一截"的来源。 */}
      <PropertyGroup hasBorderTop>
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
      </PropertyGroup>
    </BaseView>
  );
}
