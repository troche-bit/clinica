import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

// ── Listado ──────────────────────────────────────────────
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

// ── Crear ────────────────────────────────────────────────
export function useCreatePersonaRRHH() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post('/personarrhh/', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['personasrrhh'] }),
  })
}

// ── Actualizar ───────────────────────────────────────────
export function useUpdatePersonaRRHH() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch('/personarrhh/' + id + '/', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['personasrrhh'] }),
  })
}

// ── Eliminar ─────────────────────────────────────────────
export function useDeletePersonaRRHH() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete('/personarrhh/' + id + '/'),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['personasrrhh'] }),
  })
}
