// WebGL 上下文丢失恢复（frameloop=demand 的命门）。
//
// 背景：编辑器/预览画布跑 `frameloop="demand"`，只在 invalidate() 时画一帧。
// WebGL 上下文一旦丢失（GPU 重置、显卡驱动打嗝、同机多 Electron 实例抢占 context 配额、
// 切显卡/休眠唤醒…），浏览器**默认不会**补发 restore 事件，画布就永远停在被清空的颜色上
// （看着就是「白屏/纯背景色，3D 没了」）——demand 模式自身也不会自动重画。
//
// 两步治本：
// ① `webglcontextlost` 必须 `preventDefault()`，否则浏览器判定不可恢复、永不补发 restore；
// ② `webglcontextrestored` 后 three 会自行重建渲染器状态，但 demand 模式得我们手动 invalidate() 重绘一帧。
//
// 返回解绑函数（canvas 卸载时调用；不调用也只是随 DOM 一起回收，不泄漏到下个画布）。
export function attachWebGLContextRecovery(
  canvas: HTMLCanvasElement,
  invalidate: () => void,
): () => void {
  const handleLost = (event: Event) => {
    event.preventDefault()
  }
  const handleRestored = () => {
    invalidate()
  }
  canvas.addEventListener('webglcontextlost', handleLost, false)
  canvas.addEventListener('webglcontextrestored', handleRestored, false)
  return () => {
    canvas.removeEventListener('webglcontextlost', handleLost, false)
    canvas.removeEventListener('webglcontextrestored', handleRestored, false)
  }
}
