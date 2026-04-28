import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { extraerMensajeError } from '../../utils/errores'

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
    keepPreviousData: true,
  })
}

export function useCreatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post('/paciente/', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  })
}

export function useUpdatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`/paciente/${id}/`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  })
}

export function usePacienteMutations(showToast) {
  const queryClient = useQueryClient()
  const eliminar = useMutation({
    mutationFn: (id) => apiClient.delete(`/paciente/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      showToast('Paciente eliminado correctamente.', 'success')
    },
    onError: (err) => showToast(extraerMensajeError(err), 'error'),
  })
  return { eliminar }
}
