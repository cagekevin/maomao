/**
 * 视频输出分辨率档位（**唯一真源** · TD-22-71）。
 *
 * 【为什么在共享层】该词表被视频域**两个节点**消费、且用途不同：
 *   · `VideoProcessNode`（尺寸帧率）需要「档位 → 像素」（854×480 等本地缩放目标）；
 *   · `VideoGenerate` 只把档位**透传给生成接口**（实际像素由模型／后端决定）。
 * 改前两处各自手写同一份清单（`SIZE_PRESETS` 裸数组 + `resOptions` 裸数组）⇒ 增删档位必漏一处。
 *
 * 【与「图像画质档位」的区别】**非同一判据**：`agent/canvas` 的 720p/1080p/2K/4K 会归一映射到
 * 1K/2K/4K（生图 `imageSize`），是另一套语义，不并入本清单。
 */
export type VideoResolution = '480p' | '720p' | '1080p';

/** 档位清单（数组顺序 = UI 展示顺序）。新增档位只改此处；漏改消费方 ⇒ 编译报错。 */
export const VIDEO_RESOLUTIONS: readonly VideoResolution[] = ['480p', '720p', '1080p'];
