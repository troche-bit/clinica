import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { extraerMensajeError } from '../../utils/errores'

export function useTipoDocDig(search = '') {
  return useQuery({
    queryKey: ['tipo-doc-dig', search],
    queryFn: async () => {
      const params = new URLSearchParams({ page_size: 100 })
      if (search) params.append('search', search)
      const res = await apiClient.get(`/tipo-doc-dig/?${params}`)
      return res.data
    },
  })
}

export function useTipoDocDigMutations(showToast) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['tipo-doc-dig'] })

  const crear = useMutation({
    mutationFn: (d) => apiClient.post('/tipo-doc-dig/', d),
    onSuccess: () => { inv(); showToast('Tipo de documento creado.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })
  const actualizar = useMutation({
    mutationFn: ({ id, ...d }) => apiClient.patch(`/tipo-doc-dig/${id}/`, d),
    onSuccess: () => { inv(); showToast('Tipo de documento actualizado.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })
  const eliminar = useMutation({
    mutationFn: (id) => apiClient.delete(`/tipo-doc-dig/${id}/`),
    onSuccess: () => { inv(); showToast('Tipo de documento eliminado.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })

  return { crear, actualizar, eliminar }
}
