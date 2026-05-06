import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

const BASE = '/timbrado/'

export function useTimbrados(filters = {}) {
  const params = {}
  if (filters.search)  params.search  = filters.search
  if (filters.vigente !== undefined && filters.vigente !== '') params.vigente = filters.vigente

  return useQuery({
    queryKey: ['timbrado', filters],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params })
      return data
    },
  })
}

export function useCreateTimbrado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post(BASE, data).then(r => r.data),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['timbrado'] }),
  })
}

export function useUpdateTimbrado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`${BASE}${id}/`, data).then(r => r.data),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['timbrado'] }),
  })
}

export function useDeleteTimbrado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`${BASE}${id}/`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['timbrado'] }),
  })
}
