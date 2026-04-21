import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

const BASE = '/documentos/'

// ── Pacientes que tienen al menos un documento ────────────────────────────────
export function usePacientesConDocumentos(search = '') {
  return useQuery({
    queryKey: ['documentos', 'pacientes', search],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}pacientes/`, {
        params: search ? { search } : {},
      })
      return data
    },
  })
}

// ── Documentos de un paciente ─────────────────────────────────────────────────
export function useDocumentosPorPaciente(pacienteId) {
  return useQuery({
    queryKey: ['documentos', 'paciente', pacienteId],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, {
        params: { paciente: pacienteId, page_size: 200 },
      })
      return data?.results ?? data ?? []
    },
    enabled: !!pacienteId,
  })
}

// ── Documentos de una consulta ────────────────────────────────────────────────
export function useDocumentosPorConsulta(consultaId) {
  return useQuery({
    queryKey: ['documentos', 'consulta', consultaId],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params: { consulta: consultaId } })
      return data
    },
    enabled: !!consultaId,
  })
}

// ── Subir documento (multipart/form-data) ────────────────────────────────────
// Usa fetch nativo en lugar de apiClient: apiClient tiene Content-Type: application/json
// como default, lo que hace que axios serialice el FormData como JSON (perdiendo el archivo).
// fetch sin Content-Type explícito deja que el browser ponga multipart/form-data + boundary.
export function useSubirDocumento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData) => {
      const token = localStorage.getItem('access_token')
      const res = await fetch('/api/documentos/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const err = new Error('Error al subir documento')
        err.response = { data: errBody, status: res.status }
        throw err
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] })
    },
  })
}

// ── Eliminar documento (borrado lógico) ───────────────────────────────────────
export function useDeleteDocumento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentoId) => {
      await apiClient.delete(`${BASE}${documentoId}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] })
    },
  })
}
