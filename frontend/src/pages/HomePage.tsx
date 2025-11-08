import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { SendHorizonalIcon, StopCircleIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import vs2015 from "react-syntax-highlighter/dist/esm/styles/prism/atom-dark";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endChat, getChatMessages, promptGPT } from "@/lib/api";
import TypingLoader from "@/components/TypingLoader";

type ChatStatus = "active" | "ended";
type Message = { role: "assistant" | "user"; content: string };

export default function Homepage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [chatID, setChatID] = useState("");
  const [chatStatus, setChatStatus] = useState<ChatStatus>("active");
  const [chatSummary, setChatSummary] = useState<string | null>(null);
  const { chat_uid } = useParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (chat_uid) {
      setChatID(chat_uid);
      setChatStatus("active");
    } else {
      setChatID(crypto.randomUUID());
      setChatStatus("active");
    }

    setChatSummary(null);
    console.log("chat id changed!!");
  }, [chat_uid]);

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Welcome! I'm here to assist you." },
  ]);

  const mutation = useMutation({
    mutationFn: promptGPT,
    onSuccess: (res) => {
      console.log(res);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply },
      ]);
      setChatStatus(res.status);
      queryClient.invalidateQueries({ queryKey: ["todaysChat"] });
    },
  });

  const { data: chatData } = useQuery({
    queryKey: ["chatMessages", chatID],
    queryFn: () => getChatMessages(chatID),
    enabled: !!chatID,
  });

  useEffect(() => {
    if (!chatID) return;

    if (chatData && chatData.messages) {
      if (chatData.messages.length > 0) {
        setMessages(
          chatData.messages.map((msg) => ({
            role: (msg.role as Message["role"]) ?? "assistant",
            content: msg.content,
          }))
        );
      } else {
        setMessages([
          { role: "assistant", content: "Welcome! I'm here to assist you." },
        ]);
      }
      setChatStatus(chatData.status);
      const summaryMessage = [...chatData.messages]
        .reverse()
        .find((msg) => msg.content.startsWith("Summary:"));
      if (summaryMessage) {
        setChatSummary(summaryMessage.content.replace(/^Summary:\s*/i, ""));
      } else {
        setChatSummary(null);
      }
    } else {
      setMessages([
        { role: "assistant", content: "Welcome! I'm here to assist you." },
      ]);
      setChatStatus("active");
      setChatSummary(null);
    }
  }, [chatID, chatData]);

  console.log("chatdtata", chatData);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location.pathname == "/" || location.pathname == "/chats/new") {
      setMessages([
        { role: "assistant", content: "Welcome! I'm here to assist you." },
      ]);
      setChatStatus("active");
      setChatSummary(null);

      // setChatID("");
    }
  }, [location.pathname]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    if (chatStatus === "ended") return;

    if (location.pathname == "/" || location.pathname == "/chats/new") {
      navigate(`/chats/${chatID}`);
    }

    const newMessage: Message = { role: "user", content: input };
    setMessages((prev) =>
      [...prev, newMessage].filter(
        (p) => p.content != "Welcome! I'm here to assist you."
      )
    );

    mutation.mutate({ chat_id: chatID, content: input });
    setInput("");
  };

  const endChatMutation = useMutation({
    mutationFn: () => endChat(chatID),
    onSuccess: (res) => {
      setChatStatus(res.status);
      setChatSummary(res.summary);
      queryClient.invalidateQueries({ queryKey: ["chatMessages", chatID] });
    },
  });

  return (
    <div className="flex flex-1">
      <div className="flex flex-col flex-1 bg-background text-foreground">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) =>
            msg.role === "user" ? (
              <div
                key={idx}
                className="w-full mx-auto p-4 rounded-xl bg-primary text-primary-foreground self-end"
              >
                {msg.content}
              </div>
            ) : (
              <div
                key={idx}
                className="prose dark:prose-invert max-w-none bg-muted text-foreground p-4 rounded-lg shadow mb-4"
              >
                <ReactMarkdown
                  components={{
                    code({
                      inline,
                      className,
                      children,
                      ...props
                    }: {
                      inline?: boolean;
                      className?: string;
                      children?: ReactNode;
                    }) {
                      const match = /language-(\w+)/.exec(className || "");
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={vs2015}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-md"
                        >
                          {String(children ?? "").replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      ) : (
                        <code
                          {...props}
                          className="bg-muted rounded px-1 py-0.5 text-sm"
                        >
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            )
          )}

          {mutation.isPending && <TypingLoader />}
          {endChatMutation.isPending && <TypingLoader />}
          <div ref={bottomRef} />
        </div>

        {/* Input / Chat Controls */}
        {chatStatus === "active" ? (
          <div className="border-t p-4 sticky bottom-0 z-50 bg-background text-foreground">
            <div className="max-w-2xl mx-auto flex items-center gap-4">
              <Textarea
                placeholder="Send a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 resize-none min-h-[80px] max-h-[200px] rounded-md border border-input bg-muted/40 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground shadow-sm transition"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSend}
                  className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
                  disabled={mutation.isPending || !input.trim()}
                  title="Send Message"
                >
                  <SendHorizonalIcon size={18} className="cursor-pointer" />
                </button>

                <button
                  onClick={() => endChatMutation.mutate()}
                  className="px-3 py-2 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition disabled:opacity-60 cursor-pointer"
                  disabled={
                    endChatMutation.isPending ||
                    messages.length <= 1 ||
                    !chatID ||
                    mutation.isPending
                  }
                  title="End Chat And Get Summary"
                >
                  <StopCircleIcon size={18} className="cursor-pointer" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t p-6 bg-background text-foreground">
            <div className="max-w-2xl mx-auto text-center space-y-3">
              <h3 className="text-lg font-semibold">Chat Ended</h3>
              <p className="text-sm text-muted-foreground">
                This conversation has been closed. Start a new chat to continue
                the discussion.
              </p>
              {chatSummary && (
                <div className="rounded-lg bg-muted text-left p-4 shadow">
                  <h4 className="font-medium mb-2">Summary</h4>
                  <ReactMarkdown>{chatSummary}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
