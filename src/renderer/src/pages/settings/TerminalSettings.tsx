import { Navigate } from 'react-router-dom'

export default function TerminalSettings() {
    return <Navigate to="/settings/behavior?tab=terminal" replace />
}
