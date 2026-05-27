from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('caja_banco', '0003_rename_voucher_nro_comprobante'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='movimientocajabanco',
            name='vuelto',
        ),
    ]
