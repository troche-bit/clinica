import { useEffect, useRef } from 'react'

export function useAtajosTeclado(atajos) {
  const ref = useRef(atajos)
  ref.current = atajos

  useEffect(() => {
    const handler = (e) => {
      const config = ref.current[e.key]
      if (!config) return
      const { fn, soloFueraDeInputs = true } = config
      const enInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
      if (soloFueraDeInputs && enInput) return
      e.preventDefault()
      fn(e)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
