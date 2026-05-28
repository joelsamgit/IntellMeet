import { useState, useRef, useEffect } from "react";
import { Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Message } from "@/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  onClose: () => void;
  onTypingChange?: (isTyping: boolean) => void;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  onClose,
  onTypingChange,
}: ChatPanelProps) {
  const { user } = useAuthStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
    onTypingChange?.(false);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    onTypingChange?.(value.length > 0);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      onTypingChange?.(false);
      typingTimeoutRef.current = null;
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      onTypingChange?.(false);
    };
  }, [onTypingChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-80 bg-[#0d0e14] border-l border-white/5 flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">Meeting Chat</h3>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
              <Send className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-sm text-gray-500">No messages yet</p>
            <p className="text-xs text-gray-600">
              Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.senderId === user?._id;
            const showAvatar =
              i === 0 || messages[i - 1].senderId !== msg.senderId;

            return (
              <div
                key={msg._id}
                className={cn(
                  "flex gap-2",
                  isOwn ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div className="w-7 flex-shrink-0">
                  {showAvatar && (
                    <Avatar className="w-7 h-7">
                      {msg.senderAvatar ? (
                        <AvatarImage src={msg.senderAvatar} alt={msg.senderName} />
                      ) : null}
                      <AvatarFallback className="bg-indigo-600 text-white text-[10px]">
                        {msg.senderName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={cn(
                    "max-w-[200px] space-y-1",
                    isOwn ? "items-end" : "items-start",
                    "flex flex-col"
                  )}
                >
                  {showAvatar && (
                    <span
                      className={cn(
                        "text-[10px] text-gray-500",
                        isOwn ? "text-right" : "text-left"
                      )}
                    >
                      {isOwn ? "You" : msg.senderName}
                    </span>
                  )}
                  <div
                    className={cn(
                      "px-3 py-2 rounded-2xl text-sm leading-relaxed",
                      isOwn
                        ? "bg-indigo-600 text-white rounded-tr-sm"
                        : "bg-white/5 text-gray-200 rounded-tl-sm"
                    )}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-gray-600">
                    {format(new Date(msg.timestamp), "h:mm a")}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-sm h-9 flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            size="sm"
            className="w-9 h-9 p-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}