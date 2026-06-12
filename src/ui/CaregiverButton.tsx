interface Props {
  onPress: () => void
}

// The manual override. No detector is perfect — this guarantees an attempt
// is never silently dropped. Visible through prompt, listen, and model.
export default function CaregiverButton({ onPress }: Props) {
  return (
    <button className="caregiver-btn" onClick={onPress}>
      👀 I saw it!
    </button>
  )
}
