from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('facturacion', '0003_move_ctacobrar_to_estadocuenta'),
    ]

    operations = [
        migrations.AddField(
            model_name='ventafactcab',
            name='is_anulado',
            field=models.BooleanField(default=False),
        ),
    ]
