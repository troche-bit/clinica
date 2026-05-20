import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({
  isOpen, title, description, onConfirm, onCancel, loading = false,
  confirmText = 'Eliminar', cancelText = 'Cancelar',
}) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape' && !loading) onCancel() }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, loading, onCancel])

  if (!isOpen) return null

  return (
    <>
      <style>{`
        .cd-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          font-family: 'DM Sans', sans-serif;
        }
        .cd-overlay {
          position: absolute;
          inset: 0;
          background: rgba(10, 25, 45, 0.5);
          backdrop-filter: blur(2px);
          animation: cd-fade-in 0.15s ease;
        }
        @keyframes cd-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .cd-box {
          position: relative;
          background: #fff;
          border-radius: 14px;
          width: 100%;
          max-width: 420px;
          border: 1px solid #e8edf2;
          box-shadow: 0 20px 60px rgba(10, 25, 45, 0.15);
          animation: cd-pop-in 0.18s cubic-bezier(0.34, 1.3, 0.64, 1);
          overflow: hidden;
        }
        @keyframes cd-pop-in {
          from { opacity: 0; transform: scale(0.95) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        .cd-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 24px 16px;
        }
        .cd-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #dc2626;
        }
        .cd-title {
          font-size: 15px;
          font-weight: 600;
          color: #111827;
          line-height: 1.3;
        }
        .cd-description {
          padding: 0 24px 20px;
          font-size: 13.5px;
          color: #6b7280;
          line-height: 1.55;
        }
        .cd-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 14px 24px;
          border-top: 1px solid #f3f4f6;
          background: #f8fafc;
        }
      `}</style>

      <div className="cd-backdrop">
        <div className="cd-overlay" onClick={!loading ? onCancel : undefined} />
        <div className="cd-box">
          <div className="cd-header">
            <div className="cd-icon">
              <AlertTriangle size={18} />
            </div>
            <div className="cd-title">{title}</div>
          </div>

          {description && (
            <div className="cd-description">{description}</div>
          )}

          <div className="cd-footer">
            <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
              {cancelText}
            </button>
            <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
              {loading ? `${confirmText}...` : confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
