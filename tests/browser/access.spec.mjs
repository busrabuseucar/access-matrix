import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('real sessions deny forged roles and cross-organization access',async({page})=>{
 await page.goto('/');await expect(page.locator('#http-status')).toHaveText('401');
 await page.locator('[data-scenario="viewer-export"]').click();await expect(page.locator('#http-status')).toHaveText('403');
 await page.locator('#spoof').check();await page.locator('#send').click();await expect(page.locator('#http-status')).toHaveText('403');
 expect(JSON.parse(await page.locator('#response-json').innerText()).data).toBeUndefined();
 await page.locator('[data-scenario="foreign-org"]').click();await expect(page.locator('#http-status')).toHaveText('404');
 await page.locator('#action').selectOption('report');await page.locator('#send').click();await expect(page.locator('#http-status')).toHaveText('200');
 expect(JSON.parse(await page.locator('#response-json').innerText()).data).toEqual({organization:'atlas',totalDocuments:3,published:1,drafts:2});
});
test('owner export downloads the actual allowed document and logout revokes browser access',async({page,context})=>{
 await page.goto('/');await expect(page.locator('#http-status')).toHaveText('401');
 await page.locator('[data-scenario="owner-draft"]').click();await expect(page.locator('#http-status')).toHaveText('200');
 await page.locator('#action').selectOption('export');await expect(page.locator('#download')).toBeDisabled();
 await page.locator('#send').click();await expect(page.locator('#http-status')).toHaveText('200');
 const pending=page.waitForEvent('download');await page.locator('#download').click();const downloaded=await pending;
 const record=JSON.parse(await readFile(await downloaded.path(),'utf8'));expect(record.id).toBe('atlas-draft');expect(record.ownerId).toBe('ece');
 const cookie=(await context.cookies()).find(c=>c.name==='am_demo_session');expect(cookie.httpOnly).toBe(true);expect(cookie.sameSite).toBe('Strict');
 expect(await page.evaluate(()=>document.cookie)).not.toContain('am_demo_session');
 await page.reload();await expect(page.locator('#session-label')).toContainText('Ece');
 await page.locator('[data-actor="anonymous"]').click();await page.locator('#send').click();await expect(page.locator('#http-status')).toHaveText('401');
 expect((await context.cookies()).some(c=>c.name==='am_demo_session')).toBe(false);
});
