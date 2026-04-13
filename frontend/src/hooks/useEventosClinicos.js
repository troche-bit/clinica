import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

// Obtiene la lista de eventos clínicos con búsqueda opcional
export function useEventosClinicos(search = '') {
  return useQuery({
    queryKey: ['eventosclinicos', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      const res = await apiClient.get(`/eventoclinico/?${params}`)
      return res.data
    },
  })
}

// Mutaciones CRUD para eventos clínicos: crear, actualizar (PATCH) y eliminar
export function useEventoClinicoMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['eventosclinicos'] })

  const crear      = useMutation({ mutationFn: (d) => apiClient.post('/eventoclinico/', d),                         onSuccess: inv })
  const actualizar = useMutation({ mutationFn: ({ id, ...d }) => apiClient.patch(`/eventoclinico/${id}/`, d), onSuccess: inv })
  const eliminar   = useMutation({ mutationFn: (id) => apiClient.delete(`/eventoclinico/${id}/`),            onSuccess: inv })

  return { crear, actualizar, eliminar }
}
