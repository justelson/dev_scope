export interface AssistantDiffTarget {
    activityId: string
    filePath: string
    displayPath: string
    patch: string
    previousPath?: string
    createdAt?: string
    isNew?: boolean
}
