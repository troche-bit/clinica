import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

export function useResumenMes(personaRrhhId, mes, anio) {
  return useQuery({
    queryKey: ['agenda-resumen-mes', personaRrhhId, mes, anio],
    queryFn:  async () => {
      const res = await apiClient.get('/agenda/resumen-mes/', {
        params: { persona_rrhh: personaRrhhId, mes, anio },
      })
      return res.data
    },
    enabled: !!personaRrhhId && !!mes && !!anio,
  })
}

export function useAgendaDia(personaRrhhId, fecha) {
  return useQuery({
    queryKey: ['agenda-dia', personaRrhhId, fecha],
    queryFn:  async () => {
      const res = await apiClient.get('/agenda/', {
        params: { persona_rrhh: personaRrhhId, fecha, page_size: 200 },
      })
      return res.data.results ?? res.data
    },
    enabled: !!personaRrhhId && !!fecha,
  })
}

export function useAgendaMes(personaRrhhId, mes, anio) {
  return useQuery({
    queryKey: ['agenda-mes', personaRrhhId, mes, anio],
    queryFn:  async () => {
      const diasMes    = new Date(anio, mes, 0).getDate()
      const fechaDesde = `${anio}-${String(mes).padStart(2, '0')}-01`
      const fechaHasta = `${anio}-${String(mes).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`
      const res = await apiClient.get('/agenda/', {
        params: { persona_rrhh: personaRrhhId, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, page_size: 500 },
      })
      return res.data.results ?? res.data
    },
    enabled: !!personaRrhhId && !!mes && !!anio,
  })
}

export function useAgendaDiaGlobal(fecha) {
  return useQuery({
    queryKey: ['agenda-dia-global', fecha],
    queryFn:  async () => {
      const res = await apiClient.get('/agenda/', {
        params: { fecha, page_size: 200 },
      })
      return res.data.results ?? res.data
    },
    enabled: !!fecha,
  })
}

export function useAgendaGlobalMes(mes, anio) {
  return useQuery({
    queryKey: ['agenda-global-mes', mes, anio],
    queryFn:  async () => {
      const diasMes    = new Date(anio, mes, 0).getDate()
      const fechaDesde = `${anio}-${String(mes).padStart(2, '0')}-01`
      const fechaHasta = `${anio}-${String(mes).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`
      const res = await apiClient.get('/agenda/', {
        params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, page_size: 2000 },
      })
      return res.data.results ?? res.data
    },
    enabled: !!mes && !!anio,
  })
}

export function useStatsHoy() {
  return useQuery({
    queryKey: ['agenda-stats-hoy'],
    queryFn:  async () => {
      const res = await apiClient.get('/agenda/stats-hoy/')
      return res.data
    },
    staleTime: 60 * 1000,
  })
}

export function useAsignarTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, paciente_id, observacion }) =>
      apiClient.patch(`/agenda/${id}/asignar/`, { paciente_id, observacion }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-dia'] })
      qc.invalidateQueries({ queryKey: ['agenda-mes'] })
      qc.invalidateQueries({ queryKey: ['agenda-dia-global'] })
      qc.invalidateQueries({ queryKey: ['agenda-resumen-mes'] })
      qc.invalidateQueries({ queryKey: ['agenda-global-mes'] })
    },
  })
}

export function useCambiarEstado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, estado }) =>
      apiClient.patch(`/agenda/${id}/estado/`, { estado }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-dia'] })
      qc.invalidateQueries({ queryKey: ['agenda-mes'] })
      qc.invalidateQueries({ queryKey: ['agenda-dia-global'] })
      qc.invalidateQueries({ queryKey: ['agenda-resumen-mes'] })
      qc.invalidateQueries({ queryKey: ['agenda-global-mes'] })
    },
  })
}

export function usePacienteSearch(q) {
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300)
    return () => clearTimeout(t)
  }, [q])
  return useQuery({
    queryKey: ['pacientes-search-agenda', debounced],
    queryFn:  async () => {
      const res = await apiClient.get('/paciente/', { params: { search: debounced, page_size: 10 } })
      return res.data.results ?? []
    },
    enabled: debounced.length >= 2,
  })
}
