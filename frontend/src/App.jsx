import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Layout from './components/layout/Layout'
import Paciente from './pages/Paciente'
import PacienteResponsablePage from './pages/PacienteResponsablePage'
//import Paciente from './pages/ResponsablePacientePage'

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
                <Paciente />
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
          path="/citas"
          element={
            <PrivateRoute>
              <Layout>
                <div>Página de Citas — en construcción</div>
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
        <Route path="/" element={<Navigate to="/paciente" replace/>} />
        <Route path="*" element={<div>Página no encontrada</div>} />
      </Routes>
    </AuthProvider>
  )
}