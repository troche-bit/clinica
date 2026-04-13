import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

// Obtiene la lista de tipos de documento digitalizado con búsqueda opcional
export function useTipoDocDig(search = '') {
  return useQuery({
    queryKey: ['tipo-doc-dig', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      const res = await apiClient.get(`/tipo-doc-dig/?${params}`)
      return res.data
    },
  })
}

// Mutaciones CRUD: crear, actualizar (PATCH) y eliminar
export function useTipoDocDigMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['tipo-doc-dig'] })

  const crear      = useMutation({ mutationFn: (d) => apiClient.post('/tipo-doc-dig/', d),                      onSuccess: inv })
  const actualizar = useMutation({ mutationFn: ({ id, ...d }) => apiClient.patch(`/tipo-doc-dig/${id}/`, d), onSuccess: inv })
  const eliminar   = useMutation({ mutationFn: (id) => apiClient.delete(`/tipo-doc-dig/${id}/`),           onSuccess: inv })

  return { crear, actualizar, eliminar }
}
