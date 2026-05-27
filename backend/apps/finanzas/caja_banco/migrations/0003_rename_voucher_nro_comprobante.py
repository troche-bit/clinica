from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('caja_banco', '0002_lower_unique_cuenta_mcb'),
    ]

    operations = [
        migrations.RenameField(
            model_name='movimientocajabanco',
            old_name='voucher',
            new_name='nro_comprobante',
        ),
    ]
