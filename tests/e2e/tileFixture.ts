import type { Page } from '@playwright/test';

/** Pengujian otomatis tidak mengunduh tile provider secara massal. */
export async function useFixtureTiles(page: Page) {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e7eef0"/></svg>',
  }));
}
