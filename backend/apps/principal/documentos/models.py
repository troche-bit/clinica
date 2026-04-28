from datetime import datetime
from django.db import models
from apps.core.models import BaseModel
from apps.clinica.paciente.models import Paciente
from apps.mantenimiento.tipo_doc_dig.models import TipoDocDigital
from apps.principal.consultas.models import Consulta


def build_storage_path(tipo_doc_dig, paciente_id, filename):
    ext       = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    now       = datetime.now()
    timestamp = now.strftime('%Y%m%d%H%M%S')
    year      = now.year
    return f"documentos/{tipo_doc_dig.storage_key}/{year}/{timestamp}_{tipo_doc_dig.storage_key}.{ext}"


class DocumentoDigPaciente(BaseModel):

    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.PROTECT,
        related_name='documentos',
        help_text='Paciente al que pertenece este documento',
    )
    tipo_doc_dig = models.ForeignKey(
        TipoDocDigital,
        on_delete=models.PROTECT,
        related_name='documentos',
        help_text='Tipo de documento digitalizado',
    )
    consulta = models.ForeignKey(
        Consulta,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documentos',
        help_text='Consulta a la que pertenece este documento (opcional)',
    )
    storage  = models.TextField(
        help_text='Ruta relativa desde /media/',
    )
    filename = models.TextField(
        help_text='Nombre original del archivo',
    )

    class Meta:
        db_table            = 'documento_dig_paciente'
        verbose_name        = 'Documento digitalizado del paciente'
        verbose_name_plural = 'Documentos digitalizados de pacientes'
        ordering            = ['-fecha_creacion']

    def __str__(self):
        return f'{self.tipo_doc_dig} — {self.paciente} ({self.filename})'
