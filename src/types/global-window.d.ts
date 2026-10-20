/**
 * Window 上的运行时调试开关（`__DEBUG_ALL` / `__DEBUG_<MODULE>`）。
 *
 * 【为什么要有这个全局声明】这两个键是运行时注入的非标准 Window 成员（前端「其他设置→调试模式」
 * 与 AI 都会被写入）。此前两个文件各自写 `type DebugWindow = Window & {...}` 再
 * `window as unknown as DebugWindow` —— 断言只是因为 TS 不认识这两个键，而 `as unknown as`
 * 恰恰把「键写错也不报错」也一起放过了。声明一次后，读写都是普通属性访问：
 * 拼错键名会立刻 TS2339，且不再需要任何断言（TD-18-49）。
 */
export {};

declare global {
  interface Window {
    /** 调试总开关：`appSettings.syncDebugAll` 写入，`config.isDebugModuleOn` 每次实时读。 */
    __DEBUG_ALL?: boolean;
    /** 单模块开关（模块名大写，如 `__DEBUG_ASSET` / `__DEBUG_AGENT`）。 */
    [key: `__DEBUG_${string}`]: boolean | undefined;
  }
}
