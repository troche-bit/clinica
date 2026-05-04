from django.db import migrations


class Migration(migrations.Migration):
    """
    Mueve CtaCobrar del estado de facturacion a estadocuenta.
    La tabla cta_cobrar no se toca en la DB — solo cambia el app que la registra en Django.
    """

    dependencies = [
        ('facturacion', '0002_ventafactcab_establecimiento_expedicion'),
        ('estadocuenta', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name='CtaCobrar'),
            ],
            database_operations=[],
        ),
    ]
