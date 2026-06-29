import React, { useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  analysisId: string;
}

function parseMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const listItems: React.ReactNode[] = [];
  const renderedElements: React.ReactNode[] = [];

  const parseLineContent = (content: string) => {
    // Split by bold markdown **
    const parts = content.split(/\*\*([\s\S]*?)\*\*/g);
    return parts.map((part, partIdx) => {
      if (partIdx % 2 === 1) {
        return <strong key={partIdx} className="font-semibold text-foreground">{part}</strong>;
      }
      
      // Parse links [text](url)
      const linkParts = [];
      let lastIndex = 0;
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      while ((match = linkRegex.exec(part)) !== null) {
        const [_, linkText, url] = match;
        const index = match.index;
        if (index > lastIndex) {
          linkParts.push(part.substring(lastIndex, index));
        }
        linkParts.push(
          <a
            key={url + index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline font-medium"
          >
            {linkText}
          </a>
        );
        lastIndex = linkRegex.lastIndex;
      }
      if (lastIndex < part.length) {
        linkParts.push(part.substring(lastIndex));
      }
      
      return linkParts.length > 0 ? <span key={partIdx}>{linkParts}</span> : part;
    });
  };

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      renderedElements.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 mb-2 space-y-1 text-xs">
          {[...listItems]}
        </ul>
      );
      listItems.length = 0;
    }
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    
    // Header check
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      flushList(lineIdx);
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      const parsedText = parseLineContent(headerText);
      if (level === 1) {
        renderedElements.push(<h1 key={lineIdx} className="text-sm font-bold mt-3 mb-1 text-foreground">{parsedText}</h1>);
      } else if (level === 2) {
        renderedElements.push(<h2 key={lineIdx} className="text-xs font-bold mt-2 mb-1 text-foreground">{parsedText}</h2>);
      } else {
        renderedElements.push(<h3 key={lineIdx} className="text-xs font-semibold mt-2 mb-1 text-foreground">{parsedText}</h3>);
      }
      return;
    }

    // Bullet point check
    const bulletMatch = line.match(/^(\s*)-\s+(.*)/);
    if (bulletMatch) {
      const bulletContent = bulletMatch[2];
      listItems.push(
        <li key={lineIdx} className="leading-relaxed">
          {parseLineContent(bulletContent)}
        </li>
      );
      return;
    }

    // Empty line or regular text
    if (trimmed === "") {
      flushList(lineIdx);
      renderedElements.push(<div key={lineIdx} className="h-2" />);
    } else {
      flushList(lineIdx);
      renderedElements.push(
        <div key={lineIdx} className="mb-1.5 last:mb-0 leading-relaxed text-xs">
          {parseLineContent(line)}
        </div>
      );
    }
  });

  flushList(lines.length);
  return <div className="space-y-0.5">{renderedElements}</div>;
}

export function ChatInterface({ analysisId }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am your InvestorGPT Grounded QA Agent. Ask me anything about the calculated metrics, intrinsic value, or financial health scores in this report."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/chat/${analysisId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message to grounded assistant");
      }

      const json = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: json.message }]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Error: Could not reach grounded QA agent. Make sure backend is running." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card flex flex-col h-[500px] border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold text-foreground">Report Grounded Chat</span>
        </div>
        <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
          0% Hallucination Mode
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
              msg.role === "user"
                ? "bg-gradient-to-r from-accent to-primary text-white rounded-tr-none"
                : "bg-white/[0.04] border border-white/5 text-neutral/90 rounded-tl-none"
            }`}>
              {parseMarkdown(msg.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 text-xs text-neutral">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              <span>Grounded QA Agent is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-white/[0.01] flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about fair value, Piotroski score, RSI momentum..."
          className="flex-1 px-4 py-2.5 bg-black/40 border border-white/5 focus:border-accent/40 rounded-xl text-xs outline-none text-foreground placeholder:text-neutral/50"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-gradient-to-r from-accent to-primary hover:opacity-90 disabled:opacity-40 text-white rounded-xl flex items-center justify-center cursor-pointer transition-opacity"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
