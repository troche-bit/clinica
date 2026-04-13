from django.contrib import admin
from .models import Consultorio

# Registrar los modelos en el admin de Django

@admin.register(Consultorio)
class ConsultorioAdmin(admin.ModelAdmin):
    list_display = ('id', 'nro_consultorio', 'descripcion') 
    search_fields = ('nro_consultorio',)  
    ordering = ('nro_consultorio',) 