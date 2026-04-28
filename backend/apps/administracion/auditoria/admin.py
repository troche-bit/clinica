from django.contrib import admin
from .models import RegistroAuditoria


@admin.register(RegistroAuditoria)
class RegistroAuditoriaAdmin(admin.ModelAdmin):
    list_display  = ('id', 'tabla', 'registro_id', 'accion', 'usuario', 'fecha', 'ip')
    list_filter   = ('accion', 'tabla')
    search_fields = ('tabla', 'usuario__username')
    ordering      = ('-fecha',)
    readonly_fields = ('tabla', 'registro_id', 'accion', 'datos_antes', 'datos_despues',
                       'usuario', 'fecha', 'ip')