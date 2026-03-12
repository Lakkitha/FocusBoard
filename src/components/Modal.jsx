import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, width = 'max-w-lg' }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className={`relative z-10 w-full ${width} bg-surface-700 border border-surface-500 rounded-xl2 shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-500">
          <h2 className="text-base font-semibold text-surface-50">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
