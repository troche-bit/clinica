import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'

/*
 * Componente Toast — notificación temporal flotante.
 *
 * Para usarlo, importar useToast desde hooks/useToast.js
 * y renderizar <Toast toast={toast} /> en la página o layout.
 *
 * Tipos disponibles: 'success' | 'error' | 'warning'
 */

const ICONOS = {
  success: <CheckCircle  size={16} />,
  error:   <AlertCircle  size={16} />,
  warning: <AlertTriangle size={16} />,
}

const COLORES = {
  success: { bg: '#f0fdf4', border: '#86efac', color: '#16a34a' },
  error:   { bg: '#fef2f2', border: '#fca5a5', color: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fcd34d', color: '#d97706' },
}

export default function Toast({ toast }) {
  if (!toast) return null

  const { bg, border, color } = COLORES[toast.type] || COLORES.success

  return (
    <>
      <style>{`
        /* ── Toast — notificación flotante ── */
        .toast-wrap {
          position: fixed; bottom: 24px; right: 24px; z-index: 9999;
          animation: toastIn 0.25s ease;
          font-family: 'DM Sans', sans-serif;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .toast-box {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 16px; border-radius: 10px; border: 1px solid;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          max-width: 360px; min-width: 240px;
        }
        .toast-icon  { flex-shrink: 0; margin-top: 1px; }
        .toast-msg   { font-size: 13.5px; font-weight: 500; flex: 1; line-height: 1.4; }
      `}</style>

      <div className="toast-wrap">
        <div
          className="toast-box"
          style={{ background: bg, borderColor: border, color }}
        >
          <span className="toast-icon">{ICONOS[toast.type]}</span>
          <span className="toast-msg">{toast.message}</span>
        </div>
      </div>
    </>
  )
}
