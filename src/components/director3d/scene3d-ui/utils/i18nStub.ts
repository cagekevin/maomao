// ============================================================
// react-i18next 临时 stub：t(key) 返回中文映射，缺的返回 key 本身。
// 先跑通界面，文案后期可接入真 i18n 或硬编码。
// ============================================================

// scene3d 常用文案的中文映射（时间轴/工具栏/顶栏等）。按需扩充。
const ZH: Record<string, string> = {
  // 时间轴
  'scene3d.trajectory.all': '全部轨迹',
  'scene3d.trajectory.ungrouped': '未分组',
  'scene3d.trajectory.pause': '暂停',
  'scene3d.trajectory.play': '播放',
  'scene3d.trajectory.reset': '归零',
  'scene3d.trajectory.timeline': '轨迹时间轴',
  'scene3d.trajectory.hideTimeline': '隐藏轨迹时间轴',
  'scene3d.trajectory.trackGroups': '轨道组',
  'scene3d.trajectory.addGroup': '新增空白组',
  'scene3d.trajectory.emptyHint': '暂无轨迹',
  'scene3d.trajectory.bound': '已绑定',
  'scene3d.trajectory.unbound': '未绑定',
  'scene3d.trajectory.expand': '展开',
  'scene3d.trajectory.collapse': '收起',
  'scene3d.trajectory.doubleClickRename': '双击重命名',
  'scene3d.trajectory.dragStart': '拖动开始时间',
  'scene3d.trajectory.dragEnd': '拖动结束时间',
  'scene3d.trajectory.endpointLocked': '轨迹端点时间固定',
  'scene3d.trajectory.dragPointTime': '拖动轨迹点时间',
  'scene3d.trajectory.nodeCount': '{{count}}节点',
  'scene3d.trajectory.noBindingHint': '暂无绑定区间',

  // 顶栏
  'scene3d.taskFlow.refine': '精调',
  'scene3d.taskFlow.taskEntry': '任务入口',
  'scene3d.fullscreen.exitScene': '退出 3D 场景',
  'scene3d.fullscreen.initializing': '正在初始化 3D 视口…',

  // 工具栏
  'scene3d.toolbar.add': '添加',
  'scene3d.toolbar.sceneTemplates': '场景模板',
  'scene3d.toolbar.geometry': '几何模型',
  'scene3d.toolbar.props': '道具',
  'scene3d.toolbar.mannequins': '假人',
  'scene3d.toolbar.light': '灯光',
  'scene3d.toolbar.camera': '相机',
}

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export function useTranslation(): { t: TFunction } {
  const t: TFunction = (key, options) => {
    let out = ZH[key] ?? key;
    if (options) {
      for (const [name, value] of Object.entries(options)) {
        out = out.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'), String(value));
      }
    }
    return out;
  };
  return { t };
}
