import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

const BASE        = '/recordatorios/'
const BASE_NOTIF  = '/notificaciones/'
const BASE_PLANT  = '/notificaciones/plantillas/'
const BASE_CONF   = '/notificaciones/configuracion/'

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

export function useConfiguracion() {
  return useQuery({
    queryKey: ['notificaciones', 'configuracion'],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE_CONF)
      return data
    },
    staleTime: 30_000,
  })
}

export function useUpdateConfiguracion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await apiClient.patch(BASE_CONF, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones', 'configuracion'] })
    },
  })
}

export function useProbarConexion() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`${BASE_NOTIF}probar-conexion/`)
      return data
    },
  })
}

export function usePlantillas() {
  return useQuery({
    queryKey: ['notificaciones', 'plantillas'],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE_PLANT, { params: { page_size: 50 } })
      return data?.results ?? data ?? []
    },
  })
}

export function useCreatePlantilla() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post(BASE_PLANT, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones', 'plantillas'] })
    },
  })
}

export function useUpdatePlantilla() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await apiClient.patch(`${BASE_PLANT}${id}/`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones', 'plantillas'] })
    },
  })
}

export function useDeletePlantilla() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE_PLANT}${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones', 'plantillas'] })
    },
  })
}

export function useSubirImagenPlantilla() {
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData()
      form.append('file', file)
      const token = localStorage.getItem('access_token')
      const res = await fetch('/api/notificaciones/plantillas/subir-imagen/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al subir la imagen.')
      }
      return res.json()
    },
  })
}

export function useReenviarNotificacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.post(`${BASE_NOTIF}${id}/reenviar/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historial-notificaciones'] })
    },
  })
}
