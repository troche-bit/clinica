from decimal import Decimal
from django import template

register = template.Library()


@register.filter
def gs(value):
    try:
        n = int(Decimal(str(value)).quantize(Decimal('1')))
        return f'{n:,}'.replace(',', '.')
    except (ValueError, TypeError):
        return '0'


@register.filter
def minus(a, b):
    try:
        return Decimal(str(a)) - Decimal(str(b))
    except (ValueError, TypeError):
        return Decimal('0')
