import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

const BASE = '/consultas/'

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

function invalidarAgenda(qc) {
  qc.invalidateQueries({ queryKey: ['agenda-dia'] })
  qc.invalidateQueries({ queryKey: ['agenda-mes'] })
  qc.invalidateQueries({ queryKey: ['agenda-dia-global'] })
  qc.invalidateQueries({ queryKey: ['agenda-resumen-mes'] })
  qc.invalidateQueries({ queryKey: ['agenda-global-mes'] })
  qc.invalidateQueries({ queryKey: ['agenda-rango'] })
  qc.invalidateQueries({ queryKey: ['agenda-stats-hoy'] })
}

export function useIniciarConsulta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (consultaId) => {
      const { data } = await apiClient.post(`${BASE}${consultaId}/iniciar/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas'] })
      invalidarAgenda(queryClient)
    },
  })
}

export function useFinalizarConsulta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (consultaId) => {
      const { data } = await apiClient.post(`${BASE}${consultaId}/finalizar/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas'] })
      invalidarAgenda(queryClient)
    },
  })
}

export function useAnularConsulta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (consultaId) => {
      const { data } = await apiClient.post(`${BASE}${consultaId}/anular/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas'] })
      invalidarAgenda(queryClient)
    },
  })
}

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

export function useCrearConsulta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body) => {
      const { data } = await apiClient.post(BASE, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas'] })
      invalidarAgenda(queryClient)
    },
  })
}

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

export function useConsultasHoy(fecha) {
  const d   = new Date()
  const def = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const f   = fecha || def
  return useQuery({
    queryKey: ['consultas', 'hoy', f],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params: { fecha: f, page_size: 100 } })
      return data
    },
    refetchInterval: 60_000,
  })
}
