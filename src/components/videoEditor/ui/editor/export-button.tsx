'use client';

import { useState, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/videoEditor/ui/ui/popover';
import { Button } from '@/components/videoEditor/ui/ui/button';
import { Label } from '@/components/videoEditor/ui/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/videoEditor/ui/ui/radio-group';
import { Progress } from '@/components/videoEditor/ui/ui/progress';
import { Checkbox } from '@/components/videoEditor/ui/ui/checkbox';
import { cn } from '@/components/videoEditor/utils/ui';
import {
  getExportMimeType,
  getExportFileExtension,
} from '@/components/videoEditor/engine/lib/export';
import { Check, Copy, Download, RotateCcw, Replace } from 'lucide-react';
import {
  EXPORT_FORMAT_VALUES,
  EXPORT_QUALITY_VALUES,
  type ExportFormat,
  type ExportQuality,
  type ExportResult,
} from '@/components/videoEditor/types/export';
import { PropertyGroup } from '@/components/videoEditor/ui/editor/panels/properties/property-item';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { DEFAULT_EXPORT_OPTIONS } from '@/components/videoEditor/constants/export-constants';

export function ExportButton() {
  const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false);
  const editor = useEditor();

  const handleExport = () => {
    setIsExportPopoverOpen(true);
  };

  const hasProject = !!editor.project.getActive();

  return (
    <Popover open={isExportPopoverOpen} onOpenChange={setIsExportPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1 text-xs font-medium transition-colors',
            hasProject ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
          )}
          onClick={hasProject ? handleExport : undefined}
          disabled={!hasProject}
          onKeyDown={(event) => {
            if (hasProject && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              handleExport();
            }
          }}
        >
          <Replace className="size-4" />
          <span>{'导出'}</span>
        </button>
      </PopoverTrigger>
      {hasProject && <ExportPopover onOpenChange={setIsExportPopoverOpen} />}
    </Popover>
  );
}

function ExportPopover({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const editor = useEditor();
  const activeProject = editor.project.getActive();
  const [format, setFormat] = useState<ExportFormat>(DEFAULT_EXPORT_OPTIONS.format);
  const [quality, setQuality] = useState<ExportQuality>(DEFAULT_EXPORT_OPTIONS.quality);
  // 【TD-22-38① 收口】原为 `DEFAULT_EXPORT_OPTIONS.includeAudio || true` —— 左侧是 `satisfies`
  // 推断出的 `boolean`，`|| true` 是**恒真死表达式**：一旦常量改成 `false`（"默认不含音频"），
  // 会被静默吞掉且无任何报错。默认值归常量所有，此处直接引用。
  const [includeAudio, setIncludeAudio] = useState<boolean>(DEFAULT_EXPORT_OPTIONS.includeAudio);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const cancelRequestedRef = useRef(false);

  const handleExport = async () => {
    if (!activeProject) return;

    cancelRequestedRef.current = false;
    setIsExporting(true);
    setProgress(0);
    setExportResult(null);

    const result = await editor.project.export({
      options: {
        format,
        quality,
        fps: activeProject.settings.fps,
        includeAudio,
        onProgress: ({ progress }) => setProgress(progress),
        onCancel: () => cancelRequestedRef.current,
      },
    });

    setIsExporting(false);

    if (!result.ok) {
      // 取消不是错误：静默复原（原 `result.cancelled` 语义）。
      if (result.reason === 'cancelled') {
        setExportResult(null);
        setProgress(0);
        return;
      }
      setExportResult(result);
      return;
    }

    // 成功支由判别联合保证 `buffer` 必在（TD-22-38②：原 `success && buffer` 双检已消除）。
    const mimeType = getExportMimeType({ format });
    const extension = getExportFileExtension({ format });
    const blob = new Blob([result.buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.metadata.name}${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onOpenChange(false);
    setExportResult(null);
    setProgress(0);
  };

  const handleCancel = () => {
    cancelRequestedRef.current = true;
  };

  return (
    <PopoverContent className="bg-background mr-4 flex w-80 flex-col p-0">
      {exportResult && !exportResult.ok ? (
        <ExportError
          error={exportResult.message || 'Unknown error occurred'}
          onRetry={handleExport}
        />
      ) : (
        <>
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-medium text-sm">{isExporting ? '正在导出项目' : '导出项目'}</h3>
          </div>

          <div className="flex flex-col gap-4">
            {!isExporting && (
              <>
                <div className="flex flex-col">
                  <PropertyGroup title={'格式'} defaultExpanded={false} hasBorderTop={false}>
                    <RadioGroup
                      value={format}
                      onValueChange={(value) => {
                        if (isExportFormat(value)) {
                          setFormat(value);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mp4" id="mp4" />
                        <Label htmlFor="mp4">{'MP4 (H.264) - 兼容性更好'}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="webm" id="webm" />
                        <Label htmlFor="webm">{'WebM (VP9) - 文件更小'}</Label>
                      </div>
                    </RadioGroup>
                  </PropertyGroup>

                  <PropertyGroup title={'质量'} defaultExpanded={false}>
                    <RadioGroup
                      value={quality}
                      onValueChange={(value) => {
                        if (isExportQuality(value)) {
                          setQuality(value);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="low" id="low" />
                        <Label htmlFor="low">{'低 - 文件最小'}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="medium" id="medium" />
                        <Label htmlFor="medium">{'中 - 均衡'}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="high" id="high" />
                        <Label htmlFor="high">{'高 - 推荐'}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="very_high" id="very_high" />
                        <Label htmlFor="very_high">{'极高 - 文件最大'}</Label>
                      </div>
                    </RadioGroup>
                  </PropertyGroup>

                  <PropertyGroup title={'音频'} defaultExpanded={false}>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="include-audio"
                        checked={includeAudio}
                        onCheckedChange={(checked) => setIncludeAudio(!!checked)}
                      />
                      <Label htmlFor="include-audio">{'导出时包含音频'}</Label>
                    </div>
                  </PropertyGroup>
                </div>

                <div className="p-3 pt-0">
                  <Button onClick={handleExport} className="w-full gap-2">
                    <Download className="size-4" />
                    {'导出'}
                  </Button>
                </div>
              </>
            )}

            {isExporting && (
              <div className="space-y-4 p-3">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between text-center">
                    <p className="text-muted-foreground mb-2 text-sm">
                      {Math.round(progress * 100)}%
                    </p>
                  </div>
                  <Progress value={progress * 100} className="w-full" />
                </div>

                <Button variant="outline" className="w-full rounded-md" onClick={handleCancel}>
                  {'取消'}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </PopoverContent>
  );
}

function isExportFormat(value: string): value is ExportFormat {
  return EXPORT_FORMAT_VALUES.some((formatValue) => formatValue === value);
}

function isExportQuality(value: string): value is ExportQuality {
  return EXPORT_QUALITY_VALUES.some((qualityValue) => qualityValue === value);
}

function ExportError({ error, onRetry }: { error: string; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(error);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-destructive text-sm font-medium">{'导出失败'}</p>
        <p className="text-muted-foreground text-xs">{error}</p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={handleCopy}>
          {copied ? <Check className="text-constructive" /> : <Copy />}
          {'复制'}
        </Button>
        <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={onRetry}>
          <RotateCcw />
          {'重试'}
        </Button>
      </div>
    </div>
  );
}
