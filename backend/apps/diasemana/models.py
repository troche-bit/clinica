from django.db import models
from django.db.models import Index

class DiaSemana(models.Model):
    id          = models.IntegerField(primary_key=True)
    descripcion = models.CharField(max_length=20, blank=False, null=False, help_text='Ejemplo: Lunes, Martes, Miércoles, etc.')
    abreviatura = models.CharField(max_length=5)

    class Meta:
        verbose_name        = 'Día de la semana'
        verbose_name_plural = 'Días de la semana'
        ordering            = ['id']
        indexes             = [Index(fields=['descripcion'], name='idx_diasemana_descripcion')]

    def __str__(self):
        return f'{self.id} - {self.descripcion}' 
