from django.db import models # Importamos el módulo models de Django para definir los modelos de la base de datos.
from django.utils import timezone #Importamos el módulo timezone para manejar las fechas y horas de manera adecuada en Django.
from django.db.models import UniqueConstraint, Q, Index, PROTECT # Importamos UniqueConstraint para definir restricciones de unicidad, Q para construir consultas complejas, Index para crear índices en la base de datos y PROTECT para definir el comportamiento de eliminación en relaciones de clave foránea.
from django.db.models.functions import Lower # Importamos Lower para realizar comparaciones de texto sin distinguir entre mayúsculas y minúsculas.
from apps.core.models import BaseModel # Importamos el modelo BaseModel desde la aplicación core para heredar de él y agregar campos comunes a nuestros modelos.

# Heredamos de BaseModel para incluir campos comunes como created_at y updated_at, que se actualizan automáticamente al crear o modificar un registro.
class Consultorio(BaseModel):
    
    id = models.AutoField(primary_key=True) # Campo de clave primaria que se autoincrementa.

    nro_consultorio = models.CharField(
        max_length=50, 
        blank=False, 
        null=False,
        help_text='Nro del consultorio'
    ) 

    descripcion = models.CharField(
        max_length=150, 
        blank=True, 
        null=True,
        help_text='Descripción del consultorio'
    ) 

    # Meta es una clase interna que se utiliza para configurar opciones adicionales del modelo, como el nombre en singular 
    # y plural, y el ordenamiento por defecto.
    class Meta:
        verbose_name = 'Consultorio'
        verbose_name_plural = 'Consultorios'
        ordering = ['nro_consultorio']
        indexes = [ # Creamos un índice compuesto para los campos 'descripcion' e 'is_deleted' para mejorar el rendimiento de las consultas que filtren por estos campos.
            Index(fields=['nro_consultorio', 'is_deleted'], name='idx_consultorio_nro_is_deleted')
        ]
        constraints = [ # Definimos una restricción de unicidad para asegurar que no haya dos países con la misma descripción, ignorando mayúsculas y minúsculas, y considerando solo los registros que no están marcados como eliminados.
            UniqueConstraint(
                Lower('nro_consultorio'),
                name='unique_nro_consultorio',
                condition=Q(is_deleted=False)
            )
        ]
    # El método __str__ define cómo se representará el objeto Pais como una cadena, mostrando su id y descripción.
    def __str__(self):
        return f'{self.id} - {self.nro_consultorio} - {self.descripcion}'