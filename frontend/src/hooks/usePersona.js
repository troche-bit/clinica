import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query' // Importamos los hooks necesarios de React Query
import apiClient from '../api/client' // Importamos nuestro cliente API personalizado

export function useTipoDocumento() {
    return useQuery({
        queryKey: ['tipo-Documento'], // Clave única para esta consulta
        queryFn: async () => {
            const { data } = await apiClient.get('/tipo-documento/?page_size=100') // Realizamos una solicitud GET a la API para obtener los tipos de documento
            return data.results // Devolvemos los datos obtenidos de la respuesta
        },
        staleTime: 1000 * 60 * 30, // Establecemos un tiempo de vida para los datos en caché (30 minutos)
    })
}

export function useCreatePersona() {
    const queryClient = useQueryClient() // Obtenemos el cliente de consultas para poder invalidar cachés después de una mutación
    
    return useMutation({
        mutationFn: (data) => apiClient.post('/persona/', data), // Realizamos una solicitud POST a la API para crear una nueva persona con los datos proporcionados
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personas'] }), // Invalidamos la caché de personas para que se vuelva a cargar con los datos actualizados después de crear una nueva persona
    })
}

export function useUpdatePersona() {
    const queryClient = useQueryClient() // Obtenemos el cliente de consultas para poder invalidar cachés después de una mutación
    
    return useMutation({
        mutationFn: ({ id, ...data }) => apiClient.patch(`/persona/${id}/`, data), // Realizamos una solicitud PUT a la API para actualizar una persona existente con los datos proporcionados
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personas'] }), // Invalidamos la caché de personas para que se vuelva a cargar con los datos actualizados después de actualizar una persona
    })
}