from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import FormaPago
from .serializers import FormaPagoSerializer


class FormaPagoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = FormaPago.objects.all()
    serializer_class   = FormaPagoSerializer
    permission_classes = [IsAuthenticated]
