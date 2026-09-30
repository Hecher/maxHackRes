import type { JournalColumn } from '@/domain/scheme'
import type { Lab, ReadingRow } from '@/domain/types'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeCsv(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function columnHeader(column: JournalColumn): string {
  return column.unit ? `${column.label}, ${column.unit}` : column.label
}

export function cellText(value: number | null, column: JournalColumn): string {
  if (value === null || value === undefined) return '—'

  const precision = column.precision ?? 2
  return value.toFixed(precision).replace('.', ',')
}

export function buildCsv(columns: JournalColumn[], rows: ReadingRow[]): string {
  const header = ['№', ...columns.map(columnHeader)]
  const lines = [header.map(escapeCsv).join(';')]

  for (const row of rows) {
    const cells = [
      String(row.number),
      ...columns.map((column) => cellText(row.values[column.key] ?? null, column)),
    ]
    lines.push(cells.map(escapeCsv).join(';'))
  }

  return `\uFEFF${lines.join('\r\n')}`
}

export function buildExcelXml(
  columns: JournalColumn[],
  rows: ReadingRow[],
  meta: { labTitle: string; author: string; mode: string; exportedAt: string },
): string {
  const headerCells = ['№', ...columns.map(columnHeader)]
    .map((text) => `<Cell><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`)
    .join('')

  const bodyRows = rows
    .map((row) => {
      const cells = [
        `<Cell><Data ss:Type="Number">${row.number}</Data></Cell>`,
        ...columns.map((column) => {
          const value = row.values[column.key] ?? null
          if (value === null) return '<Cell/>'
          return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
        }),
      ].join('')
      return `<Row>${cells}</Row>`
    })
    .join('')

  const infoRows = [
    `<Row><Cell><Data ss:Type="String">${escapeXml(meta.labTitle)}</Data></Cell></Row>`,
    `<Row><Cell><Data ss:Type="String">Учитель: ${escapeXml(meta.author)}</Data></Cell></Row>`,
    `<Row><Cell><Data ss:Type="String">Режим: ${escapeXml(meta.mode)}</Data></Cell></Row>`,
    `<Row><Cell><Data ss:Type="String">Выгружено: ${escapeXml(meta.exportedAt)}</Data></Cell></Row>`,
    '<Row/>',
  ].join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Журнал замеров">
    <Table>
      ${infoRows}
      <Row>${headerCells}</Row>
      ${bodyRows}
    </Table>
  </Worksheet>
</Workbook>`
}

export function exportFileName(lab: Lab, mode: string, extension: string): string {
  const slug = lab.id.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'lab'
  const date = new Date().toISOString().slice(0, 10)
  return `${slug}-${mode}-${date}.${extension}`
}

export function saveFile(content: string, fileName: string, mime: string, bridgeDownload?: (url: string, name: string) => void): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)

  if (bridgeDownload) {
    try {
      bridgeDownload(url, fileName)
    } catch {

      triggerAnchorDownload(url, fileName)
    }
  } else {
    triggerAnchorDownload(url, fileName)
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function triggerAnchorDownload(url: string, fileName: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function saveBlob(
  blob: Blob,
  fileName: string,
  bridgeDownload?: (url: string, name: string) => void,
): void {
  const url = URL.createObjectURL(blob)

  if (bridgeDownload) {
    try {
      bridgeDownload(url, fileName)
    } catch {
      triggerAnchorDownload(url, fileName)
    }
  } else {
    triggerAnchorDownload(url, fileName)
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function saveDataUrl(
  dataUrl: string,
  fileName: string,
  bridgeDownload?: (url: string, name: string) => void,
): boolean {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return false

  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  const mime = /:(.*?)[;,]/.exec(meta)?.[1] ?? 'application/octet-stream'

  try {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)

    saveBlob(new Blob([bytes], { type: mime }), fileName, bridgeDownload)
    return true
  } catch {
    return false
  }
}

export function bridgeDownloader(
  bridge: { downloadFile?: (url: string, name: string) => void } | null | undefined,
): ((url: string, name: string) => void) | undefined {
  return bridge?.downloadFile ? (url, name) => bridge.downloadFile?.(url, name) : undefined
}

export function openFileUrl(url: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
