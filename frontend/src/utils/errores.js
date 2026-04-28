// Extrae el primer mensaje de error legible de una respuesta 400 de DRF.
// DRF puede devolver: string, { campo: [mensajes] } o { detail: 'msg' }
export function extraerMensajeError(err) {
  const data = err?.response?.data
  if (!data) return 'Ocurrió un error inesperado.'
  if (typeof data === 'string') return data
  const valores = Object.values(data)
  if (valores.length === 0) return 'Error al guardar.'
  const primero = valores[0]
  return Array.isArray(primero) ? primero[0] : String(primero)
}
