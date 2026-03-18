from django.db import models # Importamos el módulo de modelos de Django
from django.conf import settings # Importamos settings para acceder a AUTH_USER_MODEL
from django.utils import timezone # Importamos el módulo de utilidades de tiempo de Django para manejar fechas y horas

# Creamos una clase BaseModel que hereda de models.Model, lo que la convierte en un modelo de Django
class BaseModel(models.Model):
    # Campos comunes para todos los modelos que hereden de BaseModel
    id_usu_creator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_%(class)s')
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    id_usu_modificator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='modified_%(class)s')
    fecha_modificacion = models.DateTimeField(auto_now=True)

    is_deleted = models.BooleanField(default=False)
    fecha_eliminacion = models.DateTimeField(null=True, blank=True)
    
    # La clase Meta se utiliza para definir opciones adicionales para el modelo. En este caso, se establece que esta clase es abstracta, 
    # lo que significa que no se creará una tabla en la base de datos para esta clase, sino que se utilizará como base para otros modelos.
    class Meta:
        abstract = True
    # Método para realizar un borrado suave (soft delete) del registro. En lugar de eliminar el registro de la base de datos, 
    # se marca como eliminado y se registra la fecha de eliminación.
    def soft_delete(self):
        self.is_deleted = True
        self.fecha_eliminacion = timezone.now()
        self.save()
    # Método para restaurar un registro que ha sido marcado como eliminado. Se desmarca como eliminado y se borra la fecha de eliminación.
    def restore(self):
        self.is_deleted = False
        self.fecha_eliminacion = None
        self.save()