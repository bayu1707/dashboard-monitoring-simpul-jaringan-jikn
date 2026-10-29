import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type {
  InstansiDetail,
  Metric,
  ReferenceData,
  SnapshotData,
} from '../../app/types/domain';

type Mode = 'pilot' | 'excel' | 'demo';
const read = <T>(path: string): T =>
  JSON.parse(readFileSync(resolve('../public', path), 'utf8')) as T;
const files: Record<Mode, { references: string; snapshot: string }> = {
  pilot: {
    references: 'data/datasets/pilot/references.json',
    snapshot: 'data/datasets/pilot/snapshot.json',
  },
  excel: {
    references: 'data/references.json',
    snapshot: 'data/datasets/excel/snapshot.json',
  },
  demo: { references: 'demo/references.json', snapshot: 'demo/snapshot.json' },
};

/** Fixture hanya pada browser tests: bukan server/API pengganti untuk aplikasi produksi. */
export async function useApiFixture(page: Page) {
  const sources = new Map<
    Mode,
    { references: ReferenceData; snapshot: SnapshotData }
  >();
  const load = (mode: Mode) => {
    let value = sources.get(mode);
    if (!value) {
      value = {
        references: read<ReferenceData>(files[mode].references),
        snapshot: read<SnapshotData>(files[mode].snapshot),
      };
      sources.set(mode, value);
    }
    return value;
  };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const mode = (url.searchParams.get('mode') ?? 'pilot') as Mode;
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Accept, Content-Type',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (!files[mode]) {
      await route.fulfill({
        status: 422,
        headers,
        json: { message: 'Mode tidak valid.' },
      });
      return;
    }
    const { references, snapshot } = load(mode);
    const path = decodeURIComponent(url.pathname.replace(/^\/api\/v1\//, ''));
    let body: unknown;
    let status = 200;
    if (path === 'reference-data') body = { data: references };
    else if (path === 'institutions') {
      let items = snapshot.instansi;
      for (const field of ['provinceId', 'kabKotaId', 'jenisId'] as const) {
        const value = url.searchParams.get(field);
        if (value) items = items.filter((item) => item[field] === value);
      }
      const search = url.searchParams.get('search')?.toLocaleLowerCase('id');
      if (search) items = items.filter(item => `${item.name} ${item.kode ?? ''}`.toLocaleLowerCase('id').includes(search));
      const perPage = Math.min(
        250,
        Math.max(1, Number(url.searchParams.get('per_page') ?? '250')),
      );
      const number = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
      body = {
        data: items.slice((number - 1) * perPage, number * perPage),
        metadata: snapshot.metadata,
        meta: {
          total: items.length,
          page: number,
          perPage,
          lastPage: Math.max(1, Math.ceil(items.length / perPage)),
        },
      };
    } else if (path.startsWith('institutions/')) {
      const id = path.slice('institutions/'.length);
      const instansi = snapshot.instansi.find((item) => item.id === id);
      if (!instansi) {
        status = 404;
        body = { message: 'Instansi tidak ditemukan.' };
      } else {
        const unknown = (definition: string): Metric => ({
          value: null,
          definition,
          scope: snapshot.metadata.id,
          snapshotId: snapshot.metadata.id,
          referenceDate: snapshot.metadata.referenceDate,
        });
        const record = snapshot.statistics.find(
          (item) => item.instansiId === id,
        );
        const detail: InstansiDetail = {
          instansi,
          metadata: snapshot.metadata,
          statistik: record?.statistik ?? {
            jumlahArsip: unknown('Jumlah arsip'),
            penciptaArsip: unknown('Pencipta arsip'),
            kopiDigital: unknown('Kopi digital'),
          },
          trenInput: record?.trenInput ?? null,
          distribusiArsip: record?.distribusiArsip ?? null,
          penciptaArsip: record?.penciptaArsip ?? null,
          multiCreator: record?.multiCreator ?? null,
          monthlyAdded: record?.monthlyAdded ?? null,
        };
        body = { data: detail };
      }
    } else if (path.startsWith('geometry/')) {
      const provinceId = path.slice('geometry/'.length);
      if (!references.provinces.some((region) => region.id === provinceId)) {
        status = 404;
        body = { message: 'Wilayah tidak ditemukan.' };
      } else body = read(`data/geometry/kab-kota/${provinceId}.json`);
    } else {
      status = 404;
      body = { message: 'Route fixture tidak ditemukan.' };
    }
    await route.fulfill({ status, headers, json: body });
  });
  // Tile deterministik menjaga pengujian interaksi tidak bergantung koneksi provider.
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dcebf1"/><path d="M0 0L256 256M256 0L0 256" stroke="#c5d8e3"/></svg>',
    }),
  );
}

export async function openFixtureMap(
  page: Page,
  path = '/simpul-jaringan?demo=1',
) {
  await page.goto(path);
  // SSR memakai Laravel nyata. Bila backend belum hidup, retry di client adalah
  // titik masuk fixture Playwright yang tidak dapat mengintersep fetch server SSR.
  const retry = page.getByRole('button', { name: 'Coba lagi', exact: true });
  if (await retry.isVisible().catch(() => false)) await retry.click();
  await expect(page.locator('.map-canvas.leaflet-container')).toBeVisible();
  await waitForMapMotion(page);
}

export async function waitForMapMotion(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect
    .poll(async () => {
      const pane = page.locator('.leaflet-map-pane');
      const before = await pane.evaluate(
        (element) => getComputedStyle(element).transform,
      );
      await page.waitForTimeout(100);
      return (
        before ===
        (await pane.evaluate((element) => getComputedStyle(element).transform))
      );
    })
    .toBe(true);
}

export async function activateRegionBadge(page: Page, id: string) {
  const badge = page.locator(`[data-region-count-id="${id}"]`);
  await expect(badge).toBeVisible();
  const exposed = await badge.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return (
      document
        .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        ?.closest('[data-region-count-id]') === element
    );
  });
  if (exposed) await badge.click();
  else {
    await badge.focus();
    await page.keyboard.press('Enter');
  }
  await waitForMapMotion(page);
}

export async function unfoldDemoMarkers(page: Page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    if (await page.locator('[data-instansi-id="demo-a"]').count()) break;
    await page.locator('.instansi-cluster').first().click();
    await waitForMapMotion(page);
  }
  await expect(page.locator('[data-instansi-id="demo-a"]')).toBeVisible();
  await expect(page.locator('[data-instansi-id="demo-b"]')).toBeVisible();
}
