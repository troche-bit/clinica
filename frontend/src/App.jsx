import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Layout from './components/layout/Layout'
import PacientePage from './pages/clinica/PacientePage'
import InformesPacientePage from './pages/clinica/InformesPacientePage'
import DashboardPacientesPage from './pages/clinica/DashboardPacientesPage'
import PacienteResponsablePage from './pages/clinica/PacienteResponsablePage'
import UbicacionesPage from './pages/UbicacionesPage'
import ConsultorioPage from './pages/ConsultorioPage'
import EspecialidadPage from './pages/EspecialidadPage'
import EventoClinicoPage from './pages/EventoClinicoPage'
import TipoDocDigPage from './pages/TipoDocDigPage'
import PersonaRRHHPage from './pages/administracion/PersonaRRHHPage'
import HorarioPrestadorPage from './pages/clinica/configuracion/HorarioPrestadorPage'
import AgendaPage from './pages/AgendaPage'
import ConsultasPage from './pages/ConsultasPage'
import DocumentosPage from './pages/DocumentosPage'
import RecordatoriosPage from './pages/RecordatoriosPage'
import TimbradoPage from './pages/TimbradoPage'
import GruposPage from './pages/GruposPage'
import CuentasMcbPage from './pages/CuentasMcbPage'
import FacturacionPage from './pages/FacturacionPage'
import CobranzasPage from './pages/CobranzasPage'
import PagoPrestadorPage from './pages/PagoPrestadorPage'
import UsuariosPage from './pages/UsuariosPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>

        // Ruta pública para login
        <Route path="/login" element={<Login />} />
        
        // Ruta para listar pacientes
        <Route 
          path="/paciente"
          element={
            <PrivateRoute>
              <Layout>
                <PacientePage />
              </Layout>
            </PrivateRoute>
          }
        />

        // Ruta para listar paciente responsable
        <Route 
          path="/pacienteresponsable"
          element={
            <PrivateRoute>
              <Layout>
                <PacienteResponsablePage />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/pagos"
          element={
            <PrivateRoute>
              <Layout>
                <div>Página de Pagos — en construcción</div>
              </Layout>
            </PrivateRoute>
          }
        />

        // Ruta para listar ubicaciones
        <Route 
          path="/ubicaciones"
          element={
            <PrivateRoute>
              <Layout>
                <UbicacionesPage />
              </Layout>
            </PrivateRoute>
          }
        />

        // Ruta para listar consultorios
        <Route 
          path="/mantenimiento/consultorios"
          element={
            <PrivateRoute>
              <Layout>
                <ConsultorioPage />
              </Layout>
            </PrivateRoute>
          }
        />

        // Ruta para gestión de prestadores (RRHH)
        <Route
          path="/rrhh/personal"
          element={
            <PrivateRoute>
              <Layout>
                <PersonaRRHHPage />
              </Layout>
            </PrivateRoute>
          }
        />

        // Ruta para listar especialidades
        <Route
          path="/rrhh/especialidades"
          element={
            <PrivateRoute>
              <Layout>
                <EspecialidadPage />
              </Layout>
            </PrivateRoute>
          }
        />

        // Ruta para listar eventos clinicos
        <Route 
          path="/consultas/eventos"
          element={
            <PrivateRoute>
              <Layout>
                <EventoClinicoPage />
              </Layout>
            </PrivateRoute>
          }
        />
        {/* Ruta para tipos de documento digitalizado */}
        <Route
          path="/mantenimiento/tipo-doc"
          element={
            <PrivateRoute>
              <Layout>
                <TipoDocDigPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para horarios de prestadores */}
        <Route
          path="/agenda/horarios"
          element={
            <PrivateRoute>
              <Layout>
                <HorarioPrestadorPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para agenda y citas */}
        <Route
          path="/agenda/citas"
          element={
            <PrivateRoute>
              <Layout>
                <AgendaPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para consultas médicas */}
        <Route
          path="/consultas"
          element={
            <PrivateRoute>
              <Layout>
                <ConsultasPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para recordatorios */}
        <Route
          path="/agenda/recordatorios"
          element={
            <PrivateRoute>
              <Layout>
                <RecordatoriosPage />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/informes"
          element={
            <PrivateRoute>
              <Layout>
                <InformesPacientePage />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/informes/dashboard/pacientes"
          element={
            <PrivateRoute>
              <Layout>
                <DashboardPacientesPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para documentos digitalizados */}
        <Route
          path="/pacientes/documentos"
          element={
            <PrivateRoute>
              <Layout>
                <DocumentosPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para cuentas caja/banco */}
        <Route
          path="/finanzas/cuentas"
          element={
            <PrivateRoute>
              <Layout>
                <CuentasMcbPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para cobranzas */}
        <Route
          path="/finanzas/cobranzas"
          element={
            <PrivateRoute>
              <Layout>
                <CobranzasPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para pago a prestadores */}
        <Route
          path="/finanzas/pago-prestador"
          element={
            <PrivateRoute>
              <Layout>
                <PagoPrestadorPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para grupos y productos */}
        <Route
          path="/facturacion/grupos"
          element={
            <PrivateRoute>
              <Layout>
                <GruposPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para facturación / ventas */}
        <Route
          path="/facturacion/ventas"
          element={
            <PrivateRoute>
              <Layout>
                <FacturacionPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para timbrado */}
        <Route
          path="/facturacion/timbrado"
          element={
            <PrivateRoute>
              <Layout>
                <TimbradoPage />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Ruta para gestión de usuarios */}
        <Route
          path="/sistema/usuarios"
          element={
            <PrivateRoute>
              <Layout>
                <UsuariosPage />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route path="/" element={<Navigate to="/paciente" replace/>} />
        <Route path="*" element={<div>Página no encontrada</div>} />
      </Routes>
    </AuthProvider>
  )
}
