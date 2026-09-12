import { expect, test } from '@playwright/test'

test.describe('planning', () => {
  test('projects timeline date field updates the bar', async ({ page }) => {
    await page.goto('/#/projects')
    await page.getByTestId('workspace-ready').waitFor()
    await page.waitForFunction(() => Boolean(window.__NOCK__))
    await page.getByTestId('timeline-layout').click()
    await expect(page.getByTestId('timeline-engine')).toBeVisible()
    await page.getByTestId('timeline-zoom-week').click()
    const start = page.locator('[data-testid^="timeline-start-"]').first()
    const testId = (await start.getAttribute('data-testid')) ?? ''
    const projectId = testId.replace('timeline-start-', '')
    await start.fill('2026-10-01')
    await expect.poll(async () =>
      page.evaluate((id) => {
        const startAt = window.__NOCK__?.projects.get(id)?.startAt
        return startAt ? new Date(startAt).toISOString().slice(0, 10) : ''
      }, projectId),
    ).toBe('2026-10-01')
  })

  test('current cycle shortcut and initiatives list', async ({ page }) => {
    await page.goto('/#/cycles/current')
    await page.getByTestId('workspace-ready').waitFor()
    await expect(page.getByText(/Cycle \d+/).first()).toBeVisible()
    await page.goto('/#/initiatives')
    await page.getByTestId('workspace-ready').waitFor()
    await expect(page.locator('header').filter({ hasText: 'Initiatives' })).toBeVisible()
    await expect(page.getByText(/Lens family|Local-first platform/)).toBeVisible()
  })
})
