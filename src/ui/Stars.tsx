const STAR = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z'

/** The star jar: n of 5 filled. */
export function Stars(props: { n: number; size?: number; className?: string }) {
  const { n, size = 26, className } = props
  return (
    <div className={`stars ${className ?? ''}`} role="img" aria-label={`${n} of 5 stars in the jar`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d={STAR} fill={i < n ? 'var(--star)' : 'var(--line)'} />
        </svg>
      ))}
    </div>
  )
}

export { STAR as STAR_PATH }
