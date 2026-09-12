import { expect, test } from '@playwright/test'

test.describe('inbox triage and notifications', () => {
  test('accepts, snoozes, and switches notification panes', async ({ page }) => {
    await page.goto('/#/inbox')
    await page.getByTestId('workspace-ready').waitFor()
    await page.waitForFunction(() => Boolean(window.__NOCK__))
    await page.evaluate(() => {
      const store = window.__NOCK__
      if (!store) return
      const issue = store.createIssue({ title: 'E2E inbound', stateId: 'state_triage' })
      store.highlightIssue(issue.id)
    })
    await expect(page.getByTestId('inbox-pane-triage')).toBeVisible()
    await expect.poll(async () =>
      page.evaluate(() =>
        window.__NOCK__?.issuesForView('inbox').some((issue) => issue.title === 'E2E inbound'),
      ),
    ).toBe(true)
    const before = Number(await page.getByTestId('issue-count').innerText())
    expect(before).toBeGreaterThan(0)
    await page.keyboard.press('1')
    await expect.poll(async () => Number(await page.getByTestId('issue-count').innerText())).toBe(before - 1)

    await page.evaluate(() => {
      const store = window.__NOCK__
      if (!store) return
      const issue = store.createIssue({ title: 'E2E snooze', stateId: 'state_triage' })
      store.highlightIssue(issue.id)
    })
    await page.keyboard.press('h')
    await expect.poll(async () =>
      page.evaluate(() =>
        window.__NOCK__?.issuesForView('inbox').some((issue) => issue.title === 'E2E snooze'),
      ),
    ).toBe(false)

    await page.getByTestId('inbox-pane-priority').click()
    await expect(page.getByTestId('notification-inbox')).toBeVisible()
    await expect(page.locator('[data-testid^="inbox-row-"]').first()).toBeVisible()
    await page.getByTestId('inbox-pane-other').click()
    await expect(page.getByTestId('notification-inbox')).toBeVisible()
  })

  test('duplicate picker stays in the queue', async ({ page }) => {
    await page.goto('/#/inbox')
    await page.getByTestId('workspace-ready').waitFor()
    await page.waitForFunction(() => Boolean(window.__NOCK__))
    const canonicalId = await page.evaluate(() => {
      const store = window.__NOCK__
      if (!store) return ''
      const canonical = store.createIssue({ title: 'Canonical e2e', stateId: 'state_todo' })
      const incoming = store.createIssue({ title: 'Dup e2e', stateId: 'state_triage' })
      store.highlightIssue(incoming.id)
      return canonical.id
    })
    await page.keyboard.press('2')
    await expect(page.getByTestId('searchable-picker')).toBeVisible()
    await page.getByTestId(`picker-option-${canonicalId}`).click()
    await expect.poll(async () =>
      page.evaluate(() =>
        [...(window.__NOCK__?.issues.values() ?? [])].find((issue) => issue.title === 'Dup e2e')
          ?.duplicateOfId ?? null,
      ),
    ).toBe(canonicalId)
  })
})
