from django.db import migrations


def insertar_formas_pago(apps, schema_editor):
    FormaPago = apps.get_model('forma_pago', 'FormaPago')
    formas = [
        {'id': 1, 'descripcion': 'Efectivo'},
        {'id': 2, 'descripcion': 'Tarjeta'},
        {'id': 3, 'descripcion': 'Transferencia'},
    ]
    for forma in formas:
        FormaPago.objects.create(**forma)


def revertir_formas_pago(apps, schema_editor):
    FormaPago = apps.get_model('forma_pago', 'FormaPago')
    FormaPago.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('forma_pago', '0001_initial'),
    ]
    operations = [
        migrations.RunPython(insertar_formas_pago, revertir_formas_pago),
    ]
