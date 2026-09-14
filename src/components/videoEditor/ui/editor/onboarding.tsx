'use client';

import { ArrowRightIcon } from 'lucide-react';

import { useState } from 'react';
import { SOCIAL_LINKS } from '@videoEditor/constants/site-constants';
import { useLocalStorage } from '@videoEditor/hooks-cutia/storage/use-local-storage';
import { Button } from '../ui/button';
import { Dialog, DialogBody, DialogContent, DialogTitle } from '../ui/dialog';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useLocalStorage({
    key: 'hasSeenOnboarding',
    defaultValue: false,
  });

  const isOpen = !hasSeenOnboarding;

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleClose = () => {
    setHasSeenOnboarding({ value: true });
  };

  const getStepTitle = () => {
    switch (step) {
      case 0:
        return '欢迎体验 Cutia Beta！🎉';
      case 1:
        return '⚠️ 这是非常早期的测试版！';
      case 2:
        return '🦋 祝你测试愉快！';
      default:
        return 'Cutia 新手引导';
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-5">
            <div className="space-y-3">
              <Title title={'欢迎体验 Cutia Beta！🎉'} />
              <Description
                description={'你是最早体验 Cutia 的用户之一 —— 完全开源的剪映替代品。'}
              />
            </div>
            <NextButton onClick={handleNext}>{'下一步'}</NextButton>
          </div>
        );
      case 1:
        return (
          <div className="space-y-5">
            <div className="space-y-3">
              <Title title={getStepTitle()} />
              <Description description={'要让这个编辑器变得出色，还有很多事情要做。'} />
              <Description description={'还有很多功能尚未完成，我们正在加紧开发！'} />
              <Description
                description={
                  '如果你感兴趣，可以看看我们的路线图 [点此](https://cutia.msgbyte.com/roadmap)'
                }
              />
            </div>
            <NextButton onClick={handleNext}>{'下一步'}</NextButton>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <div className="space-y-3">
              <Title title={getStepTitle()} />
              <Description
                description={`Join our [Discord](${SOCIAL_LINKS.discord}), chat with cool people and share feedback to help make Cutia the best editor ever.`}
              />
            </div>
            <NextButton onClick={handleClose}>{'完成'}</NextButton>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>
          <span className="sr-only">{getStepTitle()}</span>
        </DialogTitle>
        <DialogBody>{renderStepContent()}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function Title({ title }: { title: string }) {
  return <h2 className="text-lg font-bold md:text-xl">{title}</h2>;
}

function Description({ description }: { description: string }) {
  return (
    <div className="text-muted-foreground">
      {/* 更新(2026-09-14)：react-markdown 属范围外已移除，降级为纯文本渲染。 */}
      <div className="whitespace-pre-wrap text-sm">{description}</div>
    </div>
  );
}

function NextButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button onClick={onClick} variant="default" className="w-full">
      {children}
      <ArrowRightIcon className="size-4" />
    </Button>
  );
}
