from django.urls import path 
from . import views 

urlpatterns = [
    path("prompt_gpt/", views.prompt_gpt, name="prompt_gpt"),
    path("get_chat_messages/<str:pk>/", views.get_chat_messages, name="get_chat_messages"),
    path("recent_chat/", views.recent_chat, name="recent_chat"),
]