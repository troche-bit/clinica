from django.db import models # Importamos el módulo models de Django para definir los modelos de la base de datos.
from django.utils import timezone #Importamos el módulo timezone para manejar las fechas y horas de manera adecuada en Django.
from django.db.models import UniqueConstraint, Q, Index, PROTECT # Importamos UniqueConstraint para definir restricciones de unicidad, Q para construir consultas complejas, Index para crear índices en la base de datos y PROTECT para definir el comportamiento de eliminación en relaciones de clave foránea.
from django.db.models.functions import Lower # Importamos Lower para realizar comparaciones de texto sin distinguir entre mayúsculas y minúsculas.
from django.contrib.auth.models import User # Importamos el modelo User de Django para establecer relaciones entre modelos y manejar la autenticación de usuarios.
from apps.persona.models import Persona # Importamos el modelo Persona desde la aplicación personas para establecer relaciones entre modelos.
from apps.core.models import BaseModel # Importamos el modelo BaseModel desde la aplicación core para heredar de él y agregar campos comunes a nuestros modelos.

class PacienteResponsable(BaseModel): # Definimos el modelo PacienteResponsable que hereda de BaseModel.
    id = models.AutoField(primary_key=True) # Definimos un campo id como AutoField, que se incrementa automáticamente y es la clave primaria del modelo.

    persona = models.ForeignKey(
        Persona, 
        on_delete=models.PROTECT,
        related_name='paciente_responsable',
        blank=False,
        null=False, 
        help_text='Persona a la que se le asigna el paciente responsable'
    )

    parentesco = models.CharField(
        max_length=200, 
        blank=False, 
        null=False, 
        help_text='Parentesco del paciente responsable con el paciente'
    )

    class Meta: # Definimos la clase Meta para establecer opciones adicionales para el modelo.
        verbose_name = 'Paciente Responsable' # Establecemos el nombre singular del modelo para la interfaz de administración de Django.
        verbose_name_plural = 'Pacientes Responsables' # Establecemos el nombre plural del modelo para la interfaz de administración de Django.
        ordering = ['persona__nro_documento'] # Ordenamos por el numero de documento de la persona.
        indexes = [ # Definimos índices para mejorar el rendimiento de las consultas.
            Index(fields=['persona'], name='idx_pac_resp_per'), # Índice para el campo persona.   
        ]

    def __str__(self): # Definimos el método __str__ para representar el modelo como una cadena de texto.
        return f'{self.persona} - {self.parentesco}' # Retornamos la representación de la persona y el parentesco como la representación del paciente responsable.|

class Paciente(BaseModel): # Definimos el modelo Paciente que hereda de BaseModel.
    id = models.AutoField(primary_key=True) # Definimos un campo id como AutoField, que se incrementa automáticamente y es la clave primaria del modelo.

    persona = models.ForeignKey(
        Persona, 
        on_delete=models.PROTECT,
        related_name='paciente',
        blank=False,
        null=False, 
        help_text='Persona a la que se le asigna el paciente'
    ) 

    fecha_nacimiento = models.DateField(
        blank=False, 
        null=False, 
        help_text='Fecha de nacimiento del paciente'
    ) 

    responsable = models.ForeignKey(
        PacienteResponsable, 
        on_delete=models.PROTECT,
        related_name='paciente_responsable',
        blank=True,
        null=True, 
        help_text='Paciente responsable del paciente'
    )

    class Sexo(models.TextChoices): # Definimos una clase interna Sexo que hereda de TextChoices para definir opciones de sexo para el paciente.
        MASCULINO = 'M', 'Masculino' # Opción para sexo masculino.
        FEMENINO = 'F', 'Femenino' # Opción para sexo femenino.
        OTRO = 'O', 'Otro' # Opción para sexo otro.
    
    sexo = models.CharField(
        max_length=1, 
        choices=Sexo.choices, 
        blank=False, 
        null=False, 
        help_text='Sexo del paciente'
    )

    observacion = models.CharField(
        max_length=5000, 
        blank=True, 
        null=True, 
        help_text='Observaciones adicionales sobre el paciente'
    )   

    grupo_sanguineo = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        help_text='Grupo sanguineo del paciente'
    )

    alergias_conocidas = models.TextField(
        blank=True,
        null=True,
        help_text='Alergias conocidas del paciente'
    )
    enfermedades_cronicas = models.TextField(
        blank=True,
        null=True,
        help_text='Enfermedades cronicas del paciente'
    )

    class Meta: # Definimos la clase Meta para establecer opciones adicionales para el modelo.
        verbose_name = 'Paciente' # Establecemos el nombre singular del modelo para la interfaz de administración de Django.
        verbose_name_plural = 'Pacientes' # Establecemos el nombre plural del modelo para la interfaz de administración de Django.
        ordering = ['persona__nro_documento'] # Ordenamos por el numero de documento de la persona.
        indexes = [ # Definimos índices para mejorar el rendimiento de las consultas.
            Index(fields=['persona'], name='idx_paciente_persona'), # Índice para el campo persona.   
        ]
        constraints = [ # Definimos restricciones para garantizar la integridad de los datos.
            UniqueConstraint(
                fields=['persona'],
                name='unique_paciente_persona',
                condition=Q(is_deleted=False) # La restricción de unicidad solo se aplica a los registros que no están marcados como eliminados.
            )
        ]

    def __str__(self): # Definimos el método __str__ para representar el modelo como una cadena de texto.
        return f'{self.persona}' # Retornamos la representación de la persona asociada al paciente como la representación del paciente.