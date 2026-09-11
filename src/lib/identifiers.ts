export function formatIdentifier(teamKey: string, number: number): string {
  return `${teamKey.toUpperCase()}-${number}`
}

export function parseIdentifier(
  value: string,
): { teamKey: string; number: number } | null {
  const match = value.trim().toUpperCase().match(/^([A-Z][A-Z0-9]*)-(\d+)$/)
  if (!match) return null
  return { teamKey: match[1], number: Number(match[2]) }
}
