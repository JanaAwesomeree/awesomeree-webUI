from django.urls import path
from .views import ShopeeHealthDataAPI
from .views import ShopeeLateShipmentDataAPI

urlpatterns = [
    path('shopee-health/', ShopeeHealthDataAPI.as_view(), name='shopee-health-data'),
    path('shopee-late-shipment/', ShopeeLateShipmentDataAPI.as_view(), name='shopee-late-shipment-data')
]