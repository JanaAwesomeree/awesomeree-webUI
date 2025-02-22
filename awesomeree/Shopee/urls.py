from django.urls import path
from .views import ShopeeHealthDataAPI

urlpatterns = [
    path('shopee-health/', ShopeeHealthDataAPI.as_view(), name='shopee-health-data'),
]