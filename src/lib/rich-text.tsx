import type { ReactNode } from 'react'

export function renderRichText(source: string): ReactNode {
  if (!source.trim()) return null
  return source.split('\n').map((line, index) => (
    <p key={index} className="min-h-[1.25rem] whitespace-pre-wrap">
      {renderInline(line)}
    </p>
  ))
}

function renderInline(line: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = pattern.exec(line))) {
    if (match.index > last) parts.push(line.slice(last, match.index))
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key++} className="rounded bg-hover px-1 text-[12px]">
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        parts.push(
          <a
            key={key++}
            href={link[2]}
            className="text-accent underline"
            target="_blank"
            rel="noreferrer"
          >
            {link[1]}
          </a>,
        )
      }
    }
    last = match.index + token.length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}
