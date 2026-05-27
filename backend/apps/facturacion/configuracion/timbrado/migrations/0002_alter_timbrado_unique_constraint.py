from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('timbrado', '0001_initial'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='timbrado',
            name='unique_timbrado_nro',
        ),
        migrations.AddConstraint(
            model_name='timbrado',
            constraint=models.UniqueConstraint(
                condition=models.Q(('is_deleted', False)),
                fields=(
                    'nro_timbrado', 'inicio_vigencia', 'fin_vigencia',
                    'punto_sucursal', 'punto_expedicion', 'nro_desde', 'nro_hasta',
                ),
                name='unique_timbrado_combinado',
            ),
        ),
    ]
