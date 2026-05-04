from django.contrib import admin
from .models import Paciente


@admin.register(Paciente)
class PacienteAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "get_nombre_completo",
        "get_documento",
        "responsable",
        "sexo",
        "grupo_sanguineo",
        "parentesco",
    )
    search_fields = ("persona__razon_social", "persona__nro_documento")
    list_filter   = ("sexo", "is_deleted")
    readonly_fields = ("fecha_creacion", "fecha_modificacion")
    fieldsets = (
        ("Persona", {"fields": ("persona",)}),
        ("Datos del Paciente", {
            "fields": (
                "responsable", "sexo",
                "observacion", "alergias_conocidas",
                "enfermedades_cronicas", "grupo_sanguineo", "parentesco",
            )
        }),
        ("Auditoría", {
            "classes": ("collapse",),
            "fields": ("fecha_creacion", "fecha_modificacion", "is_deleted"),
        }),
    )

    @admin.display(description="Nombre")
    def get_nombre_completo(self, obj):
        return obj.persona.razon_social if obj.persona else "-"

    @admin.display(description="Documento")
    def get_documento(self, obj):
        return obj.persona.nro_documento if obj.persona else "-"
