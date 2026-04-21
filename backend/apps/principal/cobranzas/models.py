from django.db import models
from apps.core.models import BaseModel


class Cobranza(BaseModel):
    """Cabecera de cobranza — cobro de cuotas de facturas a crédito."""

    fecha          = models.DateField(help_text='Fecha del cobro')
    comprobante_nro = models.IntegerField(
        null=True,
        help_text='Número de comprobante autoincremental propio de cobranzas',
    )
    persona = models.ForeignKey(
        'persona.Persona',
        on_delete=models.PROTECT,
        related_name='cobranzas',
    )
    monto  = models.DecimalField(
        max_digits=18, decimal_places=2, default=0,
        help_text='Suma de todos los montos pagados en el detalle',
    )
    vuelto = models.DecimalField(
        max_digits=18, decimal_places=2, default=0,
        help_text='Total recibido - monto cobrado (solo informativo)',
    )

    class Meta:
        db_table            = 'cobranza'
        verbose_name        = 'Cobranza'
        verbose_name_plural = 'Cobranzas'
        ordering            = ['-fecha', '-fecha_creacion']

    def __str__(self):
        return f'Cobranza #{self.comprobante_nro} — {self.persona.razon_social}'


class CobranzaDet(BaseModel):
    """Detalle de cobranza: cada cuota cobrada en esta transacción."""

    cobranza   = models.ForeignKey(Cobranza, on_delete=models.CASCADE, related_name='detalle')
    cta_cobrar = models.ForeignKey(
        'facturacion.CtaCobrar',
        on_delete=models.PROTECT,
        related_name='cobros',
    )
    monto_total  = models.DecimalField(
        max_digits=18, decimal_places=2,
        help_text='Saldo de la cuota al momento de registrar (histórico inmutable)',
    )
    monto_pagado = models.DecimalField(
        max_digits=18, decimal_places=2,
        help_text='Monto efectivamente cobrado — no puede superar saldo disponible',
    )
    nro_comprobante = models.CharField(max_length=200, blank=True, default='')

    class Meta:
        db_table            = 'cobranza_det'
        verbose_name        = 'Detalle de cobranza'
        verbose_name_plural = 'Detalles de cobranza'
        ordering            = ['id']

    def __str__(self):
        return f'Cobranza #{self.cobranza_id} — Cuota {self.cta_cobrar_id}'


class ValorRecibidoCob(BaseModel):
    """Valores recibidos (formas de pago) al cobrar."""

    cobranza   = models.ForeignKey(Cobranza, on_delete=models.CASCADE, related_name='valores_recibidos')
    forma_pago = models.ForeignKey(
        'forma_pago.FormaPago',
        on_delete=models.PROTECT,
        related_name='cobranza_valores',
    )
    cta = models.ForeignKey(
        'caja_banco.CuentaMcb',
        on_delete=models.PROTECT,
        related_name='cobranza_valores',
    )
    monto           = models.DecimalField(max_digits=18, decimal_places=2)
    voucher         = models.CharField(max_length=100, blank=True, default='')
    nro_comprobante = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        db_table            = 'valor_recibido_cob'
        verbose_name        = 'Valor recibido en cobranza'
        verbose_name_plural = 'Valores recibidos en cobranza'
        ordering            = ['id']
