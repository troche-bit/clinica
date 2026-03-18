from django.contrib import admin
from .models import TipoDocumento, Persona

# Register your models here.

@admin.register(TipoDocumento) 
class TipoDocumentoAdmin(admin.ModelAdmin):
    list_display = ('id', 'descripcion') # Mostramos el id y la descripcion en la lista de objetos
    search_fields = ('descripcion',) # Agregamos un campo de búsqueda para la descripcion
    ordering = ('descripcion',) # Ordenamos los objetos por la descripcion

@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ('id', 'nro_documento', 'ruc_dv', 'razon_social', 'tipo_documento__descripcion', 'correo_electronico', 'direccion') # Mostramos los campos id, nro_documento, ruc_dv, razon_social, tipo_dtelefono', 'ocumento, telefono, correo_electronico, pais, departamento, ciudad y direccion en la lista de objetos 
    search_fields = ('razon_social', 'nro_documento') # Agregamos campos de búsqueda para razon_social y nro_documento
    list_filter = ('nro_documento',) # Agregamos un filtro para el campo nro_documento
    ordering = ('razon_social',) # Ordenamos los objetos por razon_social
    randonly_fields = ('fecha_creacion', 'fecha_modificacion') # Hacemos que los campos fecha_creacion y fecha_modificacion sean de solo lectura

fieldset = {
    'Datos Personales': {
        'fields': ('razon_social', 'tipo_documento__descripcion', 'nro_documento', 'ruc_dv')
    },
    'Datos de Contacto': {
        'fields': ('telefono', 'coorreo_electronico')
    },
    'Ubicacion': {
        'fields': ('pais', 'departamento', 'ciudad', 'direccion')
    },
    'Auditoria': {
        'fields': ('fecha_creacion', 'fecha_modificacion')
    }
}