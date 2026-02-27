export const ASSISTANT_IPC = {
    subscribe: 'devscope:assistant:subscribe',
    unsubscribe: 'devscope:assistant:unsubscribe',
    connect: 'devscope:assistant:connect',
    disconnect: 'devscope:assistant:disconnect',
    status: 'devscope:assistant:status',
    send: 'devscope:assistant:send',
    respondApproval: 'devscope:assistant:respondApproval',
    cancelTurn: 'devscope:assistant:cancelTurn',
    setApprovalMode: 'devscope:assistant:setApprovalMode',
    getApprovalMode: 'devscope:assistant:getApprovalMode',
    getHistory: 'devscope:assistant:getHistory',
    clearHistory: 'devscope:assistant:clearHistory',
    listModels: 'devscope:assistant:listModels',
    getEvents: 'devscope:assistant:events:get',
    clearEvents: 'devscope:assistant:events:clear',
    exportEvents: 'devscope:assistant:events:export',
    exportConversation: 'devscope:assistant:conversation:export',
    listSessions: 'devscope:assistant:sessions:list',
    createSession: 'devscope:assistant:sessions:create',
    selectSession: 'devscope:assistant:sessions:select',
    renameSession: 'devscope:assistant:sessions:rename',
    deleteSession: 'devscope:assistant:sessions:delete',
    archiveSession: 'devscope:assistant:sessions:archive',
    setSessionProjectPath: 'devscope:assistant:sessions:setProjectPath',
    newThread: 'devscope:assistant:thread:new',
    estimateTokens: 'devscope:assistant:tokens:estimate',
    listProfiles: 'devscope:assistant:profiles:list',
    setProfile: 'devscope:assistant:profiles:set',
    getProjectModel: 'devscope:assistant:projectModel:get',
    setProjectModel: 'devscope:assistant:projectModel:set',
    getTelemetryIntegrity: 'devscope:assistant:telemetry:integrity',
    readAccount: 'devscope:assistant:account:read',
    readRateLimits: 'devscope:assistant:account:rateLimits',
    runWorkflowExplainDiff: 'devscope:assistant:workflow:explainDiff',
    runWorkflowReviewStaged: 'devscope:assistant:workflow:reviewStaged',
    runWorkflowDraftCommit: 'devscope:assistant:workflow:draftCommit',
    eventStream: 'devscope:assistant:event'
} as const

export type AssistantIpcChannel = (typeof ASSISTANT_IPC)[keyof typeof ASSISTANT_IPC]

export function assertAssistantIpcContract(): void {
    const values = Object.values(ASSISTANT_IPC)
    const unique = new Set(values)
    if (values.length !== unique.size) {
        throw new Error('Assistant IPC contract has duplicate channel names.')
    }
}
