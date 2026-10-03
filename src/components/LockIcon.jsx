// Shared padlock glyph.
//
// The identical inline lock <svg> (a rounded body plus the "M7 11V7a5 5 0 0110 0v4"
// shackle) was copy-pasted across PasswordGate, MatchesScreen, TeamsScreen,
// BoardScreen, CupScreen and MatchDetailScreen — once as a local LockIcon in
// CupScreen and seven times fully inlined. Two visual variants existed: the
// amber empty-state/header lock (stroke #f5b94a, strokeWidth 2) and the smaller
// currentColor button lock (strokeWidth 2.5). Both are expressible through the
// props below, so a single component keeps the glyph from drifting apart.
export default function LockIcon({
  size = 18,
  stroke = 'currentColor',
  strokeWidth = 2,
  ...rest
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}
