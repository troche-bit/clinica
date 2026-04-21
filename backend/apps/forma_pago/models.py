from django.db import models


class FormaPago(models.Model):
    TIPO_CHOICES = [
        ('efectivo',      'Efectivo'),
        ('tarjeta',       'Tarjeta'),
        ('transferencia', 'Transferencia'),
        ('otro',          'Otro'),
    ]

    id          = models.IntegerField(primary_key=True)
    descripcion = models.CharField(max_length=50)
    tipo        = models.CharField(max_length=20, choices=TIPO_CHOICES, default='otro')

    class Meta:
        db_table            = 'forma_pago'
        verbose_name        = 'Forma de pago'
        verbose_name_plural = 'Formas de pago'
        ordering            = ['id']

    def __str__(self):
        return self.descripcion
