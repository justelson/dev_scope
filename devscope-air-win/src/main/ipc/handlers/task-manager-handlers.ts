import { listActiveTasks } from '../task-manager'

export async function handleListActiveTasks(
    _event: Electron.IpcMainInvokeEvent,
    projectPath?: string
) {
    try {
        return {
            success: true,
            tasks: listActiveTasks(projectPath)
        }
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to list active tasks.' }
    }
}
