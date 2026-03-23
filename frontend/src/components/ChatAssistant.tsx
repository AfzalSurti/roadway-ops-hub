import { useMemo, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import type { AssistantConversationMessage } from "@/lib/domain";
import { toast } from "sonner";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const STARTER_TEXT =
  "Hi, I can help you create projects, create tasks, add team members, and list data. Tell me what to do in one line.";

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: "assistant-start",
      role: "assistant",
      content: STARTER_TEXT
    }
  ]);

  const conversation = useMemo<AssistantConversationMessage[]>(
    () => messages.map((item) => ({ role: item.role, content: item.content })),
    [messages]
  );

  const sendMessage = async () => {
    const value = input.trim();
    if (!value || isSending) {
      return;
    }

    const userMsg: UiMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: value
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const response = await api.chatAssistant({
        message: value,
        conversation: [...conversation, { role: "user", content: value }].slice(-20)
      });

      const assistantText = response.generatedCredentials
        ? `${response.reply}\n\nCredentials:\nEmail: ${response.generatedCredentials.email}\nPassword: ${response.generatedCredentials.password}`
        : response.reply;

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: assistantText
        }
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to contact assistant");
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "I could not process that request right now. Please try again."
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open assistant"
        title="Open assistant"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-xl hover:opacity-90 transition-opacity"
      >
        {open ? <X className="h-6 w-6 mx-auto" /> : <MessageCircle className="h-6 w-6 mx-auto" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Sankalp Assistant</p>
              <p className="text-xs text-muted-foreground">Create and manage project operations by chat</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md hover:bg-secondary/60"
              aria-label="Close assistant"
              title="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-80 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-6 ${
                  msg.role === "user"
                    ? "ml-auto bg-primary/15 border border-primary/30"
                    : "mr-auto bg-secondary/40 border border-border/40"
                }`}
              >
                {msg.content}
              </div>
            ))}
          </div>

          <div className="border-t border-border/40 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={2}
                placeholder="Type request... e.g. Create project NH848 and description road widening"
                className="flex-1 resize-none rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={isSending || !input.trim()}
                className="h-10 w-10 shrink-0 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                aria-label="Send message"
                title="Send"
              >
                <Send className="h-4 w-4 mx-auto" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
