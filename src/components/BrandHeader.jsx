export default function BrandHeader({ title }) {
  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-bg/95 backdrop-blur-md"
      style={{
        borderBottom: '1px solid rgba(152,205,2,0.14)',
        paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
      }}
    >
      <img
        src="/logo.png"
        alt="Swing & Savor"
        width="40"
        height="40"
        className="rounded-xl flex-shrink-0"
      />
      {title ? (
        <span className="font-condensed font-bold text-lg text-ink tracking-[0.16em] uppercase">
          {title}
        </span>
      ) : null}
    </header>
  )
}
