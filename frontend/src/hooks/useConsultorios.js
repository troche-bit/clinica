import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

// Obtiene la lista de consultorios con búsqueda opcional
export function useConsultorios(search = '') {
  return useQuery({
    queryKey: ['consultorios', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      const res = await apiClient.get(`/consultorio/?${params}`)
      return res.data
    },
  })
}

// Mutaciones CRUD para consultorios: crear, actualizar (PATCH) y eliminar
export function useConsultorioMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['consultorios'] })

  const crear      = useMutation({ mutationFn: (d) => apiClient.post('/consultorio/', d),                    onSuccess: inv })
  const actualizar = useMutation({ mutationFn: ({ id, ...d }) => apiClient.patch(`/consultorio/${id}/`, d), onSuccess: inv })
  const eliminar   = useMutation({ mutationFn: (id) => apiClient.delete(`/consultorio/${id}/`),            onSuccess: inv })

  return { crear, actualizar, eliminar }
}
