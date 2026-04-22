import { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, User, Loader2 } from 'lucide-react';
import { useDocumentStore } from '../../store/useDocumentStore';
import type { DocumentRecord } from '../../types/document';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

function buildSystemPrompt(documents: DocumentRecord[]): string {
  const docSummary = documents.map(d =>
    `- ID:${d.id} | ${d.vendor} | TIN:${d.taxId} | ${d.type} | ${d.docNum} | ${d.date} | ₱${d.total.toLocaleString()} | VAT:₱${d.vat?.toFixed(2)} | Vatable:₱${d.vatableSales?.toFixed(2)} | TaxType:${d.taxType || 'VAT'} | Category:${d.category} | Confidence:${d.confidence}%`
  ).join('\n');

  const totalVat = documents.reduce((s, d) => s + (d.vat || 0), 0);
  const totalAmount = documents.reduce((s, d) => s + (d.total || 0), 0);

  return `You are the RDIS AI Assistant for AA2000 Security And Technology — a Philippine-based company.
You help accountants and executives query their financial document ledger using natural language.

FINANCIAL LEDGER SUMMARY (${documents.length} submitted documents):
Total Amount: ₱${totalAmount.toLocaleString()}
Total VAT: ₱${totalVat.toFixed(2)}

DOCUMENT LIST:
${docSummary || '(No submitted documents yet — user should submit drafts via the Library)'}

INSTRUCTIONS:
- Answer questions about these documents using the data above
- Perform calculations on the fly (totals, averages, filters by vendor/date/category)
- Be concise but informative
- Use Philippine Peso (₱) for all amounts
- If asked about BIR filing, reference the relevant SLSP/VAT figures
- If documents list is empty, encourage user to upload and finalize drafts
- Format numbers with commas and 2 decimal places for currency
- Never make up document data — only use what is in the ledger above`;
}

async function askGroq(
  apiKey: string,
  systemPrompt: string,
  history: { role: string; content: string }[]
): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
      ],
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq API error ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
}

export function Chat() {
  const allDocuments = useDocumentStore(state => state.documents);
  const submittedDocs = allDocuments.filter(d => d.status === 'Submitted');

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Hello! I am your AA2000 RDIS Assistant powered by Llama 3.3 70B via Groq. You currently have ${submittedDocs.length} submitted documents in your ledger. Ask me anything — totals, vendor queries, VAT breakdowns, or BIR filing figures.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setError(null);

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);

    const newHistory = [...history, { role: 'user', content: userText }];
    setIsLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(submittedDocs);
      const aiText = await askGroq(apiKey!, systemPrompt, newHistory);
      setHistory([...newHistory, { role: 'assistant', content: aiText }]);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reach Groq. Please try again.';
      if (message.includes('401') || message.includes('invalid_api_key')) {
        setError('Invalid Groq API key. Please check your .env file.');
      } else {
        setError(`Error: ${message}`);
      }
    } finally {
      setIsLoading(false);
      // Re-focus the input after loading is complete and input is re-enabled
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50 bg-[--bg-surface]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 shrink-0 bg-[--bg-surface]">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 rounded p-1.5 shadow-sm">
            <BrainCircuit className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-[--text-primary]">RDIS AI Assistant <span className="ml-2 text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 py-0.5 px-1.5 rounded">Llama 3.3 70B</span></h1>
            <p className="text-xs text-[--text-muted]">Query your financial ledger using natural language • {submittedDocs.length} submitted docs loaded</p>
          </div>
        </div>
      </div>

      {/* Missing key warning */}
      {!apiKey && (
        <div className="px-6 py-3 border-b border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-400">
          ⚠️ No Groq API key found. Add <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">VITE_GROQ_API_KEY=your_key</code> to your <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">.env</code> file and restart the dev server.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[--bg-page]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.sender === 'user' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'bg-blue-100 dark:bg-blue-950/50 text-blue-600'}`}>
              {msg.sender === 'user' ? <User className="h-4 w-4" /> : <BrainCircuit className="h-4 w-4" />}
            </div>
            <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-2.5 rounded-2xl max-w-lg text-sm shadow-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-[--bg-surface] border border-[--border-default] text-[--text-primary] rounded-tl-sm'}`}>
                {msg.text}
              </div>
              <span className="text-[10px] text-[--text-muted] mt-1 mx-1">{msg.time}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4">
            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-blue-100 dark:bg-blue-950/50 text-blue-600">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start">
              <div className="px-4 py-2.5 rounded-2xl bg-[--bg-surface] border border-[--border-default] text-[--text-muted] rounded-tl-sm text-sm flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[--border-default] shrink-0 bg-[--bg-surface]">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={apiKey ? "Ask about your vendors, taxes, totals, or BIR figures..." : "Add VITE_GROQ_API_KEY to .env to enable chat..."}
            disabled={!apiKey}
            autoFocus
            className="w-full bg-[--bg-raised] border border-[--border-default] text-[--text-primary] placeholder:text-[--text-muted] rounded-full pl-5 pr-14 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-[--bg-surface] transition shadow-sm disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !apiKey}
            className="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition"
          >
            <Send className="h-4 w-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
