import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseJson,
  parseReferenceData,
  parseSnapshotData,
} from '../../app/services/validation';
import type { ReferenceData, SnapshotData } from '../../app/types/domain';

/** Fixture opt-in membaca hanya data demo, terpisah dari dataset utama. */
export function makeFixture(): {
  references: ReferenceData;
  snapshot: SnapshotData;
} {
  const references = parseReferenceData(
    parseJson(
      readFileSync(resolve('../public/demo/references.json'), 'utf8'),
      'fixture referensi demo',
    ),
  );
  const snapshot = parseSnapshotData(
    parseJson(
      readFileSync(resolve('../public/demo/snapshot.json'), 'utf8'),
      'fixture snapshot demo',
    ),
    references,
  );
  return structuredClone({ references, snapshot });
}
