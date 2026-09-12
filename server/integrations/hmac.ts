import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

export function nockSignature(secret: string, deliveryId: string, timestamp: number, rawBody: string): string {
  return createHmac('sha256', secret).update(`${deliveryId}.${timestamp}.${rawBody}`).digest('hex')
}

export function githubBodySignature(secret: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
}

export function payloadHash(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex')
}

export function signaturesMatch(expected: string, provided: string): boolean {
  const left = Buffer.from(expected)
  const right = Buffer.from(provided)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function parseSignatureHeader(header: string | undefined): string {
  if (!header) return ''
  return header.startsWith('sha256=') ? header.slice('sha256='.length) : header
}
