from django.utils import timezone
from .models import RegistroAuditoria


def _get_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _serializar(instance):
    from django.forms.models import model_to_dict
    try:
        data = model_to_dict(instance)
        for field in instance._meta.fields:
            if field.name not in data:
                data[field.name] = getattr(instance, field.name, None)
        for k, v in data.items():
            if hasattr(v, 'isoformat'):
                data[k] = v.isoformat()
            elif hasattr(v, 'pk'):
                data[k] = v.pk
            elif isinstance(v, list):
                # Campos M2M: model_to_dict retorna lista de instancias, no PKs
                data[k] = [obj.pk if hasattr(obj, 'pk') else obj for obj in v]
        return data
    except Exception:
        return {}


class AuditoriaMixin:
    """
    Mixin para ViewSets con BaseModel. Maneja: id_usu_creator/modificator,
    borrado lógico y registro de auditoría. Los ViewSets que usen este mixin
    NO deben redefinir perform_create, perform_update ni perform_destroy.
    """

    def _registrar(self, accion, instance, datos_antes=None, datos_despues=None):
        try:
            RegistroAuditoria.objects.create(
                tabla         = instance.__class__.__name__,
                registro_id   = instance.pk,
                accion        = accion,
                datos_antes   = datos_antes,
                datos_despues = datos_despues,
                usuario       = self.request.user if self.request.user.is_authenticated else None,
                ip            = _get_ip(self.request),
            )
        except Exception:
            pass

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)
        self._registrar(
            RegistroAuditoria.Accion.CREAR,
            serializer.instance,
            datos_antes   = None,
            datos_despues = _serializar(serializer.instance),
        )

    def perform_update(self, serializer):
        datos_antes = _serializar(serializer.instance)
        serializer.save(id_usu_modificator=self.request.user)
        self._registrar(
            RegistroAuditoria.Accion.EDITAR,
            serializer.instance,
            datos_antes   = datos_antes,
            datos_despues = _serializar(serializer.instance),
        )

    def perform_destroy(self, instance):
        datos_antes = _serializar(instance)
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()
        self._registrar(
            RegistroAuditoria.Accion.ELIMINAR,
            instance,
            datos_antes   = datos_antes,
            datos_despues = None,
        )
