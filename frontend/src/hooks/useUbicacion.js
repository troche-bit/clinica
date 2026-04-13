import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'

// Obtiene la lista de países con cache de 30 minutos
export function usePaises() {
    return useQuery({
        queryKey: ['paises'],
        queryFn: async () => {
            const { data } = await apiClient.get('/pais/?page_size=100')
            return data.results
        },
        staleTime: 1000 * 60 * 30,
    })
}

// Obtiene los departamentos de un país, solo cuando paisId es válido
export function useDepartamentos(paisId) {
    return useQuery({
        queryKey: ['departamentos', paisId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/departamento/?pais=${paisId}&page_size=100`)
            return data.results
        },
        enabled: !!paisId,
        staleTime: 1000 * 60 * 30,
    })
}

// Obtiene las ciudades de un departamento, solo cuando departamentoId es válido
export function useCiudades(departamentoId) {
    return useQuery({
        queryKey: ['ciudades', departamentoId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/ciudad/?departamento=${departamentoId}&page_size=100`)
            return data.results
        },
        enabled: !!departamentoId,
        staleTime: 1000 * 60 * 30,
    })
}
