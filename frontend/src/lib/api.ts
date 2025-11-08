import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: BASE_URL,
});

interface PromptPayload {
  chat_id: string;
  content: string;
}

interface PromptResponse {
  reply: string;
  status: "active" | "ended";
}

export async function promptGPT(data: PromptPayload): Promise<PromptResponse> {
  try {
    const response = await api.post("/prompt_gpt/", data);
    return response.data;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(err.message);
    }
    throw new Error("An unknown error occured!");
  }
}

interface ChatMessagesResponse {
  status: "active" | "ended";
  messages: Array<{ role: string; content: string }>;
}

export async function getChatMessages(
  chatId: string
): Promise<ChatMessagesResponse | null> {
  if (!chatId) return null;
  try {
    const response = await api.get(`/get_chat_messages/${chatId}/`);
    return response.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    if (err instanceof Error) {
      throw new Error(err.message);
    }
    throw new Error("An unknown error occured!");
  }
}

export async function endChat(chatId: string): Promise<{
  status: "active" | "ended";
  summary: string;
}> {
  try {
    const response = await api.post("/end_chat/", { chat_id: chatId });
    return response.data;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(err.message);
    }
    throw new Error("An unknown error occured!");
  }
}

export async function getRecentChats() {
  try {
    const response = await api.get("/recent_chat/");
    return response.data;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(err.message);
    }
    throw new Error("An unknown error occured!");
  }
}

export interface SearchChatResult {
  chat_id: string;
  title: string;
  status: "active" | "ended";
  score: number;
  snippet: string;
}

export async function searchChats(
  query: string,
  limit = 10
): Promise<SearchChatResult[]> {
  try {
    const response = await api.post("/search_chats/", { query, limit });
    return response.data.results;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(err.message);
    }
    throw new Error("An unknown error occured!");
  }
}
