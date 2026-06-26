// Lochspiel-Tabelle: je eine Zeile pro Spieler/Team, die Löcher als Spalten
// nebeneinander. Das Loch, das ein Spieler gewonnen hat, ist in seiner Farbe
// hinterlegt; eine Stand-Zeile zeigt den laufenden Vorsprung. Erste Spalte bleibt
// beim horizontalen Scrollen stehen. Wird von Casual- und Turnier-Match genutzt.
// rows = [{ hole, a, b, winner: 'A'|'B'|'halved', diff }] (nur gewertete Löcher).

const WIN_TEXT = '#102822' // dunkle Schrift auf farbiger Gewinner-Zelle

function firstWord(n) { return (n || '').trim().split(/[ ·]/)[0] }

function PlayerRow({ rows, name, side, color }) {
  return (
    <tr>
      <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left text-[12px] font-semibold text-ink truncate"
        style={{ maxWidth: 104 }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
          {name}
        </span>
      </td>
      {rows.map(r => {
        const won = r.winner === side
        const strokes = side === 'A' ? r.a : r.b
        return (
          <td key={r.hole} className="px-0.5 py-1.5 text-center" style={{ minWidth: 38 }}>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[14px] font-bold tabular-nums"
              style={won
                ? { background: color, color: WIN_TEXT }
                : { color: '#8a857c' }}>
              {strokes ?? '–'}
            </span>
          </td>
        )
      })}
    </tr>
  )
}

export default function HoleByHoleTable({ rows, labelA, labelB, colorA, colorB }) {
  if (!rows || rows.length === 0) return null
  const upA = rows.filter(r => r.winner === 'A').length
  const upB = rows.filter(r => r.winner === 'B').length
  const halved = rows.filter(r => r.winner === 'halved').length
  const nameA = firstWord(labelA) || 'A'
  const nameB = firstWord(labelB) || 'B'

  return (
    <div className="rounded-card bg-surface border border-line overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">Loch für Loch</p>
        <div className="flex items-center gap-2.5 text-[11px] tabular-nums flex-shrink-0">
          <span className="text-ink font-semibold" style={{ color: colorA }}>{nameA} {upA}</span>
          <span className="text-inkDim">·</span>
          <span className="text-ink font-semibold" style={{ color: colorB }}>{nameB} {upB}</span>
          <span className="text-inkDim">· ½ {halved}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: 0 }}>
          <tbody>
            {/* Loch-Nummern */}
            <tr className="border-b border-lineSoft">
              <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-inkDim">
                Loch
              </td>
              {rows.map(r => (
                <td key={r.hole} className="px-0.5 py-1.5 text-center text-[11px] text-inkDim tabular-nums" style={{ minWidth: 38 }}>
                  {r.hole}
                </td>
              ))}
            </tr>

            {/* je eine Zeile pro Spieler */}
            <PlayerRow rows={rows} name={nameA} side="A" color={colorA} />
            <PlayerRow rows={rows} name={nameB} side="B" color={colorB} />

            {/* laufender Stand */}
            <tr>
              <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-inkDim">
                Stand
              </td>
              {rows.map(r => (
                <td key={r.hole} className="px-0.5 py-1.5 text-center text-[10px] font-bold tabular-nums" style={{ minWidth: 38 }}>
                  <span style={{ color: r.diff === 0 ? '#8a857c' : r.diff > 0 ? colorA : colorB }}>
                    {r.diff === 0 ? 'AS' : `${Math.abs(r.diff)}↑`}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
