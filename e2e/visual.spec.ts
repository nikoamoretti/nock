import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const DIR = path.join('e2e', 'screenshots')

async function ready(page: Page) {
  await page.getByTestId('workspace-ready').waitFor()
  await page.waitForFunction(() => Boolean(window.__NOCK__))
}

async function shot(page: Page, name: string) {
  await mkdir(DIR, { recursive: true })
  await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage: true })
}

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.evaluate((next) => {
    document.documentElement.dataset.theme = next
    window.localStorage.setItem('nock.theme', next)
  }, theme)
}

test.describe('visual acceptance', () => {
  test('capture core surfaces', async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/nico/team/ENG/all')
    await ready(page)
    await setTheme(page, 'dark')
    await shot(page, 'list-1440-dark')

    await page.locator('[data-testid^="issue-row-"]').first().dblclick()
    await expect(page.getByTestId('issue-peek')).toBeVisible()
    await shot(page, 'peek-1440-dark')
    await page.keyboard.press('Escape')

    await page.getByTestId('filter-button').click()
    await page.locator('[data-testid^="filter-label-"]').first().click()
    await page.getByTestId('filter-priority-1').click()
    await shot(page, 'filters-1440-dark')
    await page.keyboard.press('Escape')
    await page.getByTestId('filter-button').click()
    await page.getByRole('button', { name: 'Clear' }).click()
    await page.keyboard.press('Escape')

    await page.goto('/nico/team/ENG/board')
    await ready(page)
    await shot(page, 'board-1440-dark')

    await page.goto('/nico/team/ENG/all')
    await ready(page)
    await page.keyboard.press('/')
    await page.getByTestId('workspace-search').fill('sync')
    await expect(page.locator('#workspace-search-results [role="option"]').first()).toBeVisible()
    await shot(page, 'search-1440-dark')
    await page.keyboard.press('Escape')

    await page.keyboard.press('Meta+k')
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
    await shot(page, 'palette-1440-dark')
    await page.keyboard.press('Escape')

    await page.keyboard.press('/')
    await page.getByTestId('workspace-search').fill('Sync contract')
    await page.getByRole('option', { name: 'Sync contract' }).click()
    await expect(page.getByTestId('document-page')).toBeVisible()
    await shot(page, 'document-1440-dark')

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/nico/team/ENG/all')
    await ready(page)
    await shot(page, 'list-1280-dark')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/nico/team/ENG/all')
    await ready(page)
    await shot(page, 'list-390-dark')

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/nico/team/ENG/all')
    await ready(page)
    await setTheme(page, 'light')
    await shot(page, 'list-1440-light')
  })
})
