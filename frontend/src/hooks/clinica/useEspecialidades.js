import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

export function useEspecialidades(search = '') {
  return useQuery({
    queryKey: ['especialidades', search],
    queryFn: async () => {
      const params = new URLSearchParams({ page_size: 200 })
      if (search) params.append('search', search)
      const res = await apiClient.get(`/especialidad/?${params}`)
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useEspecialidadMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['especialidades'] })

  const crear      = useMutation({ mutationFn: (d) => apiClient.post('/especialidad/', d),                      onSuccess: inv })
  const actualizar = useMutation({ mutationFn: ({ id, ...d }) => apiClient.patch(`/especialidad/${id}/`, d), onSuccess: inv })
  const eliminar   = useMutation({ mutationFn: (id) => apiClient.delete(`/especialidad/${id}/`),               onSuccess: inv })

  return { crear, actualizar, eliminar }
}
