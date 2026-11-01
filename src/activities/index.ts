import type { ComponentType } from 'react'
import type { ActivityId } from '../data/content'
import type { Settings } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { Placeholder } from './Placeholder'

export interface ActivityProps {
  api: FrameApi
  settings: Settings
  photos: Record<string, string>
  onDone: () => void
}

// Each activity task replaces its own entry.
export const ACTIVITY_COMPONENTS: Record<ActivityId, ComponentType<ActivityProps>> = {
  ask: Placeholder,
  choose: Placeholder,
  copy: Placeholder,
  uhoh: Placeholder,
  song: Placeholder,
  board: Placeholder,
  memory: Placeholder,
  count: Placeholder,
  find: Placeholder,
}
