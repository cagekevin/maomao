// 撤销/重做历史栈 —— 纯逻辑模块（不依赖 React），供 App.jsx 收敛调用。
// 设计意图：
//   1. 撤销栈 = 整个工程快照栈（记录 currentProject 引用）。
//   2. 「非用户编辑」的程序内部同步写（播放/拖帧镜头预览、切镜头）不得污染撤销栈——
//      通过 deferCount 抑制计数实现「只更新基线、不入栈」的统一机制，而非逐点补丁。
// 本模块所有函数均为纯操作，无副作用调用（定时器由调用方传入处理），可直接单测。

/** 撤销栈长度上限 */
export const HISTORY_LIMIT = 50;
/** 自动入栈防抖（合并连续拖拽/滑动）毫秒数 */
export const HISTORY_DEBOUNCE_MS = 280;

/**
 * 创建一份初始历史状态。
 * 字段：
 *  - past:    已入栈的过往快照（undo 弹出）
 *  - future:  已撤销待重做快照（redo 弹出）
 *  - last:    当前基线快照（用户当前可见工程）
 *  - restoring: 正在恢复（撤销/重做）中，防止本次恢复被再次入栈
 *  - deferCount: 待消费的「抑制入栈」计数（非用户编辑写，只更新基线）
 *  - timer:   防抖定时器句柄（由调用方管理，仅存值）
 */
export function createHistoryState() {
  return { past: [], future: [], last: null, restoring: false, deferCount: 0, timer: null };
}

/**
 * 消费一次「抑制入栈」计数。
 * 若存在未消费的抑制计数：只把基线推进到 latest，不入栈，返回 true（被吞掉）。
 * 否则返回 false，由调用方决定是否正常入栈。
 */
export function consumeDefer(state, latest) {
  if (state.deferCount > 0) {
    state.deferCount -= 1;
    state.last = latest;
    return true;
  }
  return false;
}

/** 程序内部写：仅推进基线，不计历史。 */
export function settleBaseline(state, latest) {
  state.last = latest;
}

/** 入栈一条历史（自动清空 future 分支，超出上限裁剪最旧）。 */
export function recordChange(state, previous, latest) {
  state.past.push(previous);
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.last = latest;
  state.future = [];
}

/**
 * 强制把当前基线入栈（供 flush 使用）。
 * 仅当存在「非空基线 且 与最新不同」时才入栈，避免重复。
 * 返回是否真的入栈。
 */
export function flushChange(state, latest) {
  if (state.last && latest && latest !== state.last) {
    recordChange(state, state.last, latest);
    return true;
  }
  return false;
}

/**
 * 弹出一条可撤销快照。无可用历史时返回 null（由调用方决定越界反馈）。
 * 同时将当前基线压入 future（可重做）。
 */
export function undoPeek(state) {
  const previous = state.past.pop();
  if (!previous) return null;
  state.future.push(state.last);
  state.last = previous;
  state.restoring = true;
  return previous;
}

/** 弹出一条可重做快照。无可用历史时返回 null。 */
export function redoPeek(state) {
  const next = state.future.pop();
  if (!next) return null;
  state.past.push(state.last);
  state.last = next;
  state.restoring = true;
  return next;
}

/**
 * 重置历史栈（load/reset 新建工程后调用）：
 * 清空 past/future、清空抑制计数，last 置空 → 下一次副作用将以新工程重建基线，
 * 使「撤销」不会退回已废弃的旧工程。
 * timer 为此次重置前残留的防抖句柄，一并清理。
 */
export function resetHistory(state, clearTimer) {
  if (clearTimer && state.timer) clearTimer(state.timer);
  state.past = [];
  state.future = [];
  state.last = null;
  state.restoring = false;
  state.deferCount = 0;
  state.timer = null;
}
