import { AssistantPageContent } from './assistant/AssistantPageContent'
import { useAssistantPageController } from './assistant/useAssistantPageController'

export default function Assistant() {
    const controller = useAssistantPageController()
    return <AssistantPageContent controller={controller} />
}

