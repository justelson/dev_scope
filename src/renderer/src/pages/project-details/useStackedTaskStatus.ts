import { useEffect, useState } from 'react'

export function useStackedTaskStatus(projectPath: string, isStackedActionRunning: boolean) {
    const [stackedTaskStatusText, setStackedTaskStatusText] = useState('')

    useEffect(() => {
        const normalizedProjectPath = String(projectPath || '').trim().toLowerCase()
        if (!normalizedProjectPath) return

        const applyTask = (task: any) => {
            if (!task || task.type !== 'git.stacked') return false
            if (String(task.projectPath || '').trim().toLowerCase() !== normalizedProjectPath) return false
            if (task.status !== 'running') {
                setStackedTaskStatusText('')
                return true
            }

            const latestLog = Array.isArray(task.logs)
                ? [...task.logs]
                    .reverse()
                    .map((entry) => String(entry?.message || '').trim())
                    .find((message) => message && !/^Target branch:|^Auto-stage all:|^Commit message:/i.test(message))
                : ''
            setStackedTaskStatusText(latestLog || 'Starting...')
            return true
        }

        void window.devscope.listActiveTasks?.(projectPath).then((result) => {
            if (!result?.success || !Array.isArray(result.tasks)) return
            const matchingTask = result.tasks.find((task: any) => applyTask(task))
            if (!matchingTask) {
                setStackedTaskStatusText('')
            }
        }).catch(() => undefined)

        const unsubscribe = window.devscope.onTaskEvent?.((event) => {
            if (event.type === 'remove') {
                void window.devscope.listActiveTasks?.(projectPath).then((result) => {
                    if (!result?.success || !Array.isArray(result.tasks)) {
                        setStackedTaskStatusText('')
                        return
                    }
                    const matchingTask = result.tasks.find((task: any) => applyTask(task))
                    if (!matchingTask) {
                        setStackedTaskStatusText('')
                    }
                }).catch(() => {
                    setStackedTaskStatusText('')
                })
                return
            }
            if (event.type !== 'upsert' || !event.task) return
            applyTask(event.task)
        })

        return () => {
            unsubscribe?.()
        }
    }, [isStackedActionRunning, projectPath])

    return stackedTaskStatusText
}
