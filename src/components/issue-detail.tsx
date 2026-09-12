import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn, formatShortDate } from '../lib/cn'
import { issueFullPath } from '../lib/paths'
import { renderRichText } from '../lib/rich-text'
import type { Issue } from '../lib/types'
import { PriorityIcon, StatusIcon } from './icons'
import { Avatar } from './picker'

export function IssueDetailPage() {
  const store = useNock()
  const { identifier } = useParams()
  const issue = identifier ? store.issueByIdentifier(identifier) : undefined
  if (!issue) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-mute">
        Issue not found
      </div>
    )
  }
  return <IssueDetail issue={issue} mode="page" />
}

export function IssuePeek() {
  const store = useNock()
  const issue = store.peekedIssue()
  if (!issue) return null
  return <IssueDetail issue={issue} mode="peek" />
}

export function IssueDetail({
  issue,
  mode,
}: {
  issue: Issue
  mode: 'peek' | 'page'
}) {
  const store = useNock()
  const navigate = useNavigate()
  const state = store.states.get(issue.stateId)
  const assignee = issue.assigneeId ? store.users.get(issue.assigneeId) : undefined
  const project = issue.projectId ? store.projects.get(issue.projectId) : undefined
  const cycle = issue.cycleId ? store.cycles.get(issue.cycleId) : undefined
  const parent = issue.parentId ? store.issue(issue.parentId) : undefined
  const children = store.childIssues(issue.id)
  const comments = store.commentsForIssue(issue.id)
  const activities = store.activitiesForIssue(issue.id)
  const links = store.linksForIssue(issue.id)
  const [comment, setComment] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [editingDescription, setEditingDescription] = useState(!issue.description)
  const triage = state?.type === 'triage'

  return (
    <section
      data-testid={mode === 'peek' ? 'issue-peek' : 'issue-page'}
      className={cn(
        'flex min-h-0 flex-col bg-fill',
        mode === 'peek' ? 'w-[420px] shrink-0 border-l border-line' : 'flex-1',
      )}
    >
      <div className="flex h-11 items-center justify-between border-b border-line px-3">
        <span className="text-[12px] text-mute">{issue.identifier}</span>
        <div className="flex items-center gap-1">
          {triage && (
            <>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
                onClick={() => store.commands.run('issue.acceptTriage')}
              >
                Accept
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
                onClick={() => store.commands.run('issue.duplicateTriage')}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
                onClick={() => store.commands.run('issue.declineTriage')}
              >
                Decline
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
                onClick={() => store.commands.run('issue.snoozeTriage')}
              >
                Snooze
              </button>
            </>
          )}
          {mode === 'peek' && (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
              onClick={() => navigate(issueFullPath(issue.identifier))}
            >
              Full view
            </button>
          )}
          {mode === 'peek' && (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
              onClick={() => store.commands.run('surface.dismiss')}
            >
              Close
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <input
          data-testid="issue-title"
          value={issue.title}
          onChange={(event) =>
            store.execute({
              type: 'issue.update',
              id: issue.id,
              patch: { title: event.target.value },
            })
          }
          className="w-full bg-transparent text-[18px] font-medium outline-none"
        />
        {editingDescription ? (
          <textarea
            data-testid="issue-description"
            value={issue.description}
            onChange={(event) =>
              store.execute({
                type: 'issue.update',
                id: issue.id,
                patch: { description: event.target.value },
              })
            }
            onBlur={() => setEditingDescription(false)}
            placeholder="Add description… **bold**, `code`, [link](url)"
            rows={8}
            className="mt-3 w-full resize-y bg-transparent text-[13px] leading-6 text-ink outline-none placeholder:text-dim"
          />
        ) : (
          <button
            type="button"
            className="mt-3 w-full text-left text-[13px] leading-6 text-ink"
            onClick={() => setEditingDescription(true)}
          >
            {issue.description ? (
              renderRichText(issue.description)
            ) : (
              <span className="text-dim">Add description…</span>
            )}
          </button>
        )}

        <dl className="mt-6 space-y-2 text-[13px]">
          <PeekRow label="Status" onClick={() => store.commands.run('issue.setStatus')}>
            {state && <StatusIcon state={state} />}
            {state?.name}
          </PeekRow>
          <PeekRow label="Assignee" onClick={() => store.commands.run('issue.setAssignee')}>
            {assignee ? (
              <>
                <Avatar user={assignee} /> {assignee.name}
              </>
            ) : (
              <span className="text-dim">Unassigned</span>
            )}
          </PeekRow>
          <PeekRow label="Priority" onClick={() => store.commands.run('issue.setPriority')}>
            <PriorityIcon priority={issue.priority} />
          </PeekRow>
          <PeekRow label="Project" onClick={() => store.commands.run('issue.setProject')}>
            {project?.name ?? <span className="text-dim">None</span>}
          </PeekRow>
          <PeekRow label="Cycle" onClick={() => store.commands.run('issue.setCycle')}>
            {cycle ? `Cycle ${cycle.number}` : <span className="text-dim">None</span>}
          </PeekRow>
          <PeekRow label="Labels" onClick={() => store.commands.run('issue.addLabel')}>
            {issue.labelIds.length ? `${issue.labelIds.length}` : <span className="text-dim">None</span>}
          </PeekRow>
          <PeekRow label="Milestone" onClick={() => store.commands.run('issue.setMilestone')}>
            {issue.milestoneId
              ? (store.milestones.get(issue.milestoneId)?.name ?? 'Milestone')
              : <span className="text-dim">None</span>}
          </PeekRow>
          <div className="flex items-center justify-between py-1 text-mute">
            <dt>Created</dt>
            <dd>{formatShortDate(issue.createdAt)}</dd>
          </div>
        </dl>

        <Section title="Parent / sub-issues">
          <div className="text-[13px] text-mute">
            {parent ? (
              <button
                type="button"
                className="hover:text-ink"
                onClick={() => store.commands.run('issue.open', { id: parent.id })}
              >
                Parent {parent.identifier} {parent.title}
              </button>
            ) : (
              'No parent'
            )}
          </div>
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              className="mt-1 block text-[13px] text-mute hover:text-ink"
              onClick={() => store.commands.run('issue.open', { id: child.id })}
            >
              {child.identifier} {child.title}
            </button>
          ))}
          <button
            type="button"
            className="mt-2 text-[12px] text-accent"
            onClick={() => store.commands.run('issue.createSubissue')}
          >
            Add sub-issue
          </button>
        </Section>

        <Section title="Relations">
          <div className="space-y-1 text-[13px] text-mute">
            {issue.relatedIssueIds.map((id) => (
              <div key={id}>{store.issue(id)?.identifier ?? id}</div>
            ))}
            {issue.blockedByIds.map((id) => (
              <div key={id}>Blocked by {store.issue(id)?.identifier ?? id}</div>
            ))}
            {issue.duplicateOfId && (
              <div>Duplicate of {store.issue(issue.duplicateOfId)?.identifier}</div>
            )}
            {issue.relatedIssueIds.length === 0 &&
              issue.blockedByIds.length === 0 &&
              !issue.duplicateOfId && <div>No relations</div>}
          </div>
        </Section>

        <Section title="Comments">
          {comments.map((row) => (
            <div key={row.id} className="mb-2 text-[13px]">
              <div className="text-[12px] text-mute">
                {store.users.get(row.authorId)?.name} · {formatShortDate(row.createdAt)}
              </div>
              <div>{row.body}</div>
            </div>
          ))}
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (!comment.trim()) return
              store.addComment(issue.id, comment)
              setComment('')
            }}
          >
            <input
              data-testid="issue-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Write a comment"
              className="min-w-0 flex-1 rounded-md border border-line bg-transparent px-2 py-1 text-[13px] outline-none"
            />
            <button type="submit" className="rounded-md px-2 text-[12px] text-accent">
              Post
            </button>
          </form>
        </Section>

        <Section title="Activity">
          {activities.length === 0 && <div className="text-[13px] text-dim">No activity yet</div>}
          {activities.map((row) => (
            <div key={row.id} className="mb-1 text-[12px] text-mute">
              {row.body}
            </div>
          ))}
        </Section>

        <Section title="Attachments / links">
          {links.map((row) => (
            <a
              key={row.id}
              href={row.url}
              className="block text-[13px] text-accent underline"
              target="_blank"
              rel="noreferrer"
            >
              {row.title}
            </a>
          ))}
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (!linkUrl.trim()) return
              store.addLink(issue.id, linkUrl, linkUrl)
              setLinkUrl('')
            }}
          >
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://"
              className="min-w-0 flex-1 rounded-md border border-line bg-transparent px-2 py-1 text-[13px] outline-none"
            />
            <button type="submit" className="rounded-md px-2 text-[12px] text-accent">
              Add
            </button>
          </form>
        </Section>
      </div>
    </section>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-dim">{title}</div>
      {children}
    </div>
  )
}

function PeekRow({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-mute">{label}</dt>
      <dd>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-hover"
        >
          {children}
        </button>
      </dd>
    </div>
  )
}
