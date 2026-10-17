import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { applyLandingPageMappings, verifiedLandingPageUrl } from '../src/services/landingPage';
import { parseJson, parseReferenceData, parseSnapshotData } from '../src/services/validation';

const [mappingArgument, snapshotArgument = '.local/casefile/snapshot.json', outputArgument = '.local/casefile/snapshot-with-landing-pages.json', referencesArgument = 'public/data/references.json'] = process.argv.slice(2);

try {
  if (!mappingArgument)
    throw new Error('Pemakaian: npx tsx scripts/import-landing-pages.ts mapping.json [snapshot.json] [output.json] [references.json]');
  const output = resolve(outputArgument);
  const localRelative = relative(resolve('.local'), output);
  if (!localRelative || localRelative.startsWith('..') || localRelative.startsWith('/'))
    throw new Error('Output harus berada di .local/ agar hasil review tidak masuk aset publik/Git.');
  if (output === resolve(snapshotArgument))
    throw new Error('Pilih output berbeda dari snapshot sumber; tinjau hasil sebelum mengaktifkannya.');
  const references = parseReferenceData(parseJson(await readFile(resolve(referencesArgument), 'utf8'), referencesArgument));
  const snapshot = parseSnapshotData(parseJson(await readFile(resolve(snapshotArgument), 'utf8'), snapshotArgument), references);
  const mapping = parseJson(await readFile(resolve(mappingArgument), 'utf8'), mappingArgument);
  const result = applyLandingPageMappings(snapshot, mapping);
  parseSnapshotData(result, references);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const verified = result.instansi.filter((record) => verifiedLandingPageUrl(record) !== null).length;
  process.stdout.write(`Pemetaan valid: ${verified} URL terverifikasi; ${result.instansi.length - verified} belum tersedia.\nHasil review lokal: ${output}\nSnapshot sumber tidak diubah.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
