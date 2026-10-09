# ADR-0065 · 出站参考素材形态统一为内联 base64（cdn 回环妥协退役）

- **状态**：生效
- **结论**：本机 /files/ 媒体一律内联 data:base64（图片压≤1920 / 视频音频直读原字节）；禁再建 cdn 回环 / 形态分流。推翻 2026-09-20「lovart 分支保持原样给回环 URL」约定
- **日期**：2026-10-09
- **裁定人**：用户
- **触发**：TD-08-46 段①长尾根因＝lovart 参考图走「回环 URL → 请求自己下载」（无超时 / 未压缩）

## 背景

出站参考素材形态的**本体**一直是「内联 base64」（外部上游都读不到 localTool 本机 `127.0.0.1:18080/files/`）。
2026-09-20 那轮撤掉一个误建的 ADR-0050（「出站素材形态归属通道」）后，保留了一个**例外**：lovart 直连
adapter 跑在本机进程内，能自己去下载「回环 URL」，于是出站把本机图**补成 `http://127.0.0.1:18080/files/…`**
交给 adapter 自取，以**省一趟 base64 encode/decode**。当时的处置结论是「各出站分支**就地**决定，不设判据层」
（`daily/架构日志/01-跨区-出站素材假报错收口-2026-09-20.md §五`）。

## 判据（它凭什么成立 / 为什么不成立）

**它当初凭什么成立**：省一次本地 base64 编解码（CPU，毫秒级）。

**为什么不成立**（2026-10-09 取证，`TD-08-46`）：
- 这条「回环 URL」路径让 localTool **通过 HTTP 请求自己**把磁盘上已有的图重新拉一遍：
  `resolveLovartAttachments` 内 `await fetchImpl(u)` —— **无 `signal`/超时**，一旦被本机自身卡住会长时间挂起；
  且该分支**逐张串行**（`for + await`）、**不压缩**（对比 base64 路径压 ≤1920 ⇒ 上传大图）。
- 代价（一次**无超时**的 HTTP 回环 + 未压缩上传网络 I/O）**远大于**收益（本地 CPU 毫秒级）——**用网络成本省 CPU 成本，方向错**。
- 实证：段①（发送前本地耗时）`median 4.8s` 但 `max 249s`；子步骤样本里 attach 单张最高 46.5s —— 长尾根因落在此路径。
- 用户裁定原话：**「所有的网站都是直接内联 base64 的，就这么简单」**。
- 该妥协文件头自留的自检句——「如果这个妥协明天被去掉，我盖的楼还剩什么？」——答案：**什么都不剩**。

## 决议

**本机 `/files/` 媒体一律由唯一出口 `resolveLocalImages` 内联成 `data:` URL**：
- 图片：Jimp 压缩 ≤1920 后内联（`MAX_SEND_DIM` 跨栈双写，`check:arch` 守卫）；
- 视频 / 音频：直读原始字节内联（`extToKind` + `extToMime`，不压缩）—— 补上原 cdn 路径独有的「非图片能过」能力，且**所有通道**统一受益。

**整段删除**：`utils/resolveLocalImages.ts` 的 `RefFormat` / `refFormatOf` / `toLoopbackUrl` / `localPortOf` /
`resolveImagesForEgress`；`ai-relay/providers/lovart/lovart_attachments.ts` 的「回环下载」分支 + `isLoopbackHostname` /
`hostnameOf`；死字段 `LovartClientDeps.fetchImpl` / `LovartDirectProfile.fetchImpl` / `toDeps` 传递。

**落点**：`localTool/src/utils/resolveLocalImages.ts#fileToInlineBase64`（形态唯一出口）、
`relay-poll.ts#runDirectSubmit`、`generateEngine.ts`（chat 分支顶部算一次、两分支复用）、
`ai-relay/providers/lovart/lovart_attachments.ts#resolveLovartAttachments`。

## 后果

- ✅ 段①消除「请求自己」的 HTTP 回环；lovart 参考图出站链路 3 环节 → 2 环节；
  形态分叉 2 叶子 → 1 叶子；**视频/音频从「仅 lovart 能过」变为所有通道可过**。
- ⚠️ 代价 / 回潮风险：base64 在内存传递（图片压缩后可控；视频与改前回环下载**同量级**，非新增负担）。
  后人可能以「省一趟 encode/decode」为由**再建分流** —— 那正是本条要拦的。
- 📌 违反时的判据（怎么发现「又回去了」）：
  `grep -rn "resolveImagesForEgress\|toLoopbackUrl\|refFormatOf" localTool/src` → **应为 0**（注释里的留痕指针除外）；
  或出站分支里再次出现「把本机图补成 `127.0.0.1` URL 交下游自取」的形态。
