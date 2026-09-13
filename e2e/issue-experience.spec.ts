import { expect, test, type Page } from '@playwright/test'

const IDS = {
  userMe: 'user_me',
  stateProgress: 'state_progress',
  stateTodo: 'state_todo',
}

async function openAllIssues(page: Page) {
  await page.goto('/#/eng/all')
  await page.getByTestId('workspace-ready').waitFor()
  await page.waitForFunction(() => Boolean(window.__NOCK__))
}

async function issueState(page: Page, identifier: string) {
  return page.evaluate((id) => window.__NOCK__?.issueByIdentifier(id)?.stateId, identifier)
}

test.describe('core issue experience', () => {
  test('create issue', async ({ page }) => {
    await openAllIssues(page)
    await page.getByTestId('new-issue').click()
    await page.getByTestId('composer-title').fill('E2E created issue')
    await page.getByTestId('composer-create').click()
    await expect(page.getByTestId('issue-peek')).toBeVisible()
    await expect(page.getByTestId('issue-title')).toHaveValue('E2E created issue')
    await expect(page.getByTestId('optimistic-dot')).toHaveCount(0)
  })

  test('keyboard status change', async ({ page }) => {
    await openAllIssues(page)
    const row = page.locator('[data-testid^="issue-row-"]').first()
    const identifier = (await row.getAttribute('data-testid'))?.replace('issue-row-', '') ?? ''
    await row.click()
    await page.keyboard.press('t')
    await expect(page.getByTestId('searchable-picker')).toBeVisible()
    await page.getByTestId(`picker-option-${IDS.stateProgress}`).click()
    await expect.poll(() => issueState(page, identifier)).toBe(IDS.stateProgress)
  })

  test('board drag', async ({ page }) => {
    await page.goto('/#/eng/board')
    await page.getByTestId('workspace-ready').waitFor()
    await page.waitForFunction(() => Boolean(window.__NOCK__))
    const identifier = await page.evaluate((todo) => {
      const store = window.__NOCK__
      if (!store) return ''
      return (
        [...store.issues.values()].find(
          (issue) => issue.stateId === todo && !issue.archivedAt,
        )?.identifier ?? ''
      )
    }, IDS.stateTodo)
    expect(identifier).not.toBe('')
    const card = page.getByTestId(`board-card-${identifier}`)
    await card.scrollIntoViewIfNeeded()
    await card.dragTo(page.getByTestId(`board-column-${IDS.stateProgress}`), {
      force: true,
    })
    await expect.poll(() => issueState(page, identifier)).toBe(IDS.stateProgress)
  })

  test('multi-select', async ({ page }) => {
    await openAllIssues(page)
    const rows = page.locator('[data-testid^="issue-row-"]')
    await rows.nth(0).click()
    await rows.nth(1).click({ modifiers: ['ControlOrMeta'] })
    await expect(page.getByTestId('bulk-bar')).toBeVisible()
    await expect(page.getByTestId('bulk-bar')).toContainText('2 selected')
  })

  test('filter', async ({ page }) => {
    await openAllIssues(page)
    const before = Number(await page.getByTestId('issue-count').innerText())
    await page.getByTestId('filter-button').click()
    await page.getByTestId('filter-priority-1').click()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/priority=1/)
    const after = Number(await page.getByTestId('issue-count').innerText())
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(before)
  })

  test('saved view', async ({ page }) => {
    await openAllIssues(page)
    await page.getByTestId('filter-button').click()
    await page.getByTestId('filter-priority-1').click()
    await page.keyboard.press('Escape')
    await page.getByTestId('display-button').click()
    await page.getByTestId('save-view-name').fill('Mine')
    await page.getByTestId('save-view').click()
    await page.keyboard.press('Escape')
    await page.getByTestId('filter-button').click()
    await page.getByTestId('filter-priority-any').click()
    await page.keyboard.press('Escape')
    await expect(page).not.toHaveURL(/priority=1/)
    await page.getByTestId('display-button').click()
    await page.getByTestId('saved-view-Mine').click()
    await expect(page).toHaveURL(/priority=1/)
  })

  test('open issue', async ({ page }) => {
    await openAllIssues(page)
    const row = page.locator('[data-testid^="issue-row-"]').first()
    const identifier = (await row.getAttribute('data-testid'))?.replace('issue-row-', '') ?? ''
    await row.dblclick()
    await expect(page.getByTestId('issue-peek')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/${identifier}$`))
  })

  test('browser Back restores focus and scroll', async ({ page }) => {
    await openAllIssues(page)
    const list = page.getByTestId('issue-list')
    await list.evaluate((node) => {
      node.scrollTop = 240
      node.dispatchEvent(new Event('scroll'))
      const store = window.__NOCK__
      if (store) store.ui.listScrollTop = node.scrollTop
    })
    await expect
      .poll(async () => page.evaluate(() => window.__NOCK__?.ui.listScrollTop))
      .toBeGreaterThan(100)
    const scrolled = await list.evaluate((node) => node.scrollTop)
    const row = page.locator('[data-testid^="issue-row-"]').first()
    await row.dblclick()
    await expect(page.getByTestId('issue-peek')).toBeVisible()
    await page.goBack()
    await expect(page.getByTestId('issue-peek')).toHaveCount(0)
    await expect
      .poll(async () => list.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(scrolled - 40)
    await expect(page.locator('[data-testid^="issue-row-"][data-highlighted]')).toBeFocused()
  })

  test('offline mutation', async ({ page }) => {
    await openAllIssues(page)
    await page.evaluate(() => window.__NOCK__?.sync.setOnline(false))
    const row = page.locator('[data-testid^="issue-row-"]').first()
    const identifier = (await row.getAttribute('data-testid'))?.replace('issue-row-', '') ?? ''
    await row.dblclick()
    await page.getByTestId('issue-title').fill('Edited offline')
    await expect.poll(async () =>
      page.evaluate((id) => {
        const store = window.__NOCK__
        const issue = store?.issueByIdentifier(id)
        return issue ? store?.sync.statusForIssue(issue.id) : null
      }, identifier),
    ).toBe('queued')
    await page.evaluate(async () => window.__NOCK__?.flush())
    await page.reload()
    await page.getByTestId('workspace-ready').waitFor()
    await page.waitForFunction(() => Boolean(window.__NOCK__))
    await expect(page.getByTestId('issue-title')).toHaveValue('Edited offline')
    const persisted = await page.evaluate(
      (id) => window.__NOCK__?.issueByIdentifier(id)?.title,
      identifier,
    )
    expect(persisted).toBe('Edited offline')
  })

  test('list rows are 34px and board columns are 300px', async ({ page }) => {
    await openAllIssues(page)
    const row = page.locator('[data-testid^="issue-row-"]').first()
    const rowBox = await row.boundingBox()
    expect(Math.round(rowBox?.height ?? 0)).toBe(34)
    await page.goto('/#/eng/board')
    await page.getByTestId('workspace-ready').waitFor()
    const column = page.locator('[data-testid^="board-column-"]').first()
    const columnBox = await column.boundingBox()
    expect(Math.round(columnBox?.width ?? 0)).toBe(300)
  })
})
