from decimal import Decimal, ROUND_HALF_UP

TWO  = Decimal('0.01')
ZERO = Decimal('0.00')


def calcular_item(monto: Decimal, impuesto: str) -> dict:
    m = Decimal(str(monto)).quantize(TWO, rounding=ROUND_HALF_UP)

    if impuesto == '10':
        gra = (m / Decimal('1.10')).quantize(TWO, rounding=ROUND_HALF_UP)
        iva = (m - gra).quantize(TWO, rounding=ROUND_HALF_UP)
        return {
            'sub_gra_10': gra, 'sub_iva_10': iva,
            'sub_gra_5':  ZERO, 'sub_iva_5':  ZERO,
            'exento': ZERO,
        }
    if impuesto == '5':
        gra = (m / Decimal('1.05')).quantize(TWO, rounding=ROUND_HALF_UP)
        iva = (m - gra).quantize(TWO, rounding=ROUND_HALF_UP)
        return {
            'sub_gra_5':  gra, 'sub_iva_5':  iva,
            'sub_gra_10': ZERO, 'sub_iva_10': ZERO,
            'exento': ZERO,
        }
    return {
        'exento':     m,
        'sub_gra_5':  ZERO, 'sub_iva_5':  ZERO,
        'sub_gra_10': ZERO, 'sub_iva_10': ZERO,
    }


def calcular_totales(items_calculados: list) -> dict:
    grav_5  = ZERO
    grav_10 = ZERO
    iva_5   = ZERO
    iva_10  = ZERO
    exento  = ZERO

    for it in items_calculados:
        grav_5  += it['sub_gra_5']
        grav_10 += it['sub_gra_10']
        iva_5   += it['sub_iva_5']
        iva_10  += it['sub_iva_10']
        exento  += it['exento']

    total_gravada = grav_5  + grav_10
    total_iva     = iva_5   + iva_10
    monto_total   = total_gravada + total_iva + exento

    return {
        'grav_5':        grav_5,
        'grav_10':       grav_10,
        'iva_5':         iva_5,
        'iva_10':        iva_10,
        'total_gravada': total_gravada,
        'total_iva':     total_iva,
        'monto_total':   monto_total,
    }
