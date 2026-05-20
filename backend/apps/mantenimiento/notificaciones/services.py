import base64
import logging
import os
import re

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

TIPO_MAP = {
    "recordatorio_cita":    "recordatorio",
    "confirmacion_reserva": "confirmacion",
    "cancelacion":          "cancelacion",
    "indicaciones":         "post_consulta",
}

_IMG_RE = re.compile(
    r'(<img\b[^>]*?\bsrc=")(/media/[^"]+)("[^>]*?>)',
    re.IGNORECASE | re.DOTALL,
)


def _procesar_imagenes_cid(html):
    """
    Reemplaza src="/media/..." por src="cid:imgN" y devuelve los adjuntos inline.
    """
    adjuntos = []

    def _reemplazar(m):
        prefijo  = m.group(1)
        url_rel  = m.group(2)   # /media/plantillas/imagenes/...
        sufijo   = m.group(3)

        rel = url_rel[len(settings.MEDIA_URL):]   # plantillas/imagenes/...
        ruta = os.path.join(settings.MEDIA_ROOT, rel)

        if not os.path.exists(ruta):
            return m.group(0)

        cid = f"img{len(adjuntos)}"
        ext = ruta.rsplit('.', 1)[-1].lower() if '.' in ruta else 'jpg'

        with open(ruta, 'rb') as f:
            contenido_b64 = base64.b64encode(f.read()).decode('utf-8')

        adjuntos.append({
            "filename":   f"{cid}.{ext}",
            "content":    contenido_b64,
            "content_id": cid,
        })
        return f"{prefijo}cid:{cid}{sufijo}"

    html_mod = _IMG_RE.sub(_reemplazar, html)
    return html_mod, adjuntos


def _build_contexto(notif):
    consulta = notif.consulta
    agenda   = notif.agenda or (consulta.agenda if consulta else None)
    paciente = notif.paciente
    persona  = paciente.persona if paciente else None

    nombre       = persona.razon_social if persona else "—"
    fecha        = ""
    hora         = ""
    medico       = "—"
    especialidad = "—"
    indicaciones = "—"
    observacion  = "—"

    if agenda:
        fecha       = agenda.fecha.strftime('%d/%m/%Y') if agenda.fecha else ""
        hora        = agenda.hora_desde.strftime('%H:%M') if agenda.hora_desde else ""
        observacion = agenda.observacion or "—"
        rrhh = getattr(getattr(agenda, "horario_prestador", None), "persona_rrhh", None)
        if rrhh:
            medico = rrhh.persona.razon_social if getattr(rrhh, "persona_id", None) else "—"
            esp = list(rrhh.especialidades.values_list("descripcion", flat=True)[:1])
            especialidad = esp[0] if esp else "—"

    if consulta:
        indicaciones = consulta.indicaciones or "—"
        if consulta.proxima_cita:
            fecha = consulta.proxima_cita.strftime('%d/%m/%Y') if consulta.proxima_cita else ""

    return {
        "nombre":       nombre,
        "fecha":        fecha,
        "hora":         hora,
        "medico":       medico,
        "especialidad": especialidad,
        "indicaciones": indicaciones,
        "observacion":  observacion,
    }


def _renderizar(plantilla, contexto):
    asunto = plantilla.asunto
    cuerpo = plantilla.cuerpo
    for k, v in contexto.items():
        asunto = asunto.replace("{" + k + "}", str(v or ""))
        cuerpo = cuerpo.replace("{" + k + "}", str(v or ""))
    return asunto, cuerpo


def probar_conexion():
    from .models import ConfiguracionNotificacion
    api_key = getattr(settings, "RESEND_API_KEY", "")
    if not api_key:
        return False, "RESEND_API_KEY no configurada en el servidor."
    conf = ConfiguracionNotificacion.get_solo()
    if not conf.email_remitente:
        return False, "Configure el correo remitente antes de probar la conexión."
    try:
        import resend
        resend.api_key = api_key
        resend.Emails.send({
            "from":    f"{conf.nombre_remitente} <{conf.email_remitente}>",
            "to":      [conf.email_remitente],
            "subject": "Clínica Lichi — Prueba de conexión",
            "html":    "<p>La conexión con el servicio de correo está funcionando correctamente.</p>",
        })
        return True, "Conexión exitosa. Se envió un correo de prueba a " + conf.email_remitente
    except Exception as e:
        return False, str(e)


def enviar_notificacion(notificacion_id):
    from .models import Notificacion, ConfiguracionNotificacion, PlantillaNotificacion

    try:
        notif = (
            Notificacion.objects
            .select_related(
                "paciente__persona",
                "consulta__agenda__horario_prestador__persona_rrhh__persona",
                "agenda__horario_prestador__persona_rrhh__persona",
            )
            .prefetch_related(
                "consulta__agenda__horario_prestador__persona_rrhh__especialidades",
                "agenda__horario_prestador__persona_rrhh__especialidades",
            )
            .get(id=notificacion_id, is_deleted=False)
        )
    except Notificacion.DoesNotExist:
        logger.error("Notificacion %s no encontrada.", notificacion_id)
        return

    if notif.canal != Notificacion.Canal.EMAIL:
        return

    conf = ConfiguracionNotificacion.get_solo()
    if not conf.habilitado:
        notif.estado = Notificacion.Estado.FALLIDO
        notif.save(update_fields=["estado"])
        logger.warning("Envío de notificaciones deshabilitado en configuración.")
        return

    api_key = getattr(settings, "RESEND_API_KEY", "")
    if not api_key:
        notif.estado = Notificacion.Estado.FALLIDO
        notif.save(update_fields=["estado"])
        logger.error("RESEND_API_KEY no configurada.")
        return

    if not notif.destinatario:
        notif.estado = Notificacion.Estado.FALLIDO
        notif.save(update_fields=["estado"])
        logger.error("Notificacion %s sin destinatario email.", notificacion_id)
        return

    tipo_plantilla = TIPO_MAP.get(notif.tipo)
    plantilla = None
    if tipo_plantilla:
        try:
            plantilla = PlantillaNotificacion.objects.get(
                tipo=tipo_plantilla, activa=True, is_deleted=False
            )
        except PlantillaNotificacion.DoesNotExist:
            pass

    if plantilla:
        ctx = _build_contexto(notif)
        asunto, html_body = _renderizar(plantilla, ctx)
    else:
        asunto    = "Clínica Lichi — Notificación"
        html_body = notif.mensaje or ""

    html_body, adjuntos = _procesar_imagenes_cid(html_body)

    try:
        import resend
        resend.api_key = api_key
        payload = {
            "from":    f"{conf.nombre_remitente} <{conf.email_remitente}>",
            "to":      [notif.destinatario],
            "subject": asunto,
            "html":    html_body,
        }
        if adjuntos:
            payload["attachments"] = adjuntos

        resend.Emails.send(payload)
        notif.estado      = Notificacion.Estado.ENVIADO
        notif.fecha_envio = timezone.now()
        notif.mensaje     = html_body
        notif.save(update_fields=["estado", "fecha_envio", "mensaje"])
        logger.info("Notificacion %s enviada a %s con %d imagen(es).",
                    notificacion_id, notif.destinatario, len(adjuntos))
        try:
            from apps.administracion.auditoria.models import RegistroAuditoria
            destinatario_email = (
                notif.paciente.persona.email
                if notif.paciente and notif.paciente.persona.email
                else 'Sin email'
            )
            RegistroAuditoria.objects.create(
                tabla='notificacion',
                registro_id=notif.id,
                accion=RegistroAuditoria.Accion.ENVIO_EMAIL,
                datos_despues={
                    'destinatario': destinatario_email,
                    'asunto': plantilla.asunto if plantilla else 'Sin plantilla',
                    'estado': notif.estado,
                    'tipo': notif.tipo,
                    'automatico': not bool(notif.id_usu_creator_id),
                },
                usuario=notif.id_usu_creator,
                ip=None,
            )
        except Exception:
            pass
    except Exception as e:
        notif.estado = Notificacion.Estado.FALLIDO
        notif.save(update_fields=["estado"])
        logger.error("Error enviando notificacion %s: %s", notificacion_id, e)
