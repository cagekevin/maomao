import { StorageMigration } from './base';
import type { MigrationResult, ProjectRecord } from './transformers/types';
import { transformProjectV2ToV3 } from './transformers/v2-to-v3';

export class V2toV3Migration extends StorageMigration {
  from = 2;
  to = 3;

  // 返回形状复用 `transformers/types.ts` 的 `MigrationResult<T>`（唯一真源，同 TD-22-35）。
  async transform(project: ProjectRecord): Promise<MigrationResult<ProjectRecord>> {
    return transformProjectV2ToV3({ project });
  }
}
