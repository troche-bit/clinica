import { useQuery } from '@tanstack/react-query' // Importamos el hook useQuery de react-query
import apiClient from '../api/client' // Importamos nuestro cliente API personalizado

export function usePaises() {
    return useQuery({
        queryKey: ['paises'], // Clave única para esta consulta
        queryFn: async () => {
            const { data } = await apiClient.get('/pais/?page_size=100') // Realizamos una solicitud GET a la API para obtener la lista de países
            return data.results // Devolvemos el resultado de la consulta
    },
    staleTime: 1000 * 60 * 30, // Tiempo en milisegundos para considerar los datos como frescos (30 minutos)
    })
}

export function useDepartamentos(paisId) {
    return useQuery({
        queryKey: ['departamentos', paisId], // Clave única para esta consulta, incluye el ID del país
        queryFn: async () => {
            const { data } = await apiClient.get(`/departamento/?pais=${paisId}&page_size=100`) // Realizamos una solicitud GET a la API para obtener la lista de departamentos según el ID del país
            return data.results // Devolvemos el resultado de la consulta
    },
    enabled: !!paisId, // Habilitamos esta consulta solo si el ID del país está disponible
    staleTime: 1000 * 60 * 30, // Tiempo en milisegundos para considerar los datos como frescos (30 minutos)
    })
}

export function useCiudades(departamentoId) {
    return useQuery({
        queryKey: ['ciudades', departamentoId], // Clave única para esta consulta, incluye el ID del departamento
        queryFn: async () => {
            const { data } = await apiClient.get(`/ciudad/?departamento=${departamentoId}&page_size=100`) // Realizamos una solicitud GET a la API para obtener la lista de ciudades según el ID del departamento
            return data.results // Devolvemos el resultado de la consulta
    },
    enabled: !!departamentoId, // Habilitamos esta consulta solo si el ID del departamento está disponible
    staleTime: 1000 * 60 * 30, // Tiempo en milisegundos para considerar los datos como frescos (30 minutos)
    })
}