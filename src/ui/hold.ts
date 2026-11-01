/** Press-and-hold: fires only if held for holdMs; any release before that does nothing. */
export function createHold(holdMs: number, onHold: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return {
    start() {
      cancel()
      timer = setTimeout(() => {
        timer = null
        onHold()
      }, holdMs)
    },
    cancel,
  }
}
