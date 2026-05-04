import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { extraerMensajeError } from '../../utils/errores'

export function usePersonasRRHH({ page = 1, search = '' } = {}) {
  return useQuery({
    queryKey: ['personasrrhh', page, search],
    queryFn:  async () => {
      const params = new URLSearchParams({ page })
      if (search) params.append('search', search)
      const res = await apiClient.get('/personarrhh/?' + params)
      return res.data
    },
  })
}

export function useCreatePersonaRRHH() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post('/personarrhh/', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['personasrrhh'] }),
  })
}

export function useUpdatePersonaRRHH() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch('/personarrhh/' + id + '/', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['personasrrhh'] }),
  })
}

export function useBuscarPersonasRRHH(q) {
  return useQuery({
    queryKey: ['buscar-rrhh', q],
    queryFn: async () => {
      const { data } = await apiClient.get('/personarrhh/', { params: { search: q, page_size: 8 } })
      return data?.results ?? data ?? []
    },
    enabled: !!q && q.length >= 2,
  })
}

export function usePersonaRRHHMutations(showToast) {
  const qc = useQueryClient()
  const eliminar = useMutation({
    mutationFn: (id) => apiClient.delete('/personarrhh/' + id + '/'),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['personasrrhh'] })
      showToast('Prestador eliminado correctamente.', 'success')
    },
    onError: (err) => showToast(extraerMensajeError(err), 'error'),
  })
  return { eliminar }
}
