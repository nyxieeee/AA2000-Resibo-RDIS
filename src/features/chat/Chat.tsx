import { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, User, Loader2 } from 'lucide-react';
import { useDocumentStore } from '../../store/useDocumentStore';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

function buildSystemPrompt(documents: any[]): string {
  const docSummary = documents.map(d =>
    `- ID:${d.id} | ${d.vendor} | ${d.type} | ${d.docNum} | ${d.date} | ₱${d.total.toLocaleString()} | VAT:₱${d.vat?.toFixed(2)} | VatableSales:₱${d.vatableSales?.toFixed(2)} | Category:${d.category} | Status:${d.status} | Confidence:${d.confidence}%`
  ).join('\n');

  const totalVat = documents.reduce((s, d) => s + (d.vat || 0), 0);
  const totalAmount = documents.reduce((s, d) => s + (d.total || 0), 0);
  const forReview = documents.filter(d => d.status === 'For Review').length;
  const approved = documents.filter(d => d.status === 'Approved' || d.status === 'Auto OK').length;

  return `You are the RDIS AI Assistant for AA2000 Security And Technology — a Philippine-based company.
You help accountants and executives query their financial document ledger using natural language.

FINANCIAL LEDGER SUMMARY (${documents.length} total documents):
Total Amount: ₱${totalAmount.toLocaleString()}
Total VAT: ₱${totalVat.toFixed(2)}
For Review: ${forReview} | Approved/Auto OK: ${approved}

DOCUMENT LIST:
${docSummary || '(No documents yet — user should upload via ScanHub)'}

INSTRUCTIONS:
- Answer questions about these documents using the data above
- Perform calculations on the fly (totals, averages, filters by vendor/date/category/status)
- Be concise but informative
- Use Philippine Peso (₱) for all amounts
- If asked about BIR filing, reference the relevant SLSP/VAT figures
- If documents list is empty, encourage user to upload via ScanHub
- Format numbers with commas and 2 decimal places for currency
- Never make up document data — only use what's in the ledger above`;
}

async function askClaude(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.content?.map((b: any) => b.text || '').join('') || 'Sorry, I could not generate a response.';
}

export function Chat() {
  const documents = useDocumentStore(state => state.documents);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Hello! I am your AA2000 RDIS Assistant powered by Claude AI. You currently have ${documents.length} processed documents in your ledger. Ask me anything — totals, vendor queries, VAT breakdowns, or BIR filing figures.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Conversation history for multi-turn context
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
      const systemPrompt = buildSystemPrompt(documents);
      const aiText = await askClaude(systemPrompt, newHistory);

      setHistory([...newHistory, { role: 'assistant', content: aiText }]);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (err: any) {
      setError('Failed to reach Claude AI. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50">
      <div className="flex items-center px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 shrink-0">
        <div className="bg-blue-600 rounded p-1.5 shadow-sm mr-3">
          <BrainCircuit className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900">RDIS AI Assistant <span className="ml-2 text-[10px] font-bold uppercase bg-blue-100 text-blue-700 py-0.5 px-1.5 rounded">Claude AI</span></h1>
          <p className="text-xs text-slate-500">Query your financial ledger using natural language • {documents.length} docs loaded</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.sender === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-600'}`}>
              {msg.sender === 'user' ? <User className="h-4 w-4" /> : <BrainCircuit className="h-4 w-4" />}
            </div>
            <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-2.5 rounded-2xl max-w-lg text-sm shadow-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                {msg.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 mx-1">{msg.time}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4">
            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-blue-100 text-blue-600">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start">
              <div className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-400 rounded-tl-sm text-sm flex items-center gap-2">
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

      <div className="p-4 border-t border-slate-100 bg-white shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your vendors, taxes, totals, or BIR figures..."
            disabled={isLoading}
            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-5 pr-14 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition shadow-sm disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition"
          >
            <Send className="h-4 w-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
