'use client';

import { useEffect, useState } from 'react';
import { Search, Mail, Mic, MicOff, Volume2, Loader2, ChevronDown, ChevronRight, Edit3, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Article {
  title: string;
  link: string;
  source: string;
  sourceType: string;
  publishedAt?: string | null;
  snippet?: string;
  author?: string | null;
  matchedKeywords?: string[];
  whyPicked?: string;
  relevanceScore?: number;
  undated?: boolean;
  ageHours?: number | null;
}

interface SearchResult {
  company: string;
  keywordsUsed: string[];
  executiveSummary: string;
  articles: Article[];
  stats: Record<string, any>;
  trace: string[];
}

interface CompanyEntry {
  name: string;
  keywords: string[];
  feedCount: number;
}

const sourceColor: Record<string, string> = {
  rss: 'bg-accent/10 text-accent',
  google_news: 'bg-gold/15 text-goldDark',
  newsapi: 'bg-success/10 text-success',
  bing_news: 'bg-navy/10 text-navy',
  scrape: 'bg-muted/15 text-muted',
};

function highlight(text: string, keywords: string[]) {
  if (!keywords?.length) return text;
  // Escape HTML first
  const escaped = text.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
  let out = escaped;
  for (const k of keywords) {
    if (!k) continue;
    const re = new RegExp(`\\b(${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}

function ArticleSnippet({ snippet, keywords }: { snippet: string; keywords: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const SHORT = 240;
  const isLong = snippet.length > SHORT;
  const shown = expanded || !isLong ? snippet : snippet.slice(0, SHORT) + '…';
  return (
    <div className="mt-2">
      <p
        className="serif text-sm text-muted leading-relaxed"
        dangerouslySetInnerHTML={{ __html: highlight(shown, keywords) }}
      />
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-accent hover:underline mt-1"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export default function Page() {
  const [companies, setCompanies] = useState<CompanyEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [editingKeywords, setEditingKeywords] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [listening, setListening] = useState(false);

  // Email modal state
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/companies').then((r) => r.json()).then((d) => setCompanies(d.companies ?? []));
  }, []);

  async function runSearch(name: string) {
    setLoading(true);
    setErr(null);
    setResult(null);
    setShowTrace(false);
    try {
      const res = await fetch('/api/agent-search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ company: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed');
      setResult(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveKeywords(name: string) {
    const list = editValue.split(',').map((k) => k.trim()).filter(Boolean);
    const res = await fetch('/api/companies', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, keywords: list }),
    });
    if (res.ok) {
      const d = await res.json();
      setCompanies((cs) => cs.map((c) => (c.name === name ? { ...c, keywords: d.keywords } : c)));
      setEditingKeywords(null);
    }
  }

  // Voice input via Web Speech API
  function toggleListen() {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setErr('Voice input not supported in this browser.');
      return;
    }
    if (listening) { setListening(false); return; }
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.onresult = (e: any) => setQuery(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  }

  function speak(text: string) {
    const synth = (window as any).speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    synth.speak(u);
  }

  async function sendEmail() {
    if (!result) return;
    setEmailSending(true);
    setEmailNote(null);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: emailTo,
          cc: emailCc || undefined,
          company: result.company,
          articles: result.articles,
          keywords: result.keywordsUsed,
          executiveSummary: result.executiveSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Send failed');
      setEmailNote('Email sent successfully.');
      setTimeout(() => { setEmailOpen(false); setEmailNote(null); }, 1500);
    } catch (e) {
      setEmailNote(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setEmailSending(false);
    }
  }

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="bg-grain min-h-screen relative">
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12 pb-8 border-b border-border">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted mb-3">
            <span>PR Monitor Agent</span>
            <span>{dateStr}</span>
          </div>
          <h1 className="serif text-5xl md:text-6xl font-bold text-navy leading-tight tracking-tight">
            Claude-powered<br/>PR Intelligence
          </h1>
          <p className="serif text-lg text-muted mt-4 max-w-2xl leading-relaxed">
            Claude reasons step-by-step across your RSS feeds, Google News, NewsAPI, Bing News, and HTML scraping —
            picks the relevant articles, explains why each one was chosen, and writes an executive summary.
            Only articles from the last <span className="text-navy font-semibold">72 hours</span> are shown.
          </p>
        </header>

        {/* Company chips */}
        {companies.length > 0 && (
          <section className="mb-8">
            <div className="text-xs uppercase tracking-widest text-muted mb-3">Monitored Companies — hover/tap pencil to edit keywords</div>
            <div className="flex flex-wrap gap-2">
              {companies.map((c) => (
                <div key={c.name} className="inline-flex items-center gap-1 bg-white border border-border rounded-full pl-1 pr-1 hover:border-navy hover:shadow-soft transition-all">
                  <button
                    onClick={() => { setQuery(c.name); runSearch(c.name); }}
                    className="px-3 py-2 text-sm font-medium text-navy"
                  >
                    {c.name}
                    <span className="ml-2 text-xs text-muted">{c.keywords.length}kw · {c.feedCount}feeds</span>
                  </button>
                  <button
                    onClick={() => { setEditingKeywords(c.name); setEditValue(c.keywords.join(', ')); }}
                    className="p-1.5 text-muted hover:text-navy hover:bg-ivory rounded-full transition-colors"
                    title="Edit keywords"
                    aria-label={`Edit keywords for ${c.name}`}
                  >
                    <Edit3 size={14}/>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Search bar */}
        <section className="mb-12">
          <div className="bg-white border border-border rounded-lg p-2 flex items-center gap-2 shadow-soft">
            <Search className="ml-3 text-muted" size={20}/>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) runSearch(query.trim()); }}
              placeholder="Type a company name (GSK, BeOne, Otsuka, Mazda, Trane, Amgen, Indivior)…"
              className="flex-1 outline-none bg-transparent px-2 py-3 text-base serif text-navy placeholder:text-muted"
            />
            <button
              onClick={toggleListen}
              className={`p-3 rounded-md transition-colors ${listening ? 'bg-red-50 text-red-600' : 'text-muted hover:text-navy hover:bg-ivory'}`}
              title="Voice input"
            >
              {listening ? <MicOff size={18}/> : <Mic size={18}/>}
            </button>
            <button
              onClick={() => query.trim() && runSearch(query.trim())}
              disabled={loading || !query.trim()}
              className="px-6 py-3 rounded-md bg-navy text-white font-medium hover:bg-navyLight disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? <><Loader2 className="animate-spin" size={16}/> Researching…</> : 'Search'}
            </button>
          </div>
        </section>

        {/* Edit keywords modal */}
        {editingKeywords && (
          <div className="fixed inset-0 bg-navy/40 z-40 flex items-center justify-center p-4" onClick={() => setEditingKeywords(null)}>
            <div className="bg-white rounded-lg shadow-strong max-w-xl w-full p-8" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="serif text-2xl text-navy">Edit Keywords — {editingKeywords}</h2>
                <button onClick={() => setEditingKeywords(null)} className="text-muted hover:text-navy"><X size={20}/></button>
              </div>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={6}
                className="w-full border border-border rounded-md p-3 serif text-sm focus:outline-none focus:border-navy"
                placeholder="GSK, GlaxoSmithKline, Arexvy, …"
              />
              <p className="text-xs text-muted mt-2">Comma-separated. Edits persist until the server restarts.</p>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setEditingKeywords(null)} className="px-4 py-2 text-muted hover:text-navy">Cancel</button>
                <button onClick={() => saveKeywords(editingKeywords)} className="px-4 py-2 rounded-md bg-navy text-white flex items-center gap-2"><Save size={14}/>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {err && (
          <div className="mb-8 p-4 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-red-700">
            <AlertCircle size={18}/> {err}
          </div>
        )}

        {/* Empty state */}
        {!loading && !result && !err && (
          <div className="text-center py-16">
            <h2 className="serif text-2xl text-navy mb-2">Ready when you are.</h2>
            <p className="text-muted serif">
              Pick a company above, or type one. Claude will plan a research strategy, hit multiple data sources,
              rank each article by relevance, and explain its reasoning.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1,2,3].map((i) => (
              <div key={i} className="bg-white border border-border rounded-md p-6 animate-pulse">
                <div className="h-4 bg-ivory rounded w-1/4 mb-3"/>
                <div className="h-5 bg-ivory rounded w-3/4 mb-2"/>
                <div className="h-4 bg-ivory rounded w-full"/>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <section>
            {/* Executive summary */}
            <div className="bg-white border border-border rounded-lg p-8 mb-8 shadow-soft border-l-4 border-l-gold">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-widest text-muted">Executive Briefing — {result.company}</div>
                <div className="flex gap-2">
                  <button onClick={() => speak(result.executiveSummary)} className="p-1.5 text-muted hover:text-navy" title="Read aloud"><Volume2 size={16}/></button>
                  <button onClick={() => { setEmailOpen(true); setEmailTo(''); setEmailCc(''); }} className="px-3 py-1.5 rounded-md bg-navy text-white text-sm flex items-center gap-2 hover:bg-navyLight"><Mail size={14}/>Email</button>
                </div>
              </div>
              <p className="serif text-lg text-navy leading-relaxed">{result.executiveSummary}</p>
              <div className="mt-4 pt-4 border-t border-border text-xs text-muted flex flex-wrap gap-4">
                <span>Gathered: <b className="text-navy">{result.stats?.totalGathered ?? 0}</b></span>
                <span>After dedupe: <b className="text-navy">{result.stats?.afterDedupe ?? 0}</b></span>
                <span>After ranking: <b className="text-navy">{result.stats?.afterRanking ?? 0}</b></span>
                <span>After freshness ({result.stats?.lookbackHours ?? 72}h): <b className="text-navy">{result.stats?.afterFreshness ?? result.articles.length}</b></span>
                {result.stats?.undated > 0 && <span>Undated: <b className="text-navy">{result.stats.undated}</b></span>}
                {result.stats?.droppedAsStale > 0 && <span>Dropped as stale: <b className="text-navy">{result.stats.droppedAsStale}</b></span>}
              </div>
            </div>

            {/* Articles */}
            {result.articles.length === 0 && (
              <div className="bg-white border border-border rounded-md p-8 text-center">
                <p className="serif text-lg text-navy">No significant news in the last 72 hours.</p>
                <p className="text-muted text-sm mt-2">Try expanding keywords or widening the FRESHNESS_HOURS env var.</p>
              </div>
            )}

            <div className="space-y-3">
              {result.articles.map((a, idx) => {
                const fullDate = a.publishedAt
                  ? new Date(a.publishedAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })
                  : null;
                return (
                <article key={idx} className="bg-white border border-border rounded-md p-6 hover:shadow-soft transition-shadow">
                  {/* Top row: source badges + age + relevance */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${sourceColor[a.sourceType] ?? 'bg-muted/10 text-muted'}`}>
                      {a.source}
                    </span>
                    <span className="text-xs text-muted">via {a.sourceType.replace('_', ' ')}</span>
                    {a.undated && (
                      <span className="text-xs px-2 py-0.5 rounded bg-cream text-muted border border-border">undated</span>
                    )}
                    {!a.undated && a.ageHours != null && (
                      <span className={`text-xs px-2 py-0.5 rounded ${a.ageHours < 24 ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
                        {Math.round(a.ageHours)}h ago
                      </span>
                    )}
                    {a.relevanceScore != null && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gold/15 text-goldDark ml-auto">
                        relevance {(a.relevanceScore * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <a href={a.link} target="_blank" rel="noreferrer" className="block">
                    <h3
                      className="serif text-xl text-navy font-semibold leading-snug hover:text-accent transition-colors"
                      dangerouslySetInnerHTML={{ __html: highlight(a.title, a.matchedKeywords ?? result.keywordsUsed) }}
                    />
                  </a>

                  {/* Byline: publication · author · full date */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted">
                    <span><span className="font-semibold text-navy">{a.source}</span></span>
                    {a.author && <span>by <span className="text-ink">{a.author}</span></span>}
                    {fullDate && <span>· {fullDate}</span>}
                  </div>

                  {/* Why picked */}
                  {a.whyPicked && (
                    <p className="serif text-sm text-ink/80 mt-3 leading-relaxed italic border-l-2 border-gold pl-3">
                      {a.whyPicked}
                    </p>
                  )}

                  {/* Snippet (expandable) */}
                  {a.snippet && (
                    <ArticleSnippet
                      snippet={a.snippet}
                      keywords={a.matchedKeywords ?? result.keywordsUsed}
                    />
                  )}

                  {/* Matched keyword chips */}
                  {a.matchedKeywords && a.matchedKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {a.matchedKeywords.map((k) => (
                        <span key={k} className="text-xs px-2 py-0.5 rounded bg-ivory text-navy border border-border">{k}</span>
                      ))}
                    </div>
                  )}
                </article>
                );
              })}
            </div>

            {/* Agent trace */}
            <div className="mt-8">
              <button onClick={() => setShowTrace((s) => !s)} className="flex items-center gap-2 text-sm text-muted hover:text-navy">
                {showTrace ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                {showTrace ? 'Hide' : 'Show'} Agent Trace ({result.trace.length} steps)
              </button>
              {showTrace && (
                <pre className="mt-3 bg-navy text-ivory text-xs p-4 rounded-md overflow-x-auto font-mono leading-relaxed">
                  {result.trace.join('\n')}
                </pre>
              )}
            </div>
          </section>
        )}

        {/* Email modal */}
        {emailOpen && (
          <div className="fixed inset-0 bg-navy/40 z-40 flex items-center justify-center p-4" onClick={() => setEmailOpen(false)}>
            <div className="bg-white rounded-lg shadow-strong max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="serif text-2xl text-navy">Email This Brief</h2>
                <button onClick={() => setEmailOpen(false)} className="text-muted hover:text-navy"><X size={20}/></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wide text-muted">To</label>
                  <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="client@example.com" className="w-full border border-border rounded-md p-2 mt-1 text-sm serif focus:outline-none focus:border-navy"/>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-muted">CC (optional)</label>
                  <input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="manager@example.com" className="w-full border border-border rounded-md p-2 mt-1 text-sm serif focus:outline-none focus:border-navy"/>
                </div>
              </div>
              {emailNote && (
                <div className={`mt-3 text-sm flex items-center gap-2 ${emailNote.includes('success') ? 'text-success' : 'text-red-600'}`}>
                  {emailNote.includes('success') ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
                  {emailNote}
                </div>
              )}
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setEmailOpen(false)} className="px-4 py-2 text-muted">Cancel</button>
                <button onClick={sendEmail} disabled={emailSending || !emailTo} className="px-4 py-2 rounded-md bg-navy text-white disabled:opacity-40 flex items-center gap-2">
                  {emailSending ? <Loader2 className="animate-spin" size={14}/> : <Mail size={14}/>}
                  {emailSending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-16 pt-8 border-t border-border text-center text-xs text-muted">
          PR Monitor Agent · Powered by Claude · RSS + Google News + NewsAPI + Bing News + Scraping · AWS SES email · 72h freshness window
        </footer>
      </main>
    </div>
  );
}
