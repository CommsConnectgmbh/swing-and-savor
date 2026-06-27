// Lochspiel-Tabelle: je eine Zeile pro Spieler/Team, die Löcher als Spalten
// nebeneinander. Das Loch, das ein Spieler gewonnen hat, ist in seiner Farbe
// hinterlegt; eine Stand-Zeile zeigt den laufenden Vorsprung. Erste Spalte bleibt
// beim horizontalen Scrollen stehen. Wird von Casual- und Turnier-Match genutzt.
// rows = [{ hole, a, b, winner: 'A'|'B'|'halved', diff }] (nur gewertete Löcher).
//
// totalHoles (optional): zeigt die volle Runde (z.B. 18) auf einen Blick —
// noch nicht gespielte Löcher erscheinen als Platzhalter. Ohne den Prop bleibt
// es beim alten Verhalten (nur gespielte Löcher).

const WIN_TEXT = '#102822' // dunkle Schrift auf farbiger Gewinner-Zelle

function firstWord(n) { return (n || '').trim().split(/[ ·]/)[0] }

// Spalten-Löcher bestimmen: volle Runde (1..totalHoles) oder nur gespielte.
function buildColumns(rows, totalHoles) {
  const byHole = new Map(rows.map(r => [r.hole, r]))
  const holes = totalHoles && totalHoles > 0
    ? Array.from({ length: totalHoles }, (_, i) => i + 1)
    : rows.map(r => r.hole)
  return holes.map(h => ({ hole: h, row: byHole.get(h) || null }))
}

function PlayerRow({ cols, name, side, color }) {
  return (
    <tr>
      <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left text-[12px] font-semibold text-ink truncate"
        style={{ maxWidth: 104 }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
          {name}
        </span>
      </td>
      {cols.map(({ hole, row }) => {
        const won = row && row.winner === side
        const strokes = row ? (side === 'A' ? row.a : row.b) : null
        return (
          <td key={hole} className="px-0.5 py-1.5 text-center" style={{ minWidth: 38 }}>
            <span
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-[14px] font-bold tabular-nums ${
                won ? '' : row ? 'text-inkMuted' : 'text-inkDim'
              }`}
              style={won ? { background: color, color: WIN_TEXT } : undefined}
            >
              {strokes ?? '–'}
            </span>
          </td>
        )
      })}
    </tr>
  )
}

export default function HoleByHoleTable({ rows, labelA, labelB, colorA, colorB, totalHoles }) {
  if (!rows || rows.length === 0) return null
  const cols = buildColumns(rows, totalHoles)
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
              {cols.map(({ hole }) => (
                <td key={hole} className="px-0.5 py-1.5 text-center text-[11px] text-inkDim tabular-nums" style={{ minWidth: 38 }}>
                  {hole}
                </td>
              ))}
            </tr>

            {/* je eine Zeile pro Spieler */}
            <PlayerRow cols={cols} name={nameA} side="A" color={colorA} />
            <PlayerRow cols={cols} name={nameB} side="B" color={colorB} />

            {/* laufender Stand */}
            <tr>
              <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-inkDim">
                Stand
              </td>
              {cols.map(({ hole, row }) => (
                <td key={hole} className="px-0.5 py-1.5 text-center text-[10px] font-bold tabular-nums" style={{ minWidth: 38 }}>
                  {row ? (
                    <span style={{ color: row.diff === 0 ? undefined : row.diff > 0 ? colorA : colorB }}
                      className={row.diff === 0 ? 'text-inkMuted' : ''}>
                      {row.diff === 0 ? 'AS' : `${Math.abs(row.diff)}↑`}
                    </span>
                  ) : (
                    <span className="text-inkDim">·</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
