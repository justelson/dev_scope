import { AssistantComposerView } from './AssistantComposerView'
import { useAssistantComposerController } from './useAssistantComposerController'
import type { AssistantComposerProps } from './assistant-composer-types'

export type { AssistantComposerProps, AssistantComposerSendOptions, ComposerContextFile } from './assistant-composer-types'

export function AssistantComposer(props: AssistantComposerProps) {
    const controller = useAssistantComposerController(props)
    return <AssistantComposerView controller={controller} />
}
