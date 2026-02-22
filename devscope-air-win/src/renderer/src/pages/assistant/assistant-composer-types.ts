export type ComposerContextFile = {
    id: string
    path: string
    name?: string
    content?: string
    mimeType?: string
    kind?: 'image' | 'doc' | 'code' | 'file'
    sizeBytes?: number
    previewText?: string
    previewDataUrl?: string
    source?: 'manual' | 'paste'
    animateIn?: boolean
}
