import { useCallback, useEffect, useRef } from 'react';
import type { DragEvent as ReactDragEvent, ClipboardEvent as ReactClipboardEvent } from 'react';
import { detectFileType, isAssetUrl } from '../components/base/utils/assetType.ts';
import { isEditableTarget } from '../components/base/core/uiHooks.ts';
import { sanitizePastedText } from '../components/base/utils/clipboard.ts';
import { showToast, toastError } from '../components/base/core/toastStore.ts';
import {
  resolveNodeAssetUrl,
  downloadRemoteToLocal,
  WEB_DROP_SUBFOLDER,
} from '../components/base/api/index.ts';
import { fileNameFromUrl } from '../components/base/core/utils.ts';
import { assetTypeLabel } from '@/types';
import { UPLOAD_DIRS } from '../components/base/utils/uploadDirs.ts';
import { logger } from '../components/base/core/logger.ts';
import { tryParse } from '../components/base/utils/asyncGuard.ts';
import { tryParseOr } from '../components/base/core/degrade.ts';

/** 画布坐标（screenToFlowPosition 的输出 / addNode 的入参） */
export interface FlowPosition {
  x: number;
  y: number;
}

/** 建节点：addNode(type, pos, data) → 返回节点 id */
export type AddNodeFn = (
  type: string,
  pos: FlowPosition,
  data?: Record<string, unknown>,
) => string | undefined | null;

/** 屏幕坐标 → 画布坐标 */
export type ScreenToFlowFn = (pos: FlowPosition) => FlowPosition;

/** 节点 data 写回（走 useNodeData 唯一入口） */
export type PatchNodeDataFn = (id: string, patch: Record<string, unknown>) => void;

/** 粘贴节点组（mutiwindow-nodes）回调：onPasteNodeGroup(json, pos)。
 *  **允许异步**：宿主实现（`App.pasteNodeGroup`）解析 JSON 后重建节点，本就是 Promise；
 *  类型里写死 `boolean | void` 会逼宿主把 Promise 丢掉（`void fn()`）＝ 把失败吞在类型层。 */
export type PasteNodeGroupFn = (
  json: string,
  pos: FlowPosition,
) => boolean | void | Promise<boolean>;

export interface UseAssetDropPasteOptions {
  addNode: AddNodeFn;
  screenToFlowPosition: ScreenToFlowFn;
  onPasteNodeGroup?: PasteNodeGroupFn;
  /** 不传则跳过网页图后台本地化（纯显示模式） */
  patchNodeData?: PatchNodeDataFn;
}

export interface AssetDropPasteApi {
  onDragOver: (e: ReactDragEvent) => void;
  onDrop: (e: ReactDragEvent) => void;
  onPaste: (e: ReactClipboardEvent | ClipboardEvent) => void;
  /** 供右键菜单「上传」复用 */
  createNodeFromFile: (file: File, pos: FlowPosition) => void;
}

/**
 * ════════════════════════════════════════════════════════════════════════
 * 【用户需求（硬约束 · 勿删勿改方向 · 改动前必须先读这里）】
 * 用户对「复制 / 粘贴」的明确要求，按优先级记录，后续任何 AI 改这块都必须遵守：
 *
 * 1. 复制图片、复制文字、复制节点，三件事都要可靠、清晰。
 * 2. 「粘贴文字就是要清洗」——用户明确要求粘贴到画布的文字必须经过彻底清洗
 *    （sanitizePastedText）：压缩连续空格/空行、去行首行尾空格、统一换行、去不可见脏字符。
 *    核心目的：粘贴表格/富文本时，绝不能被当成图片或带样式贴进来，必须压成干净纯文本。
 *    所以 textGenerateNode 内容用 sanitizePastedText 处理，不要改成"保留格式"（那是错误方向）。
 * 3. 复制「文本节点」有两种语义，都要可靠：
 *    A. 工具栏「复制文本」→ 复制节点里的文字（纯文本）→ 粘贴到画布建 textGenerateNode（经清洗）。
 *    B. 右键「复制」→ 复制整个节点（mutiwindow-nodes JSON）→ 粘贴到画布重建节点组。
 * 4. 焦点在可编辑元素（contenteditable / input / textarea）内时：
 *    - 纯文本 → 走浏览器原生插入（不建节点、不拦截）；
 *    - 节点组/图片组 JSON（mutiwindow-nodes / mutiwindow-images）→ 必须放行到画布建节点，
 *      不能退化成把 JSON 文本塞进编辑框，否则会「复制节点粘贴不上」且焦点卡住后后续全失败。
 * 5. 粘贴要稳定可靠，三层防线：
 *    - 主路径用「同步 getData('text/plain')」优先（paste 事件不回收），getAsString 仅补充；
 *    - 同步 getData 二次补充；
 *    - navigator.clipboard.read() 极端兜底；全部失败必须 showToast 提示，不静默。
 * 6. 图片：file / text/html 里的 <img> / read() 的 image blob，都要能建 assetNode。
 *
 * 注意：sanitizePastedText 是用户明确要的方向，见 ./clipboard.js。若再被改成 normalize/
 * 保留格式，是背离需求的错误改动。

 *（handlePaste）与 :10228-10543（Ri 粘贴重建）。官方文字只 trim()（text: e.trim()），
 * 用户要求比官方更强清洗，以「用户诉求」为准。
 * ════════════════════════════════════════════════════════════════════════
 *

 *
 * 【为什么抽成 hook】
 * App.jsx 里的 onDragOver/onDrop/onPaste/createNodeFromFile 是一组内聚的「素材导入」能力，
 * 直接写在画布宿主里会让 App 越来越臃肿。抽出来：
 *  - App.jsx 只调一次 hook、把事件挂到 ReactFlow，画布宿主保持清爽；
 *  - 其它画布宿主（脚本盒编辑器等）要支持拖入/粘贴，复用即可。
 *
 * 【映射规则（对齐官方）】
 *  - image / video / audio 文件 → assetNode（AssetNode 内部按 URL 判断类型展示；官方同此）
 *  - text 文件 / 纯文本 → textGenerateNode
 *  - 拖入 URL 文本：图片类 URL → assetNode，否则 → textGenerateNode
 * 原型无后端，文件用 FileReader 读 dataURL 写入节点 data（官方走 localTool hi() 上传 /files/）。
 *
 * @param {Object} opts
 * @param {Function} opts.addNode      建节点：addNode(type, pos, data) → 返回节点 id
 * @param {Function} opts.screenToFlowPosition  屏幕坐标 → 画布坐标
 * @param {Function} opts.onPasteNodeGroup  粘贴节点组（mutiwindow-nodes）回调：onPasteNodeGroup(json, pos) → boolean
 * @param {Function} [opts.patchNodeData]  节点 data 写回：patchNodeData(id, patch)（走 useNodeData 唯一入口；
 *                                         网页图后台本地化成功后替换 assetUrl 用；不传则跳过本地化）
 * @returns {{ onDragOver, onDrop, onPaste }} 挂到 ReactFlow 的事件 + 供 window paste 监听
 */
/* ════════════════════════════════════════════════════════════════
 * 【粘贴的「识别原语」已全部退役（2026-09-18 · ADR-0029 · 用户裁定）】
 * TD-04-21 曾在此收口三个探测原语（CE 判定 / 组 JSON 判定 / 读剪贴板文本），服务于 A/B 两闸的
 * **按载荷分类**。用户裁定「编辑器里的任何操作都归编辑器自己」之后，两闸的判据都塌缩为
 * **一条归属判据**（`isEditableTarget`：事件发生在谁的地盘）⇒ 三个原语**全部失去消费者**，
 * 已连块删除（不留幽灵逻辑）。判据现在是 `base/core/uiHooks.ts::isEditableTarget` 的**画布内唯一一份**
 * （域外 `videoEditor` / `director3d` 各有副本，经取证属**判据重复**，**有意不合并** —— ADR-0031）。
 * ⚠️ 别再按载荷分类重造：它是**间接判据**，必然在"编辑区也处理"时失效（两次实证见 ADR-0029 §背景）。
 * ════════════════════════════════════════════════════════════════ */

export function useAssetDropPaste({
  addNode,
  screenToFlowPosition,
  onPasteNodeGroup,
  patchNodeData,
}: UseAssetDropPasteOptions): AssetDropPasteApi {
  // 记录最近一次鼠标位置（视口坐标）：粘贴时优先落在鼠标处，无鼠标则回退到视图中心。
  // paste 事件本身不带 clientX/Y，官方也是用「当前视口位置」建节点；这里用 mousemove 追踪
  // 更贴近用户预期（在哪儿右键/停留就在哪儿粘贴），对齐 H_.jsx 用视口坐标建节点的思路。
  const lastMouse = useRef<FlowPosition | null>(null);
  useEffect(() => {
    const track = (e: MouseEvent) => {
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', track);
    return () => window.removeEventListener('mousemove', track);
  }, []);

  // 计算粘贴落点（flow 坐标）：最近鼠标位置优先，回退到视图中心。都经 screenToFlowPosition 换算。
  const pastePos = useCallback((): FlowPosition => {
    if (lastMouse.current) return screenToFlowPosition(lastMouse.current);
    return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  }, [screenToFlowPosition]);

  // 拖入时阻止浏览器默认（打开文件），标记 copy
  const onDragOver = useCallback((e: ReactDragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // 文件 → 建素材节点（图片/视频/音频→assetNode，文本→textGenerateNode）
  const createNodeFromFile = useCallback(
    (file: File, pos: FlowPosition) => {
      const type = detectFileType(file);
      // 文本：读文本 → textGenerateNode
      if (type === 'text') {
        const fr = new FileReader();
        fr.onload = () => {
          addNode('textGenerateNode', pos, { text: fr.result, label: file.name });
          showToast(`已导入文本「${file.name}」`);
        };
        fr.readAsText(file);
        return;
      }
      if (type === 'other' || type === 'empty') return;
      // 图片/视频/音频：统一落盘策略（File 直传成 /files/ URL → 落盘失败（localTool 离线等）内联 dataURL 兜底
      // → 连内联都拿不到才算真失败），唯一实现见 filesApi.resolveNodeAssetUrl。
      // 收益：不把大视频 dataURL 塞进快照；localTool 离线时仍能拖入看到图。
      (async () => {
        const up = await resolveNodeAssetUrl(file, UPLOAD_DIRS.canvasDrop);
        if (!up.ok) {
          // 真失败（落盘已回退内联，走到这里说明连内联也读不出）→ 提示一次，且**带生产者判词**
          //（原来是消费者自己编的"无法读取"）。
          toastError(`导入失败：${up.message}（「${file.name}」）`);
          return;
        }
        const url = up.url;
        // docs/122 #4：持久文件（非内联 dataURL）→ 落稳定 contentId（sha1:<hex>，与后端同源）；
        // 内联 dataURL/blob 无持久 Content，只存 url（互斥双形态）。
        // 【TD-08-28 收口】生产者（后端落盘权威）已随 `UploadOutcome` 回传 contentId ⇒ 消费者只转发。
        // 内联兜底分支（落盘失败 → dataURL）本就没有 contentId ⇒ undefined 是**真实空**，不是失败。
        const contentId = up.contentId;
        addNode('assetNode', pos, {
          assetUrl: url,
          label: file.name,
          ...(contentId ? { contentId } : {}),
        });
        // 显示名取自资产类型目录（`assetTypeLabel`），不再就地手写中文名
        showToast(`已导入${assetTypeLabel(type)}「${file.name}」`);
      })();
    },
    [addNode],
  );

  // 拖入网络图片 URL → 先用原 URL 同步建 assetNode（立即显示，能显示就显示，防盗链破图不阻塞导入）。
  // 后台本地化（先显示后替换）：复用后端 fileUrl 下载（服务端 + 7897 代理，绕 CORS）落盘专用 web 目录，
  // 成功把节点 assetUrl 替换为本地 /files/ URL（发送/图生图/压缩/裁剪都能用）；失败保持原 URL，不打扰、日志留痕。
  // 不加 label：与 onPaste 的 html <img> 建图路径一致，节点 data 保持最简 { assetUrl }。
  const addImageNodeFromUrl = useCallback(
    (pos: FlowPosition, url: string) => {
      if (!url) return;
      const id = addNode('assetNode', pos, { assetUrl: url });
      // 未注入 patchNodeData 则跳过本地化（纯显示模式）；非 http(s) 由 downloadRemoteToLocal 内部拦截（返回 null 不替换）
      if (id && typeof patchNodeData === 'function') {
        // 传 `filename` = URL 原名 → 后端登记为 resource 行**显示名**（context 维度）。
        // 物理名自 2026-09-17 起是内容寻址（sha1(字节)，不含原名），显示名必须由发起方显式声明，
        // 否则素材库/下载看到的是哈希名。
        downloadRemoteToLocal(url, {
          folder: WEB_DROP_SUBFOLDER,
          filename: fileNameFromUrl(url) || undefined,
        })
          .then(async (r) => {
            // 【2026-09-17 消费者只转发】`downloadRemoteToLocal` 现返回判别联合：
            //  · `ok:true` → 用**生产者给的** url；
            //  · `ok:false + skipped:true` → **无需下载**（已是本地文件）⇒ 保持原 URL，**不是失败**、不告警；
            //  · `ok:false`（真失败）→ **留痕转发生产者的 `message`**，此处不自己编判词。
            if (!r.ok) {
              if (!r.skipped) {
                logger.warn('素材导入', '网页图本地化失败（保持原 URL）', { message: r.message });
              }
              return;
            }
            const localUrl = r.url;
            if (localUrl !== url) {
              // docs/122 #4：网页图本地化成功后，落稳定 contentId（sha1:<hex>，与后端同源）；
              // asset 主引用从易变 assetUrl 升级为 contentId，渲染经 resource 解析 → 永不破图。
              // 【TD-08-28 收口】该值 **由后端 fileUrl 分支回传**（`files.ts:410`），随判别联合一路上浮 ⇒
              // 消费者只转发。原实现为拿它要 `fetch(localUrl)` **再下一次整图** + 前端重算 sha1
              // （同一身份两份计算 + 一次白下载）；现为零额外请求、零重复计算。
              // 【越权边界 · 2026-09-17 用户裁定】`contentId` 是生产者的**可选**契约字段：缺失即"真空中没有"
              // （`base64`／`already-local` 等分支本不产出）⇒ **静默才正确**，消费者不替生产者告警/留痕
              // （CLAUDE.md §5.1「只有生产者才有权呈现错误」＋「失败不得伪装成空」三形态①）。
              const patch: Record<string, unknown> = { assetUrl: localUrl };
              if (r.contentId) patch.contentId = r.contentId;
              patchNodeData(id, patch);
            }
          })
          .catch((e) => logger.warn('assetDrop', '网页图本地化失败，保持原 URL', e));
      }
    },
    [addNode, patchNodeData],
  );

  // 拖入
  const onDrop = useCallback(
    (e: ReactDragEvent) => {
      e.preventDefault();
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // 素材库素材拖入（ResourceLibrary 写 application/x-yimao-asset）：用素材 url 建节点
      const assetRaw = e.dataTransfer?.getData('application/x-yimao-asset');
      if (assetRaw) {
        // 【TD-16-49】此处失败=**用户无感**（拖了没反应）⇒ 必须留痕 + 提示用户。
        // 走「压平即留痕」原语；文案由本域（拖放能力的所有方）给全。
        const asset = tryParseOr(
          () =>
            JSON.parse(assetRaw) as {
              url?: string;
              type?: string;
              text?: string;
              name?: string;
              contentId?: string;
            },
          null,
          {
            layer: 'useAssetDropPaste',
            key: 'asset-drop',
            toast: '拖入的素材数据无法解析，已忽略',
          },
        );
        if (asset?.url) {
          // 文字素材 → textGenerateNode（把 data:text 内容解码成文本）；图片/视频/音频 → assetNode
          if (asset.type === 'text') {
            let content = asset.text || '';
            if (!content && asset.url.startsWith('data:text')) {
              try {
                content = decodeURIComponent(asset.url.slice(asset.url.indexOf(',') + 1));
              } catch {
                content = asset.name || '';
              }
            }
            addNode('textGenerateNode', pos, { text: content, label: asset.name || '文字素材' });
            showToast(`已添加文字素材「${asset.name || '文字素材'}」`);
          } else {
            // docs/122 #4：素材库拖入建 asset → 带稳定 contentId（来自后端资源 sha1），与 assetUrl 同存
            addNode('assetNode', pos, {
              assetUrl: asset.url,
              label: asset.name || '素材',
              ...(asset.contentId ? { contentId: asset.contentId } : {}),
            });
            showToast(`已添加素材「${asset.name || '素材'}」`);
          }
          return;
        }
      }

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) {
        // 拖入 URL 文本（非文件）：图片类 URL → assetNode，其它 → textGenerateNode。
        // 从网页拖图时 URL 通常不在 text/plain，而在 text/uri-list（拖拽 URL 的标准 MIME），
        // 故两者都读，取第一个非空 URL 候选（uri-list 可能多行，取首行 URL）。
        const uriList = e.dataTransfer?.getData('text/uri-list') || '';
        const text = e.dataTransfer?.getData('text/plain') || '';
        const candidate = (uriList.trim() || text.trim()).split(/\r?\n/)[0]?.trim() || '';
        if (candidate) {
          if (isAssetUrl(candidate)) {
            // 网页图 URL → 直接用原 URL 建 assetNode（方案C：能显示就显示，防盗链破图不阻塞导入；不做本地化）
            addImageNodeFromUrl(pos, candidate);
          } else {
            addNode('textGenerateNode', pos, { text: candidate, expanded: false });
            showToast('已导入文本');
          }
        }
        return;
      }
      Array.from(files).forEach((f, i) =>
        createNodeFromFile(f, { x: pos.x + i * 50, y: pos.y + i * 50 }),
      );
    },
    [screenToFlowPosition, addNode, createNodeFromFile, addImageNodeFromUrl],
  );

  // 建 textGenerateNode（普通文本，经 sanitize 清洗；内部 mutiwindow-* JSON 用原始 text 解析，不在此清洗）
  const handleTextPaste = useCallback(
    (rawText: string, pos: FlowPosition) => {
      if (!rawText || !rawText.trim()) return;
      const rawR = tryParse(() => JSON.parse(rawText));
      const parsedRaw = rawR.ok ? rawR.value : undefined;
      // 剪贴板 JSON 逐字段读取（type 需 string、images 需数组），不做整体形状假断言（F7）
      const d =
        parsedRaw && typeof parsedRaw === 'object'
          ? (parsedRaw as { type?: unknown; images?: unknown })
          : null;
      if (d?.type === 'mutiwindow-nodes') {
        // 粘贴节点组（含连线），交由宿主（App）解析重建。
        // 【2026-09-17 TD-16-27】原来不看返回值：宿主解析失败（false）时整个粘贴**静默无事发生**
        // —— 正是用户报的「复制节点粘贴不上」。现按结果分流，失败必须出声。
        if (typeof onPasteNodeGroup !== 'function') return;
        // 【2026-09-17 用户裁定「消费者禁止错误显示」】本 hook 是**消费者**：`onPasteNodeGroup`
        // 的失败属**宿主**（`App.pasteNodeGroup`）—— 它的失败长什么样、要不要提示，**由宿主决定**。
        // 我先前在这里写 `toastError('粘贴失败：…')` = 消费者替所有方决定错误显示（越权，
        // 且把文案抄成第二份）。现**只转发、不解释、不展示**。
        //
        // 宿主可能同步返回 boolean、也可能异步（`App.pasteNodeGroup` 是 Promise）：统一收敛两种形态。
        // `ok === false` 的**呈现责任在宿主**（它知道自己为什么失败）；此处不编文案。
        void Promise.resolve(onPasteNodeGroup(rawText, pos)).catch((e: unknown) => {
          // 唯一动作：把 reject 落地，避免 unhandledRejection（**不展示**，仅记录到开发者通道）。
          logger.debug('素材导入', 'onPasteNodeGroup 抛错（由宿主负责呈现）', e);
        });
        return;
      }
      if (d?.type === 'mutiwindow-images') {
        const images = (Array.isArray(d.images) ? d.images : []).filter(
          (x): x is string => typeof x === 'string',
        );
        if (images.length === 0) return;
        images.forEach((img, i) => {
          const col = i % 6;
          const row = Math.floor(i / 6);
          addNode(
            'assetNode',
            { x: pos.x + col * 150, y: pos.y + row * 150 },
            { assetUrl: img, label: `提取帧 ${i + 1}` },
          );
        });
        showToast(`已粘贴 ${images.length} 张提取的图片`);
        return;
      }
      // 普通文本 → textGenerateNode：经 sanitizePastedText 彻底清洗（压缩连续空格/空行、去行首行尾空格、
      // 统一换行、去不可见脏字符）。用户核心诉求：粘贴表格/富文本时绝不能被当成图片或带样式贴进来，
      // 必须压成干净纯文本，这里按用户要求更强清洗。
      const cleanText = sanitizePastedText(rawText);
      if (cleanText) addNode('textGenerateNode', pos, { text: cleanText, expanded: false });
    },
    [addNode, onPasteNodeGroup],
  );

  // 从 text/html 里提取 <img src>（外部「复制图片」常是 text/html 带 <img>，而不是 image File）
  const extractImgFromHtml = useCallback((html: string): string => {
    if (!html) return '';
    // 用 DOMParser 解析（不依赖挂在 DOM 上），jsdom 可用；解析失败则正则兜底
    const docR = tryParse(() => new DOMParser().parseFromString(String(html), 'text/html'));
    const img = docR.ok ? docR.value.querySelector('img[src]') : null;
    if (img) return img.getAttribute('src') || '';
    const m = String(html).match(/<img[^>]*\ssrc=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }, []);

  // 把 ClipboardItem 的 Blob 包装成 File（createNodeFromFile 需要 name/type 判型）。name 从 mime 推。
  const blobToPastedFile = useCallback((blob: Blob, mime: string): File => {
    const name = (mime.split('/')[1] || 'image').replace(/[^a-z0-9]/gi, '') || 'image';
    return new File([blob], name, { type: mime || blob.type || 'application/octet-stream' });
  }, []);

  // 读取 ClipboardItem 某类型的文本内容：getType 真浏览器返回 Blob、测试 mock 直接返回字符串，都兼容。
  const readClipText = useCallback(async (item: ClipboardItem, type: string): Promise<string> => {
    const got = await item.getType(type);
    if (typeof got?.text === 'function') return got.text();
    return typeof got === 'string' ? got : String(got ?? '');
  }, []);

  // 粘贴：【稳定模型 + 归属收口】
  //  - 主路径 = paste 事件同步数据（e.clipboardData.items）：图片/视频/音频 getAsFile 同步拿（最稳）、
  //    纯文本 text/plain 走 getAsString（与旧版一致，稳定可用）、text/html 提取 <img>。
  //  - **编辑区（INPUT / TEXTAREA / contenteditable）内：一律不建节点**（事件归编辑区，见下方注释）。
  //  - 极端兜底：同步数据完全为空时，再试 navigator.clipboard.read() 实时读（仅补充，不作为主路径）。
  const onPaste = useCallback(
    (e: ReactClipboardEvent | ClipboardEvent) => {
      // 【编辑区内的粘贴归编辑区（用户裁定 2026-09-18 · ADR-0029）】
      //  判据只有一条：**事件发生在谁的地盘**（`isEditableTarget`：INPUT / TEXTAREA / contenteditable
      //  一视同仁），**不再按载荷分类**。
      //  · 历史一（TD-04-34 病根）：曾对 contenteditable 内的「节点组 / 图片组 JSON」放行建节点，
      //    而编辑区自己也插文字 ⇒ 同一事件两个所有者 ⇒ 双处理（既建节点又落 JSON）。
      //  · 历史二（787ca25）：input/textarea 内也按载荷放行，理由是"否则 JSON 文本塞进编辑框 =
      //    复制节点粘贴不上"。**该理由已被用户裁定推翻**：编辑器里的任何操作（粘贴 / 删除 / 全选…）
      //    都归编辑器自己 —— 载荷分类是**间接判据**，必然在"编辑区也处理"时失效。
      //  · 本闸保留这道判断（而非依赖 A 闸），是因为 `onPaste` 是**对外挂载点**（见本 hook 返回说明：
      //    可挂到 ReactFlow），不能假定"调用方一定从 A 闸进来"。
      if (isEditableTarget(e)) return;

      const items = e.clipboardData?.items;
      const cd = e.clipboardData;
      const pos = pastePos();

      // 主路径：同步遍历 clipboardData.items（与旧版一致，稳定）
      if (items) {
        for (const item of items) {
          if (item.kind === 'file') {
            const at = detectFileType(item);
            if (at === 'image' || at === 'video' || at === 'audio') {
              const file = item.getAsFile && item.getAsFile();
              if (file) {
                e.preventDefault();
                createNodeFromFile(file, pos);
                return;
              }
            }
          } else if (item.kind === 'string' && item.type === 'text/plain') {
            e.preventDefault();
            // 同步 getData 优先（paste 事件 getData 不回收、稳）；getAsString 仅作补充（偶发被回收读空）。
            // 节点组(mutiwindow-nodes) JSON 走这条，必须稳，否则偶发「复制节点粘贴不上」。
            const syncPlain =
              cd && typeof cd.getData === 'function' ? cd.getData('text/plain') : '';
            if (syncPlain && syncPlain.trim()) {
              handleTextPaste(syncPlain, pos);
              return;
            }
            item.getAsString((text) => {
              if (text && text.trim()) handleTextPaste(text, pos);
            });
            return;
          }
        }
      }

      // text/html 里的 <img>（外部「复制图片」常是 html 而非 file）→ 建节点
      const html = cd && typeof cd.getData === 'function' ? cd.getData('text/html') : '';
      if (html) {
        const src = extractImgFromHtml(html);
        if (src) {
          e.preventDefault();
          if (isAssetUrl(src)) addNode('assetNode', pos, { assetUrl: src });
          else addNode('textGenerateNode', pos, { text: src, expanded: false });
          return;
        }
      }

      // 同步补充：直接读 getData('text/plain')（部分环境纯文本不在 items 里，而在 getData 中）
      const syncText = cd && typeof cd.getData === 'function' ? cd.getData('text/plain') : '';
      if (syncText && syncText.trim()) {
        e.preventDefault();
        handleTextPaste(syncText, pos);
        return;
      }

      // 极端兜底：同步数据完全为空才试 read() 实时读（仅补充）
      // ⚠️ 走到这里 ⇒ **一定不在编辑区**（本函数开头已对编辑区早退，见 ADR-0029）——
      //   故历史上那些 `!isCE` 条件全部恒真，已删（它们的 `isCE` 变量随按载荷判据一起消失）。
      if (cd && (!items || items.length === 0)) {
        (async () => {
          if (typeof navigator?.clipboard?.read !== 'function') {
            showToast('读取剪贴板失败，请使用 Ctrl+V 快捷键粘贴');
            return;
          }
          try {
            const clip = await navigator.clipboard.read();
            if (!clip || clip.length === 0) {
              showToast('无法识别剪贴板内容，请尝试复制图片或文字后再粘贴');
              return;
            }
            for (const item of clip) {
              const types = item.types || [];
              const imgType = types.find((x) => detectFileType({ type: x }) === 'image');
              if (imgType) {
                const blob = await item.getType(imgType);
                if (blob) {
                  createNodeFromFile(blobToPastedFile(blob, imgType), pos);
                  return;
                }
                continue;
              }
              if (types.includes('text/html')) {
                const html = await readClipText(item, 'text/html');
                const src = extractImgFromHtml(html);
                if (src) {
                  if (isAssetUrl(src)) addNode('assetNode', pos, { assetUrl: src });
                  else addNode('textGenerateNode', pos, { text: src, expanded: false });
                  return;
                }
              }
              if (types.includes('text/plain')) {
                const text = await readClipText(item, 'text/plain');
                if (text && text.trim()) {
                  handleTextPaste(text, pos);
                  return;
                }
              }
            }
            showToast('无法识别剪贴板内容，请尝试复制图片或文字后再粘贴');
          } catch {
            showToast('读取剪贴板失败，请使用 Ctrl+V 快捷键粘贴');
          }
        })();
      }
    },
    [
      createNodeFromFile,
      pastePos,
      addNode,
      handleTextPaste,
      extractImgFromHtml,
      blobToPastedFile,
      readClipText,
    ],
  );

  // createNodeFromFile 供右键菜单「上传」复用（对齐官方 Re.current 隐藏 file input → 建素材节点）
  return { onDragOver, onDrop, onPaste, createNodeFromFile };
}

/**
 * 注册全局粘贴监听（window paste → onPaste）。宿主在组件里调用一次即可。
 *
 * 【归属判据（用户裁定 2026-09-18 · TD-04-34）】编辑器（contenteditable）内的粘贴**不归画布**：
 * 本闸直接早退；事件由编辑区自己拥有（`PromptInput` 在自身处理器里 `stopPropagation` 独占）。
 * ⚠️ 曾经的"按载荷放行"（CE 内是图片 / 节点组 JSON 就交给画布建节点）造成**同一事件两个所有者**
 * ⇒ 输入框聚焦时粘贴"复制的节点"既建节点又落文字。该做法已撤销，判据见 `docs/adr/ADR-0029`。
 * @param {Function} onPaste
 */
/** window paste 的回调（与 onPaste 同签名） */
export type GlobalPasteHandler = (e: ClipboardEvent) => void;

export function useGlobalPaste(onPaste: GlobalPasteHandler): void {
  // 用 ref 存最新 onPaste，监听只绑一次（空依赖）。目的：无论 onPaste 引用怎么变，
  // window 上的 paste 监听都稳定挂着，不因依赖变化反复重挂而「粘贴完全没反应」。
  // （React StrictMode 下也只会规范地 绑→解→绑 一次，不会因 onPaste 抖动丢失监听。）
  const onPasteRef = useRef<GlobalPasteHandler>(onPaste);
  onPasteRef.current = onPaste;
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      // 【A 闸 · 归属判据】编辑区（INPUT / TEXTAREA / contenteditable）内的粘贴**一律不归画布**
      //（用户裁定 2026-09-18 · ADR-0029）。判据只有一条：**事件发生在谁的地盘**。
      //  · 为什么不再"按载荷分类"——**那正是 TD-04-34 的病根**：曾按载荷放行图片 / 节点组 JSON 到
      //    onPaste，而编辑区自己也会处理 ⇒ **同一个事件两个所有者** ⇒ 双处理。
      //  · 分工：编辑区内 = 编辑区独占（`PromptInput` 自己 `stopPropagation`，本闸本不该收到）；
      //    本闸这道判断是**全局监听器的边界** —— 全局 handler 不能假定"编辑区一定会隔离事件"
      //    （同判据先例：`ImageBoxNode` 的 window paste 监听，焦点在编辑区即早退）。
      //  · 画布上（非编辑区）的文本清洗由 onPaste → handleTextPaste → sanitizePastedText 建文本节点。
      if (isEditableTarget(e)) return;
      onPasteRef.current?.(e);
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, []);
}
