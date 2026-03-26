import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query' // Importa los hooks necesarios de React Query
import apiClient from '../api/client' // Importa el cliente API configurado para hacer las solicitudes HTTP

// Hook para obtener la lista de pacientes con paginación y búsqueda
export function useResponsables({ page = 1, pageSize = 20, search = '' } = {}) {
  return useQuery({
    queryKey: ['responsable', { page, pageSize, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page,
        page_size: pageSize,
        ...(search && { search }),
      })
      const { data } = await apiClient.get(`/pacienteresponsable/?${params}`)
      return data
    },
    staleTime: 1000 * 60 * 5,
    keepPreviousData: true, // Mantiene datos anteriores mientras carga la nueva página
  })
}

// Hook para crear un nuevo paciente
export function useCreateResponsable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post('/pacienteresponsable/', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['responsable'] }),
  })
}

// Hook para actualizar un paciente existente
export function useUpdateResponsable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`/pacienteresponsable/${id}/`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['responsable'] }),
  })
}

// Hook para eliminar un paciente
export function useDeleteResponsable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`/pacienteresponsable/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['responsable'] }),
  })
}