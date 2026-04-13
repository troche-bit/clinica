from django.contrib import admin
from .models import HorarioPrestador


@admin.register(HorarioPrestador)
class HorarioPrestadorAdmin(admin.ModelAdmin):
    list_display  = ("id", "persona_rrhh", "dia_semana", "hora_desde", "hora_hasta", "intervalo", "estado", "excepcion")
    list_filter   = ("estado", "excepcion", "dia_semana")
    search_fields = ("persona_rrhh__persona__razon_social",)
    readonly_fields = ("fecha_creacion", "fecha_modificacion")
