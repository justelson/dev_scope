import { useMemo } from 'react'
import { MAX_CSV_ROWS } from './constants'
import { detectCsvDelimiter, extractColorValues, parseDelimitedContent } from './utils'

interface CsvPreviewTableProps {
    content: string
    language?: string
}

function ColorChips({ value, idPrefix }: { value: string; idPrefix: string }) {
    const colors = useMemo(() => extractColorValues(value, 3), [value])
    if (colors.length === 0) return null

    return (
        <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
            {colors.map((colorValue, index) => (
                <span
                    key={`${idPrefix}-${index}`}
                    className="h-3.5 w-3.5 rounded-sm border border-white/20 shrink-0"
                    style={{ backgroundColor: colorValue }}
                    title={colorValue}
                />
            ))}
        </span>
    )
}

export default function CsvPreviewTable({ content, language }: CsvPreviewTableProps) {
    const csvPreview = useMemo(() => {
        const delimiter = language === 'tsv' ? '\t' : detectCsvDelimiter(content)
        const rows = parseDelimitedContent(content, delimiter).filter(row => row.some(cell => cell.trim().length > 0))

        if (rows.length === 0) {
            return { header: [] as string[], body: [] as string[][], totalRows: 0, truncated: false }
        }

        const header = rows[0]
        const bodyRows = rows.slice(1)
        const truncated = bodyRows.length > MAX_CSV_ROWS

        return {
            header,
            body: truncated ? bodyRows.slice(0, MAX_CSV_ROWS) : bodyRows,
            totalRows: bodyRows.length,
            truncated
        }
    }, [content, language])

    return (
        <div className="w-full max-w-[96%] bg-sparkle-card rounded-xl border border-white/5 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/5 text-xs text-white/50 bg-black/20">
                {csvPreview.totalRows} rows {csvPreview.truncated ? `(showing first ${MAX_CSV_ROWS})` : ''}
            </div>
            {csvPreview.header.length > 0 ? (
                <div className="overflow-auto max-h-[70vh] custom-scrollbar">
                    <table className="w-full border-collapse text-sm">
                        <thead className="sticky top-0 bg-black/40 backdrop-blur-md">
                            <tr>
                                {csvPreview.header.map((column, index) => (
                                    <th key={`csv-header-${index}`} className="px-3 py-2 text-left text-white/80 border-b border-white/10 border-r border-white/5 last:border-r-0 font-medium">
                                        {column || `Column ${index + 1}`}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {csvPreview.body.map((row, rowIndex) => (
                                <tr key={`csv-row-${rowIndex}`} className="odd:bg-white/[0.02] hover:bg-white/[0.04]">
                                    {csvPreview.header.map((_, colIndex) => {
                                        const cellValue = row[colIndex] || ''
                                        return (
                                            <td key={`csv-cell-${rowIndex}-${colIndex}`} className="px-3 py-2 text-white/70 border-b border-white/5 border-r border-white/5 last:border-r-0 align-top">
                                                <span className="inline-flex items-center">
                                                    <span>{cellValue}</span>
                                                    <ColorChips value={cellValue} idPrefix={`csv-${rowIndex}-${colIndex}`} />
                                                </span>
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="p-5 text-sm text-white/60">No tabular data found in this CSV file.</div>
            )}
        </div>
    )
}

