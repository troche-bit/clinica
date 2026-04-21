from django.db import migrations


def poblar_tipo(apps, schema_editor):
    FormaPago = apps.get_model('forma_pago', 'FormaPago')
    tipos = {1: 'efectivo', 2: 'tarjeta', 3: 'transferencia'}
    for fp in FormaPago.objects.all():
        fp.tipo = tipos.get(fp.id, 'otro')
        fp.save()


class Migration(migrations.Migration):
    dependencies = [
        ('forma_pago', '0003_add_tipo_to_forma_pago'),
    ]
    operations = [
        migrations.RunPython(poblar_tipo, migrations.RunPython.noop),
    ]
