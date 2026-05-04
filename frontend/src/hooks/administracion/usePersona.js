import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

export function useTipoDocumento() {
    return useQuery({
        queryKey: ['tipo-Documento'],
        queryFn: async () => {
            const { data } = await apiClient.get('/tipo-documento/?page_size=100')
            return data.results
        },
        staleTime: 1000 * 60 * 30,
    })
}

export function useCreatePersona() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data) => apiClient.post('/persona/', data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personas'] }),
    })
}

export function useUpdatePersona() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, ...data }) => apiClient.patch(`/persona/${id}/`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personas'] }),
    })
}
