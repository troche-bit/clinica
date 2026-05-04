from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('diasemana', '0002_insertar_dias_semana'),
    ]

    operations = [
        migrations.AlterModelTable(
            name='DiaSemana',
            table='diasemana',
        ),
    ]
