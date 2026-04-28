from django.contrib import admin
from .models import TipoDocumento, Persona


@admin.register(TipoDocumento)
class TipoDocumentoAdmin(admin.ModelAdmin):
    list_display = ('id', 'descripcion')
    search_fields = ('descripcion',)
    ordering = ('descripcion',)


@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ('id', 'nro_documento', 'ruc_dv', 'razon_social', 'tipo_documento', 'correo_electronico', 'direccion')
    search_fields = ('razon_social', 'nro_documento')
    ordering = ('razon_social',)
    readonly_fields = ('fecha_creacion', 'fecha_modificacion')
