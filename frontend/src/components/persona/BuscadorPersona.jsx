import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import apiClient from '../../api/client'

export default function BuscadorPersona({ onResultado }) {
  const [documento, setDocumento] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const handleBuscar = async (e) => {
    e.preventDefault()
    if (!documento.trim()) return
    setError('')
    setLoading(true)
    try {
      const response = await apiClient.get(
        `/persona/buscar/?nro_documento=${documento.trim()}`
      )
      onResultado({
        documento,
        persona:     response.data.persona,
        paciente:    response.data.paciente,
        es_paciente: response.data.es_paciente,
        modo: !response.data.persona
          ? 'crear_todo'
          : !response.data.es_paciente
            ? 'agregar_paciente'
            : 'editar',
      })
    } catch {
      setError('Ocurrió un error al buscar. Por favor, intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        .bp-root {
          background: #ffffff;
          border: 1px solid #e8edf2;
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 20px;
          font-family: 'DM Sans', sans-serif;
        }

        .bp-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }
        .bp-header-bar {
          width: 3px;
          height: 16px;
          background: #1a3a5c;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .bp-header-label {
          font-size: 13px;
          font-weight: 600;
          color: #1a3a5c;
        }

        .bp-form {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .bp-input-wrap {
          position: relative;
          flex: 1;
          max-width: 380px;
        }
        .bp-input-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
        }
        .bp-input {
          width: 100%;
          padding: 9px 12px 9px 34px;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          color: #111827;
          background: #ffffff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .bp-input:focus {
          border-color: #1a3a5c;
          box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }
        .bp-input::placeholder { color: #d1d5db; }

        .bp-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          background: #1a3a5c;
          color: #ffffff;
          border: none;
          border-radius: 9px;
          font-size: 13.5px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
          white-space: nowrap;
        }
        .bp-btn:hover:not(:disabled) {
          background: #15304d;
          box-shadow: 0 4px 12px rgba(26,58,92,0.2);
        }
        .bp-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .bp-error {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 10px;
          font-size: 12.5px;
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 8px 12px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .bp-spin { animation: spin 0.7s linear infinite; }
      `}</style>

      <div className="bp-root">
        <div className="bp-header">
          <div className="bp-header-bar" />
          <span className="bp-header-label">Buscar paciente por documento</span>
        </div>

        <form onSubmit={handleBuscar} className="bp-form">
          <div className="bp-input-wrap">
            <Search size={15} className="bp-input-icon" />
            <input
              type="text"
              placeholder="Ingresá el nro. de documento..."
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              className="bp-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !documento.trim()}
            className="bp-btn"
          >
            {loading
              ? <><Loader2 size={14} className="bp-spin" /> Buscando...</>
              : <><Search size={14} /> Buscar</>
            }
          </button>
        </form>

        {error && (
          <div className="bp-error">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{flexShrink:0}}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}
      </div>
    </>
  )
}