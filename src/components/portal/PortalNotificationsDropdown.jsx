import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'

export default function PortalNotificationsDropdown({ unreadNotifications = [], onMarkAsRead, isMarkingRead }) {
    const [isOpen, setIsOpen] = useState(false)

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.notification-bell-container')) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative notification-bell-container">
            <button
                disabled={isMarkingRead}
                onClick={() => setIsOpen(!isOpen)}
                className="h-11 w-11 rounded-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors inline-flex items-center justify-center relative bg-white shadow-sm cursor-pointer disabled:opacity-50"
                title="Notifications"
            >
                <Bell className="w-5 h-5" />
                {unreadNotifications.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full text-[10px] font-black w-5 h-5 flex items-center justify-center animate-bounce border-2 border-white shadow-sm">
                        {unreadNotifications.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 w-80 max-w-sm">
                    <div className="p-4 border-b border-gray-50 bg-slate-50 flex items-center justify-between">
                        <span className="text-xs uppercase tracking-widest font-black text-slate-500">ESS Inbox Notifications</span>
                        {unreadNotifications.length > 0 && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                {unreadNotifications.length} Unread
                            </span>
                        )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 text-left">
                        {unreadNotifications.length > 0 ? (
                            unreadNotifications.map(notification => (
                                <div
                                    key={notification.id}
                                    onClick={() => {
                                        onMarkAsRead(notification.id)
                                        setIsOpen(false)
                                    }}
                                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <p className="text-xs font-bold text-slate-800 leading-tight">
                                        {notification.subject || notification.notification_type || 'Notification'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1 font-medium leading-normal">
                                        {notification.message || notification.metadata?.message || 'New update is available.'}
                                    </p>
                                    <p className="text-[9px] text-gray-400 mt-2 font-mono">
                                        {new Date(notification.created_at).toLocaleString()}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-xs text-gray-400 italic">
                                No unread notifications
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
