import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './admin-ai.css';
import { loadAdminContext, supabase } from './admin-supabase';

const QUICK_PROMPTS = [
  'How is my clinic doing today?',
  'How are we doing this week?',
  'Compare this month with the same days last month.',
  'How many appointments are tomorrow?',
  "What are today's collections?",
  'How much is currently outstanding?',
];

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatAiText(value) {
  const lines = String(value || '')
    .replace(/\*\*/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim());

  const output = [];
  for (const line of lines) {
    if (!line) {
      if (output.length && output[output.length - 1] !== '') output.push('');
      continue;
    }

    if (/^\|?\s*:?-{3,}/.test(line) && !/[A-Za-z0-9₹$]/.test(line)) continue;

    if (line.includes('|')) {
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      if (cells.length) {
        output.push(`• ${cells.join(' · ')}`);
        continue;
      }
    }

    output.push(line.replace(/^[-*]\s+/, '• '));
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function invokeCapDentAi(question) {
  const cleaned = String(question || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!cleaned) throw new Error('Enter a clinic question.');

  const { data, error } = await supabase.functions.invoke('capdent-ai', {
    body: { action: 'analytics', question: cleaned },
  });

  if (error) {
    const context = error && typeof error === 'object' && 'context' in error ? error.context : null;
    if (context instanceof Response) {
      const payload = await context.json().catch(() => null);
      if (payload?.error || payload?.message) throw new Error(payload.error || payload.message);
    }
    throw error;
  }

  if (!data?.answer) throw new Error('CapDent AI returned no answer.');
  return data;
}

function CapDentAdminAi() {
  const [allowed, setAllowed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask me about your clinic performance, appointments, collections, dues, visits, treatments and gallery activity. I use read-only, clinic-scoped CapDent analytics.',
    },
  ]);

  useEffect(() => {
    let active = true;

    async function resolve(session) {
      if (!active) return;
      if (!session?.user) {
        setAllowed(false);
        setProfile(null);
        setClinic(null);
        setOpen(false);
        return;
      }

      try {
        const context = await loadAdminContext(session.user.id);
        if (!active) return;
        setProfile(context.profile);
        setClinic(context.clinic);
        setAllowed(['owner', 'head_doctor'].includes(context.profile.role));
      } catch {
        if (!active) return;
        setAllowed(false);
        setProfile(null);
        setClinic(null);
        setOpen(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => resolve(session), 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const title = useMemo(() => clinic?.name ? `${clinic.name} AI` : 'CapDent AI', [clinic?.name]);

  async function ask(question) {
    const cleaned = String(question || '').trim().slice(0, 300);
    if (!cleaned || loading) return;

    setInput('');
    setMessages((current) => [...current, { id: id(), role: 'user', text: cleaned }]);
    setLoading(true);

    try {
      const result = await invokeCapDentAi(cleaned);
      setMessages((current) => [...current, { id: id(), role: 'assistant', text: formatAiText(result.answer) }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: id(),
          role: 'assistant',
          text: error?.message || 'CapDent AI is temporarily unavailable. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!allowed || !profile || !clinic) return null;

  return (
    <>
      <button
        type="button"
        className="admin-ai-launcher"
        aria-label="Open CapDent AI"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen(true)}
      >
        <span className="admin-ai-launcher-icon" aria-hidden="true">✦</span>
        <span><strong>CapDent AI</strong><small>Ask your clinic</small></span>
      </button>

      {open ? (
        <div className="admin-ai-layer" role="presentation">
          <button type="button" className="admin-ai-backdrop" aria-label="Close CapDent AI" onClick={() => setOpen(false)} />
          <section className="admin-ai-panel" role="dialog" aria-modal="true" aria-labelledby="admin-ai-title">
            <header className="admin-ai-head">
              <div className="admin-ai-mark" aria-hidden="true">✦</div>
              <div>
                <h2 id="admin-ai-title">{title}</h2>
                <p>Read-only clinic intelligence</p>
              </div>
              <button type="button" className="admin-ai-close" aria-label="Close CapDent AI" onClick={() => setOpen(false)}>×</button>
            </header>

            <div className="admin-ai-safety">
              <span>Owner / head doctor</span>
              <span>Clinic-scoped</span>
              <span>Cannot modify records</span>
            </div>

            <div className="admin-ai-messages">
              <div className="admin-ai-prompts" aria-label="Suggested questions">
                {QUICK_PROMPTS.map((prompt) => (
                  <button type="button" key={prompt} disabled={loading} onClick={() => ask(prompt)}>{prompt}</button>
                ))}
              </div>

              {messages.map((message) => (
                <div key={message.id} className={`admin-ai-message ${message.role}`}>
                  <p style={message.role === 'assistant' ? { whiteSpace: 'pre-wrap' } : undefined}>{message.text}</p>
                </div>
              ))}

              {loading ? (
                <div className="admin-ai-message assistant loading" aria-live="polite">
                  <span className="admin-ai-spinner" aria-hidden="true" />
                  <p>Reviewing clinic metrics…</p>
                </div>
              ) : null}
            </div>

            <form className="admin-ai-compose" onSubmit={(event) => { event.preventDefault(); ask(input); }}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={300}
                rows="2"
                disabled={loading}
                placeholder="Ask about today, this week, this month, appointments, collections or dues…"
                aria-label="Ask CapDent AI"
              />
              <button type="submit" disabled={loading || !input.trim()} aria-label="Send question">↑</button>
              <small>Aggregate clinic analytics only. Verify source records before operational decisions.</small>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function mount() {
  if (document.getElementById('capdent-admin-ai-root')) return;
  const node = document.createElement('div');
  node.id = 'capdent-admin-ai-root';
  document.body.appendChild(node);
  createRoot(node).render(<React.StrictMode><CapDentAdminAi /></React.StrictMode>);
}

mount();
