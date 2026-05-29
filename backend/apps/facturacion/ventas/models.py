from django.db import models
from django.db.models import Q
from apps.core.models import BaseModel


class VentaFactCab(BaseModel):
    fecha         = models.DateField()
    condicion_vta = models.BooleanField(
        default=True,
        help_text='True = Contado, False = Crédito',
    )
    persona  = models.ForeignKey(
        'persona.Persona',
        on_delete=models.PROTECT,
        related_name='facturas',
    )
    timbrado = models.ForeignKey(
        'timbrado.Timbrado',
        on_delete=models.PROTECT,
        related_name='facturas',
    )
    establecimiento = models.CharField(max_length=3, blank=True, default='', help_text='Punto de sucursal copiado del timbrado al emitir')
    expedicion      = models.CharField(max_length=3, blank=True, default='', help_text='Punto de expedición copiado del timbrado al emitir')
    observacion     = models.TextField(blank=True, default='')
    nro_comprobante = models.IntegerField(null=True)

    is_anulado = models.BooleanField(default=False)

    # Totales desnormalizados — evita recalcular al consultar
    grav_5        = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    grav_10       = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    iva_5         = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    iva_10        = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_gravada = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_iva     = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    monto_total   = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    vuelto        = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    class Meta:
        db_table            = 'venta_fact_cab'
        verbose_name        = 'Factura'
        verbose_name_plural = 'Facturas'
        ordering            = ['-fecha', '-fecha_creacion']
        constraints         = [
            models.UniqueConstraint(
                fields=['timbrado', 'nro_comprobante'],
                condition=Q(is_deleted=False),
                name='unique_fact_timbrado_nro',
            )
        ]

    def __str__(self):
        return f'Factura {self.nro_comprobante} — {self.persona.razon_social}'


class VentaFactDet(BaseModel):
    vfc      = models.ForeignKey(VentaFactCab, on_delete=models.CASCADE, related_name='detalle')
    prs      = models.ForeignKey(
        'productos.ProductoServicio',
        on_delete=models.PROTECT,
        related_name='fact_detalle',
    )
    cantidad  = models.DecimalField(max_digits=18, decimal_places=2)
    monto     = models.DecimalField(max_digits=18, decimal_places=2, help_text='Total de la línea')
    impuesto  = models.CharField(max_length=10, help_text='Copiado del producto al guardar — histórico')

    exento     = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    sub_gra_5  = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    sub_gra_10 = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    sub_iva_5  = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    sub_iva_10 = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    class Meta:
        db_table            = 'venta_fact_det'
        verbose_name        = 'Ítem de factura'
        verbose_name_plural = 'Ítems de factura'
        ordering            = ['id']

    def __str__(self):
        return f'{self.prs.descripcion} x {self.cantidad}'


class VentaFactDetCobranza(BaseModel):
    vfc        = models.ForeignKey(VentaFactCab, on_delete=models.CASCADE, related_name='cobranza')
    forma_pago = models.ForeignKey(
        'forma_pago.FormaPago',
        on_delete=models.PROTECT,
        related_name='fact_cobranza',
    )
    cta = models.ForeignKey(
        'caja_banco.CuentaMcb',
        on_delete=models.PROTECT,
        related_name='fact_cobranza',
    )
    monto           = models.DecimalField(max_digits=18, decimal_places=2)
    voucher         = models.CharField(max_length=100, blank=True, default='')
    nro_comprobante = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        db_table            = 'venta_fact_det_cobranza'
        verbose_name        = 'Cobranza de factura'
        verbose_name_plural = 'Cobranzas de factura'
        ordering            = ['id']
