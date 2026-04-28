import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { extraerMensajeError } from '../../utils/errores'

export function useResponsables({ page = 1, search = '' } = {}) {
  return useQuery({
    queryKey: ['responsables', page, search],
    queryFn:  async () => {
      const params = new URLSearchParams({ page })
      if (search) params.append('search', search)
      const res = await apiClient.get(`/pacienteresponsable/?${params}`)
      return res.data
    },
  })
}

export function useCreateResponsable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post('/pacienteresponsable/', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['responsables'] }),
  })
}

export function useUpdateResponsable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`/pacienteresponsable/${id}/`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['responsables'] }),
  })
}

export function useResponsableMutations(showToast) {
  const qc = useQueryClient()
  const eliminar = useMutation({
    mutationFn: (id) => apiClient.delete(`/pacienteresponsable/${id}/`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['responsables'] })
      showToast('Responsable eliminado correctamente.', 'success')
    },
    onError: (err) => showToast(extraerMensajeError(err), 'error'),
  })
  return { eliminar }
}
