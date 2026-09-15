import { PanelBaseView, PanelState } from '@videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup } from './property-item';

/**
 * 属性面板空态 —— 走面板语言的**占位唯一形态**（`grow` 分区 + `PanelState`）。
 *
 * 【原先是什么】一个 `h-full … p-4` 的裸 div + 大图标：既自造了第 6 份占位实现，
 * 又因 `h-full` 在滚动容器里无参照而可能塌成一条（同 TD-22-50 的那一族问题）。
 * 【为什么不要大图标】占位块在面板里是"这里没有内容"这一件事，
 * `PanelState` 已用文案层级（主文案 + 说明）表达；再加大图标只会让属性面板的空态
 * 和"内容面板"的空态长得不一样 —— 同一件事两种样子，是维护成本。
 */
export function EmptyView() {
  return (
    <PanelBaseView>
      <PropertyGroup grow>
        <PanelState text={'这里空空如也'} hint={'点击时间轴上的元素以编辑其属性'} />
      </PropertyGroup>
    </PanelBaseView>
  );
}
