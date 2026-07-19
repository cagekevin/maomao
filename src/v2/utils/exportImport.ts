import type { AppNode, CanvasProject } from '../types';
import type { Edge, Viewport } from '@xyflow/react';

/** 导出画布项目 */
export function exportProject(
  nodes: AppNode[],
  edges: Edge[],
  viewport: Viewport | undefined,
  name?: string
): void {
  const project: CanvasProject = {
    id: `project-${Date.now()}`,
    name: name || `画布项目_${new Date().toLocaleDateString()}`,
    timestamp: Date.now(),
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
    viewport,
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 导入画布项目 */
export function importProject(file: File): Promise<CanvasProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const project = JSON.parse(e.target?.result as string) as CanvasProject;
        if (!project.nodes || !project.edges) {
          reject(new Error('无效的项目文件'));
          return;
        }
        resolve(project);
      } catch {
        reject(new Error('文件解析失败'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/** 导出配置（API 端点、账号等） */
export function exportConfig(accounts: any[], endpoints: any[]): void {
  const config = { accounts, endpoints, exportTime: Date.now() };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yimao-config-${new Date().toLocaleDateString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}