import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { extraerMensajeError } from '../utils/errores'

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

export function useUbicacionMutations(showToast) {
    const qc = useQueryClient()

    const crearPais = useMutation({
        mutationFn: (d) => apiClient.post('/pais/', d),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['paises'] }); showToast('País creado.', 'success') },
        onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })
    const actualizarPais = useMutation({
        mutationFn: ({ id, ...d }) => apiClient.patch(`/pais/${id}/`, d),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['paises'] }); showToast('País actualizado.', 'success') },
        onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })
    const eliminarPais = useMutation({
        mutationFn: (id) => apiClient.delete(`/pais/${id}/`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['paises'] }); showToast('País eliminado.', 'success') },
        onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })

    const crearDepto = useMutation({
        mutationFn: (d) => apiClient.post('/departamento/', d),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['departamentos'] }); showToast('Departamento creado.', 'success') },
        onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })
    const actualizarDepto = useMutation({
        mutationFn: ({ id, ...d }) => apiClient.patch(`/departamento/${id}/`, d),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['departamentos'] }); showToast('Departamento actualizado.', 'success') },
        onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })
    const eliminarDepto = useMutation({
        mutationFn: (id) => apiClient.delete(`/departamento/${id}/`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['departamentos'] }); showToast('Departamento eliminado.', 'success') },
        onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })

    const crearCiudad = useMutation({
        mutationFn: (d) => apiClient.post('/ciudad/', d),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['ciudades'] }); showToast('Ciudad creada.', 'success') },
        onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })
    const actualizarCiudad = useMutation({
        mutationFn: ({ id, ...d }) => apiClient.patch(`/ciudad/${id}/`, d),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['ciudades'] }); showToast('Ciudad actualizada.', 'success') },
        onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })
    const eliminarCiudad = useMutation({
        mutationFn: (id) => apiClient.delete(`/ciudad/${id}/`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['ciudades'] }); showToast('Ciudad eliminada.', 'success') },
        onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })

    return {
        crearPais, actualizarPais, eliminarPais,
        crearDepto, actualizarDepto, eliminarDepto,
        crearCiudad, actualizarCiudad, eliminarCiudad,
    }
}
