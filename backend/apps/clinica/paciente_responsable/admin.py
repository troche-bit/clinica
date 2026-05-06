from django.contrib import admin
from .models import PacienteResponsable


@admin.register(PacienteResponsable)
class PacienteResponsableAdmin(admin.ModelAdmin):
    list_display    = ('persona', 'grupo_sanguineo', 'ocupacion', 'es_contacto_emergencia', 'is_deleted')
    list_filter     = ('es_contacto_emergencia', 'grupo_sanguineo', 'is_deleted')
    search_fields   = ('persona__razon_social', 'persona__nro_documento')
    readonly_fields = (
        'id_usu_creator', 'id_usu_modificator',
        'fecha_creacion', 'fecha_modificacion', 'fecha_eliminacion',
    )
    fieldsets = (
        ('Vinculación', {
            'fields': ('persona',)
        }),
        ('Datos del responsable', {
            'fields': ('grupo_sanguineo', 'ocupacion', 'es_contacto_emergencia', 'observacion')
        }),
        ('Auditoría', {
            'fields': (
                'is_deleted', 'id_usu_creator', 'id_usu_modificator',
                'fecha_creacion', 'fecha_modificacion', 'fecha_eliminacion',
            ),
            'classes': ('collapse',),
        }),
    )
