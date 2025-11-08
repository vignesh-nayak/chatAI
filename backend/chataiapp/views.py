from django.conf import settings
from openai import OpenAI
from django.shortcuts import render, get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from chataiapp.models import Chat, ChatMessage
from chataiapp.serializers import ChatMessageSerializer, ChatSerializer
from django.utils import timezone
from datetime import timedelta
import requests
import json

now = timezone.now()
today = now.date()

def getResponseFromLocal(messages):
    url = "http://localhost:1234/v1/chat/completions"  # Adjust if your LM Studio API differs
    headers = {"Content-Type": "application/json"}
    data = {
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 500
    }

    try:
        response = requests.post(url, headers=headers, data=json.dumps(data))
        response.raise_for_status()  # Raise an exception for HTTP errors
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error connecting to LM Studio: {e}")
    return None

def createChatTitle(user_message):
    try:
        messages=[
                {"role": "assistant", "content": "Give a short, descriptive title for this conversation in not more than 5 words."},
                {"role": "user", "content": user_message},
            ]
        response = getResponseFromLocal(messages=messages)
        title = response['choices'][0]['message']['content'].strip()
    except Exception: 
        title = user_message[:50]
    return title



@api_view(['POST'])
def prompt_gpt(request):
    chat_id = request.data.get("chat_id")
    content = request.data.get("content")

    if not chat_id:
        return Response({"error": "Chat ID was not provided."}, status=400)

    if not content:
        return Response({"error": "There was no prompt passed."}, status=400)

    chat, created = Chat.objects.get_or_create(id=chat_id)
    chat.title = createChatTitle(content)
    chat.save()

    ChatMessage.objects.create(role="user", chat=chat, content=content)

    chat_messages = chat.messages.order_by("created_at")

    openai_messages = [{"role": message.role, "content": message.content} for message in chat_messages]

    if not any(message["role"] == "system" for message in openai_messages):
        openai_messages.insert(
            0, {"role": "system", "content": "You are a helpful assistant."}
        )
    
    try:
        response = getResponseFromLocal(messages=openai_messages)
        message_content = response['choices'][0]['message']['content']
        if isinstance(message_content, list):
            reply_parts = []
            for part in message_content:
                part_type = None
                part_text = None
                if isinstance(part, dict):
                    part_type = part.get("type")
                    part_text = part.get("text")
                else:
                    part_type = getattr(part, "type", None)
                    part_text = getattr(part, "text", None)
                if part_type == "text" and part_text:
                    reply_parts.append(part_text)
            openai_reply = "".join(reply_parts)
        else:
            openai_reply = str(message_content)
    except Exception as e:
        print("called 90, error:", str(e))
        return Response({"error": f"An error from Openai {str(e)}"}, status=500)
    
    ChatMessage.objects.create(role="assistant", content=openai_reply, chat=chat)
    return Response({"reply": openai_reply}, status=status.HTTP_201_CREATED)



@api_view(["GET"])
def get_chat_messages(request, pk):
    # chat = Chat.objects.get(id=pk)
    chat = get_object_or_404(Chat, id=pk)
    chatmessages = chat.messages.all()
    serializer = ChatMessageSerializer(chatmessages, many=True)
    return Response(serializer.data)



@api_view(["GET"])
def recent_chat(request):
    chats = Chat.objects.filter(created_at__date=today).order_by("-created_at")
    serializer = ChatSerializer(chats, many=True)
    return Response(serializer.data)
