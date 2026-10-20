(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const API_URL = location.hostname.endsWith('vercel.app') ? '/api/reply' : 'https://chatpilot-dusky.vercel.app/api/reply';

  function safe(text) {
    const d = document.createElement('div');
    d.textContent = String(text || '');
    return d.innerHTML;
  }

  function setStatus(mode, detail = '') {
    let badge = $('#aiStatusBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'aiStatusBadge';
      badge.style.cssText = 'margin-top:10px;font-size:12px;font-weight:700;';
      $('#generateQuickBtn')?.insertAdjacentElement('afterend', badge);
    }
    if (!badge) return;
    badge.textContent = mode === 'online' ? '● Groq AI Online' : mode === 'loading' ? '● Asking Groq AI…' : `● Local Fallback${detail ? ` — ${detail}` : ''}`;
    badge.style.color = mode === 'online' ? '#4ade80' : mode === 'loading' ? '#93c5fd' : '#fbbf24';
  }

  function render(result) {
    const list = result.replies;
    $('#quickAnalysis').innerHTML = `<div class="analysis-card"><span>Intent</span><strong>${safe(result.intent)}</strong></div><div class="analysis-card"><span>Mood</span><strong>${safe(result.mood)}</strong></div><div class="analysis-card"><span>Strategy</span><strong>${safe(result.strategy)}</strong></div>`;
    $('#quickOptions').innerHTML = list.map((x, i) => `<div class="quick-option" data-ai-option="${i}"><div class="quick-option-head"><strong>${['Best default','Alternative','Low-pressure'][i]}</strong><span>Use reply</span></div><p>${safe(x)}</p></div>`).join('');
    $('#quickEmpty').classList.add('hidden');
    $('#quickResults').classList.remove('hidden');
    $('#quickFinal').value = list[0];
    $$('[data-ai-option]').forEach(el => el.addEventListener('click', () => {
      $('#quickFinal').value = list[Number(el.dataset.aiOption)];
      $('#quickFinal').dispatchEvent(new Event('input', { bubbles: true }));
    }));
    setStatus('online');
  }

  async function generateWithAI() {
    const input = $('#quickInput')?.value.trim();
    if (!input) return;
    const button = $('#generateQuickBtn');
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Generating with AI…';
    setStatus('loading');
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, persona: $('#quickPersona')?.value || 'auto', tone: $('#quickTone')?.value || 'natural' })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.replies) || data.replies.length !== 3) throw new Error(data.error || `HTTP ${response.status}`);
      render(data);
    } catch (error) {
      console.warn('AI endpoint unavailable:', error.message);
      setStatus('fallback', 'using built-in replies');
      alert('Groq AI is temporarily unavailable. ChatPilot will keep its built-in reply generator available.');
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  function install() {
    const oldButton = $('#generateQuickBtn');
    if (!oldButton) return;
    const newButton = oldButton.cloneNode(true);
    oldButton.replaceWith(newButton);
    newButton.addEventListener('click', generateWithAI);
    setStatus('loading');
    fetch(API_URL, { method: 'OPTIONS' }).then(r => setStatus(r.ok ? 'online' : 'fallback', r.ok ? '' : 'API unavailable')).catch(() => setStatus('fallback', 'API unavailable'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
