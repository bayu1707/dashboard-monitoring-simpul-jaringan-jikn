import { expect, type Page } from '@playwright/test';

/** Klik badge yang terlihat; keyboard memilih ID tepat ketika badge sah bertumpuk. */
export async function activateRegionBadge(page: Page, id: string) {
  const badge = page.locator(`[data-region-count-id="${id}"]`);
  await expect(badge).toBeVisible();
  const exposed = await badge.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      ?.closest('[data-region-count-id]') === element;
  });
  if (exposed) await badge.click();
  else { await badge.focus(); await page.keyboard.press('Enter'); }
}
