import test from 'node:test'
import assert from 'node:assert/strict'
import { ASSISTANT_IPC, assertAssistantIpcContract } from './assistant-ipc'

test('assistant IPC channels are unique', () => {
    assert.doesNotThrow(() => assertAssistantIpcContract())
})

test('assistant IPC contains explicit session/workflow/event channels', () => {
    const required = [
        ASSISTANT_IPC.listSessions,
        ASSISTANT_IPC.createSession,
        ASSISTANT_IPC.selectSession,
        ASSISTANT_IPC.getEvents,
        ASSISTANT_IPC.exportEvents,
        ASSISTANT_IPC.runWorkflowExplainDiff,
        ASSISTANT_IPC.runWorkflowReviewStaged,
        ASSISTANT_IPC.runWorkflowDraftCommit
    ]
    for (const channel of required) {
        assert.ok(typeof channel === 'string' && channel.length > 0)
    }
})
