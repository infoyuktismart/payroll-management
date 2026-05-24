import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { devLog } from '../lib/devLogger'

export default function ProtectedRoute({ children }) {
    const { user, loading, isAdmin } = useAuth()
    const location = useLocation()

    if (loading) {
        devLog('ProtectedRoute: Loading...')
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>
    }

    devLog('ProtectedRoute Check:', { pathname: location.pathname, user: !!user, isAdmin })

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (!isAdmin && location.pathname !== '/portal') {
        devLog('ProtectedRoute: Non-admin detected at:', location.pathname, '- Redirecting to /portal')
        return <Navigate to="/portal" replace />
    }

    return children
}
