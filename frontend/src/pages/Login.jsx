import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function rutaInicial(rol) {
    if (rol === 'admin') return '/informes/dashboard/prestadores'
    if (rol === 'recepcionista') return '/consultas'
    if (rol === 'medico' || rol === 'secretaria_medico') return '/consultas'
    return '/paciente'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const username = e.target.username.value
    const password = e.target.password.value
    try {
      const newUser = await login(username, password)
      navigate(rutaInicial(newUser?.rol))
    } catch {
      setError('Credenciales incorrectas. Por favor, verificá tus datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          background: #f0f4f8;
        }

        /* Panel izquierdo decorativo */
        .login-panel-left {
          display: none;
          flex: 1;
          background: #1a3a5c;
          position: relative;
          overflow: hidden;
          padding: 48px;
          flex-direction: column;
          justify-content: space-between;
        }

        @media (min-width: 900px) {
          .login-panel-left { display: flex; }
        }

        .panel-bg-circles {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .circle {
          position: absolute;
          border-radius: 50%;
          opacity: 0.08;
          background: #ffffff;
        }

        .circle-1 { width: 420px; height: 420px; top: -120px; right: -80px; }
        .circle-2 { width: 260px; height: 260px; bottom: 80px; left: -60px; }
        .circle-3 { width: 160px; height: 160px; bottom: 240px; right: 60px; opacity: 0.05; }

        .panel-cross {
          color: rgba(255,255,255,0.15);
          font-size: 13px;
          letter-spacing: 0.15em;
          font-weight: 500;
          text-transform: uppercase;
        }

        .panel-brand {
          position: relative;
          z-index: 1;
        }

        .panel-brand-icon {
          width: 56px;
          height: 56px;
          background: rgba(255,255,255,0.12);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 28px;
          backdrop-filter: blur(8px);
        }

        .panel-brand-icon svg {
          width: 28px;
          height: 28px;
          color: #fff;
        }

        .panel-title {
          font-family: 'DM Serif Display', serif;
          font-size: 42px;
          line-height: 1.1;
          color: #ffffff;
          margin-bottom: 16px;
        }

        .panel-subtitle {
          font-size: 15px;
          color: rgba(255,255,255,0.55);
          line-height: 1.7;
          font-weight: 300;
          max-width: 280px;
        }

        .panel-footer {
          position: relative;
          z-index: 1;
        }

        .panel-footer-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 100px;
          padding: 8px 16px;
          color: rgba(255,255,255,0.6);
          font-size: 13px;
          font-weight: 400;
        }

        .panel-footer-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ade80;
          flex-shrink: 0;
        }

        /* Panel derecho — formulario */
        .login-panel-right {
          flex: 0 0 auto;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          background: #f0f4f8;
        }

        @media (min-width: 900px) {
          .login-panel-right {
            width: 460px;
            background: #ffffff;
            box-shadow: -20px 0 60px rgba(0,0,0,0.06);
          }
        }

        .form-wrapper {
          width: 100%;
          max-width: 360px;
        }

        /* Logo móvil */
        .mobile-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
        }

        @media (min-width: 900px) {
          .mobile-logo { display: none; }
        }

        .mobile-logo-icon {
          width: 44px;
          height: 44px;
          background: #1a3a5c;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mobile-logo-text {
          font-family: 'DM Serif Display', serif;
          font-size: 22px;
          color: #1a3a5c;
        }

        .form-heading {
          font-family: 'DM Serif Display', serif;
          font-size: 30px;
          color: #111827;
          margin-bottom: 6px;
        }

        .form-subheading {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 36px;
          font-weight: 400;
        }

        .field {
          margin-bottom: 20px;
        }

        .field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
          letter-spacing: 0.01em;
        }

        .input-wrap {
          position: relative;
        }

        .input-wrap svg.input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: #9ca3af;
          pointer-events: none;
        }

        .field input {
          width: 100%;
          padding: 11px 14px 11px 40px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          color: #111827;
          background: #fafafa;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          outline: none;
        }

        .field input:focus {
          border-color: #1a3a5c;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }

        .field input::placeholder {
          color: #d1d5db;
        }

        .toggle-password {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .toggle-password:hover { color: #1a3a5c; }

        .error-msg {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 10px 14px;
          color: #dc2626;
          font-size: 13px;
          margin-bottom: 20px;
        }

        .error-msg svg {
          width: 15px;
          height: 15px;
          flex-shrink: 0;
        }

        .btn-submit {
          width: 100%;
          padding: 12px;
          background: #1a3a5c;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          letter-spacing: 0.01em;
          margin-top: 4px;
        }

        .btn-submit:hover:not(:disabled) {
          background: #15304d;
          box-shadow: 0 4px 16px rgba(26,58,92,0.25);
        }

        .btn-submit:active:not(:disabled) {
          transform: scale(0.99);
        }

        .btn-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .form-footer {
          margin-top: 32px;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          border-top: 1px solid #f3f4f6;
          padding-top: 20px;
        }
      `}</style>

      <div className="login-root">
        {/* Panel izquierdo */}
        <div className="login-panel-left">
          <div className="panel-bg-circles">
            <div className="circle circle-1" />
            <div className="circle circle-2" />
            <div className="circle circle-3" />
          </div>

          <div className="panel-cross">Sistema de Gestión Clínica</div>

          <div className="panel-brand">
            <div className="panel-brand-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h1 className="panel-title">Clínica<br />Lichi</h1>
            <p className="panel-subtitle">
              Gestión integral de pacientes, consultas y registros clínicos en un solo lugar.
            </p>
          </div>

          <div className="panel-footer">
            <span className="panel-footer-tag">
              <span className="panel-footer-dot" />
              Sistema activo
            </span>
          </div>
        </div>

        {/* Panel derecho — formulario */}
        <div className="login-panel-right">
          <div className="form-wrapper">
            {/* Logo visible solo en móvil */}
            <div className="mobile-logo">
              <div className="mobile-logo-icon">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="mobile-logo-text">Clínica Lichi</span>
            </div>

            <h2 className="form-heading">Bienvenido</h2>
            <p className="form-subheading">Ingresá tus credenciales para continuar</p>

            <form onSubmit={handleSubmit} autoComplete="off">
              <div className="field">
                <label htmlFor="username">Usuario</label>
                <div className="input-wrap">
                  <svg className="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Nombre de usuario"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="password">Contraseña</label>
                <div className="input-wrap">
                  <svg className="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(p => !p)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-msg">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    Ingresando...
                  </>
                ) : (
                  'Ingresar'
                )}
              </button>
            </form>

            <div className="form-footer">
              Clínica Lichi &copy; {new Date().getFullYear()} — Sistema de Gestión Clínica
            </div>
          </div>
        </div>
      </div>
    </>
  )
}