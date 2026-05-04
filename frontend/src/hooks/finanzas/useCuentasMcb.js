import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

const BASE = '/cuentas-mcb/'

export function useCuentasMcb(filters = {}) {
  const params = {}
  if (filters.search) params.search = filters.search

  return useQuery({
    queryKey: ['cuentas-mcb', filters],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params })
      return data
    },
  })
}

export function useCreateCuenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post(BASE, data).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] }),
  })
}

export function useUpdateCuenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`${BASE}${id}/`, data).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] }),
  })
}

export function useDeleteCuenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] }),
  })
}
