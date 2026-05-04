import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

const BASE      = '/recordatorios/'
const BASE_NOTIF = '/notificaciones/'

export function useProximasCitas(filtros = {}) {
  const params = {}
  if (filtros.periodo)  params.periodo = filtros.periodo
  if (filtros.dias)     params.dias    = filtros.dias
  if (filtros.medico)   params.medico  = filtros.medico
  if (filtros.estado)   params.estado  = filtros.estado

  return useQuery({
    queryKey: ['recordatorios', 'proximas-citas', filtros],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}proximas-citas/`, { params })
      return data
    },
    staleTime: 60_000,
  })
}

export function useStatsRecordatorios() {
  return useQuery({
    queryKey: ['recordatorios', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}stats/`)
      return data
    },
    staleTime: 60_000,
  })
}

export function useNotificar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ consulta_id, tipo, canal, mensaje_personalizado }) => {
      const { data } = await apiClient.post(`${BASE}notificar/`, {
        consulta_id,
        tipo,
        canal,
        mensaje_personalizado,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordatorios'] })
      queryClient.invalidateQueries({ queryKey: ['historial-notificaciones'] })
    },
  })
}

export function useHistorialNotificaciones(pacienteId) {
  return useQuery({
    queryKey: ['historial-notificaciones', pacienteId],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE_NOTIF, {
        params: { paciente: pacienteId, page_size: 50 },
      })
      return data?.results ?? data ?? []
    },
    enabled: !!pacienteId,
  })
}

export function useMedicosLista() {
  return useQuery({
    queryKey: ['medicos-lista'],
    queryFn: async () => {
      const { data } = await apiClient.get('/personarrhh/', {
        params: { cargo: 'medico', page_size: 200 },
      })
      return data?.results ?? data ?? []
    },
    staleTime: 5 * 60_000,
  })
}
