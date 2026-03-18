from rest_framework.pagination import PageNumberPagination # Importamos la clase PageNumberPagination de DRF para crear nuestras propias clases de paginación.


class StandardPagination(PageNumberPagination): # Creamos una clase de paginación personalizada llamada StandardPagination que hereda de PageNumberPagination.
    page_size              = 20 # Establecemos el número de elementos por página a 20.
    page_size_query_param  = 'page_size'  # Permite a los clientes especificar el número de elementos por página utilizando el parámetro 'page_size' en la URL. Por ejemplo, si un cliente hace una solicitud a /api/items/?page_size=50, se devolverán 50 elementos por página.
    max_page_size          = 100 # Establecemos el número máximo de elementos por página a 100. Esto significa que aunque el cliente solicite más de 100 elementos por página, solo se devolverán 100.


class SmallPagination(PageNumberPagination): # Creamos otra clase de paginación personalizada llamada SmallPagination que también hereda de PageNumberPagination.
    page_size              = 10 # Establecemos el número de elementos por página a 10, lo que es útil para casos donde queremos mostrar menos elementos por página.
    page_size_query_param  = 'page_size' # Permite a los clientes especificar el número de elementos por página utilizando el parámetro 'page_size' en la URL, al igual que en StandardPagination.
    max_page_size          = 50 # Establecemos el número máximo de elementos por página a 50, lo que limita la cantidad de datos que se pueden solicitar en una sola página.