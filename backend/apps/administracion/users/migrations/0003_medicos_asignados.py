from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('persona_rrhh', '0002_personarrhh_honorario'),
        ('users', '0002_perfilusuario_medico_asignado'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='perfilusuario',
            name='medico_asignado',
        ),
        migrations.AddField(
            model_name='perfilusuario',
            name='medicos_asignados',
            field=models.ManyToManyField(
                blank=True,
                help_text='Médicos que esta secretaria asiste',
                related_name='secretarias',
                to='persona_rrhh.personarrhh',
            ),
        ),
    ]
