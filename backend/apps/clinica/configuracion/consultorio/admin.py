from django.contrib import admin
from .models import Consultorio


@admin.register(Consultorio)
class ConsultorioAdmin(admin.ModelAdmin):
    list_display  = ('id', 'nro_consultorio', 'descripcion')
    search_fields = ('nro_consultorio',)
    ordering      = ('nro_consultorio',)
