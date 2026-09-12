import { WebSocketServer, type WebSocket } from 'ws'
import type { Server } from 'node:http'
import type { Database } from './db.ts'
import {
  fetchWorkspaceChanges,
  liveHub,
  userCanSeeTeam,
  type LiveHub,
  type LiveSubscriber,
} from './live.ts'

const PAGE = 500

export function attachSyncSocket(
  server: Server,
  db: Database,
  hub: LiveHub = liveHub,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://nock.local')
    if (url.pathname !== '/sync') {
      socket.destroy()
      return
    }
    wss.handleUpgrade(request, socket, head, (socketClient) => {
      void handleSocket(socketClient, url, db, hub)
    })
  })
  return wss
}

async function handleSocket(
  ws: WebSocket,
  url: URL,
  db: Database,
  hub: LiveHub,
): Promise<void> {
  const userId = url.searchParams.get('userId') || url.searchParams.get('user')
  const workspaceId = url.searchParams.get('workspaceId') || url.searchParams.get('workspace')
  const checkpoint = Number(url.searchParams.get('checkpoint') ?? 0)
  if (!userId || !workspaceId) {
    ws.close(4401, 'missing userId or workspaceId')
    return
  }
  const member = await userCanSeeTeam(db, workspaceId, userId, null)
  if (!member) {
    ws.close(4403, 'forbidden')
    return
  }

  const send = (message: unknown) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(message))
  }

  const subscriber: LiveSubscriber = {
    userId,
    workspaceId,
    send: (message) => send(message),
  }
  const unsubscribe = hub.subscribe(subscriber)

  send({ type: 'hello', checkpoint })
  try {
    let after = Number.isFinite(checkpoint) ? checkpoint : 0
    while (ws.readyState === 1) {
      const page = await fetchWorkspaceChanges(db, workspaceId, userId, after, PAGE)
      for (const change of page.nodes) send({ type: 'change', change })
      after = page.checkpoint
      if (!page.hasNextPage) break
    }
  } catch (error) {
    console.error('[nock] sync bootstrap failed', error)
  }

  ws.on('message', (raw: Buffer | string) => {
    try {
      const parsed = JSON.parse(String(raw)) as { type?: string; checkpoint?: number }
      if (parsed.type === 'ping') send({ type: 'pong' })
    } catch (error) {
      console.warn('[nock] sync message ignored', error)
    }
  })

  ws.on('close', () => {
    unsubscribe()
  })
}
