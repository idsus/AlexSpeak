import type { ComponentType } from 'react'
import type { ActivityId } from '../data/content'
import type { Settings } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { AskForIt } from './AskForIt'
import { Choose } from './Choose'
import { TalkBoard } from './TalkBoard'
import { CopyMe } from './CopyMe'
import { Song } from './Song'
import { UhOh } from './UhOh'
import { MemoryMatch } from './MemoryMatch'
import { CountDots } from './CountDots'
import { FindIt } from './FindIt'

export interface ActivityProps {
  api: FrameApi
  settings: Settings
  photos: Record<string, string>
  onDone: () => void
}

export const ACTIVITY_COMPONENTS: Record<ActivityId, ComponentType<ActivityProps>> = {
  ask: AskForIt,
  choose: Choose,
  copy: CopyMe,
  uhoh: UhOh,
  song: Song,
  board: TalkBoard,
  memory: MemoryMatch,
  count: CountDots,
  find: FindIt,
}
