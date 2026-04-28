from django.contrib import admin
from .models import Especialidad

# Registrar los modelos en el admin de Django

@admin.register(Especialidad)
class EspecialidadAdmin(admin.ModelAdmin):
    list_display = ('id', 'descripcion') 
    search_fields = ('descripcion',)  
    ordering = ('descripcion',) 