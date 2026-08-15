# 1mao-scripts/ —— 历史归档（只读参考）

本目录归档**1mao 逆向 / MV3 扩展 / 跨端契约扫描**时代的脚本，已不适用当前 `src/` 可维护原型。

- 这些脚本针对已不存在的 `src/bundle/`（混淆还原源码）、`dist/` MV3 扩展产物、`reference-1mao/` 逆向参考。
- **不在 `package.json` 的 npm scripts 中，默认不跑、不维护。**
- 仅作历史对照/排障参考。如需恢复长期复用，连同依赖移回 `scripts/` 根目录。

包含：`gen_bundle_map.cjs`（bundle 地图）、`_check_align.cjs`（改名对齐）、`verify-ext/chunks/features/common.cjs`（扩展真机验收）、`ai_ask.cjs`（逆向 ask 检索）、`contract_scan.cjs` + 契约字典、`check-build.cjs`/`safety-net.cjs`（dist 基线）、`clear-cache.cjs`/`sync-api-config.mjs`/`extract-range.cjs`（逆向辅助）、`rollback/`/`readable/`/`scriptbox-split-*/` 等。
