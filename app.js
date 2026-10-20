const state = {
  selectedId: 1,
  filter: 'all',
  tone: localStorage.getItem('chatpilot-tone') || 'warm',
  autoCoach: true,
  replies: Number(localStorage.getItem('chatpilot-replies') || 0),
  quality: JSON.parse(localStorage.getItem('chatpilot-quality') || '[]'),
  opportunities: Number(localStorage.getItem('chatpilot-opps') || 0),
  missed: Number(localStorage.getItem('chatpilot-missed') || 0),
  handled: 0,
  practiceActive: false,
  practiceSeconds: 300,
  practiceInterval: null,
  arrivalInterval: null,
  contacts: [
    {id:1,name:'Alex',initials:'AL',persona:'Price-sensitive regular',mood:'Hesitant',intent:'Price objection',priority:'hot',unread:1,traits:['Friendly','Budget-aware','Returns often'],strategy:'Acknowledge the concern, preserve value, then create curiosity without instantly discounting.',history:[
      {from:'in',text:'Hey, I liked the last thing you sent 😅',time:'7:12 PM'},
      {from:'out',text:'Aww, I’m glad you liked it 😘 You’ve got good taste.',time:'7:13 PM'},
      {from:'in',text:'$30 though? That’s kinda expensive. Maybe I’ll pass this time.',time:'7:14 PM'}]},
    {id:2,name:'Marco',initials:'MR',persona:'Warm conversationalist',mood:'Curious',intent:'Casual chat',priority:'normal',unread:2,traits:['Talkative','Likes attention','Slow buyer'],strategy:'Match his energy and ask an easy open question. Do not rush into a sale.',history:[
      {from:'in',text:'Long day today 😭',time:'7:08 PM'},
      {from:'in',text:'What are you up to?',time:'7:09 PM'}]},
    {id:3,name:'Dylan',initials:'DY',persona:'Direct buyer',mood:'Interested',intent:'Buying signal',priority:'hot',unread:1,traits:['Decisive','Low patience','Buys when clear'],strategy:'Keep the reply concise, confirm interest, and make the next step simple.',history:[
      {from:'in',text:'Okay fine 😂 what’s the one you said was special?',time:'7:10 PM'}]},
    {id:4,name:'Noah',initials:'NO',persona:'Skeptical subscriber',mood:'Defensive',intent:'Emotional objection',priority:'normal',unread:1,traits:['Needs reassurance','Sensitive to sales','Observant'],strategy:'Validate the feeling, avoid making unverifiable emotional promises, and keep the conversation human.',history:[
      {from:'in',text:'Feels like every time we talk you try to sell me something 😕',time:'7:04 PM'}]},
    {id:5,name:'Evan',initials:'EV',persona:'Disappointed buyer',mood:'Frustrated',intent:'Complaint',priority:'hot',unread:1,traits:['Blunt','Previously purchased','Needs recovery'],strategy:'Acknowledge the disappointment, do not argue, and ask what they expected before offering anything.',history:[
      {from:'in',text:'Seriously? I paid for that and it wasn’t what I expected at all.',time:'7:02 PM'}]},
    {id:6,name:'Sam',initials:'SM',persona:'Quiet lurker',mood:'Neutral',intent:'Re-engagement',priority:'normal',unread:0,traits:['Rarely messages','Browses often','Responds to low-pressure prompts'],strategy:'Use a light, low-pressure opener that gives an easy reason to answer.',history:[
      {from:'out',text:'Hey stranger 😄 how’s your week going?',time:'Yesterday'}]}
  ]
};

const scenarioBank = [
  {intent:'Price objection', text:'I was going to buy it but that price is a lot 😅', mood:'Hesitant', priority:'hot'},
  {intent:'Delay objection', text:'Maybe tomorrow. I’m not sure yet.', mood:'Unsure', priority:'normal'},
  {intent:'Complaint', text:'That wasn’t really what I expected tbh.', mood:'Frustrated', priority:'hot'},
  {intent:'Casual chat', text:'You still awake? 😂', mood:'Playful', priority:'normal'},
  {intent:'Buying signal', text:'Okay you got my attention. Tell me more 👀', mood:'Interested', priority:'hot'},
  {intent:'Emotional objection', text:'Be honest, am I just another sale to you?', mood:'Defensive', priority:'normal'}
];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function saveStats(){
  localStorage.setItem('chatpilot-replies', state.replies);
  localStorage.setItem('chatpilot-quality', JSON.stringify(state.quality));
  localStorage.setItem('chatpilot-opps', state.opportunities);
  localStorage.setItem('chatpilot-missed', state.missed);
}
function now(){ return new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}); }
function selected(){ return state.contacts.find(c=>c.id===state.selectedId) || state.contacts[0]; }
function toast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1800); }
function unreadTotal(){ return state.contacts.reduce((n,c)=>n+c.unread,0); }

function renderContacts(){
  let contacts = state.contacts;
  if(state.filter==='unread') contacts=contacts.filter(c=>c.unread>0);
  if(state.filter==='hot') contacts=contacts.filter(c=>c.priority==='hot');
  $('#contactList').innerHTML = contacts.map(c=>{
    const last = c.history[c.history.length-1];
    return `<div class="contact ${c.id===state.selectedId?'active':''}" data-id="${c.id}">
      <div class="avatar">${c.initials}</div>
      <div class="contact-main">
        <div class="contact-name-row"><span class="contact-name">${c.name}</span>${c.priority==='hot'?'<span class="tag hot">Priority</span>':''}</div>
        <div class="contact-preview">${escapeHtml(last?.text||'No messages yet')}</div>
      </div>
      <div class="contact-meta"><span>${last?.time||''}</span>${c.unread?'<span class="unread-dot"></span>':''}</div>
    </div>`;
  }).join('');
  $$('.contact').forEach(el=>el.onclick=()=>{state.selectedId=Number(el.dataset.id); const c=selected(); c.unread=0; renderAll();});
  $('#subscriberCount').textContent=`${contacts.length} shown`;
  $('#navUnread').textContent=unreadTotal();
}

function renderConversation(){
  const c=selected();
  $('#conversationHeader').innerHTML=`<div class="conversation-title"><div><strong>${c.name}</strong><div class="muted">${c.persona}</div></div><span>${c.mood}</span></div>`;
  $('#messageList').innerHTML=c.history.map(m=>`<div class="msg ${m.from}">${escapeHtml(m.text)}<span class="msg-time">${m.time}</span></div>`).join('');
  $('#messageList').scrollTop=$('#messageList').scrollHeight;
  renderCopilot();
}

function draftOptions(c){
  const tone=state.tone;
  const map={
    'Price objection':[
      `I get you 😅 it’s definitely something you should feel good about before spending on it. Want a little hint about why I think this one stands out?`,
      `Totally fair — I know the price caught your attention. I’d rather tell you what makes it different than pressure you. Want the short version?`,
      `I hear you. No pressure from me — but if you’re curious, I can give you a little clue first and you can decide from there 😏`
    ],
    'Delay objection':[
      `Fair enough 😄 what’s making you want to wait until tomorrow?`,
      `No pressure. I’m curious though — is it the timing or are you still deciding if it’s worth it?`,
      `You can absolutely wait. What would help you decide either way?`
    ],
    'Complaint':[
      `I’m sorry it wasn’t what you expected 😕 What were you hoping for instead?`,
      `I can tell that disappointed you. What part felt off compared with what you expected?`,
      `That’s fair feedback. Tell me what you were expecting so I understand where the mismatch was.`
    ],
    'Casual chat':[
      `Barely 😂 how was your day?`,
      `Still here 😄 you sound like you’ve got a story — what happened today?`,
      `Yep 😄 what are you doing up this late?`
    ],
    'Buying signal':[
      `Haha okay, you’re curious now 👀 What do you want to know first?`,
      `I knew that would get your attention 😄 Want the quick preview or the details first?`,
      `Alright, now we’re talking 😏 what caught your attention most?`
    ],
    'Emotional objection':[
      `I can understand why it might feel that way 😕 I don’t want every conversation to turn into a sales pitch. What made you start feeling like that?`,
      `That’s fair to say. I’d rather actually talk than make every message about buying something. What gave you that impression?`,
      `I hear you. I don’t want the conversation to feel transactional. Tell me what’s been bothering you about it.`
    ],
    'Re-engagement':[
      `Hey stranger 😄 what’s been keeping you busy lately?`,
      `You’ve been quiet 👀 how’ve you been?`,
      `Random check-in 😄 what’s your week been like?`
    ]
  };
  let drafts=(map[c.intent]||map['Casual chat']).slice();
  if(tone==='direct') drafts=drafts.map(x=>x.replace(/😅|😕|😄|👀|😏/g,'').replace(/  +/g,' ').trim());
  if(tone==='playful') drafts=drafts.map((x,i)=>i===0?x.replace(/[.!?]$/,' 😏'):x);
  if(tone==='calm') drafts=drafts.map(x=>x.replace(/😏|👀/g,'').trim());
  return drafts;
}

function renderCopilot(){
  const c=selected();
  const drafts=draftOptions(c);
  $('#copilotContent').innerHTML=`
    <div class="insight"><label>Personality</label><strong>${c.persona}</strong></div>
    <div class="insight"><label>Current mood</label><strong>${c.mood}</strong></div>
    <div class="insight"><label>Intent detected</label><strong>${c.intent}</strong></div>
    <div class="insight"><label>Recommended strategy</label><strong>${c.strategy}</strong></div>
    <div class="insight"><label>Personality notes</label><div class="persona-traits">${c.traits.map(t=>`<span class="tag">${t}</span>`).join('')}</div></div>
    <div><div class="muted" style="margin-bottom:8px">Suggested replies — click one to edit</div>${drafts.map((d,i)=>`<div class="draft-card" data-draft="${i}"><p>${escapeHtml(d)}</p><small>Use draft ${i+1}</small></div>`).join('')}</div>`;
  $$('.draft-card').forEach(el=>el.onclick=()=>{$('#replyBox').value=drafts[Number(el.dataset.draft)]; $('#replyBox').focus();});
}

function scoreReply(text,c){
  let score=55;
  const lower=text.toLowerCase();
  if(text.length>=30) score+=8;
  if(/[?]/.test(text)) score+=9;
  if(/sorry|understand|hear you|fair|i get|no pressure|curious/.test(lower)) score+=9;
  if(c.intent==='Complaint' && /what|expected|hoping/.test(lower)) score+=8;
  if(c.intent==='Price objection' && !/discount|free|refund/.test(lower)) score+=5;
  if(c.intent==='Buying signal') score+=5;
  if(/i/.test(text) && !/I/.test(text)) score-=5;
  if(/refund|free content|guarantee/.test(lower)) score-=8;
  return Math.max(35,Math.min(98,score));
}

function simulatedResponse(c){
  const responses={
    'Price objection':['Okayyy give me the hint then 😂','Hmm, alright. What makes it different?','I’m listening 👀'],
    'Delay objection':['Honestly I’m just trying not to spend too much today 😂','Mostly timing. I might be more into it tomorrow.','I’m still deciding if I really want it.'],
    'Complaint':['I expected something a little more personal, that’s all.','The preview made me think it would be different.','I guess I just expected more for the price.'],
    'Casual chat':['Work was brutal 😂 I’m finally relaxing.','Nothing exciting, just couldn’t sleep.','Long day. I needed a distraction tbh.'],
    'Buying signal':['The way you described it 😂','Give me the quick preview first.','Okay, details. I’m curious.'],
    'Emotional objection':['Because lately every chat turns into a locked message.','I just don’t want to feel like an ATM, you know?','Maybe I’m overthinking it. I just liked when we talked normally.'],
    'Re-engagement':['Busy with work 😭 how about you?','Honestly just disappeared for a bit 😂','I’m good, just been offline more.']
  };
  const arr=responses[c.intent]||responses['Casual chat'];
  return arr[Math.floor(Math.random()*arr.length)];
}

function sendReply(){
  const box=$('#replyBox'); const text=box.value.trim(); if(!text){toast('Write or choose a reply first.');return;}
  const c=selected(); const score=scoreReply(text,c);
  c.history.push({from:'out',text,time:now()});
  state.replies++; state.handled++; state.quality.push(score); if(state.quality.length>50)state.quality.shift();
  if(c.intent==='Buying signal'||c.priority==='hot') state.opportunities++;
  saveStats(); box.value='';
  renderAll(); toast(`Reply sent • quality score ${score}%`);
  setTimeout(()=>{
    c.history.push({from:'in',text:simulatedResponse(c),time:now()}); c.unread=state.selectedId===c.id?0:1;
    c.mood = c.intent==='Complaint'?'Explaining':c.intent==='Price objection'?'Curious':'Engaged';
    renderAll();
  },700+Math.random()*900);
}

function improveDraft(){
  const c=selected(); const box=$('#replyBox'); const text=box.value.trim();
  if(!text){box.value=draftOptions(c)[0];toast('Added a suggested draft.');return;}
  let improved=text.replace(/\bi\b/g,'I').replace(/\bim\b/gi,"I'm").replace(/\bill\b/gi,"I'll").replace(/\bits\b/gi,"it's");
  if(!/[?.!]$/.test(improved)) improved+='.';
  if(!improved.includes('?') && ['Price objection','Complaint','Delay objection','Emotional objection'].includes(c.intent)) improved+=' What do you think?';
  box.value=improved; toast('Draft polished. Review before sending.');
}

function renderPersonas(){
  $('#personaGrid').innerHTML=state.contacts.map(c=>`<div class="panel persona-card"><div class="avatar" style="margin-bottom:12px">${c.initials}</div><h3>${c.name} · ${c.persona}</h3><p>${c.strategy}</p><div class="persona-traits">${c.traits.map(t=>`<span class="tag">${t}</span>`).join('')}</div></div>`).join('');
}
function renderAnalytics(){
  const avg=state.quality.length?Math.round(state.quality.reduce((a,b)=>a+b,0)/state.quality.length):null;
  $('#statReplies').textContent=state.replies;
  $('#statQuality').textContent=avg?`${avg}%`:'—';
  $('#statOpportunities').textContent=state.opportunities;
  $('#statMissed').textContent=state.missed;
  const skills={Grammar:avg?Math.min(96,avg+4):72,'Personality match':avg?Math.max(60,avg-2):68,'Objection handling':avg?Math.max(58,avg-5):64,'Conversation flow':avg?Math.min(95,avg+1):70};
  $('#skillBars').innerHTML=Object.entries(skills).map(([k,v])=>`<div class="skill-row"><div class="skill-label"><span>${k}</span><strong>${v}%</strong></div><div class="bar"><span style="width:${v}%"></span></div></div>`).join('');
}

function randomIncoming(){
  const c=state.contacts[Math.floor(Math.random()*state.contacts.length)];
  const sc=scenarioBank[Math.floor(Math.random()*scenarioBank.length)];
  c.intent=sc.intent;c.mood=sc.mood;c.priority=sc.priority;c.strategy=strategyFor(sc.intent);
  c.history.push({from:'in',text:sc.text,time:now()});
  if(state.selectedId!==c.id)c.unread=Math.min(9,c.unread+1);
  renderAll();
}
function strategyFor(intent){
  return ({'Price objection':'Acknowledge, preserve value, and ask a curiosity-driving question without instantly discounting.','Delay objection':'Find the real reason for delaying without pressure.','Complaint':'Acknowledge disappointment, investigate expectations, and avoid arguing.','Casual chat':'Match energy and ask an easy open question.','Buying signal':'Keep it concise and make the next step simple.','Emotional objection':'Validate the feeling and avoid unverifiable emotional promises.'})[intent]||'Keep it natural and continue the conversation.';
}

function startPractice(){
  if(state.practiceActive)return;
  state.practiceActive=true; state.practiceSeconds=300; state.handled=0;
  $('#shiftStatus').textContent='Live';$('#shiftStatus').className='pill success';
  state.practiceInterval=setInterval(()=>{state.practiceSeconds--;updatePractice();if(state.practiceSeconds<=0)endPractice();},1000);
  state.arrivalInterval=setInterval(randomIncoming,8000);
  randomIncoming(); updatePractice(); toast('Practice shift started. Inbox will get busier.');
}
function endPractice(){
  if(!state.practiceActive)return;
  state.practiceActive=false;clearInterval(state.practiceInterval);clearInterval(state.arrivalInterval);
  const unread=unreadTotal(); state.missed+=unread; saveStats();
  $('#shiftStatus').textContent='Finished';$('#shiftStatus').className='pill neutral'; updatePractice(); renderAnalytics();
  toast(`Shift ended • ${state.handled} handled • ${unread} unread`);
}
function updatePractice(){
  const m=String(Math.floor(state.practiceSeconds/60)).padStart(2,'0'); const s=String(state.practiceSeconds%60).padStart(2,'0');
  $('#shiftTimer').textContent=`${m}:${s}`;$('#handledCount').textContent=state.handled;$('#practiceUnread').textContent=unreadTotal();
  const avg=state.quality.length?Math.round(state.quality.reduce((a,b)=>a+b,0)/state.quality.length):0;$('#liveScore').textContent=state.handled?`${avg}%`:'—';
}

function switchView(name){
  $$('.view').forEach(v=>v.classList.remove('active-view')); $(`#${name}View`).classList.add('active-view');
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  const titles={inbox:['Inbox','Manage simulated subscribers and review AI-assisted replies.'],practice:['Practice Shift','Train under a realistic multi-conversation workload.'],analytics:['Analytics','Track your practice performance and conversation skills.'],personas:['Personas','Understand how different subscriber types need different approaches.'],settings:['Settings','Configure your local ChatPilot training experience.']};
  $('#viewTitle').textContent=titles[name][0];$('#viewSubtitle').textContent=titles[name][1];
  if(name==='analytics')renderAnalytics(); if(name==='personas')renderPersonas();
}

function resetApp(){
  if(!confirm('Reset local stats and reload the training app?'))return;
  ['chatpilot-replies','chatpilot-quality','chatpilot-opps','chatpilot-missed'].forEach(k=>localStorage.removeItem(k)); location.reload();
}
function renderAll(){renderContacts();renderConversation();renderAnalytics();renderPersonas();updatePractice();}
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}

$$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#contactFilter').onchange=e=>{state.filter=e.target.value;renderContacts();};
$('#sendBtn').onclick=sendReply;$('#improveBtn').onclick=improveDraft;
$('#resetBtn').onclick=resetApp;$('#startShiftBtn').onclick=()=>{switchView('practice');startPractice();};
$('#beginPracticeBtn').onclick=startPractice;$('#endPracticeBtn').onclick=endPractice;
$('#toneSelect').value=state.tone;$('#toneSelect').onchange=e=>{state.tone=e.target.value;localStorage.setItem('chatpilot-tone',state.tone);renderCopilot();};
$('#autoCoach').onchange=e=>state.autoCoach=e.target.checked;
$('#replyBox').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')sendReply();});
renderAll();
