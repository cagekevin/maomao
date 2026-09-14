'use client';

import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';

import { cn } from '@videoEditor/utils/ui';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none items-center select-none', className)}
    {...props}
  >
    {/* 苹果式极简：4px 细轨道 + 白色（暗色）/黑色（亮色）填充与圆点拇指，无重描边 */}
    <SliderPrimitive.Track className="bg-muted relative h-1 w-full grow overflow-hidden rounded-full">
      <SliderPrimitive.Range className="bg-primary absolute h-full rounded-full" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="bg-primary focus-visible:ring-ring block size-3 rounded-full shadow-[0_1px_4px_rgba(0,0,0,.5)] transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
