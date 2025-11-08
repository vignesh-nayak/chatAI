import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: BASE_URL,
});

export async function promptGPT(data: { chat_id: string; content: string }) {
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

export async function getChatMessages(chatId: string) {
  if (!chatId) return;
  try {
    const response = await api.get(`/get_chat_messages/${chatId}/`);
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
