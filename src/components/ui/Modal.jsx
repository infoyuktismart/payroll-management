import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

export default function Modal({ isOpen, onClose, title, children, footer }) {
    const trapRef = useFocusTrap(isOpen)

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={trapRef}>
            <div className="modal-content custom-scrollbar">
                <div className="modal-header">
                    <h3 id="modal-title">{title}</h3>
                    <button onClick={onClose} className="modal-close" aria-label="Close dialog">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}

