import { expect, test, type Page } from '@playwright/test'

async function ready(page: Page) {
  await page.getByTestId('workspace-ready').waitFor()
  await page.waitForFunction(() => Boolean(window.__NOCK__))
}

test.describe('correction brief regressions', () => {
  test('legacy hash URLs keep filter queries', async ({ page }) => {
    await page.goto('/#/eng/all?priority=1')
    await ready(page)
    await expect(page).toHaveURL(/\/nico\/team\/ENG\/all/)
    await expect(page).toHaveURL(/priority=1|filter=/)
    await expect.poll(() =>
      page.evaluate(() => window.__NOCK__?.ui.filters.priority),
    ).toBe(1)
  })

  test('direct canonical team URL loads the list', async ({ page }) => {
    await page.goto('/nico/team/ENG/all')
    await ready(page)
    await expect(page.getByTestId('issue-count')).toBeVisible()
    await expect(page.locator('[data-testid^="issue-row-"]').first()).toBeVisible()
  })

  test('unknown workspace and team stay unavailable', async ({ page }) => {
    await page.goto('/ghost/inbox')
    await ready(page)
    await expect(page.getByTestId('scope-unavailable')).toBeVisible()
    await page.goto('/nico/team/ZZZ/all')
    await ready(page)
    await expect(page.getByTestId('scope-unavailable')).toBeVisible()
  })

  test('design team URL shows DES issues and workflow', async ({ page }) => {
    await page.goto('/nico/team/DES/all')
    await ready(page)
    await expect(page.getByText('Brand system for search empty state')).toBeVisible()
    await page.getByTestId('new-issue').click()
    await expect.poll(() =>
      page.evaluate(() => window.__NOCK__?.ui.composer.teamId),
    ).toBe('team_des')
  })

  test('search opens an issue from Projects with no selection', async ({ page }) => {
    await page.goto('/nico/projects')
    await ready(page)
    const identifier = await page.evaluate(() => {
      const store = window.__NOCK__
      if (!store) return ''
      store.selectIssue(null)
      const issue = store.createIssue({
        title: 'ZZZ search target from projects',
        stateId: 'state_todo',
      })
      return issue.identifier
    })
    await page.keyboard.press('/')
    await page.getByTestId('workspace-search').fill('ZZZ search target from projects')
    await page.getByTestId('workspace-search').press('Enter')
    await expect(page.getByTestId('issue-title')).toHaveValue(
      'ZZZ search target from projects',
    )
    await expect(page).toHaveURL(new RegExp(`/nico/issue/${identifier}`))
  })

  test('search opens the Sync contract document', async ({ page }) => {
    await page.goto('/nico/projects')
    await ready(page)
    await page.keyboard.press('/')
    await page.getByTestId('workspace-search').fill('Sync contract')
    await page.getByRole('option', { name: 'Sync contract' }).click()
    await expect(page.getByTestId('document-page')).toBeVisible()
    await expect(page.getByTestId('document-title')).toHaveText('Sync contract')
    await expect(page.getByTestId('document-body')).toContainText('IndexedDB')
  })

  test('search keyboard order follows rendered groups', async ({ page }) => {
    await page.goto('/nico/team/ENG/all')
    await ready(page)
    await page.keyboard.press('/')
    await page.getByTestId('workspace-search').fill('sync')
    const order = await page.evaluate(() => {
      const store = window.__NOCK__
      if (!store) return [] as string[]
      const rows = store.searchDocuments('sync')
      const grouped = ['issue', 'project', 'document'].flatMap((type) =>
        rows.filter((row) => row.type === type).map((row) => `${row.type}:${row.id}`),
      )
      return grouped
    })
    expect(order.length).toBeGreaterThan(1)
    const firstOption = page.locator('#workspace-search-results [role="option"]').first()
    await expect(firstOption).toHaveAttribute(
      'id',
      `search-option-${order[0]}`,
    )
    await page.getByTestId('workspace-search').press('ArrowDown')
    if (order[1]) {
      await expect(
        page.locator('#workspace-search-results [role="option"]').nth(1),
      ).toHaveAttribute('aria-selected', 'true')
    }
  })

  test('label plus priority filters both remain', async ({ page }) => {
    await page.goto('/nico/team/ENG/all')
    await ready(page)
    await page.getByTestId('filter-button').click()
    const label = page.locator('[data-testid^="filter-label-"]').first()
    await expect(label).toBeVisible()
    await label.click()
    await page.getByTestId('filter-priority-1').click()
    await expect.poll(() =>
      page.evaluate(() => {
        const ast = window.__NOCK__?.ui.filterAst
        return ast ? JSON.stringify(ast) : ''
      }),
    ).toContain('labelId')
    await expect.poll(() => page.evaluate(() => window.__NOCK__?.ui.filters.priority)).toBe(1)
  })

  test('background issue shortcuts do not fire while search is open', async ({
    page,
  }) => {
    await page.goto('/nico/team/ENG/all')
    await ready(page)
    await page.keyboard.press('/')
    await page.getByTestId('workspace-search').fill('sync')
    await page.locator('#workspace-search-results [role="option"]').first().focus()
    await page.keyboard.press('c')
    await expect(page.getByTestId('composer-title')).toHaveCount(0)
    await expect(page.getByTestId('workspace-search')).toBeVisible()
  })
})
