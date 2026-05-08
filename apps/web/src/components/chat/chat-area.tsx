"use client";

import { useRef, useEffect } from "react";
import type { Message } from "ai";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatAreaProps {
  messages: Message[];
  input: string;
  isLoading: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
}

export function ChatArea({ messages, input, isLoading, onInputChange, onSubmit, onStop }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-gray-400">
            <p>开始你的学习之旅吧</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role as "user" | "assistant"} content={msg.content} />
        ))}
        <div ref={bottomRef} />
      </ScrollArea>
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmit}
        onStop={onStop}
        isLoading={isLoading}
      />
    </div>
  );
}
