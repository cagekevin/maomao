import { StorageMigration } from './base';
import type { MigrationResult, ProjectRecord } from './transformers/types';
import { transformProjectV0ToV1 } from './transformers/v0-to-v1';

export class V0toV1Migration extends StorageMigration {
  from = 0;
  to = 1;

  // 返回形状复用 `transformers/types.ts` 的 `MigrationResult<T>`（唯一真源）——
  // 不再内联手抄 `{ project; skipped; reason? }`（TD-22-35：同一形状的第二份副本）。
  async transform(project: ProjectRecord): Promise<MigrationResult<ProjectRecord>> {
    return transformProjectV0ToV1({ project });
  }
}
