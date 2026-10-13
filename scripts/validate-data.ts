import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  parseJson,
  parseReferenceData,
  parseSnapshotData,
} from '../src/services/validation';

const root = resolve(process.cwd());
const argument = process.argv[2];
const referenceArgument = process.argv[3];
const sources = argument
  ? [
      {
        snapshot: argument,
        references: referenceArgument ?? 'public/data/references.json',
      },
    ]
  : [
      {
        snapshot: 'public/data/snapshot.json',
        references: 'public/data/references.json',
      },
      {
        snapshot: 'public/demo/snapshot.json',
        references: 'public/demo/references.json',
      },
    ];
let failed = false;
for (const source of sources) {
  try {
    const references = parseReferenceData(
      parseJson(
        await readFile(resolve(root, source.references), 'utf8'),
        source.references,
      ),
    );
    const snapshot = parseSnapshotData(
      parseJson(
        await readFile(resolve(root, source.snapshot), 'utf8'),
        source.snapshot,
      ),
      references,
    );
    process.stdout.write(
      `Valid: ${source.snapshot}; ${snapshot.instansi.length} instansi; cakupan ${snapshot.metadata.coverage}; ${snapshot.metadata.datasetKind}\n`,
    );
  } catch (error) {
    failed = true;
    process.stderr.write(
      `${source.snapshot}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}
if (failed) process.exitCode = 1;
