(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const contacts = [
    { id: 1, name: 'Alex', initials: 'AL', persona: 'Price-sensitive regular', mood: 'Hesitant', intent: 'Price objection', priority: 'hot', unread: 1, traits: ['Friendly', 'Budget-aware', 'Returns often'], history: [
      { from: 'in', text: 'Hey, I liked the last thing you sent 😅', time: '7:12 PM' },
      { from: 'out', text: 'Aww, I’m glad you liked it 😘 You’ve got good taste.', time: '7:13 PM' },
      { from: 'in', text: '$30 though? That’s kinda expensive. Maybe I’ll pass this time.', time: '7:14 PM' }
    ]},
    { id: 2, name: 'Marco', initials: 'MR', persona: 'Warm conversationalist', mood: 'Curious', intent: 'Casual chat', priority: 'normal', unread: 2, traits: ['Talkative', 'Likes attention', 'Slow buyer'], history: [{ from: 'in', text: 'Long day today 😭 What are you up to?', time: '7:09 PM' }] },
    { id: 3, name: 'Dylan', initials: 'DY', persona: 'Direct buyer', mood: 'Interested', intent: 'Buying signal', priority: 'hot', unread: 1, traits: ['Decisive', 'Low patience', 'Clear intent'], history: [{ from: 'in', text: 'Okay fine 😂 what’s the one you said was special?', time: '7:10 PM' }] },
    { id: 4, name: 'Noah', initials: 'NO', persona: 'Skeptical subscriber', mood: 'Defensive', intent: 'Emotional objection', priority: 'normal', unread: 1, traits: ['Needs reassurance', 'Sensitive to sales'], history: [{ from: 'in', text: 'Feels like every time we talk you try to sell me something 😕', time: '7:04 PM' }] },
    { id: 5, name: 'Evan', initials: 'EV', persona: 'Disappointed buyer', mood: 'Frustrated', intent: 'Complaint', priority: 'hot', unread: 1, traits: ['Blunt', 'Previously purchased'], history: [{ from: 'in', text: 'Seriously? I paid for that and it wasn’t what I expected at all.', time: '7:02 PM' }] },
    { id: 6, name: 'Sam', initials: 'SM', persona: 'Quiet lurker', mood: 'Neutral', intent: 'Re-engagement', priority: 'normal', unread: 0, traits: ['Quiet', 'Low-pressure'], history: [{ from: 'out', text: 'Hey stranger 😄 how’s your week going?', time: 'Yesterday' }] }
  ];

  const state = { selectedId: 1, filter: 'all', replies: 0, scores: [], handled: 0, practice: false, seconds: 300, timer: null, arrivals: null };

  const strategies = {
    'Price objection': 'Acknowledge the concern, preserve value, and create curiosity without immediately discounting.',
    'Delay objection': 'Find the reason for delaying without pressure or panic-discounting.',
    'Complaint': 'Acknowledge disappointment, understand expectations, and avoid arguing or promising unauthorized compensation.',
    'Casual chat': 'Match their energy and continue with an easy open question.',
    'Buying signal': 'Keep it concise and make the next step easy.',
    'Emotional objection': 'Validate the concern, reduce sales pressure, and keep the conversation human.',
    'Re-engagement': 'Use a light, low-pressure opener that is easy to answer.'
  };

  const replySets = {
    'Price objection': ['I get you 😅 it’s something you should feel good about before spending on it. Want a little hint about what makes this one different?', 'Totally fair — I’d rather explain the value than pressure you. Want the short version?', 'No pressure. If you’re curious, I can give you a little clue first and you can decide from there 😏'],
    'Delay objection': ['Fair enough 😄 what’s making you want to wait until tomorrow?', 'No pressure. Is it mostly the timing, or are you still deciding if it’s worth it?', 'You can absolutely wait. What’s making you hesitate right now?'],
    'Complaint': ['I’m sorry it wasn’t what you expected 😕 What were you hoping for instead?', 'I can tell that disappointed you. What part felt different from what you expected?', 'That’s fair feedback. Tell me what you expected so I understand the mismatch.'],
    'Casual chat': ['Haha I’m here 😄 how’s your day going?', 'You sound like you’ve got a story 😂 what happened?', 'I’m listening 😄 what are you up to?'],
    'Buying signal': ['Haha okay, you’re curious now 👀 What caught your attention most?', 'Alright, now we’re talking 😏 want the quick version first?', 'I like the curiosity 😂 what do you want to know first?'],
    'Emotional objection': ['I can understand why it might feel that way 😕 I don’t want every conversation to turn into a sales pitch. What made you start feeling like that?', 'That’s fair to say. I’d rather keep the conversation natural. What gave you that impression?', 'I hear you. I don’t want this to feel transactional. What’s been bothering you about the way we’ve been talking?'],
    'Re-engagement': ['Hey stranger 😄 what’s been keeping you busy lately?', 'You’ve been quiet 👀 how’ve you been?', 'Random check-in 😄 what’s your week been like?']
  };

  function safe(text) { const d = document.createElement('div'); d.textContent = String(text || ''); return d.innerHTML; }
  function current() { return contacts.find(c => c.id === state.selectedId) || contacts[0]; }
  function totalUnread() { return contacts.reduce((n, c) => n + c.unread, 0); }
  function timeNow() { return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function showToast(text) { const el = $('#toast'); if (!el) return; el.textContent = text; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1600); }

  function detect(text) {
    const t = text.toLowerCase();
    if (/not worth|disappoint|expected|refund|waste|paid.*that/.test(t)) return { intent: 'Complaint', mood: 'Frustrated' };
    if (/just another|trying to sell|only.*money|just.*sale|atm|actually like/.test(t)) return { intent: 'Emotional objection', mood: 'Defensive' };
    if (/tomorrow|later|next time|not now|\bwait\b/.test(t)) return { intent: 'Delay objection', mood: 'Unsure' };
    if (/expensive|price|cost|discount|cheaper|\$\s*\d+/.test(t)) return { intent: 'Price objection', mood: 'Hesitant' };
    if (/i.?ll buy|send it|want it|tell me more|got my attention|how much|what.*special/.test(t)) return { intent: 'Buying signal', mood: 'Interested' };
    return { intent: 'Casual chat', mood: 'Neutral' };
  }

  function suggestions(intent, tone) {
    let list = (replySets[intent] || replySets['Casual chat']).slice();
    if (tone === 'direct') list = list.map(x => x.replace(/[😅😕😄👀😏😂]/gu, '').replace(/\s{2,}/g, ' ').trim());
    if (tone === 'calm') list = list.map(x => x.replace(/[👀😏😂]/gu, '').trim());
    return list;
  }

  function renderContacts() {
    const host = $('#contactList'); if (!host) return;
    let list = contacts;
    if (state.filter === 'unread') list = list.filter(c => c.unread > 0);
    if (state.filter === 'hot') list = list.filter(c => c.priority === 'hot');
    host.innerHTML = list.map(c => {
      const last = c.history[c.history.length - 1] || {};
      return `<div class="contact ${c.id === state.selectedId ? 'active' : ''}" data-contact="${c.id}"><div class="avatar">${c.initials}</div><div class="contact-main"><div class="contact-name-row"><span class="contact-name">${safe(c.name)}</span>${c.priority === 'hot' ? '<span class="tag hot">Priority</span>' : ''}</div><div class="contact-preview">${safe(last.text)}</div></div><div class="contact-meta"><span>${safe(last.time)}</span>${c.unread ? '<span class="unread-dot"></span>' : ''}</div></div>`;
    }).join('');
    host.querySelectorAll('[data-contact]').forEach(el => el.addEventListener('click', () => { state.selectedId = Number(el.dataset.contact); current().unread = 0; renderInbox(); }));
    if ($('#subscriberCount')) $('#subscriberCount').textContent = `${list.length} shown`;
    if ($('#navUnread')) $('#navUnread').textContent = totalUnread();
  }

  function renderInbox() {
    renderContacts();
    const c = current();
    if ($('#conversationHeader')) $('#conversationHeader').innerHTML = `<div class="conversation-title"><div><strong>${safe(c.name)}</strong><div class="muted">${safe(c.persona)}</div></div><span>${safe(c.mood)}</span></div>`;
    if ($('#messageList')) { $('#messageList').innerHTML = c.history.map(m => `<div class="msg ${m.from}">${safe(m.text)}<span class="msg-time">${safe(m.time)}</span></div>`).join(''); $('#messageList').scrollTop = $('#messageList').scrollHeight; }
    const drafts = suggestions(c.intent, 'natural');
    if ($('#copilotContent')) $('#copilotContent').innerHTML = `<div class="insight"><label>Personality</label><strong>${safe(c.persona)}</strong></div><div class="insight"><label>Mood</label><strong>${safe(c.mood)}</strong></div><div class="insight"><label>Intent</label><strong>${safe(c.intent)}</strong></div><div class="insight"><label>Strategy</label><strong>${safe(strategies[c.intent] || strategies['Casual chat'])}</strong></div><div><div class="muted" style="margin-bottom:8px">Suggested replies</div>${drafts.map((x,i)=>`<div class="draft-card" data-draft="${i}"><p>${safe(x)}</p><small>Use draft ${i+1}</small></div>`).join('')}</div>`;
    $$('.draft-card').forEach(el => el.addEventListener('click', () => { $('#replyBox').value = drafts[Number(el.dataset.draft)]; $('#replyBox').focus(); }));
  }

  function switchView(name) {
    const target = $(`#${name}View`); if (!target) return;
    $$('.view').forEach(v => v.classList.remove('active-view'));
    target.classList.add('active-view');
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
    const titles = { inbox: ['Inbox','Manage simulated subscribers and review AI-assisted replies.'], assistant: ['Quick Reply','Paste a message, generate response options, review, then copy.'], practice: ['Practice Shift','Train under a realistic multi-conversation workload.'], analytics: ['Analytics','Track your practice performance.'], personas: ['Personas','Learn how different subscriber types need different approaches.'], settings: ['Settings','Configure your training experience.'] };
    if ($('#viewTitle')) $('#viewTitle').textContent = titles[name][0];
    if ($('#viewSubtitle')) $('#viewSubtitle').textContent = titles[name][1];
    if (name === 'analytics') renderAnalytics();
    if (name === 'personas') renderPersonas();
  }

  function generateQuick() {
    const input = $('#quickInput').value.trim(); if (!input) return showToast('Paste a message first.');
    const result = detect(input), tone = $('#quickTone').value, list = suggestions(result.intent, tone);
    $('#quickAnalysis').innerHTML = `<div class="analysis-card"><span>Intent</span><strong>${safe(result.intent)}</strong></div><div class="analysis-card"><span>Mood</span><strong>${safe(result.mood)}</strong></div><div class="analysis-card"><span>Strategy</span><strong>${safe(strategies[result.intent])}</strong></div>`;
    $('#quickOptions').innerHTML = list.map((x,i)=>`<div class="quick-option" data-option="${i}"><div class="quick-option-head"><strong>${['Best default','Alternative','Low-pressure'][i]}</strong><span>Use reply</span></div><p>${safe(x)}</p></div>`).join('');
    $('#quickEmpty').classList.add('hidden'); $('#quickResults').classList.remove('hidden'); $('#quickFinal').value = list[0];
    $$('.quick-option').forEach(el => el.addEventListener('click', () => { $('#quickFinal').value = list[Number(el.dataset.option)]; updateQuality(); }));
    updateQuality();
  }

  function updateQuality() { const text = ($('#quickFinal')?.value || '').trim(); if (!$('#quickQuality')) return; const score = Math.min(97, 55 + (text.length > 30 ? 15 : 0) + (text.includes('?') ? 15 : 0) + (/fair|understand|sorry|no pressure|curious/i.test(text) ? 10 : 0)); $('#quickQuality').textContent = text ? `Estimated quality: ${score}% • Review before using.` : ''; }
  function polish(text) { let x = text.trim().replace(/\bi\b/g, 'I').replace(/\bim\b/gi, "I'm").replace(/\bill\b/gi, "I'll"); if (x && !/[.!?]$/.test(x)) x += '.'; return x; }

  function sendReply() { const box = $('#replyBox'), text = box.value.trim(); if (!text) return showToast('Write or choose a reply first.'); const c = current(); c.history.push({ from: 'out', text, time: timeNow() }); c.unread = 0; state.replies++; state.handled++; state.scores.push(80); box.value = ''; renderInbox(); showToast('Practice reply sent.'); }

  function renderAnalytics() { const avg = state.scores.length ? Math.round(state.scores.reduce((a,b)=>a+b,0)/state.scores.length) : null; if ($('#statReplies')) $('#statReplies').textContent = state.replies; if ($('#statQuality')) $('#statQuality').textContent = avg ? `${avg}%` : '—'; if ($('#statOpportunities')) $('#statOpportunities').textContent = contacts.filter(c=>c.priority==='hot').length; if ($('#statMissed')) $('#statMissed').textContent = totalUnread(); if ($('#skillBars')) $('#skillBars').innerHTML = ['Grammar','Personality match','Objection handling','Conversation flow'].map((x,i)=>`<div class="skill-row"><div class="skill-label"><span>${x}</span><strong>${[78,74,70,76][i]}%</strong></div><div class="bar"><span style="width:${[78,74,70,76][i]}%"></span></div></div>`).join(''); }
  function renderPersonas() { if ($('#personaGrid')) $('#personaGrid').innerHTML = contacts.map(c=>`<div class="panel persona-card"><div class="avatar" style="margin-bottom:12px">${c.initials}</div><h3>${safe(c.name)} · ${safe(c.persona)}</h3><p>${safe(strategies[c.intent] || strategies['Casual chat'])}</p><div class="persona-traits">${c.traits.map(t=>`<span class="tag">${safe(t)}</span>`).join('')}</div></div>`).join(''); }
  function updatePractice() { const m = String(Math.floor(state.seconds/60)).padStart(2,'0'), s = String(state.seconds%60).padStart(2,'0'); if ($('#shiftTimer')) $('#shiftTimer').textContent=`${m}:${s}`; if ($('#handledCount')) $('#handledCount').textContent=state.handled; if ($('#practiceUnread')) $('#practiceUnread').textContent=totalUnread(); }
  function startPractice() { switchView('practice'); if (state.practice) return; state.practice=true; state.seconds=300; if ($('#shiftStatus')) { $('#shiftStatus').textContent='Live'; $('#shiftStatus').className='pill success'; } state.timer=setInterval(()=>{ state.seconds--; updatePractice(); if(state.seconds<=0) endPractice(); },1000); updatePractice(); }
  function endPractice() { if (!state.practice) return; state.practice=false; clearInterval(state.timer); if ($('#shiftStatus')) { $('#shiftStatus').textContent='Finished'; $('#shiftStatus').className='pill neutral'; } showToast('Practice shift ended.'); }

  function init() {
    $$('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
    $('#contactFilter')?.addEventListener('change', e => { state.filter=e.target.value; renderContacts(); });
    $('#sendBtn')?.addEventListener('click', sendReply);
    $('#improveBtn')?.addEventListener('click', () => { const box=$('#replyBox'); box.value = box.value.trim() ? polish(box.value) : suggestions(current().intent,'natural')[0]; });
    $('#generateQuickBtn')?.addEventListener('click', generateQuick);
    $('#clearQuickBtn')?.addEventListener('click', () => { $('#quickInput').value=''; $('#quickFinal').value=''; $('#quickResults').classList.add('hidden'); $('#quickEmpty').classList.remove('hidden'); });
    $('#polishQuickBtn')?.addEventListener('click', () => { $('#quickFinal').value=polish($('#quickFinal').value); updateQuality(); });
    $('#quickFinal')?.addEventListener('input', updateQuality);
    $('#copyQuickBtn')?.addEventListener('click', async () => { const text=$('#quickFinal').value.trim(); if(!text) return showToast('Choose a reply first.'); try { await navigator.clipboard.writeText(text); showToast('Reply copied.'); } catch(e) { $('#quickFinal').select(); document.execCommand('copy'); showToast('Reply copied.'); } });
    $('#startShiftBtn')?.addEventListener('click', startPractice); $('#beginPracticeBtn')?.addEventListener('click', startPractice); $('#endPracticeBtn')?.addEventListener('click', endPractice);
    $('#resetBtn')?.addEventListener('click', () => location.reload());
    renderInbox(); renderAnalytics(); renderPersonas(); updatePractice();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();