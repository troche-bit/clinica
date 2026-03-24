from django.db import models # Importamos el módulo models de Django para definir los modelos de la base de datos.
from django.utils import timezone #Importamos el módulo timezone para manejar las fechas y horas de manera adecuada en Django.
from django.db.models import UniqueConstraint, Q, Index, PROTECT # Importamos UniqueConstraint para definir restricciones de unicidad, Q para construir consultas complejas, Index para crear índices en la base de datos y PROTECT para definir el comportamiento de eliminación en relaciones de clave foránea.
from django.db.models.functions import Lower # Importamos Lower para realizar comparaciones de texto sin distinguir entre mayúsculas y minúsculas.
from django.contrib.auth.models import User # Importamos el modelo User de Django para relacionar nuestros modelos con los usuarios del sistema.
from apps.ubicacion.models import Pais, Departamento, Ciudad # Importamos los modelos Pais, Departamento y Ciudad desde la aplicación de ubicación para establecer relaciones entre ellos.
from apps.core.models import BaseModel # Importamos el modelo BaseModel desde la aplicación core para heredar de él y agregar campos comunes a nuestros modelos.

class TipoDocumento(BaseModel): # Definimos el modelo TipoDocumento que hereda de BaseModel.
    id = models.AutoField(primary_key=True) # Campo de clave primaria autoincremental para identificar de manera única cada tipo de documento.
    
    descripcion = models.CharField(
        max_length=200,
        blank=False,
        null=False,
        help_text="Descripción del tipo de documento"
        ) 

    # Definimos la clase Meta para configurar opciones adicionales del modelo.
    class Meta: 
        verbose_name = "Tipo de Documento" # Nombre legible para el modelo en singular.
        verbose_name_plural = "Tipos de Documentos" # Nombre legible para el modelo en plural.
        ordering = ['descripcion']
        constraints = [ # Definimos una restricción de unicidad para el campo nombre, ignorando mayúsculas y minúsculas.
            UniqueConstraint(
                Lower('descripcion'), name='unique_tipo_documento_descripcion'
            )
        ]
        indexes = [ # Definimos un índice para el campo nombre, ignorando mayúsculas y minúsculas, para mejorar el rendimiento de las consultas.
            Index(Lower('descripcion'), name='idx_tipo_doc_descripcion')
        ]
    
    # Definimos el método __str__ para representar el objeto TipoDocumento como una cadena de texto.
    def __str__(self): 
        return self.descripcion # Retorna la descripción del tipo de documento como su representación en cadena.

class Persona(BaseModel): # Definimos el modelo Persona que hereda de BaseModel.
    id = models.AutoField(primary_key=True) # Campo de clave primaria autoincremental para identificar de manera única cada persona.
    
    tipo_documento = models.ForeignKey(
        TipoDocumento, 
        on_delete=models.PROTECT, 
        related_name='personas',
        blank=False,
        null=False,
        help_text="Tipo de documento asociado a la persona"
    ) # Campo de clave foránea que referencia al modelo TipoDocumento. Si se intenta eliminar un tipo de documento que está asociado a una persona, se protegerá la eliminación. El nombre relacionado para acceder a las personas desde el tipo de documento es 'personas'.

    nro_documento = models.CharField(
        max_length=50,
        blank=False,
        null=False,
        help_text="Número del documento de la persona"
    ) # Campo para almacenar el número del documento de la persona, con una longitud máxima de 50 caracteres. No puede estar en blanco ni ser nulo.

    ruc_dv = models.IntegerField(
        blank=True,
        null=True,
        help_text="Dígito verificador del RUC (opcional)"
    ) # Campo para almacenar el dígito verificador del RUC. Es opcional y puede estar en blanco o ser nulo.

    razon_social = models.CharField(
        max_length=400,
        blank=False,
        null=False,
        help_text="Razón social de la persona"
    ) # Campo para almacenar la razón social de la persona, con una longitud máxima de 400 caracteres. No puede estar en blanco ni ser nulo.    

    telefono = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Número de teléfono de la persona (opcional)"
    ) # Campo para almacenar el número de teléfono de la persona. Es opcional y puede estar en blanco o ser nulo.

    correo_electronico = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Correo electrónico de la persona (opcional)"
    ) # Campo para almacenar el correo electrónico de la persona. Es opcional y puede estar en blanco o ser nulo.

    pais = models.ForeignKey(
        Pais,
        on_delete=models.PROTECT,
        related_name='personas',
        blank=True,
        null=True,
        help_text="País de residencia de la persona"
    ) # Campo de clave foránea que referencia al modelo Pais. Si se intenta eliminar un país que está asociado a una persona, se protegerá la eliminación. El nombre relacionado para acceder a las personas desde el país es 'personas'.   

    departamento = models.ForeignKey(
        Departamento,
        on_delete=models.PROTECT,
        related_name='personas',
        blank=True,
        null=True,
        help_text="Departamento de residencia de la persona"
    ) # Campo de clave foránea que referencia al modelo Departamento. Si se intenta eliminar un departamento que está asociado a una persona, se protegerá la eliminación. El nombre relacionado para acceder a las personas desde el departamento es 'personas'.   

    ciudad = models.ForeignKey(
        Ciudad,
        on_delete=models.PROTECT,
        related_name='personas',
        blank=True,
        null=True,
        help_text="Ciudad de residencia de la persona"
    ) # Campo de clave foránea que referencia al modelo Ciudad. Si se intenta eliminar una ciudad que está asociada a una persona, se protegerá la eliminación. El nombre relacionado para acceder a las personas desde la ciudad es 'personas'.

    direccion = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Dirección de la persona (opcional)"
    ) # Campo para almacenar la dirección de la persona. Es opcional y puede estar en blanco o ser nulo.

    class Meta: # Definimos la clase Meta para configurar opciones adicionales del modelo.
        verbose_name = "Persona" # Nombre legible para el modelo en singular.
        verbose_name_plural = "Personas" # Nombre legible para el modelo en plural.
        ordering = ['nro_documento']
        constraints = [ # Definimos una restricción de unicidad para el campo nro_documento, ignorando mayúsculas y minúsculas, solo para registros que no estén marcados como eliminados (is_deleted=False).
            UniqueConstraint(
                Lower('nro_documento'), 
                name='unique_persona_nro_documento',
                condition=Q(is_deleted=False)
            )
        ]
        indexes = [ # Definimos un índice para el campo nro_documento, ignorando mayúsculas y minúsculas, para mejorar el rendimiento de las consultas.
            Index(Lower('nro_documento'), 'razon_social', name='idx_per_nro_doc_tip_doc') # Índice que combina el número de documento (ignorando mayúsculas y minúsculas) y la razón social para mejorar el rendimiento de las consultas que filtren por estos campos.
        ]

    def __str__(self): # Definimos el método __str__ para representar el objeto Persona como una cadena de texto.
        return f'{self.razon_social} — {self.nro_documento}' # Retorna la razón social y el número de documento de la persona como su representación en cadena.