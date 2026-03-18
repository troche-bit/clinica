import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query' // Importa los hooks necesarios de React Query
import apiClient from '../api/client' // Importa el cliente API configurado para hacer las solicitudes HTTP

// Hook para obtener la lista de pacientes con paginación y búsqueda
export function usePatients({ page = 1, pageSize = 20, search = '' } = {}) {
  return useQuery({
    queryKey: ['patients', { page, pageSize, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page,
        page_size: pageSize,
        ...(search && { search }),
      })
      const { data } = await apiClient.get(`/paciente/?${params}`)
      return data
    },
    staleTime: 1000 * 60 * 5,
    keepPreviousData: true, // Mantiene datos anteriores mientras carga la nueva página
  })
}

// Hook para crear un nuevo paciente
export function useCreatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post('/paciente/', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  })
}

// Hook para actualizar un paciente existente
export function useUpdatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`/paciente/${id}/`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  })
}

// Hook para eliminar un paciente
export function useDeletePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`/paciente/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  })
}