export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm">
        <p className="text-white text-lg font-medium mb-6 text-center">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-border text-muted text-sm font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-danger text-white text-sm font-bold"
          >
            Wirklich löschen
          </button>
        </div>
      </div>
    </div>
  )
}
