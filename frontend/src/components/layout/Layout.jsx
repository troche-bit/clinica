import { useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function Layout({ children }) {
  const [collapsed, setCollapsed]     = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: #f0f4f8;
          color: #111827;
        }

        .layout-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          z-index: 45;
          display: none;
        }
        .layout-overlay.visible { display: block; }

        .layout-main {
          min-height: 100vh;
          padding-top: 64px;
          transition: margin-left 0.3s ease;
          margin-left: 240px;
        }
        .layout-main.collapsed { margin-left: 64px; }

        @media (max-width: 767px) {
          .layout-main { margin-left: 0 !important; }
        }

        .layout-content {
          padding: 28px 28px;
        }

        @media (max-width: 640px) {
          .layout-content { padding: 20px 16px; }
        }

        /* ── Estilos globales de página reutilizables ── */

        .page-header {
          margin-bottom: 24px;
        }
        .page-title {
          font-size: 22px;
          font-weight: 600;
          color: #1a3a5c;
          margin-bottom: 4px;
        }
        .page-subtitle {
          font-size: 13.5px;
          color: #6b7280;
          font-weight: 400;
        }

        .card {
          background: #ffffff;
          border: 1px solid #e8edf2;
          border-radius: 12px;
          padding: 20px 24px;
        }
        .card-sm {
          background: #ffffff;
          border: 1px solid #e8edf2;
          border-radius: 10px;
          padding: 14px 18px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: #ffffff;
          border: 1px solid #e8edf2;
          border-radius: 10px;
          padding: 16px 18px;
        }
        .stat-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: #9ca3af;
          margin-bottom: 6px;
        }
        .stat-value {
          font-size: 26px;
          font-weight: 600;
          color: #1a3a5c;
          line-height: 1;
        }
        .stat-sub {
          font-size: 12px;
          color: #9ca3af;
          margin-top: 4px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: 9px;
          font-size: 13.5px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
          border: none;
        }
        .btn-primary {
          background: #1a3a5c;
          color: #ffffff;
        }
        .btn-primary:hover {
          background: #15304d;
          box-shadow: 0 4px 12px rgba(26,58,92,0.2);
        }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }
        .btn-secondary:hover { background: #e9ecef; }
        .btn-danger {
          background: #fff;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .btn-danger:hover { background: #fef2f2; }

        .badge {
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 500;
          padding: 3px 9px;
          border-radius: 20px;
        }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-warning { background: #fef9c3; color: #854d0e; }
        .badge-danger  { background: #fee2e2; color: #991b1b; }
        .badge-info    { background: #dbeafe; color: #1a3a5c; }
        .badge-gray    { background: #f3f4f6; color: #6b7280; }

        .table-wrapper {
          overflow-x: auto;
          border-radius: 10px;
          border: 1px solid #e8edf2;
          background: #ffffff;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }
        thead {
          background: #f8fafc;
          border-bottom: 1px solid #e8edf2;
        }
        th {
          text-align: left;
          padding: 11px 16px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .05em;
          text-transform: uppercase;
          color: #9ca3af;
        }
        td {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          color: #374151;
        }
        tr:last-child td { border-bottom: none; }
        tbody tr:hover { background: #f8fafc; }

        .input {
          width: 100%;
          padding: 9px 12px;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          color: #111827;
          background: #fafafa;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .input:focus {
          border-color: #1a3a5c;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }
        .input::placeholder { color: #d1d5db; }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }
        .form-group { margin-bottom: 18px; }
      `}</style>

      {/* Overlay mobile */}
      <div
        className={`layout-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Navbar */}
      <Navbar
        collapsed={collapsed}
        onMenuToggle={() => setMobileOpen(m => !m)}
      />

      {/* Contenido */}
      <main className={`layout-main ${collapsed ? 'collapsed' : ''}`}>
        <div className="layout-content">
          {children}
        </div>
      </main>
    </>
  )
}