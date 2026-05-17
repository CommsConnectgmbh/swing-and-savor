export default function ConfirmDialog({ message, onConfirm, onCancel, confirmText = 'Delete' }) {
  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-end justify-center z-50 p-4 pb-8 animate-fade-up"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-surface border border-line rounded-2xl w-full max-w-sm overflow-hidden shadow-lift">
        <div className="p-6 border-b border-lineSoft">
          <p className="text-ink font-semibold text-center leading-relaxed">{message}</p>
        </div>
        <div className="flex">
          <button
            onClick={onCancel}
            className="flex-1 py-4 text-inkDim text-sm font-semibold tracking-wide border-r border-lineSoft active:bg-bg/40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 text-danger text-sm font-bold tracking-wide active:bg-danger/10 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
