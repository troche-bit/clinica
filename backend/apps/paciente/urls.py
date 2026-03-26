from rest_framework.routers import DefaultRouter # Importamos el enrutador de DRF para crear rutas automáticamente para nuestras vistas basadas en conjuntos de vistas (ViewSets)
from .views import PacienteViewSet, PacienteResponsableViewSet # Importamos el conjunto de vistas (ViewSet) que hemos creado para manejar las operaciones relacionadas con los pacientes

router = DefaultRouter()    # Creamos una instancia del enrutador, que se encargará de generar las rutas para nuestras vistas basadas en conjuntos de vistas (ViewSets)
router.register(r'paciente', PacienteViewSet, basename='paciente') # Registramos nuestro conjunto de vistas (ViewSet) con el enrutador. El primer argumento es el prefijo de la URL (en este caso, 'pacientes'), el segundo argumento es la clase del conjunto de vistas (PacienteViewSet), y el tercer argumento es un nombre base para las rutas generadas (basename='paciente').
router.register(r'pacienteresponsable', PacienteResponsableViewSet, basename='pacienteresponsable')

urlpatterns = router.urls # Asignamos las rutas generadas por el enrutador a la variable urlpatterns, que es la lista de rutas que Django utilizará para enrutar las solicitudes HTTP a nuestras vistas. Esto permitirá que las operaciones CRUD (Crear, Leer, Actualizar, Eliminar) para los pacientes estén disponibles a través de las rutas generadas automáticamente por el enrutador.