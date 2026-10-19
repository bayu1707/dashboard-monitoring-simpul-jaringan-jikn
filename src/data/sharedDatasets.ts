/** Path aset relatif terhadap origin, sama untuk dev, build dan preview.
 * validate:shared memeriksa kecocokannya dengan manifest rilis.
 */
export const SHARED_DATASETS = {
  pilot: {
    snapshot: '/data/datasets/pilot/snapshot.json',
    references: '/data/datasets/pilot/references.json',
  },
  excel: {
    snapshot: '/data/datasets/excel/snapshot.json',
    references: '/data/references.json',
  },
} as const;
