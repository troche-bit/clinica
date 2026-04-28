from django.contrib import admin
from .models import PersonaRRHH


@admin.register(PersonaRRHH)
class PersonaRRHHAdmin(admin.ModelAdmin):
    list_display    = ("id", "get_nombre", "get_documento", "cargo", "tipo_contrato", "estado")
    search_fields   = ("persona__razon_social", "persona__nro_documento", "nro_matricula")
    list_filter     = ("cargo", "tipo_contrato", "estado", "is_deleted")
    readonly_fields = ("fecha_creacion", "fecha_modificacion")
    filter_horizontal = ("especialidades",)

    @admin.display(description="Nombre")
    def get_nombre(self, obj):
        return obj.persona.razon_social if obj.persona else "-"

    @admin.display(description="Documento")
    def get_documento(self, obj):
        return obj.persona.nro_documento if obj.persona else "-"
