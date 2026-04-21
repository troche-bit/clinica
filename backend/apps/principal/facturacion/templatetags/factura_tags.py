from decimal import Decimal
from django import template

register = template.Library()


@register.filter
def gs(value):
    """Formatea un valor numérico como Guaraníes: sin decimales, separador de miles con punto."""
    try:
        n = int(Decimal(str(value)).quantize(Decimal('1')))
        # Formato con separador de miles usando punto (estilo paraguayo)
        return f'{n:,}'.replace(',', '.')
    except (ValueError, TypeError):
        return '0'


@register.filter
def minus(a, b):
    """Resta b de a usando Decimal para evitar errores de punto flotante."""
    try:
        return Decimal(str(a)) - Decimal(str(b))
    except (ValueError, TypeError):
        return Decimal('0')
