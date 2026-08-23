import { AnimationPanel } from "./AnimationPanel";

/**
 * 右栏唯一动画面板：普通属性面板（Scene/Character/Prop/Camera）已并入
 * AnimationPanel 的「属性」tab，按选中对象动态显示，不再整栏切换。
 */
export function RightPanel() {
  return <AnimationPanel />;
}
