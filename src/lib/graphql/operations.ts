export const ISSUE_PAYLOAD = `
  success
  clientMutationId
  lastSyncId
  revision
  error
  issue {
    id
    workspaceId
    teamId
    number
    identifier
    title
    description
    priority
    stateId
    assigneeId
    projectId
    cycleId
    milestoneId
    parentId
    dueAt
    labelIds
    subscriberIds
    relatedIssueIds
    blockedByIds
    duplicateOfId
    archivedAt
    sortOrder
    revision
    lastMutationId
    createdAt
    updatedAt
  }
`

export const ISSUE_CREATE = `
  mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) { ${ISSUE_PAYLOAD} }
  }
`

export const ISSUE_UPDATE = `
  mutation IssueUpdate($input: IssueUpdateInput!) {
    issueUpdate(input: $input) { ${ISSUE_PAYLOAD} }
  }
`

export const ISSUE_ARCHIVE = `
  mutation IssueArchive($input: IssueArchiveInput!) {
    issueArchive(input: $input) { ${ISSUE_PAYLOAD} }
  }
`

export const ISSUE_BATCH_UPDATE = `
  mutation IssueBatchUpdate($input: IssueBatchUpdateInput!) {
    issueBatchUpdate(input: $input) {
      success
      clientMutationId
      lastSyncId
      error
      issues {
        id
        revision
        title
        stateId
      }
    }
  }
`

export const COMMENT_CREATE = `
  mutation CommentCreate($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      clientMutationId
      lastSyncId
      error
      comment { id issueId authorId body createdAt }
    }
  }
`

export const PROJECT_CREATE = `
  mutation ProjectCreate($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      success
      clientMutationId
      lastSyncId
      error
      project { id name teamId status health }
    }
  }
`

export const PROJECT_UPDATE = `
  mutation ProjectUpdate($input: ProjectUpdateInput!) {
    projectUpdate(input: $input) {
      success
      clientMutationId
      lastSyncId
      error
      project { id name status health summary }
    }
  }
`

export const BOOTSTRAP = `
  query Bootstrap {
    bootstrap {
      lastSyncId
      workspace { id name urlKey changeSequence }
      currentUser { id name email initials }
      teams { id key name issueCounter private }
      users { id name email initials }
      states { id teamId name type color position isDefault }
      labels { id teamId name color }
      projects { id teamId name description status health area }
      cycles { id teamId number startsAt endsAt }
      milestones { id projectId name sortOrder }
      issues {
        id teamId number identifier title description priority stateId
        assigneeId projectId cycleId milestoneId parentId labelIds
        subscriberIds relatedIssueIds blockedByIds duplicateOfId
        archivedAt sortOrder revision lastMutationId createdAt updatedAt
      }
      comments { id issueId authorId body createdAt }
    }
  }
`

export const VIEWER = `
  query Viewer {
    viewer {
      id
      user { id name email }
      workspace { id name urlKey changeSequence }
    }
  }
`

export const SEARCH = `
  query Search($query: String!) {
    search(query: $query) {
      issues { id identifier title }
      projects { id name }
    }
  }
`

export const WORKSPACE_CHANGES = `
  query WorkspaceChanges($after: Float, $first: Int) {
    workspaceChanges(after: $after, first: $first) {
      checkpoint
      pageInfo { hasNextPage endCursor }
      nodes {
        workspaceId
        sequence
        entityType
        entityId
        operation
        revision
        changedFields
        payload
        syncGroup
        authorizationTeamId
        actorId
        clientMutationId
        createdAt
      }
    }
  }
`
