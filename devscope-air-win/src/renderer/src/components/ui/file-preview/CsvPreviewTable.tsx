import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { MAX_CSV_ROWS } from './constants'
import { detectCsvDelimiter, extractColorValues, parseDelimitedContent } from './utils'

interface CsvPreviewTableProps {
    content: string
    language?: string
    useDistinctColumnColors: boolean
}

interface ColumnTheme {
    headerBackground: string
    headerText: string
    cellBackground: string
    cellText: string
    borderColor: string
}

const COLUMN_THEMES: ColumnTheme[] = [
    {
        headerBackground: 'rgba(56, 189, 248, 0.2)',
        headerText: 'rgb(186, 230, 253)',
        cellBackground: 'rgba(56, 189, 248, 0.08)',
        cellText: 'rgba(224, 242, 254, 0.95)',
        borderColor: 'rgba(56, 189, 248, 0.26)'
    },
    {
        headerBackground: 'rgba(16, 185, 129, 0.22)',
        headerText: 'rgb(167, 243, 208)',
        cellBackground: 'rgba(16, 185, 129, 0.09)',
        cellText: 'rgba(209, 250, 229, 0.95)',
        borderColor: 'rgba(16, 185, 129, 0.3)'
    },
    {
        headerBackground: 'rgba(245, 158, 11, 0.24)',
        headerText: 'rgb(254, 240, 138)',
        cellBackground: 'rgba(245, 158, 11, 0.1)',
        cellText: 'rgba(254, 249, 195, 0.95)',
        borderColor: 'rgba(245, 158, 11, 0.3)'
    },
    {
        headerBackground: 'rgba(168, 85, 247, 0.24)',
        headerText: 'rgb(233, 213, 255)',
        cellBackground: 'rgba(168, 85, 247, 0.1)',
        cellText: 'rgba(243, 232, 255, 0.95)',
        borderColor: 'rgba(168, 85, 247, 0.3)'
    },
    {
        headerBackground: 'rgba(244, 63, 94, 0.24)',
        headerText: 'rgb(254, 205, 211)',
        cellBackground: 'rgba(244, 63, 94, 0.1)',
        cellText: 'rgba(255, 228, 230, 0.95)',
        borderColor: 'rgba(244, 63, 94, 0.3)'
    },
    {
        headerBackground: 'rgba(59, 130, 246, 0.24)',
        headerText: 'rgb(191, 219, 254)',
        cellBackground: 'rgba(59, 130, 246, 0.1)',
        cellText: 'rgba(219, 234, 254, 0.95)',
        borderColor: 'rgba(59, 130, 246, 0.3)'
    }
]

function getColumnTheme(index: number): ColumnTheme {
    return COLUMN_THEMES[index % COLUMN_THEMES.length]
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

export default function CsvPreviewTable({ content, language, useDistinctColumnColors }: CsvPreviewTableProps) {
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
                                    <th
                                        key={`csv-header-${index}`}
                                        className={cn(
                                            'px-3 py-2 text-left border-b border-r last:border-r-0 font-medium',
                                            useDistinctColumnColors ? 'text-white/90' : 'text-white/80 border-white/10 border-r-white/5'
                                        )}
                                        style={useDistinctColumnColors ? {
                                            backgroundColor: getColumnTheme(index).headerBackground,
                                            color: getColumnTheme(index).headerText,
                                            borderBottomColor: getColumnTheme(index).borderColor,
                                            borderRightColor: getColumnTheme(index).borderColor
                                        } : undefined}
                                    >
                                        {column || `Column ${index + 1}`}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {csvPreview.body.map((row, rowIndex) => (
                                <tr
                                    key={`csv-row-${rowIndex}`}
                                    className={cn(
                                        useDistinctColumnColors
                                            ? 'hover:bg-white/[0.03]'
                                            : 'odd:bg-white/[0.02] hover:bg-white/[0.04]'
                                    )}
                                >
                                    {csvPreview.header.map((_, colIndex) => {
                                        const cellValue = row[colIndex] || ''
                                        const columnTheme = useDistinctColumnColors ? getColumnTheme(colIndex) : null
                                        return (
                                            <td
                                                key={`csv-cell-${rowIndex}-${colIndex}`}
                                                className={cn(
                                                    'px-3 py-2 border-b border-r last:border-r-0 align-top',
                                                    useDistinctColumnColors ? 'text-white/85' : 'text-white/70 border-white/5 border-r-white/5'
                                                )}
                                                style={columnTheme ? {
                                                    backgroundColor: columnTheme.cellBackground,
                                                    color: columnTheme.cellText,
                                                    borderBottomColor: columnTheme.borderColor,
                                                    borderRightColor: columnTheme.borderColor
                                                } : undefined}
                                            >
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
