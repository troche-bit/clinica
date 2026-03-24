
export function calcularDV(ruc) {
  if (!ruc || isNaN(ruc)) return ''
  
  const baseMultiplicadores = [2, 3, 4, 5, 6, 7, 8, 9]
  const digits = String(ruc).split('').reverse()
  
  let suma = 0
  digits.forEach((digit, index) => {
    const multiplicador = baseMultiplicadores[index % baseMultiplicadores.length]
    suma += parseInt(digit) * multiplicador
  })
  
  const resto = suma % 11
  const dv = resto < 2 ? resto : 11 - resto
  
  return String(dv)
}