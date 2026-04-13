import { useState, useCallback, useRef } from 'react'

/*
 * Hook useToast — gestiona el estado de una notificación Toast.
 *
 * Uso:
 *   const { toast, showToast } = useToast()
 *   showToast('Mensaje', 'success' | 'error' | 'warning', duracionMs?)
 *   <Toast toast={toast} />
 */
export function useToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    // Cancelar cualquier toast anterior antes de mostrar uno nuevo
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, type })
    timerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  return { toast, showToast }
}
