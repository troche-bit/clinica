import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

export function useHorariosPrestador({ persona_rrhh, estado } = {}) {
  return useQuery({
    queryKey: ['horarios-prestador', persona_rrhh, estado],
    queryFn: async () => {
      const params = new URLSearchParams({ page_size: 200 })
      if (persona_rrhh) params.append('persona_rrhh', persona_rrhh)
      if (estado)       params.append('estado', estado)
      const res = await apiClient.get('/horario-prestador/?' + params)
      return res.data
    },
  })
}

export function useCreateHorario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post('/horario-prestador/', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['horarios-prestador'] }),
  })
}

export function useUpdateHorario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch('/horario-prestador/' + id + '/', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['horarios-prestador'] }),
  })
}

export function useDeleteHorario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete('/horario-prestador/' + id + '/'),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['horarios-prestador'] }),
  })
}

export function useGenerarTurnos() {
  return useMutation({
    mutationFn: ({ id, fecha_desde, fecha_hasta }) =>
      apiClient.post('/horario-prestador/' + id + '/generar/', { fecha_desde, fecha_hasta }),
  })
}
