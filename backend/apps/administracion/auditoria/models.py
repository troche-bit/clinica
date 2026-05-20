from django.db import models
from django.conf import settings


class RegistroAuditoria(models.Model):

    class Accion(models.TextChoices):
        CREAR       = 'CREAR',       'Crear'
        EDITAR      = 'EDITAR',      'Editar'
        ELIMINAR    = 'ELIMINAR',    'Eliminar'
        ENVIO_EMAIL = 'ENVIO_EMAIL', 'Envío de Email'

    tabla       = models.CharField(max_length=100)
    registro_id = models.IntegerField()
    accion      = models.CharField(max_length=12, choices=Accion.choices)
    datos_antes = models.JSONField(null=True, blank=True)
    datos_despues = models.JSONField(null=True, blank=True)
    usuario     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='registros_auditoria',
    )
    fecha       = models.DateTimeField(auto_now_add=True)
    ip          = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table            = 'auditoria_registro'
        verbose_name        = 'Registro de auditoría'
        verbose_name_plural = 'Registros de auditoría'
        ordering            = ['-fecha']
        indexes             = [
            models.Index(fields=['tabla', 'registro_id'], name='idx_auditoria_tabla_registro'),
            models.Index(fields=['usuario', 'fecha'],     name='idx_auditoria_usuario_fecha'),
        ]

    def __str__(self):
        return f'{self.accion} {self.tabla}#{self.registro_id} — {self.fecha:%d/%m/%Y %H:%M}'
