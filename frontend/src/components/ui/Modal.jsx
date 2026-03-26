import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, size = 'md', subtitle }) {
  const sizes = {
    sm:   'max-w-md',
    md:   'max-w-2xl',
    lg:   'max-w-4xl',
    xl:   'max-w-6xl',
    full: 'max-w-full mx-4',
  }

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          font-family: 'DM Sans', sans-serif;
        }

        .modal-overlay {
          position: absolute;
          inset: 0;
          background: rgba(10, 25, 45, 0.55);
          backdrop-filter: blur(2px);
          animation: overlayIn 0.18s ease;
        }

        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .modal-box {
          position: relative;
          background: #ffffff;
          border-radius: 14px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(10, 25, 45, 0.18), 0 4px 16px rgba(0,0,0,0.08);
          animation: modalIn 0.2s cubic-bezier(0.34, 1.3, 0.64, 1);
          border: 1px solid #e8edf2;
        }

        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 24px 18px;
          border-bottom: 1px solid #f0f4f8;
          flex-shrink: 0;
          gap: 12px;
        }

        .modal-header-left {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .modal-header-accent {
          width: 4px;
          height: 36px;
          background: #1a3a5c;
          border-radius: 4px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .modal-header-text {}

        .modal-title {
          font-size: 16px;
          font-weight: 600;
          color: #1a3a5c;
          line-height: 1.3;
          margin: 0;
        }

        .modal-subtitle {
          font-size: 12.5px;
          color: #9ca3af;
          margin-top: 3px;
          font-weight: 400;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e8edf2;
          background: none;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .modal-close:hover {
          background: #fef2f2;
          color: #dc2626;
          border-color: #fecaca;
        }

        .modal-body {
          overflow-y: auto;
          flex: 1;
          padding: 24px;
          scrollbar-width: thin;
          scrollbar-color: #e2e8f0 transparent;
        }
        .modal-body::-webkit-scrollbar { width: 5px; }
        .modal-body::-webkit-scrollbar-track { background: transparent; }
        .modal-body::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>

      <div className="modal-backdrop">
        <div className="modal-overlay" onClick={onClose} />

        <div className={`modal-box ${sizes[size]}`}>
          {/* Header */}
          <div className="modal-header">
            <div className="modal-header-left">
              <div className="modal-header-accent" />
              <div className="modal-header-text">
                <h2 className="modal-title">{title}</h2>
                {subtitle && <p className="modal-subtitle">{subtitle}</p>}
              </div>
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>

          {/* Contenido */}
          <div className="modal-body">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}