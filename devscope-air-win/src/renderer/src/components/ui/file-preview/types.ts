export type PreviewFileType = 'md' | 'html' | 'image' | 'video' | 'text' | 'code' | 'json' | 'csv'

export interface PreviewFile {
    name: string
    path: string
    type: PreviewFileType
    language?: string
    startInEditMode?: boolean
}

export interface PreviewMeta {
    truncated?: boolean
    size?: number | null
    previewBytes?: number | null
    modifiedAt?: number | null
}
