import { Archive, ArchiveRestore, ChevronDown, ChevronRight, Edit2, SquarePen, Trash2 } from 'lucide-react'
import type { AssistantSession } from '@shared/assistant/contracts'
import type { FileActionsMenuItem } from '@/components/ui/FileActionsMenu'
import type { SessionProjectGroup } from './assistant-sessions-rail-utils'
import type { AssistantRailMode } from './useAssistantPageSidebarState'

export function createSessionActionMenuItems(args: {
    session: AssistantSession
    archived?: boolean
    onOpenRename: (session: AssistantSession) => void
    onArchiveSession: (sessionId: string, archived?: boolean) => void
    onDeleteRequest: (session: AssistantSession) => void
}): FileActionsMenuItem[] {
    const { session, archived = false, onOpenRename, onArchiveSession, onDeleteRequest } = args

    if (archived) {
        return [
            {
                id: 'restore',
                label: 'Restore chat',
                icon: <ArchiveRestore size={13} />,
                onSelect: () => onArchiveSession(session.id, false)
            },
            {
                id: 'delete',
                label: 'Delete chat',
                icon: <Trash2 size={13} />,
                danger: true,
                onSelect: () => onDeleteRequest(session)
            }
        ]
    }

    return [
        {
            id: 'rename',
            label: 'Rename chat',
            icon: <Edit2 size={13} />,
            onSelect: () => onOpenRename(session)
        },
        {
            id: 'archive',
            label: 'Archive chat',
            icon: <Archive size={13} />,
            onSelect: () => onArchiveSession(session.id, true)
        },
        {
            id: 'delete',
            label: 'Delete chat',
            icon: <Trash2 size={13} />,
            danger: true,
            onSelect: () => onDeleteRequest(session)
        }
    ]
}

export function createProjectActionMenuItems(args: {
    railMode: AssistantRailMode
    group: SessionProjectGroup
    playgroundLabId?: string | null
    isExpanded: boolean
    onToggleGroup: (groupKey: string) => void
    onCreateSession: (projectPath?: string) => void
    onCreatePlaygroundSession: (labId?: string | null) => void
    onDeletePlaygroundLab?: (labId: string, label: string) => void
    onDeleteProjectChats?: (group: SessionProjectGroup) => void
}): FileActionsMenuItem[] {
    const {
        railMode,
        group,
        playgroundLabId = null,
        isExpanded,
        onToggleGroup,
        onCreateSession,
        onCreatePlaygroundSession,
        onDeletePlaygroundLab,
        onDeleteProjectChats
    } = args
    const labId = playgroundLabId || group.sessions[0]?.playgroundLabId || null

    const items: FileActionsMenuItem[] = [
        {
            id: 'new-chat',
            label: railMode === 'playground'
                ? (group.path ? 'New chat in lab' : 'New chat-only session')
                : (group.path ? 'New chat in project' : 'New chat'),
            icon: <SquarePen size={13} />,
            onSelect: () => {
                if (railMode === 'playground') {
                    onCreatePlaygroundSession(labId)
                    return
                }
                onCreateSession(group.path || undefined)
            }
        },
        {
            id: 'toggle-group',
            label: isExpanded ? 'Collapse group' : 'Expand group',
            icon: isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />,
            onSelect: () => onToggleGroup(group.key)
        }
    ]

    if (railMode === 'playground' && labId && onDeletePlaygroundLab) {
        items.push({
            id: 'remove-lab',
            label: 'Remove lab',
            icon: <Trash2 size={13} />,
            danger: true,
            onSelect: () => onDeletePlaygroundLab(labId, group.label)
        })
    } else if (group.sessions.length > 0 && onDeleteProjectChats) {
        items.push({
            id: 'delete-project-chats',
            label: 'Delete project chats',
            icon: <Trash2 size={13} />,
            danger: true,
            onSelect: () => onDeleteProjectChats(group)
        })
    }

    return items
}
