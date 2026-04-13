from django.db import models # Importamos el módulo models de Django para definir los modelos de la base de datos.
from django.utils import timezone #Importamos el módulo timezone para manejar las fechas y horas de manera adecuada en Django.
from django.db.models import UniqueConstraint, Q, Index, PROTECT # Importamos UniqueConstraint para definir restricciones de unicidad, Q para construir consultas complejas, Index para crear índices en la base de datos y PROTECT para definir el comportamiento de eliminación en relaciones de clave foránea.
from django.db.models.functions import Lower # Importamos Lower para realizar comparaciones de texto sin distinguir entre mayúsculas y minúsculas.
from apps.core.models import BaseModel # Importamos el modelo BaseModel desde la aplicación core para heredar de él y agregar campos comunes a nuestros modelos.

# Heredamos de BaseModel para incluir campos comunes como created_at y updated_at, que se actualizan automáticamente al crear o modificar un registro.
class Pais(BaseModel):
    
    id = models.AutoField(primary_key=True) # Campo de clave primaria que se autoincrementa.

    # Campo de nombre del país, con una longitud máxima de 200 caracteres, obligatorio y único.
    descripcion = models.CharField(
        max_length=200, 
        blank=False, 
        null=False,
        help_text='Descripción del país'
    ) 

    # Meta es una clase interna que se utiliza para configurar opciones adicionales del modelo, como el nombre en singular 
    # y plural, y el ordenamiento por defecto.
    class Meta:
        verbose_name = 'País'
        verbose_name_plural = 'Países'
        ordering = ['descripcion']
        indexes = [ # Creamos un índice compuesto para los campos 'descripcion' e 'is_deleted' para mejorar el rendimiento de las consultas que filtren por estos campos.
            Index(fields=['descripcion', 'is_deleted'], name='idx_pais_desc_is_deleted')
        ]
        constraints = [ # Definimos una restricción de unicidad para asegurar que no haya dos países con la misma descripción, ignorando mayúsculas y minúsculas, y considerando solo los registros que no están marcados como eliminados.
            UniqueConstraint(
                Lower('descripcion'),
                name='unique_pais_descripcion',
                condition=Q(is_deleted=False)
            )
        ]
    # El método __str__ define cómo se representará el objeto Pais como una cadena, mostrando su id y descripción.
    def __str__(self):
        return f'{self.id} - {self.descripcion}'

# Definimos el modelo Departamento, que tiene una relación de clave foránea con el modelo Pais, lo que indica que cada departamento pertenece a un país. También tiene un campo de nombre y opciones de configuración similares a las del modelo Pais.
class Departamento(BaseModel):
    id = models.AutoField(primary_key=True) # Campo de clave primaria que se autoincrementa.
    pais = models.ForeignKey( # Definimos una relación de clave foránea con el modelo Pais, lo que indica que cada departamento pertenece a un país. La opción on_delete=models.PROTECT evita que se elimine un país si tiene departamentos asociados, y related_name='departamentos' permite acceder a los departamentos de un país a través del atributo 'departamentos'.
        Pais,
        on_delete=models.PROTECT,
        related_name='departamentos'
    )

    # Campo de nombre del departamento, con una longitud máxima de 200 caracteres, obligatorio.
    descripcion = models.CharField(
        max_length=200,
        blank=False,
        null=False,
        help_text='Descripción del departamento'
        )

    # Meta es una clase interna que se utiliza para configurar opciones adicionales del modelo, como el nombre en singular y plural, y el ordenamiento por defecto.
    class Meta:
        verbose_name = 'Departamento'
        verbose_name_plural = 'Departamentos'
        ordering = ['descripcion']
        indexes = [ # Creamos un índice compuesto para los campos 'descripcion' e 'is_deleted' para mejorar el rendimiento de las consultas que filtren por estos campos.
            Index(fields=['descripcion', 'is_deleted'], name='idx_dep_desc_is_deleted')
        ]
        constraints = [ # Definimos una restricción de unicidad para asegurar que no haya dos departamentos con la misma descripción dentro del mismo país, ignorando mayúsculas y minúsculas, y considerando solo los registros que no están marcados como eliminados.
            UniqueConstraint(
                Lower('descripcion'),
                'pais',
                name='unique_departamento_descripcion_pais',
                condition=Q(is_deleted=False)
            )
        ]

    # El método __str__ define cómo se representará el objeto Departamento como una cadena, mostrando su nombre y el país al que pertenece.
    def __str__(self):
        return f'{self.descripcion} — {self.pais}'

# Definimos el modelo Ciudad, que tiene una relación de clave foránea con el modelo Departamento, lo que indica que cada ciudad pertenece a un departamento. También tiene un campo de nombre y opciones de configuración similares a las de los modelos anteriores.
class Ciudad(BaseModel):
    id = models.AutoField(primary_key=True) # Campo de clave primaria que se autoincrementa.
    
    # Definimos una relación de clave foránea con el modelo Departamento, lo que indica que cada ciudad pertenece a un departamento. La opción on_delete=models.PROTECT evita que se elimine un departamento si tiene ciudades asociadas, y related_name='ciudades' permite acceder a las ciudades de un departamento a través del atributo 'ciudades'.
    departamento = models.ForeignKey(
        Departamento,
        on_delete=models.PROTECT,
        related_name='ciudades'
    )

    descripcion = models.CharField(max_length=200, 
        blank=False, 
        null=False, 
        help_text='Descripción de la ciudad'
    )

    # Meta es una clase interna que se utiliza para configurar opciones adicionales del modelo, como el nombre en singular y plural, y el ordenamiento por defecto.
    class Meta:
        verbose_name = 'Ciudad'
        verbose_name_plural = 'Ciudades'
        ordering = ['descripcion']
        indexes = [ # Creamos un índice compuesto para los campos 'descripcion' e 'is_deleted' para mejorar el rendimiento de las consultas que filtren por estos campos.
            Index(fields=['descripcion', 'is_deleted'], name='idx_ciu_desc_is_deleted')
        ]
        constraints = [ # Definimos una restricción de unicidad para asegurar que no haya dos ciudades con la misma descripción dentro del mismo departamento, ignorando mayúsculas y minúsculas, y considerando solo los registros que no están marcados como eliminados.
            UniqueConstraint(
                Lower('descripcion'),
                'departamento',
                name='unique_ciudad_descripcion_departamento',
                condition=Q(is_deleted=False)
            )
        ]

    # El método __str__ define cómo se representará el objeto Ciudad como una cadena, mostrando su nombre, el departamento al que pertenece y el país al que pertenece ese departamento.
    def __str__(self):
        return f'{self.descripcion} — {self.departamento} - {self.departamento.pais}'