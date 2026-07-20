/**
 * 节点类型: rhWebappNode
 * 原版函数名: Ms
 * 原版行号: L14637-L16030
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _r → Rl
// a → ZK
// ar → Xl
// at → W_
// b → dT
// c → tK
// ct → qd
// d → zG
// e → i
// f → MG
// g → qU
// h → xW
// i → jq
// in → Zu
// ir → Zl
// j → GE
// jn → wu
// k → cO
// l → VG
// m → LW
// mr → Vl
// mt → Vd
// n → Fq
// o → oK
// p → VW
// pr → Hl
// pt → Hd
// r → Nq
// rr → Ql
// s → iK
// t → e1
// u → BG
// ut → Gd
// v → XH
// w → xT
// x → Y
// y → Mk
// yn → Iu
// z → Rw
 */

import { memo, useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Loader2,
  AlertCircle,
  Play,
  X,
  Sparkles,
  Check,
  ChevronDown,
  Minus,
  Plus,
  Upload,
  Image,
  Search,
  Unplug,
  ImageIcon,
  Music,
  Video,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import ResizeController from './ResizeController';
import CustomHandle from './CustomHandle';
import { APP_BRAND } from '../../_engine/config.js';

// ====== External dependency stubs ======

// TODO: implement ar - parse AI app API URL
const ar = (url: string | undefined): string => {
  // TODO: implement
  return url || '';
};

// TODO: implement Et - useFitView or similar
const Et = () => {
  // TODO: implement
  return (nodeId: string) => {
    // fitView to node
  };
};

// TODO: implement ir - build API URL for app detail
const ir = (baseUrl: string, appId?: string): string => {
  // TODO: implement
  return appId ? `${baseUrl}/app/${appId}` : baseUrl;
};

// TODO: implement rr - build API URL for task polling
const rr = (baseUrl: string, path: string): string => {
  // TODO: implement
  return `${baseUrl}${path}`;
};

// TODO: implement xs - get field type from schema entry
const xs = (entry: any): string => {
  return (entry.fieldType || '').toUpperCase();
};

// TODO: implement Ss - get field key from schema entry
const Ss = (entry: any): string => {
  // TODO: implement
  return `${entry.nodeId}_${entry.fieldName}`;
};

// TODO: implement hs - get output text from connected source node
const hs = (node: any): string => {
  // TODO: implement
  return node?.data?.resultData || node?.data?.text || node?.data?.output || '';
};

// TODO: implement js - detect media type from URL
const js = (url: string, outputType?: string): string => {
  // TODO: implement
  if (!url) return 'unknown';
  const lower = url.toLowerCase();
  if (/\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)(\?|$)/i.test(lower)) return 'audio';
  if (/\.(png|jpe?g|webp|gif|bmp|svg|avif)(\?|$)/i.test(lower)) return 'image';
  if (outputType === 'text') return 'text';
  return 'unknown';
};

// TODO: implement bs - parse list options from fieldData
const bs = (fieldData: any): Array<{ index: string; name: string; description?: string }> => {
  // TODO: implement
  try {
    return Array.isArray(fieldData) ? fieldData : [];
  } catch {
    return [];
  }
};

// TODO: implement Cs - find selected list index
const Cs = (value: string, options: any[]): string => {
  // TODO: implement
  return value || (options.length > 0 ? options[0].index : '');
};

// TODO: implement Ts - upload file to API
const Ts = async (blob: Blob, apiUrl: string, apiKey: string, filename: string): Promise<string> => {
  // TODO: implement
  console.warn('[RhWebappNode] Ts (uploadFile) not implemented');
  return '';
};

// TODO: implement Es - fetch blob from URL
const Es = async (url: string): Promise<Blob> => {
  // TODO: implement
  const res = await fetch(url);
  return res.blob();
};

// TODO: implement Xr - urlify asset (upload to storage)
const Xr = async (url: string, options: any): Promise<{ url: string; thumbnailUrl?: string }> => {
  // TODO: implement
  return { url };
};

// TODO: implement ri - generate thumbnail
const ri = async (url: string, options: any): Promise<string | undefined> => {
  // TODO: implement
  return undefined;
};

// TODO: implement ys - check membership
const ys = (membershipType: string | undefined): boolean => {
  // TODO: implement
  return true;
};

// TODO: implement vs - custom event name for triggering node execution
const vs = 'custom-node-run';

// TODO: implement As - sanitize HTML
const As = (html: string): string => {
  // TODO: implement
  return html;
};

// TODO: implement Un - createPortal helper (using react-dom directly)
// Already imported createPortal from 'react-dom'

// ws - icon mapping for media types
const ws: Record<string, any> = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  AUDIO: Music,
};

// Ot - default fallback icon
const Ot = ImageIcon;

// Pn - Check icon alias
const Pn = Check;

// Sn - ChevronDown icon alias
const Sn = ChevronDown;

// Nt - Sparkles icon alias (for app store)
const Nn = Sparkles;

// ====== Schema field type ======
interface SchemaField {
  nodeId: string;
  nodeName: string;
  fieldName: string;
  fieldValue?: any;
  fieldData?: any;
  fieldType: string;
  description?: string;
  descriptionEn?: string;
}

interface RhWebappNodeData {
  webappId?: string;
  aiAppApiUrl?: string;
  aiAppApiKey?: string;
  schema?: SchemaField[];
  values?: Record<string, string>;
  uploadStatus?: Record<string, string>;
  uploadError?: Record<string, string>;
  uploadSourceSig?: Record<string, string>;
  schemaLoading?: boolean;
  schemaError?: string;
  webappName?: string;
  webappDesc?: string;
  webappTags?: string[];
  covers?: Array<{ url?: string; thumbnailUri?: string }>;
  preDeductAmount?: number | null;
  loading?: boolean;
  status?: string;
  errorMessage?: string;
  consumeMoney?: string | null;
  finalPrice?: number | null;
  taskCostTime?: number | null;
  taskId?: string;
  lastResultTaskId?: string;
  progress?: number;
  membershipType?: string;
  openAppSelectorOnMount?: boolean;
  label?: string;
  onShowToast?: (msg: string) => void;
  onStop?: (nodeId: string) => void;
  updateGlobalTasks?: (fn: (tasks: any[]) => any[]) => void;
  addTransitResource?: (url: string, type: string, source: string) => void;
  [key: string]: unknown;
}

function RhWebappNode({ id, data, selected }: NodeProps<RhWebappNodeData>) {
  const {
    updateNodeData,
    setNodes,
    setEdges,
    getNode,
  } = useReactFlow();
  const fitView = Et();
  const nodeData = data;
  const webappId = nodeData.webappId || '';
  const apiBaseUrl = ar(nodeData.aiAppApiUrl);
  const apiKey = nodeData.aiAppApiKey || '';
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = () => setDropdownOpen(null);
    return document.addEventListener('mousedown', handler), () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const schema = useMemo(() => nodeData.schema || [], [nodeData.schema]);
  const values = useMemo(() => nodeData.values || {}, [nodeData.values]);
  const uploadStatus = useMemo(() => nodeData.uploadStatus || {}, [nodeData.uploadStatus]);
  const uploadError = useMemo(() => nodeData.uploadError || {}, [nodeData.uploadError]);

  const connections = useHandleConnections({ type: 'target' });
  const connectedNodeIds = useMemo(() => Array.from(new Set(connections.map((c) => c.source))), [connections]);

  const mediaFields = useMemo(() => schema.filter((e) => ['IMAGE', 'VIDEO', 'AUDIO'].includes(xs(e))), [schema]);
  const nonMediaFields = useMemo(() => schema.filter((e) => !['IMAGE', 'VIDEO', 'AUDIO'].includes(xs(e))), [schema]);

  // Fit view on mount or schema change
  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => fitView(id));
    return () => window.cancelAnimationFrame(rafId);
  }, [id, schema, fitView]);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const pollingTaskRef = useRef<string | null>(null);
  const uploadSourceSigRef = useRef<Record<string, string>>({});
  const textSourceSigRef = useRef<Record<string, string>>({});

  // Load schema
  const loadSchema = useCallback(async (appId: string, options?: { resetValues?: boolean }) => {
    if (!apiBaseUrl || !apiKey) {
      updateNodeData(id, {
        schemaLoading: false,
        schemaError: '请先登录以使用 AI 应用'
      });
      return;
    }

    updateNodeData(id, {
      schemaLoading: true,
      schemaError: undefined
    });

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(ir(apiBaseUrl, appId), {
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        signal: controller.signal
      });
      const json = await res.json();

      if (res.status === 404) throw Error(json?.error || '应用不存在或已下架，请重新选择应用');
      if (!res.ok || !json?.success) throw Error(json?.error || `加载失败 HTTP ${res.status}`);

      const appData = json.data || {};
      const fields = (appData.nodeInfoList || []).map((e: any) => ({
        nodeId: String(e.nodeId),
        nodeName: e.nodeName,
        fieldName: e.fieldName,
        fieldValue: e.fieldValue,
        fieldData: e.fieldData,
        fieldType: (e.fieldType || '').toUpperCase(),
        description: e.description,
        descriptionEn: e.descriptionEn
      }));

      const defaultValues: Record<string, string> = {};
      fields.forEach((e: SchemaField) => {
        if (e.fieldValue !== undefined) {
          defaultValues[Ss(e)] = String(e.fieldValue);
        }
      });

      const covers = Array.isArray(appData.covers) ? appData.covers : [];
      const rawTags = appData.tags ?? [];
      const tags = Array.isArray(rawTags) ? rawTags.map((e: any) => typeof e === 'string' ? e : e?.name || e?.tagName || '').filter(Boolean) : [];

      updateNodeData(id, {
        webappId: appId,
        schema: fields,
        webappName: appData.appName || 'AI应用',
        webappDesc: appData.description || '',
        webappTags: tags,
        covers: covers,
        preDeductAmount: appData.preDeductAmountDefault ?? null,
        values: options?.resetValues ? defaultValues : {
          ...defaultValues,
          ...(nodeData.values || {})
        },
        uploadStatus: options?.resetValues ? {} : nodeData.uploadStatus || {},
        uploadError: options?.resetValues ? {} : nodeData.uploadError || {},
        uploadSourceSig: options?.resetValues ? {} : nodeData.uploadSourceSig || {},
        schemaLoading: false
      });

      uploadSourceSigRef.current = options?.resetValues ? {} : {
        ...(nodeData.uploadSourceSig || {})
      };
    } catch (err: any) {
      updateNodeData(id, {
        schemaLoading: false,
        schemaError: err?.name === 'AbortError' ? '加载超时（15s），请检查网络或应用 ID' : err?.message || '加载失败'
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [id, apiBaseUrl, apiKey]);

  // Load schema on mount if needed
  useEffect(() => {
    if (schema.length > 0 || !nodeData.webappId) return;
    loadSchema(nodeData.webappId);
  }, [id]);

  // Reload on API key change
  const prevApiKeyRef = useRef(apiKey);
  useEffect(() => {
    const prevKey = prevApiKeyRef.current;
    prevApiKeyRef.current = apiKey;
    if (!apiBaseUrl || !apiKey || !nodeData.webappId) return;
    const keyChanged = !prevKey && !!apiKey;
    const isLoginError = !!nodeData.schemaError && /登录/.test(nodeData.schemaError);
    if ((keyChanged || (isLoginError && schema.length === 0))) {
      loadSchema(nodeData.webappId);
    }
  }, [apiBaseUrl, apiKey, nodeData.webappId, nodeData.schemaError, schema.length, loadSchema]);

  // Handle media field connections (auto-upload)
  useEffect(() => {
    if (mediaFields.length === 0) return;

    mediaFields.forEach((field) => {
      const fieldKey = Ss(field);
      const conn = connections.find((c) => c.targetHandle === `var-${fieldKey}`);
      const fieldType = xs(field);

      if (!conn) {
        if (uploadSourceSigRef.current[fieldKey]) {
          uploadSourceSigRef.current[fieldKey] = '';
          updateNodeData(id, {
            values: {
              ...(nodeData.values || {}),
              [fieldKey]: ''
            },
            uploadStatus: {
              ...(nodeData.uploadStatus || {}),
              [fieldKey]: 'idle'
            },
            uploadError: {
              ...(nodeData.uploadError || {}),
              [fieldKey]: ''
            },
            uploadSourceSig: {
              ...(nodeData.uploadSourceSig || {}),
              [fieldKey]: ''
            }
          });
        }
        return;
      }

      const sourceNode = connectedNodeIds.find((nid) => nid === conn.source);
      const sourceNodeData = sourceNode ? getNode(conn.source)?.data : null;
      if (!sourceNodeData) return;

      const mediaUrl = sourceNodeData.imageUrl || sourceNodeData.videoUrl || sourceNodeData.audioUrl || '';
      let matchedUrl = '';

      if (fieldType === 'IMAGE') {
        matchedUrl = sourceNodeData.imageUrl && !/\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(String(sourceNodeData.imageUrl)) ? sourceNodeData.imageUrl : '';
      } else if (fieldType === 'VIDEO') {
        matchedUrl = sourceNodeData.videoUrl || (sourceNodeData.imageUrl && /\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(String(sourceNodeData.imageUrl)) ? sourceNodeData.imageUrl : '');
      } else if (fieldType === 'AUDIO') {
        matchedUrl = sourceNodeData.audioUrl || (sourceNodeData.imageUrl && /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)(\?|$)/i.test(String(sourceNodeData.imageUrl)) ? sourceNodeData.imageUrl : '');
      }

      matchedUrl = matchedUrl || mediaUrl;
      if (!matchedUrl) return;

      const expectedType = fieldType === 'IMAGE' ? 'image' : fieldType === 'VIDEO' ? 'video' : 'audio';
      const detectedType = js(matchedUrl);

      if (detectedType !== 'unknown' && detectedType !== expectedType) {
        const badSig = `bad#${conn.source}#${conn.sourceHandle ?? ''}#${matchedUrl}`;
        if (uploadSourceSigRef.current[fieldKey] !== badSig) {
          uploadSourceSigRef.current[fieldKey] = badSig;
          const typeNames: Record<string, string> = { image: '图片', video: '视频', audio: '音频' };
          updateNodeData(id, {
            uploadStatus: {
              ...(nodeData.uploadStatus || {}),
              [fieldKey]: 'error'
            },
            uploadError: {
              ...(nodeData.uploadError || {}),
              [fieldKey]: `该字段需要${typeNames[expectedType]}，但接入的是${typeNames[detectedType] || detectedType}`
            }
          });
        }
        return;
      }

      const goodSig = `${conn.source}#${conn.sourceHandle ?? ''}#${matchedUrl}`;
      if (uploadSourceSigRef.current[fieldKey] === goodSig || ((nodeData.uploadSourceSig || {})[fieldKey] === goodSig && (nodeData.values || {})[fieldKey] && (nodeData.uploadStatus || {})[fieldKey] === 'done')) {
        uploadSourceSigRef.current[fieldKey] = goodSig;
        return;
      }

      uploadSourceSigRef.current[fieldKey] = goodSig;

      (async () => {
        updateNodeData(id, {
          uploadStatus: {
            ...(nodeData.uploadStatus || {}),
            [fieldKey]: 'uploading'
          },
          uploadError: {
            ...(nodeData.uploadError || {}),
            [fieldKey]: ''
          }
        });

        try {
          const uploadedUrl = await Ts(
            await Es(matchedUrl),
            apiBaseUrl,
            apiKey,
            (() => {
              try {
                const urlObj = new URL(matchedUrl);
                return decodeURIComponent(urlObj.pathname.split('/').pop() || 'upload.bin');
              } catch {
                return 'upload.bin';
              }
            })()
          );
          updateNodeData(id, {
            values: {
              ...(nodeData.values || {}),
              [fieldKey]: uploadedUrl
            },
            uploadStatus: {
              ...(nodeData.uploadStatus || {}),
              [fieldKey]: 'done'
            },
            uploadSourceSig: {
              ...(nodeData.uploadSourceSig || {}),
              [fieldKey]: goodSig
            }
          });
        } catch (err: any) {
          updateNodeData(id, {
            uploadStatus: {
              ...(nodeData.uploadStatus || {}),
              [fieldKey]: 'error'
            },
            uploadError: {
              ...(nodeData.uploadError || {}),
              [fieldKey]: err?.message || '上传失败'
            }
          });
        }
      })();
    });
  }, [connections, connectedNodeIds, mediaFields, id]);

  // Handle non-media field connections (auto-fill text)
  useEffect(() => {
    if (nonMediaFields.length === 0) return;

    nonMediaFields.forEach((field) => {
      const fieldKey = Ss(field);
      const conn = connections.find((c) => c.targetHandle === `var-${fieldKey}`);

      if (!conn) {
        if (textSourceSigRef.current[fieldKey]) {
          textSourceSigRef.current[fieldKey] = '';
          updateNodeData(id, {
            values: {
              ...(nodeData.values || {}),
              [fieldKey]: ''
            }
          });
        }
        return;
      }

      const sourceNodeData = connectedNodeIds.length > 0 ? hs(getNode(conn.source)) : '';
      const trimmed = sourceNodeData.trim();
      if (!trimmed) return;

      const sig = `${conn.source}#${conn.sourceHandle ?? ''}#${trimmed}`;
      if (textSourceSigRef.current[fieldKey] === sig) return;
      textSourceSigRef.current[fieldKey] = sig;

      const fieldType = xs(field);
      let value = trimmed;
      if (fieldType === 'LIST') {
        value = Cs(trimmed, bs(field.fieldData));
      }
      if (fieldType === 'BOOLEAN') {
        value = /^(true|1|yes|是|开)$/i.test(trimmed) ? 'true' : /^(false|0|no|否|关)$/i.test(trimmed) ? 'false' : trimmed;
      }

      updateNodeData(id, {
        values: {
          ...(nodeData.values || {}),
          [fieldKey]: value
        }
      });
    });
  }, [connections, connectedNodeIds, nonMediaFields, id]);

  // Handle manual file upload
  const handleFileUpload = useCallback(async (fieldKey: string, file: File, expectedFieldType: string) => {
    const fileName = (file.name || '').toLowerCase();
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)$/i.test(fileName);
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(fileName);
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(fileName);
    const detectedType = isAudio ? 'audio' : isVideo ? 'video' : isImage ? 'image' : 'unknown';
    const expectedType = expectedFieldType === 'IMAGE' ? 'image' : expectedFieldType === 'VIDEO' ? 'video' : 'audio';

    if (detectedType !== 'unknown' && detectedType !== expectedType) {
      const typeNames: Record<string, string> = { image: '图片', video: '视频', audio: '音频' };
      updateNodeData(id, {
        uploadStatus: {
          ...(uploadStatus || {}),
          [fieldKey]: 'error'
        },
        uploadError: {
          ...(uploadError || {}),
          [fieldKey]: `该字段需要${typeNames[expectedType]}，请选择${typeNames[expectedType]}文件`
        }
      });
      return;
    }

    let blobUrl = URL.createObjectURL(file);
    try {
      const uploadResult = await Xr(file, {
        subfolder: 'canvas/upload',
        generateThumb: expectedType === 'image',
        thumbMaxDim: 480,
        thumbQuality: 75
      });
      if (uploadResult?.url) {
        blobUrl = uploadResult.url;
      }
    } catch {}

    const node = getNode(id);
    const posX = node?.position?.x ?? 0;
    const posY = node?.position?.y ?? 0;
    const fieldIndex = mediaFields.findIndex((f) => Ss(f) === fieldKey);
    const newNodeId = `${id}-in-${fieldKey}-${Date.now()}`;

    let newNode: any;
    if (expectedType === 'audio') {
      newNode = {
        id: newNodeId,
        type: 'audioPlayerNode',
        position: { x: posX - 420, y: posY + Math.max(0, fieldIndex) * 240 },
        style: { width: 360, height: 220 },
        data: { audioUrl: blobUrl, audioName: file.name, label: file.name, hasChanged: true }
      };
    } else {
      newNode = {
        id: newNodeId,
        type: 'imageNode',
        position: { x: posX - 420, y: posY + Math.max(0, fieldIndex) * 280 },
        style: { width: 360, height: expectedType === 'video' ? 240 : 360 },
        data: { imageUrl: blobUrl, label: file.name, hasChanged: true }
      };
    }

    const newEdge = {
      id: `e-${newNodeId}-${id}`,
      source: newNodeId,
      sourceHandle: null,
      target: id,
      targetHandle: `var-${fieldKey}`
    };

    setNodes((nodes) => nodes.concat(newNode));
    setEdges((edges) => edges.concat(newEdge));
  }, [id, updateNodeData, uploadStatus, uploadError, getNode, mediaFields, setNodes, setEdges]);

  // Disconnect edge for a field
  const disconnectField = useCallback((fieldKey: string) => {
    setEdges((edges) => edges.filter((edge) => !(edge.target === id && edge.targetHandle === `var-${fieldKey}`)));
  }, [id, setEdges]);

  // Update a single field value
  const updateFieldValue = useCallback((fieldKey: string, value: string) => {
    updateNodeData(id, {
      values: {
        ...(nodeData.values || {}),
        [fieldKey]: value
      }
    });
  }, [id, updateNodeData, nodeData.values]);

  // Check if all media uploads are done
  const allMediaUploaded = useMemo(() => mediaFields.every((e) => uploadStatus[Ss(e)] === 'done'), [mediaFields, uploadStatus]);

  // Cancel polling
  const cancelPolling = useCallback(() => {
    cancelledRef.current = true;
    pollingTaskRef.current = null;
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Create result nodes from task results
  const createResultNodes = useCallback((results: Array<{ url?: string; text?: string; thumbnailUrl?: string; outputType?: string }>) => {
    const node = getNode(id);
    if (!node) return;

    const baseX = (node.position?.x ?? 0) + (node.width || 560) + 80;
    let baseY = node.position?.y ?? 0;
    const newNodes: any[] = [];
    const newEdges: any[] = [];

    results.forEach((result, index) => {
      const mediaType = js(result.url, result.outputType);
      const newNodeId = `${id}-out-${Date.now()}-${index}`;
      let nodeType: string;
      let nodeStyle: any;
      let nodeData: any;

      if (mediaType === 'image') {
        nodeType = 'imageNode';
        nodeStyle = { width: 360, height: 360 };
        nodeData = { imageUrl: result.url, thumbnailUrl: result.thumbnailUrl, label: `结果${index + 1}` };
      } else if (mediaType === 'video') {
        nodeType = 'imageNode';
        nodeStyle = { width: 360, height: 240 };
        nodeData = { imageUrl: result.url, thumbnailUrl: result.thumbnailUrl, label: `视频${index + 1}` };
      } else if (mediaType === 'audio') {
        nodeType = 'audioPlayerNode';
        nodeStyle = { width: 360, height: 220 };
        nodeData = { audioUrl: result.url, audioName: `音频${index + 1}`, label: `音频${index + 1}` };
      } else if (mediaType === 'text' || (!result.url && result.text)) {
        nodeType = 'textNode';
        nodeStyle = { width: 360, height: 200 };
        nodeData = { text: result.text || '', label: `文本${index + 1}`, expanded: true };
      } else {
        nodeType = 'textNode';
        nodeStyle = { width: 360, height: 120 };
        nodeData = { text: result.url || '', label: `结果${index + 1}`, expanded: true };
      }

      const newNode = {
        id: newNodeId,
        type: nodeType,
        position: { x: baseX, y: baseY },
        style: nodeStyle,
        data: { ...nodeData, hasChanged: true }
      };

      baseY += (nodeStyle?.height || 240) + 30;
      newNodes.push(newNode);
      newEdges.push({
        id: `e-${id}-${newNodeId}`,
        source: id,
        sourceHandle: null,
        target: newNodeId,
        targetHandle: null
      });
    });

    if (newNodes.length > 0) {
      setNodes((nodes) => nodes.concat(newNodes));
      setEdges((edges) => edges.concat(newEdges));
    }
  }, [getNode, id, setNodes, setEdges]);

  // Poll task status
  const pollTask = useCallback(async (taskId: string) => {
    if (pollingTaskRef.current === taskId) return;
    pollingTaskRef.current = taskId;
    cancelledRef.current = false;

    const startTime = Date.now();

    const poll = async () => {
      if (!cancelledRef.current) {
        if (Date.now() - startTime > 600000) {
          updateNodeData(id, {
            loading: false,
            status: 'FAILED',
            errorMessage: '任务轮询超时'
          });
          nodeData.updateGlobalTasks?.((tasks) => tasks.map((t: any) => t.taskId === taskId ? { ...t, status: 'failed', errorMsg: '任务轮询超时' } : t));
          pollingTaskRef.current = null;
          return;
        }

        try {
          const res = await fetch(rr(apiBaseUrl, `/task/${encodeURIComponent(taskId)}`), {
            headers: { Authorization: `Bearer ${apiKey}` }
          });
          const json = await res.json();
          if (!res.ok) throw Error(json?.error || `轮询失败 HTTP ${res.status}`);

          const status = String(json?.status || '').toUpperCase();

          if (status === 'SUCCESS') {
            const results = Array.isArray(json?.results) ? json.results : [];
            const finalPrice = json?.finalPrice == null ? null : Number(json.finalPrice);
            const consumeMoney = finalPrice != null && finalPrice > 0 ? String(finalPrice).replace(/\.?0+$/, '') : null;
            const taskCostTime = json?.usage?.taskCostTime ?? null;

            const resolveUrl = (url: string) => {
              if (!url) return '';
              return /^(https?:|data:|blob:)/i.test(url) ? url : `${apiBaseUrl.replace(/\/api\/?$/i, '').replace(/\/$/, '')}/${url.replace(/^\/+/, '')}`;
            };

            const processedResults = await Promise.all(results.map(async (result: any) => {
              const resolvedUrl = resolveUrl(String(result.url || '').trim().replace(/^`+|`+$/g, ''));
              if (!resolvedUrl) return { ...result, url: '' };

              const detectedType = js(resolvedUrl, result.outputType);
              if (detectedType === 'text' || /\.(txt|md|json|csv|log|xml|ya?ml|srt|vtt)(\?|$)/i.test(resolvedUrl)) {
                try {
                  const textRes = await fetch(resolvedUrl).catch(() => null);
                  if (textRes && textRes.ok) {
                    const text = await textRes.text();
                    return { ...result, url: '', text, outputType: 'text' };
                  }
                } catch (e) {
                  console.warn('Failed to fetch text file content', e);
                }
              }

              try {
                const stored = await Xr(resolvedUrl, {
                  subfolder: 'tasks',
                  generateThumb: detectedType === 'image',
                  thumbMaxDim: 480,
                  thumbQuality: 75
                });
                if (stored?.url) {
                  let thumbUrl = stored.thumbnailUrl;
                  if (!thumbUrl && detectedType === 'image') {
                    thumbUrl = (await ri(stored.url, { maxDim: 480, quality: 75 })) || undefined;
                  }
                  return { ...result, url: stored.url, thumbnailUrl: thumbUrl };
                }
                return { ...result, url: resolvedUrl };
              } catch {
                return { ...result, url: resolvedUrl };
              }
            }));

            updateNodeData(id, {
              loading: false,
              status: 'SUCCESS',
              consumeMoney: consumeMoney,
              finalPrice: finalPrice,
              taskCostTime: taskCostTime,
              lastResultTaskId: taskId
            });

            createResultNodes(processedResults);

            const addTransitResource = nodeData.addTransitResource;
            if (addTransitResource) {
              processedResults.forEach((result) => {
                if (!result?.url) return;
                const rType = js(result.url, result.outputType);
                const rCategory = rType === 'video' ? 'video' : rType === 'audio' ? 'audio' : rType === 'text' ? 'text' : 'image';
                addTransitResource(result.url, rCategory, 'generated');
              });
            }

            const firstResult = processedResults.find((r) => !!r?.url);
            const mainUrl = firstResult?.url || '';
            const mainThumb = firstResult?.thumbnailUrl;
            const mainType = js(mainUrl);
            const outputType = mainType === 'video' ? 'video' : mainType === 'audio' ? 'audio' : mainType === 'text' ? 'text' : 'image';

            nodeData.updateGlobalTasks?.((tasks) => tasks.map((t: any) => t.taskId === taskId ? {
              ...t,
              status: 'completed',
              progress: 100,
              resultUrl: mainUrl || t.resultUrl,
              thumbnailUrl: mainThumb || t.thumbnailUrl,
              customResultData: mainUrl || t.resultUrl,
              customOutputType: outputType,
              responseData: json
            } : t));

            pollingTaskRef.current = null;
            return;
          }

          if (status === 'FAILED') {
            const errorMsg = json?.errorMessage || json?.errorCode || '任务失败';
            updateNodeData(id, {
              loading: false,
              status: 'FAILED',
              errorMessage: errorMsg
            });
            nodeData.updateGlobalTasks?.((tasks) => tasks.map((t: any) => t.taskId === taskId ? { ...t, status: 'failed', errorMsg, responseData: json } : t));
            pollingTaskRef.current = null;
            return;
          }

          updateNodeData(id, {
            status: status === 'QUEUED' ? 'QUEUED' : 'RUNNING'
          });
          nodeData.updateGlobalTasks?.((tasks) => tasks.map((t: any) => t.taskId === taskId ? { ...t, status: 'running' } : t));
        } catch {}

        pollTimerRef.current = window.setTimeout(poll, 3000);
      }
    };

    pollTimerRef.current = window.setTimeout(poll, 1500);
  }, [id, apiBaseUrl, apiKey, updateNodeData, createResultNodes, nodeData.addTransitResource, nodeData.updateGlobalTasks]);

  // Run the app
  const handleRun = useCallback(async () => {
    if (nodeData.loading) return;

    if (!apiBaseUrl || !apiKey) {
      const msg = '请先登录以使用 AI 应用';
      updateNodeData(id, { errorMessage: msg });
      nodeData.onShowToast?.(msg);
      return;
    }

    if (!ys(nodeData.membershipType)) {
      const msg = 'AI 应用需要 VIP 或以上会员';
      updateNodeData(id, { errorMessage: msg });
      nodeData.onShowToast?.(msg);
      return;
    }

    if (!webappId) {
      const msg = '请先选择 AI 应用';
      updateNodeData(id, { errorMessage: msg });
      nodeData.onShowToast?.(msg);
      return;
    }

    if (!allMediaUploaded) {
      updateNodeData(id, {
        errorMessage: '存在未完成的文件上传，请等待打勾后再运行'
      });
      return;
    }

    updateNodeData(id, {
      loading: true,
      status: 'QUEUED',
      errorMessage: undefined,
      consumeMoney: null,
      finalPrice: null,
      taskCostTime: null,
      taskId: undefined
    });

    try {
      const nodeInfoList = schema.map((e) => {
        const fieldKey = Ss(e);
        let fieldValue = (nodeData.values || {})[fieldKey] ?? e.fieldValue ?? '';
        if (xs(e) === 'LIST') {
          fieldValue = Cs(String(fieldValue ?? ''), bs(e.fieldData));
        }
        const entry: any = {
          nodeId: e.nodeId,
          fieldName: e.fieldName,
          fieldValue: String(fieldValue ?? '')
        };
        if (e.description) {
          entry.description = e.description;
        }
        return entry;
      });

      const requestBody = {
        appId: webappId,
        instanceType: 'default',
        nodeInfoList: nodeInfoList
      };

      const res = await fetch(rr(apiBaseUrl, '/run'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      const json = await res.json();

      if (!res.ok) {
        throw res.status === 402
          ? Error('特惠币余额不足')
          : res.status === 403
            ? Error(json?.error || '需要 VIP 会员')
            : Error(json?.error || '发起任务失败');
      }

      const taskId = String(json?.taskId || json?.task_id || '');
      if (!taskId) throw Error('未拿到 taskId');

      if (json?.preDeducted != null) {
        updateNodeData(id, { preDeductAmount: Number(json.preDeducted) });
      }
      updateNodeData(id, { taskId, status: 'RUNNING' });

      const promptSummary = (() => {
        const parts: string[] = [];
        nodeInfoList.forEach((entry: any) => {
          const val = String(entry.fieldValue ?? '');
          if (!val) return;
          const display = val.length > 80 ? `${val.slice(0, 80)}…` : val;
          parts.push(`${entry.description || entry.fieldName}: ${display}`);
        });
        return parts.join(' | ');
      })();

      nodeData.updateGlobalTasks?.((tasks: any[]) => {
        const filtered = tasks.filter((t) => t.nodeId !== id || t.status === 'completed' || t.status === 'failed');
        return [{
          id: taskId,
          taskId,
          nodeId: id,
          type: 'rhWebapp',
          status: 'running',
          progress: 0,
          createdAt: Date.now(),
          prompt: promptSummary,
          channelName: `${APP_BRAND}应用`,
          modelName: `应用 · ${nodeData.webappName || webappId}`,
          requestData: requestBody
        }, ...filtered];
      });

      pollTask(taskId);
    } catch (err: any) {
      updateNodeData(id, {
        loading: false,
        status: 'FAILED',
        errorMessage: err?.message || '请求失败'
      });
      nodeData.onShowToast?.(err?.message || '请求失败');
    }
  }, [allMediaUploaded, apiBaseUrl, apiKey, id, nodeData.loading, nodeData.membershipType, nodeData.onShowToast, nodeData.updateGlobalTasks, nodeData.values, nodeData.webappName, pollTask, schema, updateNodeData, webappId]);

  // Listen for external run events
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.nodeId === id) {
        handleRun();
      }
    };
    return window.addEventListener(vs, handler), () => window.removeEventListener(vs, handler);
  }, [id, handleRun]);

  // Cleanup on unmount
  useEffect(() => () => cancelPolling(), [cancelPolling]);

  // Resume polling on mount if there's an active task
  const lastPolledTaskRef = useRef<string | null>(null);
  useEffect(() => {
    const taskId = nodeData.taskId;
    if (taskId && nodeData.status !== 'FAILED' && nodeData.lastResultTaskId !== taskId && lastPolledTaskRef.current !== taskId && pollingTaskRef.current !== taskId) {
      lastPolledTaskRef.current = taskId;
      pollTask(taskId);
    }
  }, [nodeData.taskId, nodeData.status, nodeData.lastResultTaskId, pollTask]);

  // Helper: compute step size for number inputs
  const getStepSize = (value: string | undefined, type: string): number => {
    const str = String(value ?? '').trim();
    if (!str) return type === 'FLOAT' ? 0.1 : 1;
    const dotIndex = str.indexOf('.');
    if (dotIndex === -1) return 1;
    return 10 ** -(str.length - dotIndex - 1);
  };

  // Render a single schema field
  const renderField = (field: SchemaField): React.ReactNode => {
    const fieldKey = Ss(field);
    const fieldType = xs(field);
    const fieldValue = values[fieldKey] ?? '';
    const fieldLabel = field.description || field.fieldName;

    const handle = (
      <CustomHandle
        type={`target`}
        id={`var-${fieldKey}`}
        position={Position.Left}
        variant={`small`}
        title={`连接到变量: ${fieldLabel}`}
        style={{ top: 18 }}
        ballOutset={10}
      />
    );

    const labelRow = (icon?: React.ReactNode, status?: string) => (
      <div className={`w-[120px] flex-shrink-0 pt-2 flex items-start gap-1 text-[12px] text-gray-200`}>
        {icon && <span className={`mt-[2px]`}>{icon}</span>}
        <span className={`font-medium leading-snug break-words`} title={fieldLabel}>{fieldLabel}</span>
        {status === 'uploading' && <Loader2 size={11} className={`animate-spin text-blue-400 ml-auto flex-shrink-0`} />}
        {status === 'done' && <Pn size={12} className={`text-green-400 ml-auto flex-shrink-0`} />}
        {status === 'error' && <AlertCircle size={12} className={`text-red-400 ml-auto flex-shrink-0`} />}
      </div>
    );

    // Media fields (IMAGE, VIDEO, AUDIO)
    if (['IMAGE', 'VIDEO', 'AUDIO'].includes(fieldType)) {
      const IconComponent = ws[fieldType] || Ot;
      const status = uploadStatus[fieldKey] || 'idle';
      const conn = connections.find((c) => c.targetHandle === `var-${fieldKey}`);
      const sourceNode = conn ? connectedNodeIds.find((nid) => nid === conn.source) : undefined;
      const sourceData = sourceNode ? getNode(conn.source)?.data : null;
      const mediaUrl = sourceData?.imageUrl || sourceData?.videoUrl || sourceData?.audioUrl || '';
      const expectedType = fieldType === 'IMAGE' ? 'image' : fieldType === 'VIDEO' ? 'video' : 'audio';
      const detectedType = js(mediaUrl);
      const displayType = detectedType === 'unknown' ? expectedType : detectedType;

      return (
        <div key={fieldKey} className={`flex flex-row items-start gap-3 nodrag`} style={{ position: 'relative' }}>
          {handle}
          {labelRow(<IconComponent size={13} className={`text-gray-400`} />, status)}
          <div className={`flex-1 min-w-0 flex`}>
            <div className={`relative flex-shrink-0`} style={{ width: 240, height: 240 }}>
              {conn || mediaUrl ? (
                <div className={`absolute inset-0 rounded-lg overflow-hidden border border-[#333] bg-black`}>
                  {mediaUrl && displayType === 'image' && (
                    <img src={mediaUrl} className={`w-full h-full object-contain`} />
                  )}
                  {mediaUrl && displayType === 'video' && (
                    <video src={mediaUrl} className={`w-full h-full object-contain bg-black`} controls={true} preload={`metadata`} />
                  )}
                  {mediaUrl && displayType === 'audio' && (
                    <div className={`absolute inset-0 flex items-center justify-center p-3`}>
                      <audio src={mediaUrl} controls={true} className={`w-full`} />
                    </div>
                  )}
                  {!mediaUrl && (
                    <div className={`absolute inset-0 flex items-center justify-center text-[11px] text-gray-500`}>
                      已连线，等待来源…
                    </div>
                  )}
                  {status === 'uploading' && (
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center`}>
                      <Loader2 size={26} className={`animate-spin text-white drop-shadow`} />
                    </div>
                  )}
                  {status === 'done' && (
                    <div className={`absolute top-1.5 right-1.5 bg-green-500/90 rounded-full p-1 shadow`}>
                      <Pn size={12} className={`text-white`} />
                    </div>
                  )}
                  {status !== 'uploading' && (
                    <button
                      className={`absolute top-1.5 left-1.5 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-1 shadow transition-colors`}
                      title={`断开连线`}
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnectField(fieldKey);
                      }}
                    >
                      <Unplug size={12} />
                    </button>
                  )}
                </div>
              ) : (
                <label className={`absolute inset-0 border border-dashed border-[#444] hover:border-blue-500 rounded-lg flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-blue-400 transition-colors text-[12px] gap-1.5 bg-[#0d0c0c]`}>
                  {status === 'error' ? (
                    <Fragment>
                      <AlertCircle size={20} className={`text-red-400`} />
                      <span>请重新选择</span>
                    </Fragment>
                  ) : (
                    <Fragment>
                      <Upload size={22} />
                      <span>{fieldType === 'IMAGE' ? '点击上传图片' : fieldType === 'VIDEO' ? '点击上传视频' : '点击上传音频'}</span>
                      <span className={`text-[10px] text-gray-600`}>或从左侧连线接入</span>
                    </Fragment>
                  )}
                  <input
                    type={`file`}
                    accept={fieldType === 'IMAGE' ? 'image/*' : fieldType === 'VIDEO' ? 'video/*' : 'audio/*,.flac,.aac,.opus,.m4a,.wma,.aiff'}
                    className={`hidden`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(fieldKey, file, fieldType);
                    }}
                  />
                </label>
              )}
            </div>
            {uploadError[fieldKey] && (
              <div className={`ml-2 text-red-400 text-[10px] flex items-start gap-1`}>
                <AlertCircle size={11} className={`mt-0.5`} />
                {' '}{uploadError[fieldKey]}
              </div>
            )}
          </div>
        </div>
      );
    }

    // LIST fields
    if (fieldType === 'LIST') {
      const options = bs(field.fieldData);
      const currentIndex = Cs(fieldValue, options);
      const currentOption = options.find((o) => o.index === currentIndex);
      const displayLabel = currentOption?.description || currentOption?.name || currentIndex || '请选择';
      const isOpen = dropdownOpen === fieldKey;

      return (
        <div key={fieldKey} className={`flex flex-row items-start gap-3 nodrag`} style={{ position: 'relative' }}>
          {handle}
          {labelRow()}
          <div className={`flex-1 min-w-0`}>
            <div className={`relative inline-flex max-w-full`}>
              <div onMouseDown={(e) => e.stopPropagation()}>
                <button
                  type={`button`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(isOpen ? null : fieldKey);
                  }}
                  className={`flex items-center gap-2 h-9 pl-3 pr-2 bg-[#0d0c0c] border rounded-full text-[12.5px] text-gray-100 hover:border-gray-500 transition-colors cursor-pointer max-w-full ${isOpen ? `border-blue-500` : `border-[#333]`}`}
                  title={displayLabel}
                >
                  <span className={`truncate`}>{displayLabel}</span>
                  <Sn size={14} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? `rotate-180` : ''}`} />
                </button>
                {isOpen && (
                  <div
                    className={`absolute top-full left-0 mt-1 min-w-[14rem] w-max max-w-[24rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-1.5 z-50 max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {options.length === 0 && (
                      <div className={`px-3 py-2 text-[12px] text-gray-500`}>无可选项</div>
                    )}
                    {options.map((opt) => {
                      const optLabel = opt.description || opt.name;
                      const isSelected = opt.index === currentIndex;
                      return (
                        <button
                          key={opt.index}
                          type={`button`}
                          onClick={() => {
                            updateFieldValue(fieldKey, opt.index);
                            setDropdownOpen(null);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[12.5px] transition-colors ${isSelected ? `bg-blue-500/15 text-blue-200` : `text-gray-200 hover:bg-white/[0.06]`}`}
                          title={optLabel}
                        >
                          <span className={`flex-1 min-w-0 truncate`}>{optLabel}</span>
                          {isSelected && <Pn size={13} className={`text-blue-300 shrink-0`} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // INT / FLOAT fields
    if (fieldType === 'INT' || fieldType === 'FLOAT') {
      const step = getStepSize(fieldValue, fieldType);
      const decimalPlaces = (() => {
        const stepStr = String(step);
        const dotIdx = stepStr.indexOf('.');
        return dotIdx === -1 ? 0 : stepStr.length - dotIdx - 1;
      })();

      const adjust = (delta: number) => {
        let newVal = (Number(fieldValue) || 0) + delta;
        newVal = fieldType === 'INT' ? Math.round(newVal) : Number(newVal.toFixed(decimalPlaces));
        updateFieldValue(fieldKey, String(newVal));
      };

      return (
        <div key={fieldKey} className={`flex flex-row items-start gap-3 nodrag`} style={{ position: 'relative' }}>
          {handle}
          {labelRow()}
          <div className={`flex-1 min-w-0`}>
            <div className={`inline-flex items-stretch h-10 rounded-md overflow-hidden border border-[#333] bg-[#0d0c0c]`} style={{ maxWidth: 220 }}>
              <button
                type={`button`}
                onClick={() => adjust(-step)}
                className={`px-3 hover:bg-[#222] text-gray-300 flex items-center justify-center border-r border-[#333]`}
                title={`-${step}`}
              >
                <Minus size={16} />
              </button>
              <input
                type={`number`}
                step={step}
                className={`rh-num-input bg-transparent text-center text-[13px] text-gray-100 outline-none w-[100px]`}
                value={fieldValue}
                onChange={(e) => updateFieldValue(fieldKey, e.target.value)}
              />
              <button
                type={`button`}
                onClick={() => adjust(step)}
                className={`px-3 hover:bg-[#222] text-gray-300 flex items-center justify-center border-l border-[#333]`}
                title={`+${step}`}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // BOOLEAN fields
    if (fieldType === 'BOOLEAN') {
      const isChecked = fieldValue === 'true' || fieldValue === '1';
      return (
        <div key={fieldKey} className={`flex flex-row items-start gap-3 nodrag`} style={{ position: 'relative' }}>
          {handle}
          {labelRow()}
          <div className={`flex-1 min-w-0 pt-1.5`}>
            <input
              type={`checkbox`}
              checked={isChecked}
              onChange={(e) => updateFieldValue(fieldKey, e.target.checked ? 'true' : 'false')}
              className={`w-5 h-5 accent-blue-500 cursor-pointer`}
            />
          </div>
        </div>
      );
    }

    // Default: TEXT field
    return (
      <div key={fieldKey} className={`flex flex-row items-start gap-3 nodrag`} style={{ position: 'relative' }}>
        {handle}
        {labelRow()}
        <div className={`flex-1 min-w-0`}>
          <textarea
            className={`w-full bg-[#0d0c0c] border border-[#333] rounded-md px-3 py-2 text-[13px] text-gray-100 outline-none focus:border-blue-500 custom-scrollbar resize-y nodrag nowheel min-h-[160px]`}
            placeholder={`输入 ${fieldLabel}...`}
            value={fieldValue}
            onChange={(e) => updateFieldValue(fieldKey, e.target.value)}
            onWheel={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    );
  };

  // App selector state
  const firstCover = nodeData.covers && nodeData.covers[0];
  const [appSelectorOpen, setAppSelectorOpen] = useState(false);
  const [appList, setAppList] = useState<any[]>([]);
  const [appListLoading, setAppListLoading] = useState(false);
  const [appListError, setAppListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (appSelectorOpen) {
      setCurrentPage(1);
      setSearchQuery('');
    }
  }, [appSelectorOpen]);

  useEffect(() => {
    if (nodeData.openAppSelectorOnMount) {
      setAppSelectorOpen(true);
      updateNodeData(id, { openAppSelectorOnMount: false });
    }
  }, [id, nodeData.openAppSelectorOnMount, updateNodeData]);

  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query ? appList.filter((app) => app.appName.toLowerCase().includes(query) || app.appId.includes(query)) : appList;
  }, [appList, searchQuery]);

  const pagedApps = useMemo(() => {
    const start = (currentPage - 1) * 10;
    return filteredApps.slice(start, start + 10);
  }, [filteredApps, currentPage]);

  const hasNextPage = currentPage * 10 < filteredApps.length;

  // Fetch app list when selector opens
  useEffect(() => {
    if (!appSelectorOpen || !apiBaseUrl || !apiKey) return;
    let cancelled = false;
    setAppListLoading(true);
    setAppListError(null);

    const url = new URL(ir(apiBaseUrl));
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', '100');

    fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) throw Error(json?.error || `加载应用列表失败 HTTP ${res.status}`);
        if (!cancelled) {
          setAppList(Array.isArray(json.items) ? json.items : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAppListError(err.message || '加载应用列表失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAppListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appSelectorOpen, apiBaseUrl, apiKey]);

  const handleSelectApp = useCallback((appId: string) => {
    loadSchema(appId, { resetValues: true });
    setAppSelectorOpen(false);
  }, [loadSchema]);

  const getAppTags = (app: any): string[] => {
    const tags = app.tags || [];
    return Array.isArray(tags) ? tags.map((t: any) => typeof t === 'string' ? t : t?.name || t?.tagName || '').filter(Boolean).slice(0, 3) : [];
  };

  // App selector portal
  const appSelectorPortal = appSelectorOpen ? createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 nowheel nopan nodrag`}
      onClick={() => setAppSelectorOpen(false)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`relative w-[58vw] h-[66vh] max-w-[1080px] min-w-[720px] bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center gap-4 px-5 h-14 border-b border-[#222]`}>
          <div className={`flex items-center gap-2 min-w-0`}>
            <div className={`w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center`}>
              <Nn size={16} className={`text-cyan-300`} />
            </div>
            <div className={`min-w-0`}>
              <div className={`text-sm text-white font-medium`}>应用市场</div>
            </div>
          </div>
          <button
            onClick={() => setAppSelectorOpen(false)}
            className={`ml-auto p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a] rounded-lg`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search bar */}
        <div className={`shrink-0 px-5 py-3 flex items-center gap-3 border-b border-[#1f1f1f]`}>
          <div className={`relative flex-1 max-w-md`}>
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
            <input
              type={`text`}
              className={`w-full pl-8 pr-3 py-2 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-200 placeholder:text-gray-600 focus:border-gray-500 outline-none`}
              placeholder={`搜索应用名称或 ID`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {webappId && (
            <div className={`text-[11px] text-gray-500 truncate`}>
              当前：<span className={`text-gray-300`}>{nodeData.webappName || webappId}</span>
            </div>
          )}
        </div>

        {/* App grid */}
        <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5`}>
          {apiKey ? (
            appListLoading ? (
              <div className={`h-full flex flex-col items-center justify-center gap-3 text-sm text-gray-500`}>
                <Loader2 size={34} />
                <span>加载应用中…</span>
              </div>
            ) : appListError ? (
              <div className={`h-full flex items-center justify-center text-sm text-red-400`}>
                {appListError}
              </div>
            ) : filteredApps.length === 0 ? (
              <div className={`h-full flex items-center justify-center text-sm text-gray-500`}>
                暂无已上架应用
              </div>
            ) : (
              <div className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4`}>
                {pagedApps.map((app) => {
                  const isSelected = app.appId === webappId;
                  const coverUrl = app.coverUrl || app.iconUrl || '';
                  const tags = getAppTags(app);
                  return (
                    <button
                      key={app.appId}
                      type={`button`}
                      onClick={() => handleSelectApp(app.appId)}
                      className={`group relative rounded-xl overflow-hidden bg-[#1a1a1a] border transition-all text-left ${isSelected ? `border-cyan-400/70 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]` : `border-transparent hover:border-white/30`}`}
                      title={app.appName || app.appId}
                    >
                      <div className={`relative aspect-[242/355] bg-[#0d0c0c] overflow-hidden`}>
                        {coverUrl ? (
                          /\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(coverUrl) ? (
                            <video src={coverUrl} autoPlay={true} loop={true} muted={true} playsInline={true} className={`w-full h-full object-cover`} />
                          ) : (
                            <img src={coverUrl} alt={app.appName || app.appId} className={`w-full h-full object-cover`} draggable={false} />
                          )
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center text-gray-700`}>
                            <Sparkles size={28} />
                          </div>
                        )}
                        <div className={`absolute inset-x-0 bottom-0 pt-16 px-2.5 pb-2.5 bg-gradient-to-t from-black via-black/75 to-transparent`}>
                          <p className={`text-[13px] text-white font-medium truncate drop-shadow`}>{app.appName || app.appId}</p>
                          {(tags.length > 0 || app.preDeductAmountDefault != null) && (
                            <div className={`mt-1.5 flex flex-wrap gap-1.5`}>
                              {tags.map((tag) => (
                                <span key={tag} className={`px-1.5 py-0.5 rounded bg-white/15 text-[10px] text-gray-200 backdrop-blur-sm`}>
                                  #{tag}
                                </span>
                              ))}
                              {app.preDeductAmountDefault != null && (
                                <span className={`px-1.5 py-0.5 rounded bg-yellow-400/15 text-[10px] text-yellow-100 backdrop-blur-sm`}>
                                  预计≈{app.preDeductAmountDefault} 特惠币
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <span className={`absolute top-2 right-2 w-6 h-6 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow`}>
                            <Pn size={14} />
                          </span>
                        )}
                        <div className={`absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center`}>
                          <span className={`px-3 py-1.5 rounded-lg bg-white text-xs text-black font-semibold`}>选择</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className={`h-full flex items-center justify-center text-sm text-amber-400`}>
              请先登录后选择应用
            </div>
          )}
        </div>

        {/* Pagination */}
        {apiKey && !appListLoading && !appListError && filteredApps.length > 0 && (
          <div className={`shrink-0 flex items-center justify-center gap-4 py-3 border-t border-[#1f1f1f] bg-[#141414]`}>
            <button
              type={`button`}
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className={`px-4 py-1.5 rounded-lg bg-[#2a2a2a] text-sm text-gray-300 hover:bg-[#333] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              上一页
            </button>
            <span className={`text-sm text-gray-500`}>第 {currentPage} 页</span>
            <button
              type={`button`}
              disabled={!hasNextPage}
              onClick={() => setCurrentPage((p) => p + 1)}
              className={`px-4 py-1.5 rounded-lg bg-[#2a2a2a] text-sm text-gray-300 hover:bg-[#333] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <Fragment>
      <div className={`flex flex-col items-center group/node transition-all ${selected ? `z-50` : `z-10`}`}>
        <NodeTitle
          id={id}
          data={nodeData}
          defaultTitle={`AI应用`}
          icon={<Sparkles size={11} className={`text-gray-500`} />}
        />
        <div
          className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 flex flex-row ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}
          style={{
            width: '100%',
            height: '100%',
            minWidth: 820,
            minHeight: 560,
            overflow: 'visible'
          }}
        >
          <ResizeController minWidth={820} minHeight={560} />
          <div className={`flex-1 min-w-0 flex flex-col`}>
            {/* Title bar */}
            <div className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 drag-handle cursor-move rounded-tl-xl`}>
              <span className={`font-semibold text-[13px] text-gray-100 flex-1 truncate`} title={nodeData.webappName}>
                {nodeData.webappName || 'AI应用'}
              </span>
              {webappId && (
                <button
                  className={`text-gray-400 hover:text-gray-100 hover:bg-[#2a2a2a] rounded p-1.5 nodrag`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAppSelectorOpen(true);
                  }}
                  title={`应用市场`}
                >
                  <Nn size={14} />
                </button>
              )}
            </div>

            {/* Schema fields area */}
            <div
              className={`flex-1 min-h-0 px-4 py-4 flex flex-col gap-4`}
              onWheel={(e) => e.stopPropagation()}
            >
              {nodeData.schemaLoading && (
                <div className={`flex items-center gap-2 text-xs text-gray-400 py-6 justify-center`}>
                  <Loader2 size={12} className={`animate-spin`} />
                  正在加载应用参数...
                </div>
              )}
              {nodeData.schemaError && (
                <div className={`text-red-400 text-[11px] p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`}>
                  <AlertCircle size={12} className={`mt-0.5`} />
                  <span>{nodeData.schemaError}</span>
                </div>
              )}
              {!nodeData.schemaLoading && !webappId && !nodeData.schemaError && (
                <div className={`flex-1 flex flex-col items-center justify-center gap-6 nodrag`}>
                  <div className={`flex flex-col items-center gap-3`}>
                    <button
                      type={`button`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAppSelectorOpen(true);
                      }}
                      className={`w-20 h-20 rounded-2xl bg-[#242424] border border-[#333] hover:border-cyan-400/60 hover:bg-[#2a2a2a] flex items-center justify-center text-gray-400 hover:text-cyan-300 transition-colors`}
                      title={`打开应用市场`}
                    >
                      <Nn size={32} />
                    </button>
                    <div className={`flex flex-col items-center gap-1.5`}>
                      <button
                        type={`button`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAppSelectorOpen(true);
                        }}
                        className={`text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a]`}
                      >
                        浏览应用
                      </button>
                    </div>
                  </div>
                  <div className={`text-sm text-gray-500`}>请选择 AI 应用开始创作</div>
                </div>
              )}
              {!nodeData.schemaLoading && schema.map(renderField)}
              {nodeData.errorMessage && (
                <div className={`text-red-400 text-[11px] p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`}>
                  <AlertCircle size={12} className={`mt-0.5`} />
                  <span className={`break-all`}>{nodeData.errorMessage}</span>
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div className={`flex-shrink-0 px-4 py-3 flex items-center justify-between gap-3 nodrag`}>
              {nodeData.loading ? (
                <div
                  className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333]`}
                  title={`停止`}
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelPolling();
                    updateNodeData(id, { loading: false, status: 'IDLE' });
                  }}
                >
                  <div className={`flex items-center gap-1 mr-3 text-xs text-gray-300`}>
                    {nodeData.status === 'QUEUED' ? '排队中' : '运行中…'}
                  </div>
                  <button className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors cursor-pointer`}>
                    <X size={10} fill={`currentColor`} />
                  </button>
                </div>
              ) : (
                <div
                  className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn ${!allMediaUploaded || nodeData.schemaLoading ? `opacity-50 cursor-not-allowed` : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!(!allMediaUploaded || nodeData.schemaLoading)) {
                      handleRun();
                    }
                  }}
                  title={allMediaUploaded ? '' : '等待文件上传完成'}
                >
                  <div className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>运行</div>
                  <button className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                    <Play size={12} fill={`currentColor`} />
                  </button>
                </div>
              )}
              {!nodeData.loading && (nodeData.taskCostTime != null || nodeData.consumeMoney != null || nodeData.preDeductAmount != null) && (
                <div className={`text-[12px] text-gray-400 tabular-nums text-right`}>
                  {nodeData.preDeductAmount != null && nodeData.loading === false && nodeData.consumeMoney == null && (
                    <span className={`mr-2`}>预计预扣 <span className={`text-yellow-300`}>{nodeData.preDeductAmount}</span> 特惠币</span>
                  )}
                  {(nodeData.taskCostTime != null || nodeData.consumeMoney != null) && (
                    <Fragment>
                      上次运行了 <span className={`text-gray-200`}>{nodeData.taskCostTime ?? '-'}</span> 秒，实扣{' '}
                      <span className={`text-yellow-300`}>{nodeData.consumeMoney ?? '-'} </span>特惠币
                    </Fragment>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar - cover image */}
          <div className={`flex-shrink-0 w-[312px] relative rounded-r-xl overflow-hidden bg-[#141414]`}>
            {firstCover && (
              <div className={`absolute inset-x-0 top-0`}>
                {/\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(firstCover.url || firstCover.thumbnailUri || '') ? (
                  <video
                    src={firstCover.url || firstCover.thumbnailUri}
                    className={`w-full h-auto block select-none`}
                    autoPlay={true}
                    loop={true}
                    muted={true}
                    playsInline={true}
                  />
                ) : (
                  <img
                    src={firstCover.url || firstCover.thumbnailUri}
                    className={`w-full h-auto block select-none`}
                    alt={`banner`}
                    draggable={false}
                  />
                )}
                <div className={`absolute inset-x-0 -bottom-1 h-[25%] bg-gradient-to-t from-[#141414] to-transparent pointer-events-none`} />
              </div>
            )}
            {firstCover && nodeData.loading && (
              <div className={`absolute inset-0 flex items-center justify-center bg-black/40 z-20`}>
                <Loader2 size={22} className={`animate-spin text-white drop-shadow`} />
              </div>
            )}
            {(nodeData.webappTags?.length || nodeData.webappDesc) && (
              <div className={`absolute inset-0 flex flex-col justify-end z-10 pointer-events-none opacity-0 group-hover/node:opacity-100 group-focus-within/node:opacity-100 transition-opacity duration-300`}>
                <div
                  className={`max-h-[75%] overflow-auto custom-scrollbar nowheel px-3 pt-14 pb-3 flex flex-col gap-2 nodrag pointer-events-auto bg-gradient-to-t from-black via-black/85 to-transparent`}
                  onWheel={(e) => e.stopPropagation()}
                >
                  {nodeData.webappTags && nodeData.webappTags.length > 0 && (
                    <div className={`flex flex-wrap gap-1`}>
                      {nodeData.webappTags.map((tag) => (
                        <span key={tag} className={`text-[10px] text-pink-200 bg-pink-500/20 rounded px-1.5 py-0.5`}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {nodeData.webappDesc && (
                    <div
                      className={`text-[12px] text-gray-100 leading-relaxed rh-app-desc`}
                      dangerouslySetInnerHTML={{ __html: As(nodeData.webappDesc.length > 30 ? nodeData.webappDesc.slice(0, 30) + '...' : nodeData.webappDesc) }}
                    />
                  )}
                </div>
              </div>
            )}
            {webappId && !firstCover && !nodeData.webappDesc && !nodeData.webappTags?.length && (
              <div className={`absolute inset-0 flex items-center justify-center text-gray-700 pointer-events-none`}>
                <Ot size={40} />
              </div>
            )}
          </div>

          <CustomHandle
            type={`source`}
            position={Position.Right}
            variant={`small`}
          />
        </div>
      </div>
      {appSelectorPortal}
    </Fragment>
  );
}

export default memo(RhWebappNode);