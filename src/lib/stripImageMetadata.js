// Entfernt Metadaten aus hochgeladenen Bildern, bevor sie im Storage landen.
//
// Warum hier besonders: Swing & Savor nimmt Fotos entgegen, die Spieler mit dem
// eigenen Handy aufnehmen — Scorecard-Fotos (Bucket `scorecard-photos`),
// Match- und Cup-Fotos (`match-photos`), Cup-Cover und Team-Logos
// (`cup-covers`), Sponsorenlogos (`sponsor-logos`), Spieler-Avatare (`avatars`)
// und Savor-Speisenbilder (`savor-images`). Handykameras schreiben
// GPS-Koordinaten ins EXIF. Ein Scorecard- oder Spielerfoto entsteht direkt auf
// dem Platz; bis auf `scorecard-photos` sind alle Ziel-Buckets public-read, der
// Aufnahmeort waere dort fuer jeden mit der URL lesbar. Fuer keinen Zweck der
// App wird eine dieser Angaben gebraucht — Datenminimierung nach
// Art. 5 Abs. 1 lit. c DSGVO.
//
// Ausnahme, die bleiben MUSS: die EXIF-Orientation. Handykameras speichern das
// Bild oft liegend und legen die Drehung nur als Tag 0x0112 ab. Wird das EXIF
// komplett entfernt, erscheint ein hochkant fotografiertes Foto quer.
// Deshalb wird bei vorhandener Orientation ein minimales EXIF-Segment neu
// geschrieben, das ausschliesslich dieses eine Tag enthaelt — GPS, Make, Model,
// DateTime, UserComment und MakerNote fallen weg.
//
// Grundsaetze:
//   - Verlustfrei. Pixeldaten werden nicht angefasst, kein Re-Encoding.
//   - Wirft nie. Bei unerwartetem Byte-Layout kommt das Original unveraendert
//     zurueck — ein Upload darf nie an dieser Stelle verloren gehen.
//   - Nur JPEG und PNG. PDF, HEIC und WebP gehen unveraendert durch.
//
// Laeuft in Browser und Node: reines Uint8Array, keine Runtime-APIs.
//
// Herkunft: Zeile-fuer-Zeile-Port von obacht/src/lib/strip-image-metadata.ts
// (dort und in belegify mit Tests abgesichert). Unterschiede zur TS-Fassung:
// nur die entfernten Typannotationen sowie die Repo-Konvention ohne
// Semikolons — die Logik ist byteidentisch, gegen die TS-Fassung differenziell
// geprueft. Aenderungen an der Logik bitte in allen drei Projekten gleich
// halten. Einzige Ergaenzung hier: `stripFileMetadataForUpload` ganz unten,
// ein reiner Wrapper fuer die `File`-Objekte aus den Datei-Dialogen.

/** JFIF-Segment. Bleibt: harmlos, manche Decoder erwarten es. */
const JPEG_APP0 = 0xe0
/** EXIF/XMP. Wird entfernt — bis auf die Orientation, siehe Kopfkommentar. */
const JPEG_APP1 = 0xe1
/** ICC-Farbprofil. Bleibt per Default: Entfernen würde Farben verschieben. */
const JPEG_APP2 = 0xe2
/** Start of Scan — ab hier beginnen die Pixeldaten. */
const JPEG_SOS = 0xda
/** Kommentarsegment. */
const JPEG_COM = 0xfe

/** PNG-Chunks mit Text-, Zeit- oder EXIF-Inhalt. */
const PNG_METADATA_CHUNKS = ['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'dSIG']
const PNG_ICC_CHUNK = 'iCCP'

const JPEG_MAGIC = [0xff, 0xd8, 0xff]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * @typedef {object} StripOptions
 * @property {boolean} [removeIccProfile]
 *   Auch das ICC-Farbprofil entfernen. Default false — verschiebt sonst Farben.
 */

/**
 * @typedef {object} StripResult
 * @property {Uint8Array} bytes
 * @property {number} removedBytes
 *   Wie viele Bytes entfernt wurden. 0 = nichts gefunden oder Format unbekannt.
 * @property {string[]} removed
 *   Welche Blöcke entfernt wurden, für Logging. Z. B. ["APP1", "COM"].
 * @property {number|null} [orientationKept]
 *   Gesetzt, wenn eine EXIF-Orientation gerettet und als minimales APP1 neu
 *   geschrieben wurde. null, wenn keine vorhanden oder ohnehin 1 (normal).
 */

/**
 * @param {Uint8Array} bytes
 * @param {number[]} magic
 * @returns {boolean}
 */
function startsWith(bytes, magic) {
  if (bytes.length < magic.length) return false
  return magic.every((b, i) => byteAt(bytes, i) === b)
}

/**
 * Byte an einer Position, ausserhalb der Grenzen 0. Explizit, weil der Web-Build
 * der TS-Fassung mit `noUncheckedIndexedAccess` laeuft und ein blanker
 * Indexzugriff dort `number | undefined` ist. Alle Aufrufer pruefen die Grenzen
 * vorher selbst.
 *
 * @param {Uint8Array} bytes
 * @param {number} index
 * @returns {number}
 */
function byteAt(bytes, index) {
  return bytes[index] ?? 0
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {number}
 */
function readUint32BE(bytes, offset) {
  return (
    ((byteAt(bytes, offset) << 24) >>> 0) +
    (byteAt(bytes, offset + 1) << 16) +
    (byteAt(bytes, offset + 2) << 8) +
    byteAt(bytes, offset + 3)
  )
}

/**
 * Liest die EXIF-Orientation (TIFF-Tag 0x0112) aus einem APP1-Segment.
 * `segment` beginnt hinter Marker und Längenfeld, also bei "Exif\0\0".
 * Gibt null zurück, wenn kein oder ein unlesbares EXIF vorliegt.
 *
 * @param {Uint8Array} segment
 * @returns {number|null}
 */
function readOrientation(segment) {
  // "Exif\0\0" (6 Byte), danach der TIFF-Header.
  if (segment.length < 14) return null
  for (let i = 0; i < 4; i++) {
    if (byteAt(segment, i) !== 'Exif'.charCodeAt(i)) return null
  }
  const tiff = 6
  const little = byteAt(segment, tiff) === 0x49 && byteAt(segment, tiff + 1) === 0x49
  const big = byteAt(segment, tiff) === 0x4d && byteAt(segment, tiff + 1) === 0x4d
  if (!little && !big) return null

  const u16 = (o) =>
    little
      ? byteAt(segment, o) | (byteAt(segment, o + 1) << 8)
      : (byteAt(segment, o) << 8) | byteAt(segment, o + 1)
  const u32 = (o) =>
    little
      ? (byteAt(segment, o) | (byteAt(segment, o + 1) << 8) |
        (byteAt(segment, o + 2) << 16) | (byteAt(segment, o + 3) << 24)) >>> 0
      : ((byteAt(segment, o) << 24) | (byteAt(segment, o + 1) << 16) |
        (byteAt(segment, o + 2) << 8) | byteAt(segment, o + 3)) >>> 0

  const ifd0 = tiff + u32(tiff + 4)
  if (ifd0 + 2 > segment.length) return null
  const count = u16(ifd0)
  // Ein IFD mit absurd vielen Einträgen ist kaputt, nicht interessant.
  if (count > 512) return null

  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12
    if (entry + 12 > segment.length) return null
    if (u16(entry) === 0x0112) {
      // SHORT: der Wert steht in den ersten zwei Byte des Wertfelds.
      const value = u16(entry + 8)
      return value >= 1 && value <= 8 ? value : null
    }
  }
  return null
}

/**
 * Baut ein minimales APP1-Segment, das nur die Orientation trägt.
 * Aufbau: Marker, Länge, "Exif\0\0", TIFF-Header (big endian), IFD0 mit einem
 * Eintrag, leerer Next-IFD-Zeiger. Insgesamt 36 Byte.
 *
 * @param {number} orientation
 * @returns {Uint8Array}
 */
function buildOrientationExif(orientation) {
  const payload = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, // "MM", 42 — big endian
    0x00, 0x00, 0x00, 0x08, // IFD0 beginnt 8 Byte nach dem TIFF-Header
    0x00, 0x01, // ein Eintrag
    0x01, 0x12, // Tag 0x0112 Orientation
    0x00, 0x03, // Typ SHORT
    0x00, 0x00, 0x00, 0x01, // Anzahl 1
    (orientation >> 8) & 0xff, orientation & 0xff, 0x00, 0x00, // Wert, linksbündig
    0x00, 0x00, 0x00, 0x00, // kein weiteres IFD
  ]
  const length = payload.length + 2 // Längenfeld zählt sich selbst mit
  return new Uint8Array([0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...payload])
}

/**
 * @param {Uint8Array[]} parts
 * @param {number} totalLength
 * @returns {Uint8Array}
 */
function concat(parts, totalLength) {
  const out = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/**
 * @param {Uint8Array} bytes
 * @param {StripOptions} opts
 * @returns {StripResult}
 */
function stripJpeg(bytes, opts) {
  const keep = [bytes.subarray(0, 2)] // SOI
  const removed = []
  let total = 2
  let i = 2
  // Aus dem ersten EXIF-Segment gerettet, danach als minimales APP1 neu gesetzt.
  let orientation = null
  let orientationKept = null

  while (i + 4 <= bytes.length) {
    // Kein gültiger Marker, oder ab Start of Scan folgen Pixeldaten ohne
    // Längenangabe: ab hier nichts mehr interpretieren.
    if (byteAt(bytes, i) !== 0xff) break

    const marker = byteAt(bytes, i + 1)
    if (marker === JPEG_SOS) break

    // Längenfeld zählt sich selbst mit, daher +2 für den Marker.
    const segmentLength = (byteAt(bytes, i + 2) << 8) + byteAt(bytes, i + 3)
    const end = i + 2 + segmentLength
    // Längenangabe unplausibel — nicht weiter interpretieren.
    if (segmentLength < 2 || end > bytes.length) break

    let drop = false
    let label = ''
    if (marker === JPEG_COM) {
      drop = true
      label = 'COM'
    } else if (marker >= 0xe0 && marker <= 0xef) {
      label = `APP${marker - 0xe0}`
      if (marker === JPEG_APP0) drop = false
      else if (marker === JPEG_APP2) drop = Boolean(opts.removeIccProfile)
      else drop = true // APP1 = EXIF/XMP, und alles andere an Anwendungsdaten
    }

    if (drop) {
      // Vor dem Verwerfen die Orientation retten: ohne sie wuerde ein
      // Hochformat-Foto quer dargestellt.
      if (marker === JPEG_APP1 && orientation === null) {
        orientation = readOrientation(bytes.subarray(i + 4, end))
      }
      removed.push(label)
    } else {
      keep.push(bytes.subarray(i, end))
      total += end - i
    }
    i = end
  }

  // Alles ab hier (Pixeldaten, Reste, nicht interpretierbare Bytes) unverändert.
  if (i < bytes.length) {
    keep.push(bytes.subarray(i))
    total += bytes.length - i
  }

  // Orientation als minimales EXIF wieder einsetzen — hinter JFIF, vor den
  // Bilddaten. Bei Orientation 1 (normal) ist nichts zu retten.
  if (orientation !== null && orientation !== 1) {
    const exif = buildOrientationExif(orientation)
    // Position: direkt nach SOI und einem eventuellen JFIF-Segment.
    const insertAt = keep.length > 1 && byteAt(keep[1] ?? new Uint8Array(), 1) === JPEG_APP0
      ? 2
      : 1
    keep.splice(insertAt, 0, exif)
    total += exif.length
    orientationKept = orientation
  }

  return {
    bytes: concat(keep, total),
    removedBytes: bytes.length - total,
    removed,
    orientationKept,
  }
}

/**
 * @param {Uint8Array} bytes
 * @param {StripOptions} opts
 * @returns {StripResult}
 */
function stripPng(bytes, opts) {
  const keep = [bytes.subarray(0, 8)] // Signatur
  const removed = []
  let total = 8
  let i = 8

  while (i + 8 <= bytes.length) {
    const length = readUint32BE(bytes, i)
    // 4 Byte Länge + 4 Byte Typ + Daten + 4 Byte CRC
    const end = i + 12 + length
    if (length < 0 || end > bytes.length) break

    const type = String.fromCharCode(
      byteAt(bytes, i + 4), byteAt(bytes, i + 5),
      byteAt(bytes, i + 6), byteAt(bytes, i + 7),
    )
    const drop =
      PNG_METADATA_CHUNKS.includes(type) ||
      (type === PNG_ICC_CHUNK && Boolean(opts.removeIccProfile))

    if (drop) {
      removed.push(type)
    } else {
      keep.push(bytes.subarray(i, end))
      total += end - i
    }

    i = end
    if (type === 'IEND') break
  }

  // Reste nach IEND oder nicht interpretierbare Bytes unverändert übernehmen.
  if (i < bytes.length) {
    keep.push(bytes.subarray(i))
    total += bytes.length - i
  }

  return { bytes: concat(keep, total), removedBytes: bytes.length - total, removed }
}

/**
 * Entfernt Metadaten aus JPEG und PNG. Andere Formate kommen unverändert zurück.
 * Wirft nie — im Zweifel gewinnt das Original.
 *
 * @param {Uint8Array} bytes
 * @param {StripOptions} [opts]
 * @returns {StripResult}
 */
export function stripImageMetadata(bytes, opts = {}) {
  const unchanged = { bytes, removedBytes: 0, removed: [] }
  try {
    if (startsWith(bytes, JPEG_MAGIC)) return stripJpeg(bytes, opts)
    if (startsWith(bytes, PNG_MAGIC)) return stripPng(bytes, opts)
    return unchanged
  } catch {
    return unchanged
  }
}

/**
 * Bequemer Aufruf für die Upload-Pfade: gibt nur die Bytes zurück und schreibt
 * eine Logzeile, wenn etwas entfernt wurde.
 *
 * @param {Uint8Array} bytes
 * @param {string} context
 * @returns {Uint8Array}
 */
export function stripImageMetadataForUpload(bytes, context) {
  const result = stripImageMetadata(bytes)
  if (result.removedBytes > 0) {
    console.log(
      `[${context}] Bild-Metadaten entfernt: ${result.removed.join(', ')} ` +
        `(${result.removedBytes} B)`,
    )
  }
  return result.bytes
}

/**
 * Liest ein File/Blob als Uint8Array und entfernt die Metadaten. Der Aufruf,
 * den die JSX-Komponenten brauchen — dort liegt ein `File` aus dem
 * `<input type="file">` vor, kein Byte-Array.
 *
 * Der contentType muss beim `.upload()` explizit mitgegeben werden: Supabase
 * leitet ihn sonst aus dem File-Objekt ab, das hier verloren geht.
 *
 * @param {Blob} file
 * @param {string} context
 * @returns {Promise<Uint8Array>}
 */
export async function stripFileMetadataForUpload(file, context) {
  return stripImageMetadataForUpload(new Uint8Array(await file.arrayBuffer()), context)
}
