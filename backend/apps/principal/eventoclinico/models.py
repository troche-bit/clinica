from django.db import models # Importamos el módulo models de Django para definir los modelos de la base de datos.
from django.utils import timezone #Importamos el módulo timezone para manejar las fechas y horas de manera adecuada en Django.
from django.db.models import UniqueConstraint, Q, Index, PROTECT # Importamos UniqueConstraint para definir restricciones de unicidad, Q para construir consultas complejas, Index para crear índices en la base de datos y PROTECT para definir el comportamiento de eliminación en relaciones de clave foránea.
from django.db.models.functions import Lower # Importamos Lower para realizar comparaciones de texto sin distinguir entre mayúsculas y minúsculas.
from apps.core.models import BaseModel # Importamos el modelo BaseModel desde la aplicación core para heredar de él y agregar campos comunes a nuestros modelos.

# Heredamos de BaseModel para incluir campos comunes como created_at y updated_at, que se actualizan automáticamente al crear o modificar un registro.
class EventoClinico(BaseModel):
    
    id = models.AutoField(primary_key=True) # Campo de clave primaria que se autoincrementa.

    tipo_evento = models.CharField(
        max_length=50, 
        blank=False, 
        null=False,
        help_text='Tipo de evento clínico (por ejemplo, consulta, cirugía, etc.)'
    ) 

    # Meta es una clase interna que se utiliza para configurar opciones adicionales del modelo, como el nombre en singular 
    # y plural, y el ordenamiento por defecto.
    class Meta:
        verbose_name = 'Evento Clínico'
        verbose_name_plural = 'Eventos Clínicos'
        ordering = ['tipo_evento'] # Ordenamos los registros por el campo 'tipo_evento' de manera ascendente.
        indexes = [ # Creamos un índice compuesto para los campos 'descripcion' e 'is_deleted' para mejorar el rendimiento de las consultas que filtren por estos campos.
            Index(fields=['tipo_evento', 'is_deleted'], name='idx_tipo_evento_is_deleted')
        ]
        constraints = [ # Definimos una restricción de unicidad para asegurar que no haya dos países con la misma descripción, ignorando mayúsculas y minúsculas, y considerando solo los registros que no están marcados como eliminados.
            UniqueConstraint(
                Lower('tipo_evento'),
                name='unique_tipo_evento',
                condition=Q(is_deleted=False)
            )
        ]
    # El método __str__ define cómo se representará el objeto Pais como una cadena, mostrando su id y descripción.
    def __str__(self):
        return f'{self.id} - {self.tipo_evento}'