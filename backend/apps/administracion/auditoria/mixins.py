from decimal import Decimal

from django.db import transaction as db_transaction
from django.db.models.fields.related import ForeignKey, OneToOneField
from django.utils import timezone

from .models import RegistroAuditoria


def _get_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _json_safe(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return value


def _serializar(instance):
    try:
        data = {}
        for field in instance._meta.fields:
            if isinstance(field, (ForeignKey, OneToOneField)):
                try:
                    related = getattr(instance, field.name, None)
                    data[field.name] = str(related) if related is not None else None
                except Exception:
                    data[field.name] = getattr(instance, field.attname, None)
            else:
                data[field.name] = _json_safe(getattr(instance, field.name, None))
        for field in instance._meta.many_to_many:
            try:
                data[field.name] = [str(obj) for obj in getattr(instance, field.name).all()]
            except Exception:
                pass
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
        sid = None
        try:
            sid = db_transaction.savepoint()
            RegistroAuditoria.objects.create(
                tabla         = instance.__class__.__name__,
                registro_id   = instance.pk,
                accion        = accion,
                datos_antes   = datos_antes,
                datos_despues = datos_despues,
                usuario       = self.request.user if self.request.user.is_authenticated else None,
                ip            = _get_ip(self.request),
            )
            db_transaction.savepoint_commit(sid)
        except Exception:
            if sid is not None:
                try:
                    db_transaction.savepoint_rollback(sid)
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
