from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from chataiapp.models import Chat, ChatMessage
from chataiapp.serializers import ChatMessageSerializer, ChatSerializer
from django.utils import timezone
import requests
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

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

    if chat.status == Chat.Status.ENDED:
        return Response(
            {"error": "Chat has already ended and cannot accept new messages."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    chat.title = createChatTitle(content)
    chat.save()

    ChatMessage.objects.create(role="user", chat=chat, content=content)

    chat_messages = chat.messages.order_by("created_at")

    openai_messages = [{"role": message.role, "content": message.content} for message in chat_messages]

    if not any(message["role"] == "system" for message in openai_messages):
        openai_messages.insert(
            0, {"role": "system", "content": "You are a helpful assistant. answer in a concise and to the point manner."}
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
    return Response(
        {"reply": openai_reply, "status": chat.status},
        status=status.HTTP_201_CREATED,
    )



@api_view(["GET"])
def get_chat_messages(request, pk):
    # chat = Chat.objects.get(id=pk)
    chat = get_object_or_404(Chat, id=pk)
    chatmessages = chat.messages.all()
    serializer = ChatMessageSerializer(chatmessages, many=True)
    return Response(
        {"status": chat.status, "messages": serializer.data},
        status=status.HTTP_200_OK,
    )



@api_view(["GET"])
def recent_chat(request):
    chats = Chat.objects.filter(created_at__date=today).order_by("-created_at")
    serializer = ChatSerializer(chats, many=True)
    return Response(serializer.data)


def _build_conversation_text(messages):
    return "\n".join(
        f"{message.role.upper()}: {message.content}" for message in messages
    )


@api_view(["POST"])
def end_chat(request):
    chat_id = request.data.get("chat_id")

    if not chat_id:
        return Response({"error": "Chat ID was not provided."}, status=400)

    chat = get_object_or_404(Chat, id=chat_id)

    if chat.status == Chat.Status.ENDED:
        return Response(
            {"status": chat.status, "summary": "Chat already marked as ended."},
            status=status.HTTP_200_OK,
        )

    chat_messages = chat.messages.order_by("created_at")

    if not chat_messages.exists():
        summary_text = "No messages were exchanged in this chat."
    else:
        conversation_text = _build_conversation_text(chat_messages)
        summary_prompt = [
            {
                "role": "system",
                "content": (
                    "You are an assistant tasked with summarizing conversations. "
                    "Generate a concise summary (2-3 bullet points) followed by a single-line key takeaway."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Summarize the following conversation between a user and an assistant:\n"
                    f"{conversation_text}"
                ),
            },
        ]
        try:
            response = getResponseFromLocal(messages=summary_prompt)
            summary_payload = response["choices"][0]["message"]["content"]
            if isinstance(summary_payload, list):
                summary_text = "".join(
                    part.get("text", "")
                    for part in summary_payload
                    if isinstance(part, dict)
                ).strip()
            else:
                summary_text = str(summary_payload).strip()
        except Exception as exc:
            print("Error generating chat summary:", exc)
            return Response(
                {"error": "Failed to generate chat summary."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    chat.status = Chat.Status.ENDED
    chat.save(update_fields=["status"])

    ChatMessage.objects.create(
        role="assistant", chat=chat, content=f"Summary:\n{summary_text}"
    )

    return Response(
        {"status": chat.status, "summary": summary_text}, status=status.HTTP_200_OK
    )


def _chat_to_document(chat: Chat, messages):
    pieces = []
    if chat.title:
        pieces.append(chat.title)
    for message in messages:
        pieces.append(f"{message.role}: {message.content}")
    return " \n".join(pieces)


def _extract_snippet(text: str, length: int = 160):
    stripped = text.strip()
    if len(stripped) <= length:
        return stripped
    return stripped[: length - 3].rstrip() + "..."


@api_view(["POST"])
def search_chats(request):
    query = (request.data.get("query") or "").strip()
    limit = int(request.data.get("limit") or 10)

    if not query:
        return Response({"error": "Query was not provided."}, status=400)

    chats = (
        Chat.objects.prefetch_related("messages")
        .order_by("-created_at")
    )

    documents = []
    metadata = []

    for chat in chats:
        messages = list(chat.messages.order_by("created_at"))
        if not messages:
            continue
        document = _chat_to_document(chat, messages)
        documents.append(document)
        metadata.append((chat, messages))

    if not documents:
        return Response({"results": []}, status=status.HTTP_200_OK)

    vectorizer = TfidfVectorizer(stop_words="english")
    corpus = documents + [query]
    tfidf_matrix = vectorizer.fit_transform(corpus)
    query_vector = tfidf_matrix[-1]
    documents_matrix = tfidf_matrix[:-1]

    similarities = cosine_similarity(query_vector, documents_matrix).flatten()

    ranked = sorted(
        zip(similarities, metadata, documents),
        key=lambda item: item[0],
        reverse=True,
    )

    results = []
    for score, (chat, messages), document in ranked[:limit]:
        last_message = messages[-1].content if messages else ""
        snippet = _extract_snippet(last_message or document)
        results.append(
            {
                "chat_id": str(chat.id),
                "title": chat.title or f"Session {chat.id}",
                "status": chat.status,
                "score": round(float(score), 4),
                "snippet": snippet,
            }
        )

    return Response({"results": results}, status=status.HTTP_200_OK)
