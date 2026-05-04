import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

const BASE = '/grupos/'

export function useGrupos(filters = {}) {
  const params = {}
  if (filters.search) params.search = filters.search
  if (filters.activo !== undefined && filters.activo !== '') params.activo = filters.activo

  return useQuery({
    queryKey: ['grupos', filters],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params })
      return data
    },
  })
}

export function useCreateGrupo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post(BASE, data).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grupos'] }),
  })
}

export function useUpdateGrupo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`${BASE}${id}/`, data).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grupos'] }),
  })
}

export function useDeleteGrupo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grupos'] }),
  })
}
