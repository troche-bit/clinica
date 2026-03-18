from django.contrib import admin
from .models import Paciente


@admin.register(Paciente) # Decorador para registrar el modelo Paciente en el admin de Django
class PacienteAdmin(admin.ModelAdmin):

    list_display = ( # Campos que se mostrarán en la lista de pacientes en el admin
        'id',
        'get_nombre_completo',
        'get_documento',
        'fecha_nacimiento',
        'responsable',
        'sexo',
        'observacion'
    )

    search_fields = ( # Campos por los que se puede buscar en la lista de pacientes en el admin
        'persona__razon_social',
        'persona__nro_documento'
    )

    list_filter = ( # Campos por los que se puede filtrar en la lista de pacientes en el admin
        'sexo',
        'is_deleted',
    )

    readonly_fields = ( # Campos que serán de solo lectura en el formulario de edición del paciente en el admin
        'fecha_creacion',
        'fecha_modificacion'
    )

    fieldsets = ( # Organización de los campos en el formulario de edición del paciente en el admin
        ('Persona', { # Sección para los campos relacionados con la persona del paciente
            'fields': ('persona',)
        }),
        ('Datos del Paciente', { # Sección para los campos específicos del paciente
            'fields': ('fecha_nacimiento', 'responsable', 'sexo', 'observacion')
        }),
        ('Auditoría', { # Sección para los campos relacionados con la auditoría del paciente
            'classes': ('collapse',),
            'fields': ('fecha_creacion', 'fecha_modificacion', 'is_deleted')
        }),
    )
   
    # Métodos personalizados para mostrar información relacionada con la persona del paciente en la lista de pacientes en el admin
    @admin.display(description="Nombre")
    def get_nombre_completo(self, obj):
        return obj.persona.razon_social if obj.persona else "-"

    @admin.display(description="Documento")
    def get_documento(self, obj):
        return obj.persona.nro_documento if obj.persona else "-"