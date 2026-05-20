import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NavigationGuardProvider } from './hooks/useNavigationGuard'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Layout from './components/layout/Layout'
import PacientePage from './pages/clinica/PacientePage'
import InformesPacientePage from './pages/clinica/InformesPacientePage'
import DashboardPacientesPage from './pages/clinica/DashboardPacientesPage'
import DashboardConsultasPage from './pages/clinica/DashboardConsultasPage'
import DashboardAgendaPage from './pages/clinica/DashboardAgendaPage'
import DashboardPrestadoresPage from './pages/clinica/DashboardPrestadoresPage'
import DashboardOcupacionPage from './pages/clinica/DashboardOcupacionPage'
import PacienteResponsablePage from './pages/clinica/PacienteResponsablePage'
import UbicacionesPage from './pages/mantenimiento/UbicacionesPage'
import ConsultorioPage from './pages/clinica/configuracion/ConsultorioPage'
import EspecialidadPage from './pages/clinica/configuracion/EspecialidadPage'
import EventoClinicoPage from './pages/mantenimiento/EventoClinicoPage'
import TipoDocDigPage from './pages/mantenimiento/TipoDocDigPage'
import PersonaRRHHPage from './pages/administracion/PersonaRRHHPage'
import HorarioPrestadorPage from './pages/clinica/configuracion/HorarioPrestadorPage'
import AgendaPage from './pages/clinica/AgendaPage'
import ConsultasPage from './pages/clinica/ConsultasPage'
import DocumentosPage from './pages/mantenimiento/DocumentosPage'
import RecordatoriosPage from './pages/clinica/RecordatoriosPage'
import RecordatoriosConfigPage from './pages/clinica/RecordatoriosConfigPage'
import TimbradoPage from './pages/facturacion/TimbradoPage'
import GruposPage from './pages/stock/GruposPage'
import CuentasMcbPage from './pages/finanzas/CuentasMcbPage'
import FacturacionPage from './pages/facturacion/FacturacionPage'
import CobranzasPage from './pages/finanzas/CobranzasPage'
import PagoPrestadorPage from './pages/finanzas/PagoPrestadorPage'
import UsuariosPage from './pages/administracion/UsuariosPage'
import AuditoriaPage from './pages/administracion/AuditoriaPage'

export default function App() {
  return (
    <NavigationGuardProvider>
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

        <Route
          path="/mantenimiento/ubicaciones"
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

        <Route
          path="/clinica/configuracion/especialidades"
          element={
            <PrivateRoute>
              <Layout>
                <EspecialidadPage />
              </Layout>
            </PrivateRoute>
          }
        />

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

        {/* Rutas de recordatorios */}
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
          path="/agenda/recordatorios/configuracion"
          element={
            <PrivateRoute>
              <Layout>
                <RecordatoriosConfigPage />
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

        <Route
          path="/informes/dashboard/consultas"
          element={
            <PrivateRoute>
              <Layout>
                <DashboardConsultasPage />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/informes/dashboard/agenda"
          element={
            <PrivateRoute>
              <Layout>
                <DashboardAgendaPage />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/informes/dashboard/prestadores"
          element={
            <PrivateRoute>
              <Layout>
                <DashboardPrestadoresPage />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/informes/dashboard/ocupacion"
          element={
            <PrivateRoute>
              <Layout>
                <DashboardOcupacionPage />
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

        <Route
          path="/administracion/auditoria"
          element={
            <PrivateRoute roles={['admin']}>
              <Layout>
                <AuditoriaPage />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route path="/" element={<Navigate to="/paciente" replace/>} />
        <Route path="*" element={<div>Página no encontrada</div>} />
      </Routes>
    </AuthProvider>
    </NavigationGuardProvider>
  )
}
