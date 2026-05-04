import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('horario_prestador', '0002_especialidad_fk_to_m2m'),
        ('consultorio', '0003_rename_table_to_consultorio'),
    ]

    operations = [
        migrations.AddField(
            model_name='horarioprestador',
            name='consultorio',
            field=models.ForeignKey(
                blank=True,
                help_text='Consultorio donde se atiende',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='horarios',
                to='consultorio.consultorio',
            ),
        ),
    ]
