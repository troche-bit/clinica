from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.clinica.agenda.models import Agenda
from apps.clinica.consultas.models import Consulta
from apps.mantenimiento.notificaciones.models import Notificacion, ConfiguracionNotificacion
from apps.mantenimiento.notificaciones.services import enviar_notificacion


class Command(BaseCommand):
    help = (
        "Envía recordatorios automáticos:\n"
        "  · Turnos agendados (Agenda.estado=ocupado) próximos a vencer\n"
        "  · Próximas citas sugeridas por el médico (Consulta.proxima_cita)\n"
        "Las horas de anticipación se toman de ConfiguracionNotificacion."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--horas",
            type=int,
            default=None,
            help="Horas de anticipación (sobreescribe la configuración guardada)",
        )

    def handle(self, *args, **options):
        conf = ConfiguracionNotificacion.get_solo()

        if not conf.habilitado:
            self.stdout.write("Notificaciones deshabilitadas en configuración — sin acción.")
            return

        if not conf.auto_recordatorio:
            self.stdout.write("Recordatorios automáticos desactivados en configuración — sin acción.")
            return

        horas_override = options.get("horas")
        if horas_override:
            anticipaciones = [horas_override]
        else:
            anticipaciones = [conf.horas_anticipacion]
            if conf.horas_anticipacion_2:
                anticipaciones.append(conf.horas_anticipacion_2)

        total_env = total_omit = total_fall = 0

        for horas in anticipaciones:
            dias           = max(1, round(horas / 24))
            fecha_objetivo = date.today() + timedelta(days=dias)
            self.stdout.write(f"\n→ Anticipación {horas}h → fecha objetivo: {fecha_objetivo}")

            e, o, f = self._agenda(fecha_objetivo)
            total_env += e; total_omit += o; total_fall += f

            e, o, f = self._proxima_cita(fecha_objetivo)
            total_env += e; total_omit += o; total_fall += f

        self.stdout.write(
            self.style.SUCCESS(
                f"\nTotal — enviados: {total_env}, omitidos: {total_omit}, fallidos: {total_fall}"
            )
        )

    # ──────────────────────────────────────────────────────────────
    def _agenda(self, fecha_objetivo):
        """Turnos confirmados (estado=OCUPADO) para fecha_objetivo."""
        turnos = (
            Agenda.objects
            .filter(is_deleted=False, estado=Agenda.Estado.OCUPADO, fecha=fecha_objetivo)
            .select_related(
                "paciente__persona",
                "horario_prestador__persona_rrhh__persona",
            )
            .prefetch_related("horario_prestador__persona_rrhh__especialidades")
        )

        enviados = omitidos = fallidos = 0

        for turno in turnos:
            paciente = turno.paciente
            persona  = paciente.persona if paciente else None
            email    = persona.correo_electronico if persona else None

            if not email:
                omitidos += 1
                continue

            ya_enviado = Notificacion.objects.filter(
                is_deleted=False,
                agenda=turno,
                tipo=Notificacion.Tipo.RECORDATORIO_CITA,
                canal=Notificacion.Canal.EMAIL,
                estado=Notificacion.Estado.ENVIADO,
            ).exists()

            if ya_enviado:
                omitidos += 1
                continue

            notif = Notificacion.objects.create(
                paciente=paciente,
                agenda=turno,
                tipo=Notificacion.Tipo.RECORDATORIO_CITA,
                canal=Notificacion.Canal.EMAIL,
                estado=Notificacion.Estado.PENDIENTE,
                mensaje="",
                destinatario=email,
            )
            enviar_notificacion(notif.id)
            notif.refresh_from_db()

            if notif.estado == Notificacion.Estado.ENVIADO:
                enviados += 1
            else:
                fallidos += 1

        self.stdout.write(f"  Turnos agendados: +{enviados} env, {omitidos} omit, {fallidos} fall")
        return enviados, omitidos, fallidos

    # ──────────────────────────────────────────────────────────────
    def _proxima_cita(self, fecha_objetivo):
        """Próximas citas sugeridas por médico (Consulta.proxima_cita)."""
        consultas = (
            Consulta.objects
            .filter(is_deleted=False, proxima_cita=fecha_objetivo)
            .select_related("agenda__paciente__persona")
        )

        enviados = omitidos = fallidos = 0

        for consulta in consultas:
            agenda   = consulta.agenda
            paciente = agenda.paciente if agenda else None
            persona  = paciente.persona if paciente else None
            email    = persona.correo_electronico if persona else None

            if not email:
                omitidos += 1
                continue

            ya_enviado = Notificacion.objects.filter(
                is_deleted=False,
                consulta=consulta,
                tipo=Notificacion.Tipo.RECORDATORIO_CITA,
                canal=Notificacion.Canal.EMAIL,
                estado=Notificacion.Estado.ENVIADO,
            ).exists()

            if ya_enviado:
                omitidos += 1
                continue

            notif = Notificacion.objects.create(
                paciente=paciente,
                consulta=consulta,
                tipo=Notificacion.Tipo.RECORDATORIO_CITA,
                canal=Notificacion.Canal.EMAIL,
                estado=Notificacion.Estado.PENDIENTE,
                mensaje="",
                destinatario=email,
            )
            enviar_notificacion(notif.id)
            notif.refresh_from_db()

            if notif.estado == Notificacion.Estado.ENVIADO:
                enviados += 1
            else:
                fallidos += 1

        self.stdout.write(f"  Citas sugeridas:  +{enviados} env, {omitidos} omit, {fallidos} fall")
        return enviados, omitidos, fallidos
