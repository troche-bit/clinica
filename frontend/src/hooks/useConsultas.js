import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

const BASE = '/consultas/'

// ── Consultas del día para un médico específico ──────────────────────────────
export function useConsultasDelDia(personaRrhhId, fecha) {
  return useQuery({
    queryKey: ['consultas', 'dia', personaRrhhId, fecha],
    queryFn: async () => {
      const params = {}
      if (personaRrhhId) params.persona_rrhh = personaRrhhId
      if (fecha) params.fecha = fecha
      const { data } = await apiClient.get(BASE, { params })
      return data
    },
    enabled: !!(personaRrhhId && fecha),
    refetchInterval: 60_000,
  })
}

// ── Historial de consultas de un paciente ────────────────────────────────────
export function useConsultasPaciente(pacienteId) {
  return useQuery({
    queryKey: ['consultas', 'paciente', pacienteId],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params: { paciente: pacienteId, page_size: 50 } })
      return data
    },
    enabled: !!pacienteId,
  })
}

// ── Detalle de una consulta ───────────────────────────────────────────────────
export function useConsultaDetalle(consultaId) {
  return useQuery({
    queryKey: ['consultas', consultaId],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}${consultaId}/`)
      return data
    },
    enabled: !!consultaId,
  })
}

// ── Iniciar consulta ──────────────────────────────────────────────────────────
export function useIniciarConsulta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (consultaId) => {
      const { data } = await apiClient.post(`${BASE}${consultaId}/iniciar/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

// ── Finalizar consulta ────────────────────────────────────────────────────────
export function useFinalizarConsulta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (consultaId) => {
      const { data } = await apiClient.post(`${BASE}${consultaId}/finalizar/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas'] })
      // Actualizar todas las vistas de agenda (el turno pasa a 'realizado')
      queryClient.invalidateQueries({ queryKey: ['agenda-dia'] })
      queryClient.invalidateQueries({ queryKey: ['agenda-mes'] })
      queryClient.invalidateQueries({ queryKey: ['agenda-dia-global'] })
      queryClient.invalidateQueries({ queryKey: ['agenda-resumen-mes'] })
      queryClient.invalidateQueries({ queryKey: ['agenda-global-mes'] })
    },
  })
}

// ── Actualizar consulta (PATCH) ───────────────────────────────────────────────
export function useUpdateConsulta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.patch(`${BASE}${id}/`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas'] })
    },
  })
}

// ── Crear consulta ────────────────────────────────────────────────────────────
export function useCrearConsulta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body) => {
      const { data } = await apiClient.post(BASE, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

// ── Stats de consultas de hoy ─────────────────────────────────────────────────
export function useStatsConsultasHoy() {
  return useQuery({
    queryKey: ['consultas', 'stats-hoy'],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}stats-hoy/`)
      return data
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

// ── Todas las consultas de hoy (vista recepcionista) ──────────────────────────
export function useConsultasHoy() {
  const d   = new Date()
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return useQuery({
    queryKey: ['consultas', 'hoy', hoy],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params: { fecha: hoy, page_size: 100 } })
      return data
    },
    refetchInterval: 60_000,
  })
}
