import type { ShortcutSpec } from './types'

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return true
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Mac OS|Macintosh/.test(
    navigator.userAgent,
  )
}

export function eventHasMod(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

export function formatShortcut(spec: ShortcutSpec, apple = isApplePlatform()): string {
  const keyLabel = shortcutKeyLabel(spec.key)
  if (apple) {
    return `${spec.mod ? '⌘' : ''}${spec.alt ? '⌥' : ''}${spec.shift ? '⇧' : ''}${keyLabel}`
  }
  return [spec.mod ? 'Ctrl' : null, spec.alt ? 'Alt' : null, spec.shift ? 'Shift' : null, keyLabel]
    .filter(Boolean)
    .join('+')
}

export function shortcutKeyLabel(key: string): string {
  if (key === 'Escape') return 'Esc'
  if (key === 'ArrowUp') return '↑'
  if (key === 'ArrowDown') return '↓'
  if (key === 'ArrowLeft') return '←'
  if (key === 'ArrowRight') return '→'
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  return key
}

export function eventMatchesShortcut(event: KeyboardEvent, spec: ShortcutSpec): boolean {
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const specKey = spec.key.length === 1 ? spec.key.toLowerCase() : spec.key
  if (eventKey !== specKey && event.key !== spec.key) return false
  if (!!spec.shift !== event.shiftKey) return false
  if (!!spec.alt !== event.altKey) return false
  if (!!spec.mod !== eventHasMod(event)) return false
  return true
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    target.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  )
}
