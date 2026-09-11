export const COLOR_TOKENS = [
  'bg-app',
  'bg-sidebar',
  'bg-panel',
  'bg-elevated',
  'bg-hover',
  'bg-scrim',
  'fg-primary',
  'fg-secondary',
  'fg-muted',
  'fg-disabled',
  'fg-on-accent',
  'border-subtle',
  'border-default',
  'border-strong',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'avatar-1',
  'avatar-2',
  'avatar-3',
  'avatar-4',
  'avatar-5',
] as const

export const SHADOW_TOKENS = ['shadow-sm', 'shadow-md'] as const

export const RADIUS_TOKENS = [
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-full',
] as const

export const SPACE_TOKENS = [
  'space-1',
  'space-2',
  'space-3',
  'space-4',
  'space-5',
  'space-6',
  'space-8',
] as const

export const SIZE_TOKENS = [
  'row-issue',
  'control-sm',
  'control-md',
  'icon-sm',
  'icon-md',
] as const

export const TYPE_TOKENS = [
  'font-ui',
  'font-display',
  'font-mono',
  'text-ui',
  'text-meta',
  'text-heading',
  'leading-ui',
] as const

export const Z_TOKENS = [
  'z-base',
  'z-sticky',
  'z-dropdown',
  'z-overlay',
  'z-toast',
] as const

export const MOTION_TOKENS = [
  'duration-hover',
  'duration-popover',
  'duration-dialog',
  'duration-panel',
  'duration-triage',
  'duration-board',
  'ease-ui',
] as const

export const ALL_TOKENS = [
  ...COLOR_TOKENS,
  ...SHADOW_TOKENS,
  ...RADIUS_TOKENS,
  ...SPACE_TOKENS,
  ...SIZE_TOKENS,
  ...TYPE_TOKENS,
  ...Z_TOKENS,
  ...MOTION_TOKENS,
] as const

export type ColorToken = (typeof COLOR_TOKENS)[number]
