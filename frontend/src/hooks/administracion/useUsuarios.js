import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

export function useUsuarios(filters = {}) {
  return useQuery({
    queryKey: ['usuarios', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.rol) params.append('rol', filters.rol)
      if (filters.activo !== undefined && filters.activo !== '') params.append('activo', filters.activo)
      const res = await apiClient.get(`/usuarios/?${params}`)
      return res.data
    },
  })
}

export function useCreateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post('/usuarios/', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export function useUpdateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`/usuarios/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export function useCambiarEstadoUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.post(`/usuarios/${id}/cambiar-estado/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export function useResetearPassword() {
  return useMutation({
    mutationFn: ({ id, nueva_password }) =>
      apiClient.post(`/usuarios/${id}/resetear-password/`, { nueva_password }),
  })
}

export function useCambiarPassword() {
  return useMutation({
    mutationFn: ({ current_password, nueva_password }) =>
      apiClient.post('/usuarios/cambiar-password/', { current_password, nueva_password }),
  })
}
