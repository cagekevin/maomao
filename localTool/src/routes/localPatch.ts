/**
 * 局部提取与图像融合 · 接口 handler（对齐 backend.py 契约）
 * ----------------------------------------------------------------------------
 * 三个接口：
 *   POST /api/local-patch/crop        —— 提取选区局部图 + 生成 cropContext
 *   POST /api/local-patch/merge       —— 把局部图拼回原图（羽化/颜色匹配/多图）
 *   POST /api/local-patch/fingerprint —— 源图 SHA-256 指纹 + 字节数
 *
 * 错误契约（docs/18 §5.5）：409 源变 / 400 校验 / 500 兜底。业务错误由
 * LocalPatchError 携带 status 透传，不留空、不吞错。落盘结果新文件，不覆盖源图。
 * 源 URL 解析复用 fileStore / handleThumbnail 范式（/files/{subfolder}/{name} → 磁盘）。
 *
 * ════════════════════════════【前端接入指引（前端版本 2026-08 曾撤回待重做）】════════════════════════════
 * 本后端已就绪、路由已注册、含单测（localTool/test/localPatch.test.js）。前端接入时：
 * 1) 接口：
 *    POST /api/local-patch/crop       { source_url, selection:{x,y,w,h,source_width,source_height}, padding_ratio?=0.1, crop_node_id? }
 *       → { file:{ url,name,kind:'image',natural_w,natural_h,cropContext } }
 *    POST /api/local-patch/merge      { original_url, patches:[{patch_url,crop_context}], color_match?=true }
 *       → { file:{ url,...,localPatchFullImage:true,localPatchContextReset:true }, warnings:[] }
 *    POST /api/local-patch/fingerprint { source_url } → { fingerprint, size }
 * 2) cropContext 是「局部图贴回原图位置」的记忆卡（结构见 utils/localPatchOps.ts 的 CropContext）：
 *    - 提取后 /crop 返回，随局部图节点 data.cropContext 保存；
 *    - 局部图经「任意生成节点」处理后，需把该 cropContext 继承到新生成图 data.cropContext
 *      （前端用 useLocalPatchInherit 一类 hook，从连线上游/参考图读继承），否则融合无法识别报「缺上下文」。
 * 3) 前端 API 封装建议：src/components/base/localPatchApi.js（cropLocal/mergeLocal/fingerprintLocal，经
 *    httpRequest + API_BASE，业务错不重试）；端点已在 src/components/base/contracts.(js|ts) 的 apiRegistry 登记
 *    （cropLocal/mergeLocal/fingerprintLocal，envelope:'code-data'，status:'ACTIVE'）。
 * 4) 常规流程：提取选区(建议 1:1 正方形, aspect=1) → 图生节点改局部(比例选 1:1) → 融合节点「原图+局部图」→开始融合。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Jimp from 'jimp';
import { getUploadDir } from '../db/database.js';
import { writeUploadBufferAt } from '../utils/fileStore.js';
import {
  LocalPatchError,
  cropLocalPatch,
  fileFingerprint,
  mergeLocalPatches,
  type CropContext,
} from '../utils/localPatchOps.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import { logTs } from '../utils/relayHeaders.js';
import { localToolBaseUrl } from '../utils/localToolBaseUrl.js';

const BASE_URL = localToolBaseUrl();

/** 局部提取与图像融合产物落盘目录（local-patch 子目录，docs/19 §2.2）。 */
const OUTPUT_SUBFOLDER = 'local-patch';

/** 留痕日志（对齐 files.ts 的 [upload]/[download] 风格，供「图丢了」溯源）。 */
const patchLog = (status: number, msg: string) =>
  console.log(`[local-patch] ${logTs()} | ${status} | ${msg}`);

/**
 * 源 URL → 磁盘绝对路径。
 * 兼容 /files/{subfolder}/{name}（相对）与 http://host/files/...（绝对）两种写法，
 * 统一落到 getUploadDir() 下，杜绝路径穿越。
 */
function sourceUrlToPath(sourceUrl: string): string {
  if (!sourceUrl) throw new LocalPatchError('缺少图片 URL（source_url）', 400);
  const clean = sourceUrl.replace(/^https?:\/\/[^/]+\//, '/'); // 绝对 http → / 前缀
  if (!clean.startsWith('/files/')) {
    throw new LocalPatchError(`图片 URL 非法：${sourceUrl}`, 400);
  }
  const relativePath = clean.replace(/^\/files\//, '');
  const filePath = path.join(getUploadDir(), relativePath);
  if (!filePath.startsWith(getUploadDir())) {
    throw new LocalPatchError('图片 URL 越界', 400);
  }
  if (!fs.existsSync(filePath)) {
    throw new LocalPatchError(`图片文件不存在：${sourceUrl}`, 404);
  }
  return filePath;
}

interface CropSelection {
  x: number;
  y: number;
  w: number;
  h: number;
  source_width?: number;
  source_height?: number;
}

/** POST /api/local-patch/crop —— 提取选区局部图。 */
export async function handleLocalPatchCrop(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const body = (await parseJsonBody(req)) as {
      source_url?: string;
      selection?: CropSelection;
      padding_ratio?: number;
      crop_node_id?: string;
    } | null;
    if (!body || !body.source_url || !body.selection) {
      throw new LocalPatchError('缺少 source_url 或 selection', 400);
    }
    const sel = body.selection;
    if ([sel.x, sel.y, sel.w, sel.h].some((v) => typeof v !== 'number' || !isFinite(v))) {
      throw new LocalPatchError('请选择有效裁剪区域', 400);
    }
    const filePath = sourceUrlToPath(body.source_url);
    const { img, cropContext } = await cropLocalPatch(
      filePath,
      { x: sel.x, y: sel.y, w: sel.w, h: sel.h },
      {
        paddingRatio: body.padding_ratio ?? 0.1,
        cropNodeId: body.crop_node_id,
        sourceUrl: body.source_url,
      },
    );

    const buf = await img.getBufferAsync(Jimp.MIME_PNG);
    const { urlPath } = writeUploadBufferAt(
      OUTPUT_SUBFOLDER,
      `local_crop_${cropContext.contextId}.png`,
      buf,
    );
    patchLog(200, `crop ${body.source_url} -> ${urlPath} rect=${sel.w}x${sel.h}`);

    return json(res, {
      code: 0,
      data: {
        file: {
          url: `${BASE_URL}${urlPath}`,
          name: path.basename(urlPath),
          kind: 'image',
          natural_w: cropContext.source.width,
          natural_h: cropContext.source.height,
          cropContext,
        },
      },
    });
  } catch (e) {
    if (e instanceof LocalPatchError) {
      patchLog(e.status, e.message);
      return sendError(res, e.message, e.status);
    }
    patchLog(500, (e as Error).message);
    return sendError(res, `裁剪失败：${(e as Error).message}`, 500);
  }
}

interface MergePatchBody {
  patch_url: string;
  crop_context: CropContext;
}

/** POST /api/local-patch/merge —— 局部图拼回原图。单/多图均可。 */
export async function handleLocalPatchMerge(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const body = (await parseJsonBody(req)) as {
      original_url?: string;
      patches?: MergePatchBody[];
      patch_url?: string;
      crop_context?: CropContext;
      color_match?: boolean;
    } | null;
    if (!body || !body.original_url) {
      throw new LocalPatchError('缺少 original_url', 400);
    }
    // 兼容单 patch：patches 缺省时用 patch_url+crop_context 归一为数组。
    let patches: MergePatchBody[];
    if (Array.isArray(body.patches) && body.patches.length > 0) {
      patches = body.patches;
    } else if (body.patch_url && body.crop_context) {
      patches = [{ patch_url: body.patch_url, crop_context: body.crop_context }];
    } else {
      throw new LocalPatchError('缺少局部图（patches 或 patch_url）', 400);
    }
    if (patches.some((p) => !p.patch_url || !p.crop_context)) {
      throw new LocalPatchError('存在缺少裁剪上下文的局部图，请重新提取选区', 400);
    }

    const originalPath = sourceUrlToPath(body.original_url);
    const mapped = patches.map((p) => ({
      patchPath: sourceUrlToPath(p.patch_url),
      cropContext: p.crop_context,
    }));

    const merged = await mergeLocalPatches(originalPath, mapped, {
      colorMatch: body.color_match ?? true,
    });

    const buf = await merged.getBufferAsync(Jimp.MIME_PNG);
    const hex = crypto.randomBytes(8).toString('hex');
    const { urlPath } = writeUploadBufferAt(OUTPUT_SUBFOLDER, `local_merge_${hex}.png`, buf);
    patchLog(200, `merge ${body.original_url} <- ${patches.length} patches -> ${urlPath}`);

    return json(res, {
      code: 0,
      data: {
        file: {
          url: `${BASE_URL}${urlPath}`,
          name: path.basename(urlPath),
          kind: 'image',
          localPatchFullImage: true,
          localPatchContextReset: true,
        },
        warnings: [],
      },
    });
  } catch (e) {
    if (e instanceof LocalPatchError) {
      patchLog(e.status, e.message);
      return sendError(res, e.message, e.status);
    }
    patchLog(500, (e as Error).message);
    return sendError(res, `融合失败：${(e as Error).message}`, 500);
  }
}

/** POST /api/local-patch/fingerprint —— 源图指纹 + 字节数。 */
export async function handleLocalPatchFingerprint(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const body = (await parseJsonBody(req)) as { source_url?: string } | null;
    if (!body || !body.source_url) {
      throw new LocalPatchError('缺少 source_url', 400);
    }
    const filePath = sourceUrlToPath(body.source_url);
    const fingerprint = await fileFingerprint(filePath);
    const size = fs.statSync(filePath).size;
    return json(res, { code: 0, data: { fingerprint, size } });
  } catch (e) {
    if (e instanceof LocalPatchError) {
      return sendError(res, e.message, e.status);
    }
    return sendError(res, `指纹计算失败：${(e as Error).message}`, 500);
  }
}
