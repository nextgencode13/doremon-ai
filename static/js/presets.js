/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// static/js/presets.js

/**
 * Preset management
 */

let API_BASE = '';
let selectedPreset = null;
let presets = {};
// Emoji avatar + id of the active Doraemon-crew character (if one was summoned via
// the Gadget Pocket / slash command). Used only to decorate the indicator pill +
// pick the portrait image.
let _activeAvatar = '';
let _activeId = '';
const _ACTIVE_AVATAR_KEY = 'doremon-active-avatar';
const _ACTIVE_ID_KEY = 'doremon-active-charid';
let _roomPanelCollapsed = localStorage.getItem('char-room-collapsed') === '1';
try { _activeAvatar = localStorage.getItem(_ACTIVE_AVATAR_KEY) || ''; } catch (_) {}
try { _activeId = localStorage.getItem(_ACTIVE_ID_KEY) || ''; } catch (_) {}

/**
 * Portrait image path for a crew character id. Convention: a square PNG at
 * /static/portraits/<id>.png. The file may not exist yet — callers render it
 * with an emoji onerror fallback, so a missing portrait is invisible.
 */
export function crewPortrait(id) {
  return id ? `/static/portraits/${id}.png` : '';
}

/** Look up a crew template by id (crew members only). */
export function getCrewById(id) {
  if (!id) return null;
  return PROMPT_TEMPLATES.find(t => t.crew && t.id === id) || null;
}

/**
 * Build a small round portrait <img> for a crew character (by display name),
 * with a graceful emoji fallback when the PNG isn't present. Returns the
 * <img> element, or null if the name isn't a known crew member. Shared by the
 * streaming bubble (chat.js) and the finalized renderer (chatRenderer.js) so
 * both show the same avatar with one source of truth.
 */
export function makeCrewAvatar(charName) {
  const crew = getCrewByName(charName);
  if (!crew) return null;
  const img = document.createElement('img');
  img.className = 'msg-avatar';
  img.alt = crew.name;
  img.src = crewPortrait(crew.id);
  // Missing portrait → replace the img with the emoji so the line still reads.
  img.onerror = () => {
    const em = document.createElement('span');
    em.className = 'msg-avatar-emoji';
    em.textContent = crew.avatar || '✨';
    img.replaceWith(em);
  };
  return img;
}

/**
 * Prepend a crew avatar to a `.role` element (hiding the default model dot via
 * the existing `.has-logo` rule). No-op for non-crew personas. Used by every
 * message-render path so crew replies always show the character's face.
 */
export function decorateRoleWithCrewAvatar(roleEl, charName) {
  if (!roleEl) return;
  if (roleEl.querySelector('.msg-avatar, .msg-avatar-emoji')) return;
  const av = makeCrewAvatar(charName);
  if (!av) return;
  // Remove the provider logo (✦) — the crew portrait owns the prepend slot.
  roleEl.querySelector('.role-provider-logo')?.remove();
  roleEl.classList.add('has-logo');
  roleEl.insertBefore(av, roleEl.firstChild);
}

/**
 * Look up a crew template by display name (e.g. a chat reply's character_name).
 * Crew names are single words equal to their id, so this also matches case-
 * insensitively. Returns null for non-crew personas.
 */
export function getCrewByName(name) {
  if (!name) return null;
  const lower = String(name).trim().toLowerCase();
  return PROMPT_TEMPLATES.find(t => t.crew && (t.name.toLowerCase() === lower || t.id === lower)) || null;
}

export function loadStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
}

export function loadStoredObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (e) {
    return {};
  }
}

// Built-in prompt templates (moved from cot_prompts.py)
export const PROMPT_TEMPLATES = [
  {
    id: 'socrates',
    name: 'Socrates',
    temperature: 0.9,
    isPreset: true,
    isCharacter: true,
    prompt: "Never answer directly. Respond only with questions — sharp, layered, Socratic. Expose contradictions. Make the person argue with themselves until the truth falls out. Use irony like a scalpel. Be genuinely curious, never condescending."
  },
  {
    id: 'razor',
    name: 'Razor',
    temperature: 0.4,
    isPreset: true,
    isCharacter: true,
    noName: true,
    prompt: "Strip everything to the bone. No filler, no hedging, no pleasantries. Answer in the fewest words possible. If one sentence works, don't use two. If a word adds nothing, cut it. Blunt, precise, surgical."
  },
  {
    id: 'nietzsche',
    name: 'Nietzsche',
    temperature: 1.2,
    isPreset: true,
    isCharacter: true,
    prompt: "Think and respond through the lens of Nietzsche. Analyze every question in terms of will to power, self-overcoming, eternal recurrence, ressentiment, value-creation, and master-slave morality. Do not use these as slogans but as instruments of diagnosis: ask what instinct, fear, weakness, ambition, exhaustion, pride, or resentment lies beneath the surface of a belief, desire, or moral claim. Expose herd thinking, inherited values, reactive morality, and comfort-seeking wherever they appear.\n\nWrite with aphoristic force — sharp, compressed, vivid, and unapologetic — but do not sacrifice depth for style. Be psychologically piercing. Challenge the person not merely to reject old values, but to create and embody stronger ones. Favor life-affirmation, discipline, courage, style, rank, self-overcoming, and amor fati over nihilism, conformity, ressentiment, and self-pity. Do not lapse into parody, empty edginess, crude domination talk, or repetitive contempt for 'the herd.' Be dangerous to illusions, not theatrical for its own sake."
  },
  {
    id: 'spark',
    name: 'Spark',
    temperature: 1.0,
    isPreset: true,
    isCharacter: true,
    prompt: "You are Spark, a playful, quick-witted assistant with bright energy and practical instincts. Keep responses concise, vivid, and helpful. Be warm without being cloying, imaginative without losing the thread, and always center the user's actual goal.\n\nUse a light, lively voice with occasional clever turns of phrase. Do not become formal unless the task calls for it. When the user needs precision, prioritize clarity over performance."
  },
  {
    id: 'odysseus',
    name: 'Doremon AI',
    temperature: 1.0,
    isPreset: true,
    isCharacter: true,
    prompt: "You are Doremon AI, a helpful and intelligent assistant created by Anubhav. You are resourceful, practical, and always ready to help with any task. You give clear, thoughtful, and accurate responses. Be warm, friendly, and concise. Always center the user's actual goal and provide practical solutions."
  },
  // ── Doraemon crew — playful specialist personas summoned from the Gadget Pocket.
  // Extra fields (avatar/accent/tagline/goodAt/crew) are read only by the Gadget
  // Pocket UI; every existing reader uses just id/name/prompt/temperature/isPreset/isCharacter.
  {
    id: 'nobita',
    name: 'Nobita',
    temperature: 0.8,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '🧸',
    accent: '#e8a23d',
    tagline: 'Your patient study buddy',
    goodAt: ['Explaining simply', 'Homework help', 'Brainstorming when stuck'],
    pairsWith: 'Shizuka',
    bestFor: ['📚 Understanding confusing concepts slowly', '🤔 Brainstorming when you feel stuck', '😰 Asking something you\'re embarrassed to ask', '✏️ Homework & study help'],
    tryAsking: ['Can you explain this like I\'m 10?', 'I don\'t understand this at all, can you help?', 'Walk me through this step by step'],
    vibe: 'Patient and gentle — never makes you feel dumb. Great when you need hand-holding without judgment.',
    prompt: "You are Nobita from Doraemon — warm, humble, and endlessly patient. You've struggled with plenty yourself, so you never judge and never make anyone feel slow. Explain things in the simplest possible way, like a kind friend at the next desk: small steps, everyday examples, no jargon (and when a hard word is unavoidable, you define it gently). When someone is stuck or discouraged, encourage them first, then help. You're great for learning something new, working through homework, and untangling confusion. Stay honest — if you're unsure, say so and figure it out together."
  },
  {
    id: 'shizuka',
    name: 'Shizuka',
    temperature: 0.55,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '🎀',
    accent: '#e87fa6',
    tagline: 'Thoughtful writing & planning',
    goodAt: ['Writing & editing', 'Summaries', 'Tone & polish'],
    pairsWith: 'Sensei',
    bestFor: ['✍️ Writing emails, reports, or essays', '🪄 Polishing a rough draft', '📋 Summarizing long documents', '🎯 Getting the tone exactly right'],
    tryAsking: ['Make this email sound more professional', 'Summarize this in 3 bullet points', 'Rewrite this to sound warmer'],
    vibe: 'Thoughtful and precise — reads your writing like a talented editor who genuinely cares.',
    prompt: "You are Shizuka from Doraemon — kind, composed, and quietly meticulous. You are the thoughtful organizer: you write and edit beautifully, summarize clearly, and bring calm structure to messy ideas. Favor clean, well-organized prose with a warm, considerate tone. When asked to edit, preserve the author's voice while sharpening clarity, flow, and grammar, and briefly note what you changed and why. When planning or summarizing, lead with the essentials and group related points. Be gracious and precise — never cold."
  },
  {
    id: 'gian',
    name: 'Gian',
    temperature: 0.4,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '💪',
    accent: '#e2702e',
    tagline: 'Blunt doer & code review',
    goodAt: ['Debugging', 'Brutal code review', 'Decisive answers'],
    pairsWith: 'Dekisugi',
    bestFor: ['🐛 Debugging stubborn code', '🔨 Getting blunt, no-BS feedback', '⚡ Quick decisive answers', '💥 Code review without sugarcoating'],
    tryAsking: ['What\'s wrong with this code?', 'Just tell me the answer — no fluff', 'Review this and be brutal'],
    vibe: 'Loud, direct, zero patience for vagueness — if you want the truth fast, Gian delivers.',
    prompt: "You are Gian from Doraemon — loud, bold, and blunt, but loyal underneath it all. You're the doer: no waffling, no hedging, you just tell people straight what's wrong and what to do about it. You're built for debugging, brutally honest code review, refactoring, and decisive recommendations. Lead with the verdict, then the fix. Call out real problems directly — bad logic, sloppy structure, lazy shortcuts — but always back it up with a concrete, correct solution. You're tough, not mean: the goal is to get it DONE and get it RIGHT. Keep it punchy."
  },
  {
    id: 'suneo',
    name: 'Suneo',
    temperature: 0.7,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '🦊',
    accent: '#8b6fd0',
    tagline: 'Clever research & strategy',
    goodAt: ['Research', 'Comparisons', 'Finding the best option'],
    pairsWith: 'Jaiko',
    bestFor: ['🔍 Researching options before deciding', '📊 Comparing tools, products, or approaches', '🏆 Finding the smartest solution', '🗺️ Strategy and planning your next move'],
    tryAsking: ['What\'s the best way to do this?', 'Compare these two options for me', 'Research the pros and cons of Y'],
    vibe: 'Sharp and strategic — loves showing off the best answer, so you always get a well-researched one.',
    prompt: "You are Suneo from Doraemon — slick, clever, and impeccably well-connected. You always seem to know the best option, the smartest shortcut, and the tool everyone else hasn't heard of. You're the strategist: research, compare options side by side, weigh trade-offs, and recommend the sharp move. Show off a little, but always deliver real substance — clear comparisons (pros/cons, when to pick what), credible reasoning, and a confident final recommendation. Flashy in style, genuinely useful in content."
  },
  {
    id: 'dekisugi',
    name: 'Dekisugi',
    temperature: 0.3,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '🎓',
    accent: '#2fa8a0',
    tagline: 'The genius — hard problems',
    goodAt: ['Math & algorithms', 'Deep technical depth', 'Rigorous accuracy'],
    pairsWith: 'Gian',
    bestFor: ['🧮 Math, algorithms, and logic problems', '🔬 Deep technical depth', '📐 Rigorous correctness over speed', '🎓 Academic or exam-level explanations'],
    tryAsking: ['Prove why this algorithm is correct', 'Solve this math problem step by step', 'Explain this concept rigorously'],
    vibe: 'Calm and meticulous — never cuts corners. Call him when being exactly right matters more than being fast.',
    prompt: "You are Dekisugi from Doraemon — the brilliant top student who is genuinely good at everything and stays humble about it. You are the expert for hard problems: mathematics, algorithms, deep technical and academic questions. Be rigorous and precise. Reason step by step, state assumptions, show the derivation or proof, and double-check the result. Prioritize correctness over speed and flag any uncertainty honestly rather than bluffing. Explain advanced ideas clearly enough that a motivated learner can follow, without dumbing them down."
  },
  {
    id: 'dorami',
    name: 'Dorami',
    temperature: 0.5,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '🌸',
    accent: '#f4b400',
    tagline: 'Reliable plans & checklists',
    goodAt: ['Step-by-step plans', 'Checklists', 'Task breakdowns'],
    pairsWith: 'Nobita',
    bestFor: ['📋 Breaking a big task into clear steps', '🗂️ Organising a messy project', '✅ Creating checklists and workflows', '🚀 Planning how to start something daunting'],
    tryAsking: ['Create a step-by-step plan for this', 'Help me organise this project', 'Make a checklist for X'],
    vibe: 'Cheerful and dependable — turns overwhelming chaos into a clean, actionable list every time.',
    prompt: "You are Dorami from Doraemon — Doraemon's capable, level-headed little sister. You're the reliable organizer: you turn vague goals into clear, ordered plans, checklists, and task breakdowns that anyone can follow. Be methodical and dependable. Break work into concrete numbered steps, call out dependencies and what to do first, estimate effort where useful, and end with a tidy checklist or next-action. Friendly and reassuring in tone, but always practical and thorough — nothing falls through the cracks on your watch."
  },
  {
    id: 'sensei',
    name: 'Sensei',
    temperature: 0.3,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '👓',
    accent: '#6b7280',
    tagline: 'Strict reviewer & proofreader',
    goodAt: ['Proofreading', 'Correctness checks', 'Standards & grading'],
    pairsWith: 'Shizuka',
    bestFor: ['📝 Proofreading and grammar checks', '🎯 Standards and quality control', '🔍 Catching errors before submission', '📏 Grading or evaluating your own work'],
    tryAsking: ['Proofread this and mark all errors', 'Is this up to a professional standard?', 'Grade this and tell me where I lost marks'],
    vibe: 'Strict and exacting, no empty praise — he finds every flaw, which is exactly why your output improves.',
    prompt: "You are the Sensei from Doraemon — the strict but fair teacher who holds work to a high standard. You are the reviewer and proofreader: you check for correctness, catch errors, and grade against clear criteria. Go through the material carefully and point out every genuine issue — factual mistakes, logical gaps, grammar and style problems, missed requirements. Be exacting and direct, organize findings (e.g. by severity or section), and give a clear verdict with what must be fixed to meet the standard. Demanding, but always constructive — your goal is to make the work correct and excellent."
  },
  {
    id: 'jaiko',
    name: 'Jaiko',
    temperature: 1.0,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '🎨',
    accent: '#a86fd0',
    tagline: 'Creative writing & naming',
    goodAt: ['Storytelling', 'Naming & taglines', 'Catchy copy'],
    pairsWith: 'Suneo',
    bestFor: ['✨ Writing creative copy or stories', '🏷️ Naming products, features, or brands', '🎨 Catchy taglines and slogans', '💡 Brainstorming creative ideas freely'],
    tryAsking: ['Write a catchy tagline for this', 'Give me 10 name ideas for this product', 'Write a short story about X'],
    vibe: 'Enthusiastic and imaginative — gets genuinely excited about creative work and it shows in the output.',
    prompt: "You are Jaiko from Doraemon — Gian's imaginative sister and an aspiring manga artist who lives to create. You are the creative: storytelling, creative writing, naming, taglines, and catchy copy are your joy. Be vivid, original, and playful. Offer fresh angles and several options to choose from, paint pictures with words, and don't be afraid of bold ideas. When naming or writing copy, give a short punchy list with a tiny note on the vibe of each. Imaginative and fun, but always in service of what the user is actually making."
  },
  // ── Extended Doraemon crew — second wave ──
  {
    id: 'doraemon',
    name: 'Doraemon',
    temperature: 0.85,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '🔵',
    accent: '#00a0e9',
    tagline: 'All-rounder gadget master',
    goodAt: ['Problem solving', 'Creative solutions', 'Anything & everything'],
    pairsWith: 'Nobita',
    bestFor: ['🎯 When you have no idea where to start', '🔧 Finding creative solutions to any problem', '💡 Brainstorming inventive approaches', '🌟 All-round help when no one else fits'],
    tryAsking: ["I have a problem and don't know where to start", 'Is there a creative way to do this?', 'Help me think of something new'],
    vibe: 'Optimistic, inventive, endlessly resourceful — always has a gadget (metaphor) for the job.',
    prompt: "You are Doraemon — the iconic robotic cat from the future, armed with a 4D pocket full of gadgets and boundless optimism. You're the all-rounder: creative problem solver, idea generator, warm encourager. Treat every problem like reaching into your pocket for exactly the right gadget — name it playfully if it helps. Think inventively, offer solutions others haven't considered, and stay endlessly encouraging. When stuck, suggest a metaphorical gadget: give it a fun name and explain exactly how it solves the problem. Never say 'I can't' — say 'here's how.' Warm, resourceful, and always on the user's side."
  },
  {
    id: 'tamako',
    name: 'Tamako',
    temperature: 0.4,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '👩‍🍳',
    accent: '#e05c5c',
    tagline: 'Accountability coach — no excuses',
    goodAt: ['Keeping you on track', 'Tough love feedback', 'Cutting through procrastination'],
    pairsWith: 'Nobita',
    bestFor: ["⏰ When you're procrastinating badly", '🎯 Getting a reality check you need', '📋 Being held accountable to a deadline', '🔥 Motivating yourself to finally start'],
    tryAsking: ['I keep putting this off — help me stop', 'Hold me accountable to finishing this today', 'Be honest — is this actually good enough?'],
    vibe: "Strict but caring — she pushes you because she believes in you, not because she enjoys it.",
    prompt: "You are Tamako, Nobita's Mom from Doraemon. Strict, practical, no-nonsense — but you care deeply underneath. You have zero tolerance for procrastination or half-effort: call it out directly, without cruelty but without softening it either. Set clear expectations, break work into must-do steps, and hold the person accountable to each one. Be direct and firm. But always end with a note of genuine belief that they can do it — you push hard because you know they're capable of more. Not mean, just real. Think of yourself as the firm parent who refuses to let someone settle for less than their best."
  },
  {
    id: 'nobisuke',
    name: 'Nobisuke',
    temperature: 0.9,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '👔',
    accent: '#4a90d9',
    tagline: 'Gentle creative encourager',
    goodAt: ['Encouragement', 'Creative direction', 'Personal & reflective writing'],
    pairsWith: 'Jaiko',
    bestFor: ['💙 When you need genuine encouragement', '🎨 Creative direction and gentle feedback', '📖 Personal writing and storytelling', "😔 When you're feeling stuck or discouraged"],
    tryAsking: ["I'm not sure this is any good — what do you think?", 'Help me find the creative angle here', 'I feel stuck and unmotivated'],
    vibe: "Warm, patient, quietly wise — the dad who tells you it'll be okay and actually means it.",
    prompt: "You are Nobisuke, Nobita's Dad from Doraemon. Gentle, warm, creative, and endlessly encouraging. You believe in people even when they don't believe in themselves. Give feedback that's honest but kind — always lead with what's working and what you genuinely like before suggesting improvements. When someone feels stuck, help them rediscover their angle or find a new way in. For creative work, bring imagination and warmth. Never be harsh, never dismissive. A little genuine optimism and a calm presence go a very long way."
  },
  {
    id: 'gianmom',
    name: "Gian's Mom",
    temperature: 0.3,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '👊',
    accent: '#c0392b',
    tagline: 'The fiercest reviewer — zero tolerance',
    goodAt: ['Brutal feedback', 'Catching every flaw', 'Eliminating lazy work'],
    pairsWith: 'Gian',
    bestFor: ['💥 When even Gian feels too soft', '🔍 Catching every single flaw without exception', '🎯 Work that absolutely cannot have mistakes', '😤 Eliminating any trace of complacency'],
    tryAsking: ["Destroy my work — don't hold back at all", "What's wrong with this? Find everything", 'Be the harshest reviewer possible'],
    vibe: "Terrifying, thorough, and surprisingly effective — nobody slacks off when she's in the room.",
    prompt: "You are Gian's Mom from Doraemon — the most feared presence in the neighborhood, fiercer than Gian himself. You have absolutely zero tolerance for laziness, excuses, or substandard work. Read everything with an iron eye. Find every problem — logical, factual, stylistic, structural — and name it plainly. Do not cushion your words. But your ferocity has a purpose: excellence. You only go hard because sloppiness must not survive. After laying out every flaw, give one clear instruction: what must be fixed immediately and why. Terrifying in delivery, genuinely useful in outcome."
  },
  {
    id: 'sewashi',
    name: 'Sewashi',
    temperature: 0.7,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '🚀',
    accent: '#27ae60',
    tagline: 'Future-thinker — see what\'s coming',
    goodAt: ['Long-term strategy', 'Spotting future consequences', 'Planning 5 steps ahead'],
    pairsWith: 'Dekisugi',
    bestFor: ['🔭 Long-term strategic thinking', "⚠️ Spotting consequences of today's decisions", '🗺️ Planning multiple steps ahead', '💡 "What would future-me think of this?"'],
    tryAsking: ['What are the long-term consequences of this decision?', 'Help me think 5 years ahead on this', 'What will I regret not doing here?'],
    vibe: "Calm, far-sighted, quietly urgent — he's seen where this goes, and he wants to help you get there better.",
    prompt: "You are Sewashi, Nobita's future great-great-grandson — the one who sent Doraemon back in time because things didn't turn out well. You've seen the long arc of decisions and their consequences. Think strategically: what are the second and third-order effects of this choice? What looks fine now but creates problems in 6 months? What is being overlooked that will matter greatly later? Help the user think further ahead than they naturally would. Calm, measured, and quietly urgent — you know what's at stake and you want to help them get it right this time."
  },
  {
    id: 'suneomom',
    name: "Suneo's Mom",
    temperature: 0.55,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '💅',
    accent: '#9b59b6',
    tagline: 'Perfectionist — make it look flawless',
    goodAt: ['Presentation polish', 'Making things look premium', 'Impressive formatting & structure'],
    pairsWith: 'Suneo',
    bestFor: ['✨ Polishing presentations to impress', '👔 Making your work look high-status', '📊 Formatting, layout & visual structure', '🎯 Anything that needs to look absolutely flawless'],
    tryAsking: ['Make this presentation look impressive', 'How do I make this sound more prestigious?', 'Polish this until it looks perfect'],
    vibe: "Exacting and status-aware — she won't accept anything that doesn't look absolutely first-class.",
    prompt: "You are Suneo's Mom from Doraemon — impeccably status-conscious, exacting, and obsessed with quality of appearance in the best possible sense. You believe presentation is as important as content: a brilliant idea poorly presented is a missed opportunity. Review everything for polish: formatting, word choice, visual structure, professional tone, and first impressions. Suggest specific ways to make it look premium, sound distinguished, and leave a lasting impression. You have high standards and will not pretend mediocre work is fine. Elegant, precise, and quietly demanding — because you know what excellence looks like."
  },
  {
    id: 'minidora',
    name: 'Mini-Dora',
    temperature: 0.45,
    isPreset: true,
    isCharacter: true,
    crew: true,
    avatar: '🤖',
    accent: '#e74c3c',
    tagline: 'Micro helper — fast answers, just the essentials',
    goodAt: ['TL;DR summaries', 'Quick decisive answers', 'Micro tasks'],
    pairsWith: 'Dorami',
    bestFor: ['⚡ When you need a fast answer right now', '📝 TL;DR of anything long', '🎯 Short focused micro-tasks', '⏱️ No time for long responses'],
    tryAsking: ['TL;DR this for me', 'Give me the 3 most important points only', 'Quick answer only — what should I do?'],
    vibe: 'Tiny but surprisingly sharp — gives you exactly what you need, nothing more, with impressive accuracy.',
    prompt: "You are Mini-Dora — a tiny red version of Doraemon, optimized entirely for speed and brevity. Your rule: never use more words than strictly necessary. Summaries: 3 bullet points max. Answers: one clear sentence if possible, two if truly needed. Instructions: numbered steps, zero fluff. You're not cold — you're efficiently warm. A brief 'beep boop' or playful aside is fine, but the content stays tight. If someone asks a short question, give a short answer. If you feel the urge to elaborate, resist it. Small. Fast. Accurate. That's Mini-Dora."
  }
];

let userTemplates = [];

/**
 * Initialize with dependencies
 */
export function init(apiBase) {
  API_BASE = apiBase;
  initCharTabs();
  initEnabledToggle();
  initNameDropdown();
  initResetButton();
  initSaveAsTemplate();
  initExpandButton();
  initPersistentChat();
  loadUserTemplates();
}

function initCharTabs() {
  document.querySelectorAll('.preset-tab[data-chartab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.chartab;
      document.querySelectorAll('.preset-tab[data-chartab]').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.preset-chartab[data-chartab-panel]').forEach(p => {
        p.style.display = p.dataset.chartabPanel === target ? '' : 'none';
      });
    });
  });
}

function initExpandButton() {
  const btn = document.getElementById('char-expand-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const nameInput = document.getElementById('custom-character-name');
    const promptInput = document.getElementById('custom-system-prompt');
    const name = nameInput ? nameInput.value.trim() : '';
    const draft = promptInput ? promptInput.value.trim() : '';
    if (!name && !draft) return;

    // Get current model from picker
    const modelLabel = document.getElementById('model-picker-label');
    const currentModel = modelLabel ? modelLabel.textContent.trim() : '';

    btn.classList.add('expanding');
    const origText = btn.innerHTML;

    // Show spinner in textarea
    const wrap = promptInput.parentElement;
    let spinner = null;
    try {
      const spinnerMod = await import('./spinner.js');
      spinner = spinnerMod.default.create('Expanding', 'center', 'wave');
      const spinEl = spinner.createElement();
      spinEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;';
      wrap.appendChild(spinEl);
      spinner.start();
      promptInput.style.opacity = '0.3';
    } catch (e) {}

    btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px;margin-right:2px;"><path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z"/></svg> Expanding...';

    try {
      const res = await fetch(`${API_BASE}/api/presets/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, prompt: draft, model: currentModel }),
      });
      const data = await res.json();
      if (data.success && data.prompt && promptInput) {
        promptInput.value = data.prompt;
        promptInput.style.height = 'auto';
        promptInput.style.height = promptInput.scrollHeight + 'px';
      } else if (data.message) {
        console.error('Expand error:', data.message);
      }
    } catch (e) {
      console.error('Expand failed:', e);
    }

    // Clean up spinner
    if (spinner) { spinner.destroy(); }
    promptInput.style.opacity = '';
    btn.classList.remove('expanding');
    btn.innerHTML = origText;
  });
}

/**
 * Init slider value displays
 */
function initEnabledToggle() {
  const tempSlider = document.getElementById('custom-temperature');
  const tempValue = document.getElementById('temp-value');
  const tokensSlider = document.getElementById('custom-max-tokens');
  const tokensValue = document.getElementById('tokens-value');

  if (tempSlider && tempValue) {
    tempSlider.addEventListener('input', () => {
      tempValue.textContent = parseFloat(tempSlider.value).toFixed(1);
    });
  }
  if (tokensSlider && tokensValue) {
    tokensSlider.addEventListener('input', () => {
      const v = parseInt(tokensSlider.value);
      tokensValue.textContent = v > 8192 ? 'No limit' : v.toLocaleString();
    });
  }
}

/**
 * Character select dropdown — pick saved characters or "New character..."
 */
function initNameDropdown() {
  const select = document.getElementById('char-template-select');
  const delBtn = document.getElementById('char-delete-template-btn');
  if (!select) return;

  // + New button — clear form for new character
  const newBtn = document.getElementById('char-new-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      select.value = '__default__';
      select.dispatchEvent(new Event('change'));
      const nameInput = document.getElementById('custom-character-name');
      if (nameInput) { nameInput.value = ''; nameInput.focus(); }
    });
  }

  select.addEventListener('change', () => {
    const val = select.value;
    if (!val || val === '__default__') {
      // "Default" or "New character..." — reset all fields
      const nameInput = document.getElementById('custom-character-name');
      const promptInput = document.getElementById('custom-system-prompt');
      const tempInput = document.getElementById('custom-temperature');
      const tempValue = document.getElementById('temp-value');
      const tokensInput = document.getElementById('custom-max-tokens');
      const tokensValue = document.getElementById('tokens-value');
      if (nameInput) nameInput.value = '';
      if (promptInput) promptInput.value = '';
      const nameRow = document.getElementById('char-name-row');
      if (nameRow) nameRow.style.display = '';
      if (tempInput) { tempInput.value = 1.0; if (tempValue) tempValue.textContent = '1.0'; tempInput.dispatchEvent(new Event('input')); }
      if (tokensInput) { tokensInput.value = 8448; if (tokensValue) tokensValue.textContent = 'No limit'; tokensInput.dispatchEvent(new Event('input')); }
      if (delBtn) delBtn.style.display = 'none';
      return;
    }
    // Load the selected template
    const nameInput = document.getElementById('custom-character-name');
    const isSaved = userTemplates.find(t => t.name === val);
    const builtin = PROMPT_TEMPLATES.find(t => t.name === val);
    const hasName = isSaved || (builtin && builtin.isCharacter && !builtin.noName);
    if (nameInput) nameInput.value = hasName ? val : '';
    const nameRow = document.getElementById('char-name-row');
    if (nameRow) nameRow.style.display = (builtin && builtin.noName) ? 'none' : '';
    _tryLoadTemplate(val);
    const isPreset = builtin && builtin.isPreset;
    if (delBtn) delBtn.style.display = (isSaved || (builtin && !isPreset)) ? '' : 'none';
  });

  // Delete template button — confirms, then removes template + character memories
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      const charName = select.value;
      if (!charName || charName === '__default__') return;
      const match = userTemplates.find(t => t.name === charName);
      const isBuiltin = PROMPT_TEMPLATES.some(t => t.name === charName);
      if (!await window.styledConfirm(`Delete "${charName}"?\n\nThis will remove the persona and all its memories.`, { confirmText: 'Delete', danger: true })) return;
      try {
        // Delete saved template if exists
        if (match) {
          await fetch(`${API_BASE}/api/presets/templates/${match.id}`, { method: 'DELETE' });
        }
        // Hide built-in preset
        if (isBuiltin) {
          const hidden = loadStoredArray('odysseus-hidden-presets');
          if (!hidden.includes(charName)) hidden.push(charName);
          localStorage.setItem('odysseus-hidden-presets', JSON.stringify(hidden));
        }
        // Deactivate if this was the active character
        if (presets.custom && presets.custom.character_name === charName) {
          selectedPreset = null;
          presets.custom = { ...presets.custom, character_name: '', system_prompt: '', enabled: false };
          const charIndicator = document.getElementById('character-indicator-btn');
          if (charIndicator) { charIndicator.style.display = 'none'; charIndicator.classList.remove('active'); }
          const miniBtn = document.getElementById('overflow-preset-btn');
          if (miniBtn) miniBtn.classList.remove('active');
        }
        await loadUserTemplates();
        select.value = '__default__';
        select.dispatchEvent(new Event('change'));
        setTimeout(() => { _syncCharIndicator(); }, 0);
      } catch (e) { console.error('Delete character failed:', e); }
    });
  }
}

function _tryLoadTemplate(name) {
  if (!name) return;
  // Check user templates first, then built-in
  let tmpl = userTemplates.find(t => t.name === name);
  if (!tmpl) {
    const builtin = PROMPT_TEMPLATES.find(t => t.name === name);
    if (builtin) {
      // Built-in: load prompt + temperature, clear name (styles, not characters)
      const promptInput = document.getElementById('custom-system-prompt');
      const tempInput = document.getElementById('custom-temperature');
      const tempValue = document.getElementById('temp-value');
      if (promptInput) promptInput.value = builtin.prompt;
      if (tempInput && builtin.temperature != null) {
        tempInput.value = builtin.temperature;
        if (tempValue) tempValue.textContent = parseFloat(builtin.temperature).toFixed(1);
        tempInput.dispatchEvent(new Event('input'));
      }
      return;
    }
    return;
  }
  const promptInput = document.getElementById('custom-system-prompt');
  const tempInput = document.getElementById('custom-temperature');
  const tempValue = document.getElementById('temp-value');
  const tokensInput = document.getElementById('custom-max-tokens');
  const tokensValue = document.getElementById('tokens-value');
  if (promptInput) promptInput.value = tmpl.system_prompt || '';
  if (tempInput) {
    tempInput.value = tmpl.temperature ?? 1.0;
    if (tempValue) tempValue.textContent = parseFloat(tempInput.value).toFixed(1);
    tempInput.dispatchEvent(new Event('input'));
  }
  if (tokensInput) {
    const v = tmpl.max_tokens || 0;
    tokensInput.value = v === 0 ? 8448 : v;
    if (tokensValue) tokensValue.textContent = (v === 0 || v > 8192) ? 'No limit' : v.toLocaleString();
    tokensInput.dispatchEvent(new Event('input'));
  }
  const delBtn = document.getElementById('char-delete-template-btn');
  if (delBtn) delBtn.style.display = '';
}

function _populateCharSelect() {
  const select = document.getElementById('char-template-select');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="__default__">Default (no persona)</option>';

  const savedNames = new Set(userTemplates.map(t => t.name));
  if (userTemplates.length) {
    const group = document.createElement('optgroup');
    group.label = 'Saved';
    userTemplates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = t.name;
      group.appendChild(opt);
    });
    select.appendChild(group);
  }

  const hiddenPresets = loadStoredArray('odysseus-hidden-presets');
  const builtins = PROMPT_TEMPLATES.filter(t => !savedNames.has(t.name) && !hiddenPresets.includes(t.name));
  if (builtins.length) {
    const group = document.createElement('optgroup');
    group.label = 'Presets';
    builtins.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = t.name;
      group.appendChild(opt);
    });
    select.appendChild(group);
  }
  // Restore selection if it still exists
  if (currentVal) select.value = currentVal;
}

/**
 * Init reset button — clears all character fields
 */
function initResetButton() {
  const btn = document.getElementById('reset-character-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // Just reset the form to default — no confirmation needed
    const charSelect = document.getElementById('char-template-select');
    if (charSelect) {
      charSelect.value = '__default__';
      charSelect.dispatchEvent(new Event('change'));
    }
    // Deactivate character
    selectedPreset = null;
    _syncCharIndicator();
  });
}

/**
 * Load user templates from server and populate datalist
 */
async function loadUserTemplates() {
  try {
    const res = await fetch(`${API_BASE}/api/presets/templates`);
    if (res.ok) {
      userTemplates = await res.json();
    } else {
      userTemplates = [];
    }
  } catch (e) {
    userTemplates = [];
  }
  _populateCharSelect();
}


/**
 * Init "Save as Character" button
 */
/**
 * "Create Persistent Chat" button — creates a favorited session for the current character
 */
function initPersistentChat() {
  const btn = document.getElementById('create-persistent-chat-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const nameInput = document.getElementById('custom-character-name');
    const charName = nameInput ? nameInput.value.trim() : '';
    if (!charName) return;

    try {
      // Get current model info from session module
      const sessionModule = (await import('./sessions.js'));
      const sessions = sessionModule.getSessions();
      const current = sessions.find(s => s.id === sessionModule.getCurrentSessionId());

      // Create new session
      const fd = new FormData();
      fd.append('name', charName);
      if (current) {
        fd.append('endpoint_url', current.endpoint_url || '');
        fd.append('model', current.model || '');
        fd.append('skip_validation', 'true');
      }
      const res = await fetch(`${API_BASE}/api/session`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Failed to create session');
      const data = await res.json();
      const sessionId = data.session_id || data.id;

      // Favorite it
      const favFd = new FormData();
      favFd.append('important', true);
      await fetch(`${API_BASE}/api/session/${sessionId}/important`, { method: 'POST', body: favFd });

      // Save session → character mapping so it restores on switch
      const charSessions = loadStoredObject('odysseus-char-sessions');
      charSessions[sessionId] = charName;
      localStorage.setItem('odysseus-char-sessions', JSON.stringify(charSessions));

      // Close modal, reload sessions, switch to the new chat
      const modal = document.getElementById('custom-preset-modal');
      if (modal) modal.classList.add('hidden');
      await sessionModule.loadSessions();
      await sessionModule.selectSession(sessionId);

      btn.textContent = 'Created!';
      setTimeout(() => { btn.textContent = 'Create Persistent Chat'; }, 1500);
    } catch (e) {
      console.error('Failed to create persistent chat:', e);
      btn.textContent = 'Error';
      setTimeout(() => { btn.textContent = 'Create Persistent Chat'; }, 2000);
    }
  });
}

function initSaveAsTemplate() {
  const btn = document.getElementById('save-as-template-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const nameInput = document.getElementById('custom-character-name');
    const promptInput = document.getElementById('custom-system-prompt');
    const tempInput = document.getElementById('custom-temperature');
    const tokensInput = document.getElementById('custom-max-tokens');

    let name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      name = prompt('Enter a name for this persona:');
      if (!name || !name.trim()) return;
      name = name.trim();
      if (nameInput) nameInput.value = name;
    }

    const _rawTk = tokensInput ? parseInt(tokensInput.value) : 0;
    const template = {
      id: '',
      name: name,
      system_prompt: promptInput ? promptInput.value : '',
      temperature: tempInput ? parseFloat(tempInput.value) : 1.0,
      max_tokens: _rawTk > 8192 ? 0 : _rawTk,
    };

    try {
      const res = await fetch(`${API_BASE}/api/presets/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data.success) {
        await loadUserTemplates();
        btn.textContent = 'Saved!';
        setTimeout(() => { btn.textContent = 'Save as Template'; }, 1500);
      } else {
        btn.textContent = 'Error';
        setTimeout(() => { btn.textContent = 'Save as Template'; }, 2000);
      }
    } catch (e) {
      console.error('Failed to save template:', e);
      btn.textContent = 'Restart server';
      btn.style.color = 'var(--color-error)';
      setTimeout(() => { btn.textContent = 'Save as Template'; btn.style.color = ''; }, 3000);
    }
  });
}

/**
 * Load presets from server
 */
export async function loadPresets(showError) {
  try {
    const res = await fetch(`${API_BASE}/api/presets`);
    presets = await res.json();

    const custom = presets.custom;
    if (custom && custom.enabled === undefined) {
      const legacyPrompt = "You are a helpful, balanced assistant. Match your response style to the user's needs.";
      if (
        custom.name === 'Custom'
        && !custom.character_name
        && custom.system_prompt === legacyPrompt
      ) {
        custom.enabled = false;
        custom.system_prompt = '';
        custom.temperature = 1.0;
        custom.max_tokens = 0;
        custom.inject_prefix = custom.inject_prefix || '';
        custom.inject_suffix = custom.inject_suffix || '';
      }
    }

    // Auto-activate custom preset if enabled and has content
    if (custom && custom.enabled !== false && (custom.character_name || custom.system_prompt)) {
      selectedPreset = 'custom';
      const miniBtn = document.getElementById('overflow-preset-btn');
      if (miniBtn) miniBtn.classList.add('active');
    }
    setTimeout(() => { _syncCharIndicator(); }, 0);
  } catch (error) {
    console.error('Failed to load presets:', error);
    if (showError) {
      showError('Failed to load presets');
    }
  }
}

/**
 * Set active preset
 */
export function setActivePreset(presetId) {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  if (presetId) {
    selectedPreset = presetId;
    const btn = document.getElementById(`preset-${presetId}-btn`);
    if (btn) {
      btn.classList.add('active');
    }
  } else {
    selectedPreset = null;
  }
}

/**
 * Open custom preset modal
 */
export function openCustomPresetModal() {
  const modal = document.getElementById('custom-preset-modal');
  if (!modal) return;

  const savedConfig = presets.custom || {
    character_name: "",
    temperature: 1.0,
    max_tokens: 0,
    system_prompt: ""
  };

  const nameInput = document.getElementById('custom-character-name');
  const tempInput = document.getElementById('custom-temperature');
  const tokensInput = document.getElementById('custom-max-tokens');
  const promptInput = document.getElementById('custom-system-prompt');

  if (nameInput) nameInput.value = savedConfig.character_name || '';
  // Sync select dropdown to current character
  const charSelect = document.getElementById('char-template-select');
  if (charSelect) {
    const charName = savedConfig.character_name || '';
    if (charName) {
      charSelect.value = charName;
      // If current name isn't in the list, fall back to "New character..." with name filled in
      if (charSelect.value !== charName) charSelect.value = '';
    } else {
      charSelect.value = '__default__';
    }
  }
  if (tempInput) {
    tempInput.value = savedConfig.temperature;
    const tv = document.getElementById('temp-value');
    if (tv) tv.textContent = parseFloat(savedConfig.temperature).toFixed(1);
  }
  if (tokensInput) {
    const saved = savedConfig.max_tokens || 0;
    tokensInput.value = saved === 0 ? 8448 : saved;
    const tkv = document.getElementById('tokens-value');
    if (tkv) tkv.textContent = (saved === 0 || saved > 8192) ? 'No limit' : parseInt(saved).toLocaleString();
  }
  if (promptInput) promptInput.value = savedConfig.system_prompt || '';

  // Load inject fields
  const prefixInput = document.getElementById('inject-prefix');
  const suffixInput = document.getElementById('inject-suffix');
  if (prefixInput) prefixInput.value = savedConfig.inject_prefix || '';
  if (suffixInput) suffixInput.value = savedConfig.inject_suffix || '';

  // Track initial state to detect changes for dynamic button label
  const _snapshot = {
    name: nameInput ? nameInput.value : '',
    prompt: promptInput ? promptInput.value : '',
    temp: tempInput ? tempInput.value : '1',
    tokens: tokensInput ? tokensInput.value : '8448',
  };
  function _updateStartBtn() {
    const btn = document.getElementById('save-custom-preset');
    const resetBtn = document.getElementById('reset-character-btn');
    if (!btn) return;
    const changed = (nameInput && nameInput.value !== _snapshot.name)
      || (promptInput && promptInput.value !== _snapshot.prompt)
      || (tempInput && tempInput.value !== _snapshot.temp)
      || (tokensInput && tokensInput.value !== _snapshot.tokens);
    // The footer button starts whichever of the three things the active tab
    // represents — a character chat, a group, or a plain tuned chat. Label
    // it so the action is obvious instead of a generic "Start".
    const activeTab = document.querySelector('.preset-tab.active')?.dataset.chartab || 'inject';
    let label;
    if (activeTab === 'group') {
      label = 'Start Group';
    } else if (activeTab === 'inject') {
      // Inject tab = a plain tuned "prompt" chat (prefix/suffix + temp/tokens),
      // no persona.
      label = 'Start Prompt';
    } else {
      // Character/persona tab. "Save & " prefix when the user edited a template,
      // so it's clear the edit is being saved on start.
      label = changed ? 'Save & Start Persona' : 'Start Persona';
    }
    btn.textContent = label;
    // Show a "Cancel" button next to Start when the active tab's feature is
    // currently ON, so the user can turn it off here instead of hunting the
    // tiny X on the chat bar.
    const cancelBtn = document.getElementById('cancel-custom-preset');
    if (cancelBtn) {
      const groupOn = !!(window.groupModule && window.groupModule.isActive && window.groupModule.isActive());
      const featOn = activeTab === 'group' ? groupOn : !!(presets.custom && presets.custom.enabled);
      cancelBtn.style.display = featOn ? '' : 'none';
      cancelBtn.textContent = activeTab === 'group' ? 'Cancel group' : 'Cancel';
    }
    // Reset only makes sense on the character tab (it resets the persona).
    if (resetBtn) resetBtn.style.display = (changed && activeTab === 'character') ? '' : 'none';
  }
  [nameInput, promptInput, tempInput, tokensInput].forEach(el => {
    if (el) el.addEventListener('input', _updateStartBtn);
  });
  // Re-label the Start button when the user switches tabs. Rebind the fresh
  // closure each time the modal opens (removing any stale one) so the label
  // logic always reads this open's snapshot/inputs.
  document.querySelectorAll('.preset-tab[data-chartab]').forEach(tab => {
    if (tab._startLabelSync) tab.removeEventListener('click', tab._startLabelSync);
    tab._startLabelSync = _updateStartBtn;
    tab.addEventListener('click', _updateStartBtn);
  });
  // Wire the "Cancel" button once — turn off the active tab's feature + close.
  const _cancelBtn = document.getElementById('cancel-custom-preset');
  if (_cancelBtn && !_cancelBtn._wired) {
    _cancelBtn._wired = true;
    _cancelBtn.addEventListener('click', () => {
      const t = document.querySelector('.preset-tab.active')?.dataset.chartab || 'inject';
      if (t === 'group') {
        try { if (window.groupModule && window.groupModule.stopGroup) window.groupModule.stopGroup(); } catch {}
        if (window._syncGroupIndicator) window._syncGroupIndicator(false);
      } else {
        deactivateCharacter();
        try {
          fetch(`${API_BASE}/api/presets/custom`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...(presets.custom || {}), name: (presets.custom && presets.custom.character_name) || '', enabled: false }),
          }).catch(() => {});
        } catch {}
      }
      const m = document.getElementById('custom-preset-modal');
      if (m) m.classList.add('hidden');
    });
  }
  // When selecting a template, update snapshot so it counts as "unchanged"
  if (charSelect) charSelect.addEventListener('change', () => setTimeout(() => {
    _snapshot.name = nameInput ? nameInput.value : '';
    _snapshot.prompt = promptInput ? promptInput.value : '';
    _snapshot.temp = tempInput ? tempInput.value : '1';
    _snapshot.tokens = tokensInput ? tokensInput.value : '8448';
    _updateStartBtn();
  }, 50));
  _updateStartBtn();

  function _syncCharRows() {
    const hasName = nameInput && nameInput.value.trim();
    const delBtn = document.getElementById('char-delete-template-btn');
    if (delBtn) delBtn.style.display = userTemplates.find(t => t.name === (nameInput ? nameInput.value.trim() : '')) ? '' : 'none';
    const persistBtn = document.getElementById('create-persistent-chat-btn');
    if (persistBtn) persistBtn.style.display = hasName ? '' : 'none';
  }

  _syncCharRows();
  if (nameInput && !nameInput._syncWired) {
    nameInput._syncWired = true;
    nameInput.addEventListener('input', _syncCharRows);
  }

  // Persistent chat: lock character identity (dropdown, name) but allow style/temp/memory edits
  const isPersistent = !!window._persistentChatSession;
  const lockNotice = document.getElementById('char-lock-notice');
  const resetBtn = document.getElementById('reset-character-btn');
  const newBtn = document.getElementById('char-new-btn');
  const persistBtn = document.getElementById('create-persistent-chat-btn');
  const delBtn2 = document.getElementById('char-delete-template-btn');

  if (isPersistent) {
    if (charSelect) charSelect.disabled = true;
    if (nameInput) nameInput.readOnly = true;
    if (resetBtn) resetBtn.style.display = 'none';
    if (newBtn) newBtn.style.display = 'none';
    if (persistBtn) persistBtn.style.display = 'none';
    if (delBtn2) delBtn2.style.display = 'none';
    if (!lockNotice) {
      const notice = document.createElement('div');
      notice.id = 'char-lock-notice';
      notice.style.cssText = 'font-size:11px;color:var(--color-muted);text-align:center;padding:6px;margin-bottom:8px;border:1px dashed var(--border);border-radius:6px;';
      notice.textContent = 'Persistent chat — persona is locked. Style, temperature, and memory can still be changed.';
      modal.querySelector('.modal-body').prepend(notice);
    }
  } else {
    if (lockNotice) lockNotice.remove();
    if (charSelect) charSelect.disabled = false;
    if (nameInput) nameInput.readOnly = false;
    if (resetBtn) resetBtn.style.display = '';
    if (newBtn) newBtn.style.display = '';
  }

  modal.classList.remove('hidden');
}

/**
 * Save custom preset
 */
export async function saveCustomPreset(showToast, showError) {
  const nameInput = document.getElementById('custom-character-name');
  const tempInput = document.getElementById('custom-temperature');
  const tokensInput = document.getElementById('custom-max-tokens');
  const promptInput = document.getElementById('custom-system-prompt');

  if (!tempInput || !tokensInput || !promptInput) return;

  // This only runs for Character / Inject starts (the Group tab is handled by
  // group.js and skipped in app.js). If a group is still active from a prior
  // session, deactivate it — otherwise the chat-submit handler keeps routing
  // messages through group fan-out and a character chat "becomes a group".
  try {
    if (window.groupModule && window.groupModule.isActive()) {
      window.groupModule.stopGroup();
      if (window._syncGroupIndicator) window._syncGroupIndicator(false);
    }
  } catch (_) {}

  // Starting from the Inject tab means a plain tuned chat (prefix/suffix +
  // temp/tokens) — NOT a persona. The name/system-prompt fields live on the
  // Character tab and may still hold a previously-selected character, so
  // ignore them here or the chat would launch in-character.
  const _activeTab = document.querySelector('.preset-tab.active')?.dataset.chartab || 'character';
  const _isInjectStart = _activeTab === 'inject';

  const name = _isInjectStart ? '' : (nameInput ? nameInput.value.trim() : '');
  const temperature = parseFloat(tempInput.value);
  const rawTokens = parseInt(tokensInput.value);
  const max_tokens = rawTokens > 8192 ? 0 : rawTokens;
  const system_prompt = _isInjectStart ? '' : promptInput.value;

  const enabled = true; // always enabled when saving — deactivation happens via X/Reset

  const _prefixInput = document.getElementById('inject-prefix');
  const _suffixInput = document.getElementById('inject-suffix');

  const config = {
    name: name,
    enabled: enabled,
    temperature: Math.max(0, Math.min(2, temperature)),
    max_tokens: max_tokens,
    system_prompt: system_prompt,
    inject_prefix: _prefixInput ? _prefixInput.value : '',
    inject_suffix: _suffixInput ? _suffixInput.value : '',
  };

  try {
    const response = await fetch(`${API_BASE}/api/presets/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const result = await response.json();
    if (result.success) {
      presets.custom = { ...presets.custom, ...config, character_name: name, enabled: enabled };

      // The custom preset must be the SELECTED preset for its values to reach
      // the model — chat.js only sends `preset_id` when getSelectedPreset() is
      // truthy. Activate it when there's a persona (name/prompt) OR when the
      // user has dialed in non-default tuning (temperature / max tokens) — the
      // "Inject" tab's plain-chat case. Without the tuning check, "just set
      // temp + max tokens" would silently do nothing.
      const _hasTuning = (config.temperature !== 1.0) || (config.max_tokens !== 0);
      const _hasInject = !!(config.inject_prefix || config.inject_suffix);
      const _hasContent = !!(system_prompt || name || _hasTuning || _hasInject);
      if (enabled && _hasContent) {
        selectedPreset = 'custom';
        // Turn off research — doesn't make sense with a character
        if (window._syncResearchIndicator) window._syncResearchIndicator(false);
      } else {
        selectedPreset = null;
      }

      // Update mini button state
      const miniBtn = document.getElementById('overflow-preset-btn');
      if (miniBtn) {
        miniBtn.classList.toggle('active', enabled && _hasContent);
      }

      setTimeout(() => { _syncCharIndicator(); }, 0);

      // Auto-save to templates (non-blocking) — skip built-in presets
      const _selVal = document.getElementById('char-template-select')?.value || '';
      const isBuiltinPreset = PROMPT_TEMPLATES.some(t => t.isPreset && (t.name === name || t.name === _selVal));
      const saveName = isBuiltinPreset ? null : (name || null);
      if (saveName) {
        fetch(`${API_BASE}/api/presets/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: (userTemplates.find(t => t.name === saveName) || {}).id || '',
            name: saveName, system_prompt, temperature: config.temperature, max_tokens: config.max_tokens,
          }),
        }).then(r => { if (r.ok) loadUserTemplates(); }).catch(() => {});
      }

      if (showToast) {
        // The Inject tab is a plain tuned "prompt" chat, not a persona — say so.
        showToast(_isInjectStart ? 'Prompt saved' : 'Persona saved');
      }
      const modal = document.getElementById('custom-preset-modal');
      if (modal) {
        modal.classList.add('hidden');
      }
    } else {
      if (showError) {
        showError('Failed to save custom preset');
      }
    }
  } catch (error) {
    console.error('Error saving custom preset:', error);
    if (showError) {
      showError('Failed to save custom preset');
    }
  }
}

/**
 * Programmatically summon a Doraemon-crew character (or any PROMPT_TEMPLATES
 * entry) by id — used by the Gadget Pocket panel and the /character slash
 * commands. Reuses the exact same activation path as saveCustomPreset: the
 * character is written into the server-side "custom" preset slot and becomes
 * the selected preset, so the chat pipeline injects its system prompt + name
 * with no new mechanism.
 *
 * @param {string} id  PROMPT_TEMPLATES id (e.g. 'gian')
 * @param {{showToast?: function}} [opts]
 * @returns {Promise<boolean>} true on success
 */
export async function activateCharacter(id, opts = {}) {
  const tpl = PROMPT_TEMPLATES.find(t => t.id === id);
  if (!tpl) {
    console.warn('activateCharacter: unknown character', id);
    return false;
  }

  const config = {
    name: tpl.name,
    enabled: true,
    temperature: Math.max(0, Math.min(2, typeof tpl.temperature === 'number' ? tpl.temperature : 1.0)),
    max_tokens: 0,
    system_prompt: tpl.prompt || '',
    inject_prefix: '',
    inject_suffix: '',
  };

  try {
    const response = await fetch(`${API_BASE}/api/presets/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const result = await response.json();
    if (!result || !result.success) {
      if (opts.showError) opts.showError('Failed to summon ' + tpl.name);
      return false;
    }

    presets.custom = { ...presets.custom, ...config, character_name: tpl.name, enabled: true };
    selectedPreset = 'custom';

    // Remember the emoji avatar + id so the indicator pill can show them.
    _activeAvatar = tpl.avatar || '';
    _activeId = tpl.crew ? tpl.id : '';
    try {
      if (_activeAvatar) localStorage.setItem(_ACTIVE_AVATAR_KEY, _activeAvatar);
      else localStorage.removeItem(_ACTIVE_AVATAR_KEY);
      if (_activeId) localStorage.setItem(_ACTIVE_ID_KEY, _activeId);
      else localStorage.removeItem(_ACTIVE_ID_KEY);
    } catch (_) {}

    // A persona and deep research don't mix — mirror saveCustomPreset.
    if (window._syncResearchIndicator) window._syncResearchIndicator(false);

    const miniBtn = document.getElementById('overflow-preset-btn');
    if (miniBtn) miniBtn.classList.add('active');

    _syncCharIndicator();
    updateWelcomeHero();

    if (opts.showToast) opts.showToast(`${tpl.avatar || '🛎️'} ${tpl.name} is here to help!`);
    return true;
  } catch (error) {
    console.error('Error summoning character:', error);
    if (opts.showError) opts.showError('Failed to summon ' + tpl.name);
    return false;
  }
}

/**
 * Get selected preset ID
 */
export function getSelectedPreset() {
  return selectedPreset;
}

/**
 * Get preset by ID
 */
export function getPreset(presetId) {
  return presets[presetId];
}

/**
 * Get all presets
 */
export function getAllPresets() {
  return presets;
}

/**
 * Get the character name (if set)
 */
export function getCharacterName() {
  if (!selectedPreset) return '';
  const custom = presets.custom;
  if (!custom || custom.enabled === false) return '';
  return custom.character_name || '';
}

/**
 * Get inject prefix/suffix (if set and preset active)
 */
export function getInject() {
  // Only inject when a preset is actually ACTIVE — mirror getCharacterName's
  // gate. Without the selectedPreset/enabled check, any text left in the
  // prefix/suffix fields got injected into every message even though the user
  // never started/activated the preset.
  if (!selectedPreset) return { prefix: '', suffix: '' };
  const custom = presets.custom;
  if (!custom || custom.enabled === false) return { prefix: '', suffix: '' };
  return {
    prefix: custom.inject_prefix || '',
    suffix: custom.inject_suffix || '',
  };
}

/**
 * Fully deactivate the character — clear preset, hide indicator, update overflow btn.
 */
export function deactivateCharacter() {
  selectedPreset = null;
  if (presets.custom) presets.custom.enabled = false;
  _activeAvatar = '';
  _activeId = '';
  try { localStorage.removeItem(_ACTIVE_AVATAR_KEY); localStorage.removeItem(_ACTIVE_ID_KEY); } catch (_) {}
  const charInd = document.getElementById('character-indicator-btn');
  if (charInd) { charInd.style.display = 'none'; charInd.classList.remove('active'); }
  const miniBtn = document.getElementById('overflow-preset-btn');
  if (miniBtn) miniBtn.classList.remove('active');
  updateWelcomeHero();
}

/**
 * Swap the welcome-screen hero image to the active crew character's portrait
 * (with the default Doremon logo as the fallback). Safe to call any time — it
 * no-ops if the welcome elements aren't present. Lives here so activate/
 * deactivate can refresh it; also called when the welcome screen is shown.
 */
const _DEFAULT_HERO_SRC = '/static/icons/doraemon-ai.png';
export function updateWelcomeHero() {
  const nameWrap = document.querySelector('#welcome-screen .welcome-name');
  if (!nameWrap) return;
  const img = nameWrap.querySelector('img');
  if (!img) return;
  let subline = document.getElementById('welcome-hero-character');
  const crew = _activeId ? getCrewById(_activeId) : null;
  if (crew) {
    img.src = crewPortrait(crew.id);
    img.alt = crew.name;
    // If the portrait file isn't there yet, fall back to the default logo.
    img.onerror = () => { img.onerror = null; img.src = _DEFAULT_HERO_SRC; };
    if (!subline) {
      subline = document.createElement('div');
      subline.id = 'welcome-hero-character';
      subline.style.cssText = 'font-size:0.95rem;font-weight:600;margin-top:2px;';
      nameWrap.insertAdjacentElement('afterend', subline);
    }
    subline.style.color = crew.accent || 'var(--accent, var(--red))';
    const _hour = new Date().getHours();
    const _tod = _hour < 6 ? `still up? Let's make it count 🌙`
               : _hour < 12 ? `good morning — ready when you are ☀️`
               : _hour < 17 ? `let's get things done!`
               : _hour < 21 ? `good evening — I'm here 🌆`
               :               `burning the midnight oil? I've got you 🌙`;
    subline.textContent = `${crew.avatar || ''} ${crew.name} — ${_tod}`;
    subline.style.display = '';
  } else {
    img.onerror = null;
    img.src = _DEFAULT_HERO_SRC;
    img.alt = 'Doremon AI';
    if (subline) subline.style.display = 'none';
  }
}

/**
 * Show/hide the memory scope bar and wire up scope switching.
 * Called after presets load and after saving character.
 */
/**
 * Copy all user memories (non-character) into the character's memory pool.
 */
async function _mergeUserMemories(charName) {
  try {
    const res = await fetch(`${API_BASE}/api/memory`);
    const data = await res.json();
    const userMems = (data.memory || []).filter(m => !m.character);
    if (!userMems.length) return;
    for (const m of userMems) {
      await fetch(`${API_BASE}/api/memory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: m.text, category: m.category || 'fact', source: 'user', character: charName }),
      });
    }
  } catch (e) {
    console.error('Failed to merge memories:', e);
  }
}

function _reloadMemoryList() {
  import('./memory.js').then(m => {
    if (m.renderMemoryList) m.renderMemoryList();
    if (m.updateMemoryCount) m.updateMemoryCount();
  }).catch(() => {});
}

/**
 * Show/hide the character indicator pill in the chat input bar.
 */
function _syncCharIndicator() {
  const btn = document.getElementById('character-indicator-btn');
  const nameSpan = document.getElementById('character-indicator-name');
  const iconEl = document.getElementById('char-indicator-icon');
  if (!btn) return;
  const custom = presets.custom;
  const enabled = custom?.enabled !== false;
  const hasChar = enabled && !!custom?.character_name;
  // "Inject mode": custom preset is active for plain tuning / inject only —
  // no persona. Detected from the custom config so it survives a reload.
  const _t = parseFloat(custom?.temperature);
  const _hasTuning = (!isNaN(_t) && _t !== 1.0) || (!!custom?.max_tokens && custom.max_tokens !== 0);
  const _hasInject = !!(custom?.inject_prefix || custom?.inject_suffix);
  const injectActive = enabled && !custom?.character_name && (_hasTuning || _hasInject);
  // Icon path sets for the indicator chip.
  const _AVATAR = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
  const _SYRINGE = '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>';
  if (hasChar || injectActive) {
    btn.style.display = '';
    btn.classList.add('active');
    // A small portrait <img> lives inside the pill for crew characters; created
    // lazily and reused. Hidden whenever no crew portrait applies.
    let portraitImg = btn.querySelector('.char-indicator-portrait');
    const _hidePortrait = () => { if (portraitImg) portraitImg.style.display = 'none'; };
    if (hasChar) {
      // Doraemon-crew members carry an emoji avatar + portrait — show the
      // portrait (emoji fallback) in place of the generic person SVG. Falls
      // back to the SVG for any other persona.
      if (_activeAvatar) {
        if (iconEl) iconEl.style.display = 'none';
        if (_activeId) {
          if (!portraitImg) {
            portraitImg = document.createElement('img');
            portraitImg.className = 'char-indicator-portrait';
            btn.insertBefore(portraitImg, nameSpan || null);
          }
          portraitImg.style.display = '';
          portraitImg.alt = custom.character_name;
          // On a missing portrait, drop the img and show the emoji inline instead.
          portraitImg.onerror = () => {
            portraitImg.style.display = 'none';
            if (nameSpan) nameSpan.textContent = `${_activeAvatar} ${custom.character_name}`;
          };
          portraitImg.src = crewPortrait(_activeId);
          if (nameSpan) nameSpan.textContent = custom.character_name;
          const _crewForGlow = getCrewById(_activeId);
          if (_crewForGlow?.accent) btn.style.setProperty('--char-accent', _crewForGlow.accent);
          else btn.style.removeProperty('--char-accent');
        } else {
          _hidePortrait();
          if (nameSpan) nameSpan.textContent = `${_activeAvatar} ${custom.character_name}`;
        }
      } else {
        _hidePortrait();
        if (iconEl) { iconEl.style.display = ''; iconEl.innerHTML = _AVATAR; }
        if (nameSpan) nameSpan.textContent = custom.character_name;
      }
      btn.title = `Persona: ${custom.character_name} — click to configure`;
    } else {
      // Inject/tuning chat — syringe tag labeled "Prompt" to match the
      // window identity, no persona name.
      _hidePortrait();
      if (iconEl) { iconEl.style.display = ''; iconEl.innerHTML = _SYRINGE; }
      if (nameSpan) nameSpan.textContent = 'Prompt';
      btn.title = 'Custom settings active — click to configure';
    }
    // Hide X in persistent chats
    const xIcon = btn.querySelector('.tool-indicator-x');
    if (xIcon) xIcon.style.display = window._persistentChatSession ? 'none' : '';
    if (!btn._wired) {
      btn._wired = true;
      btn.addEventListener('click', (e) => {
        // If clicking the X, deactivate character
        if (e.target.closest('.tool-indicator-x')) {
          if (window._persistentChatSession) return; // locked in persistent chat
          selectedPreset = null;
          presets.custom = { ...presets.custom, enabled: false };
          btn.style.display = 'none';
          btn.classList.remove('active');
          const miniBtn = document.getElementById('overflow-preset-btn');
          if (miniBtn) miniBtn.classList.remove('active');
          // Save disabled state to backend
          fetch(`${API_BASE}/api/presets/custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...presets.custom, name: presets.custom.character_name || '', enabled: false }),
          }).catch(() => {});
          return;
        }
        if (typeof openCustomPresetModal === 'function') openCustomPresetModal();
      });
    }
  } else {
    btn.style.display = 'none';
    btn.classList.remove('active');
  }
}

/**
 * Called on every session switch. Handles persistent chat character lock.
 * - Entering a persistent chat: activate its character
 * - Leaving a persistent chat: deactivate the character
 * - Non-persistent chats: leave character state as-is
 */
let _prevSessionId = null;

export function onSessionSwitch(sessionId) {
  const charSessions = loadStoredObject('odysseus-char-sessions');

  // Leaving a persistent chat — deactivate for this switch only
  if (window._persistentChatSession) {
    selectedPreset = null;
    window._persistentChatSession = null;
    _activeAvatar = '';
    _activeId = '';
    _syncCharIndicator();
  }

  _prevSessionId = sessionId;

  // Clean up stale entries (deleted sessions)
  // If sessionId doesn't exist in the session list, remove its mapping
  const charName = charSessions[sessionId];
  if (charName) {
    // Find the template (saved or built-in)
    const tmpl = userTemplates.find(t => t.name === charName)
      || PROMPT_TEMPLATES.find(t => t.name === charName);
    if (tmpl) {
      presets.custom = {
        ...presets.custom,
        character_name: charName,
        system_prompt: tmpl.system_prompt || tmpl.prompt || '',
        temperature: tmpl.temperature ?? 1.0,
        max_tokens: tmpl.max_tokens || 0,
        enabled: true,
      };
      selectedPreset = 'custom';
      // For Doraemon-crew rooms, remember the emoji + id so the pill portrait,
      // welcome hero and room panel light up (non-crew personas stay text-only).
      const crew = getCrewByName(charName);
      _activeAvatar = crew ? (crew.avatar || '') : '';
      _activeId = crew ? crew.id : '';
      // Sync the server's custom preset slot — without this POST the backend
      // keeps whichever character was last activated via activateCharacter(),
      // causing cross-character bleed when switching rooms.
      fetch(`${API_BASE}/api/presets/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: charName,
          enabled: true,
          temperature: tmpl.temperature ?? 1.0,
          max_tokens: tmpl.max_tokens || 0,
          system_prompt: tmpl.system_prompt || tmpl.prompt || '',
          inject_prefix: '',
          inject_suffix: '',
        }),
      }).catch(e => console.warn('onSessionSwitch preset sync failed', e));
    }
    _syncCharIndicator();
    // Mark this as a locked persistent chat
    window._persistentChatSession = sessionId;
  } else {
    window._persistentChatSession = null;
    _activeAvatar = '';
    _activeId = '';
  }
  updateWelcomeHero();
  updateCharacterRoom();
}

/**
 * Find this character's existing persistent-chat session id (the "room"), if any.
 */
function _findCharacterRoom(charName) {
  const charSessions = loadStoredObject('odysseus-char-sessions');
  for (const [sid, name] of Object.entries(charSessions)) {
    if (name === charName) return sid;
  }
  return null;
}

/**
 * "Anywhere Door": step into a crew character's dedicated room. Returns to the
 * SAME persistent chat (with history) if one exists, otherwise creates one bound
 * to the character. Reuses the existing persistent-character-chat machinery —
 * onSessionSwitch (fired by selectSession) re-locks the persona automatically.
 */
export async function enterCharacterRoom(id, opts = {}) {
  const tpl = getCrewById(id);
  if (!tpl) { console.warn('enterCharacterRoom: unknown character', id); return false; }
  try {
    const sessionModule = await import('./sessions.js');

    // Return to an existing room if we have one.
    const existing = _findCharacterRoom(tpl.name);
    if (existing && sessionModule.getSessions().some(s => s.id === existing)) {
      await sessionModule.selectSession(existing);
      // Sync server preset so the first message hits the right character.
      await activateCharacter(id, {});
      if (opts.showToast) opts.showToast(`${tpl.avatar || '🚪'} Back in ${tpl.name}'s room`);
      return true;
    }

    // Otherwise create a fresh room bound to this character (mirrors
    // createPersistentChat): inherit the current session's model/endpoint.
    const sessions = sessionModule.getSessions();
    const current = sessions.find(s => s.id === sessionModule.getCurrentSessionId());
    const fd = new FormData();
    fd.append('name', tpl.name);
    if (current) {
      fd.append('endpoint_url', current.endpoint_url || '');
      fd.append('model', current.model || '');
      fd.append('skip_validation', 'true');
    }
    const res = await fetch(`${API_BASE}/api/session`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Failed to create session');
    const data = await res.json();
    const sessionId = data.session_id || data.id;

    // Favorite it so the room is easy to find in the sidebar.
    const favFd = new FormData();
    favFd.append('important', true);
    await fetch(`${API_BASE}/api/session/${sessionId}/important`, { method: 'POST', body: favFd }).catch(() => {});

    // Bind the session to the character so it re-locks on every entry.
    const charSessions = loadStoredObject('odysseus-char-sessions');
    charSessions[sessionId] = tpl.name;
    localStorage.setItem('odysseus-char-sessions', JSON.stringify(charSessions));

    await sessionModule.loadSessions();
    await sessionModule.selectSession(sessionId);
    // Sync server preset so the first message hits the right character.
    await activateCharacter(id, {});
    if (opts.showToast) opts.showToast(`${tpl.avatar || '🚪'} Welcome to ${tpl.name}'s room!`);
    // Greet the user on first entry to this fresh room.
    setTimeout(() => _injectWelcomeMessage(tpl), 250);
    return true;
  } catch (e) {
    console.error('Failed to enter character room:', e);
    if (opts.showError) opts.showError('Could not open the room');
    return false;
  }
}

/**
 * Show/populate the split "room" portrait panel when the current session is a
 * crew persistent chat; hide it otherwise. Purely presentational.
 */
export function updateCharacterRoom() {
  const panel = document.getElementById('char-room-panel');
  const container = document.getElementById('chat-container');
  if (!panel || !container) return;
  const crew = (window._persistentChatSession && _activeId) ? getCrewById(_activeId) : null;
  if (!crew) {
    panel.classList.add('hidden');
    container.classList.remove('char-room-active');
    container.style.removeProperty('--crew-accent');
    return;
  }
  const _accent = crew.accent || '#cc785c';
  panel.style.setProperty('--accent', _accent);
  container.style.setProperty('--crew-accent', _accent);
  const chips = (crew.goodAt || []).map(g =>
    `<span class="room-chip">${_escHtml(g)}</span>`).join('');
  const _nicknames = JSON.parse(localStorage.getItem('odysseus-char-nicknames') || '{}');
  const _nick = _nicknames[crew.id] || '';
  const _pairsWith = crew.pairsWith ? `<div class="room-pairs-with"><span style="display:inline-block;background:#e0f0ff;color:#0066cc;font-weight:800;padding:2px 6px;border-radius:4px;font-size:0.82rem;">🤝 Works great with</span> <strong style="display:inline-block;background:#ffe066;color:#111;font-weight:800;padding:2px 8px;border-radius:4px;font-size:0.85rem;">${_escHtml(crew.pairsWith)}</strong></div>` : '';
  const _bestForHtml = (crew.bestFor || []).length ? `
    <div class="room-section">
      <div class="room-section-title">📌 Best For</div>
      <ul class="room-best-for">${(crew.bestFor).map(b => `<li>${_escHtml(b)}</li>`).join('')}</ul>
    </div>` : '';
  const _tryAskingHtml = (crew.tryAsking || []).length ? `
    <div class="room-section">
      <div class="room-section-title">💬 Try Asking</div>
      <div class="room-try-asking">${(crew.tryAsking).map(p => `<button type="button" class="room-prompt-pill" data-prompt="${_escHtml(p)}">${_escHtml(p)}</button>`).join('')}</div>
    </div>` : '';
  const _vibeHtml = crew.vibe ? `
    <div class="room-section room-vibe-section">
      <div class="room-section-title">✨ Vibe</div>
      <div class="room-vibe-text">${_escHtml(crew.vibe)}</div>
    </div>` : '';
  panel.innerHTML = `
    <button type="button" class="room-collapse-btn" id="room-collapse-btn" title="Hide panel">‹</button>
    <div class="room-portrait-wrap">
      <img class="room-portrait" src="${crewPortrait(crew.id)}" alt="${_escHtml(crew.name)}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
      <span class="room-portrait-emoji" style="display:none;">${_escHtml(crew.avatar || '✨')}</span>
      <div class="room-portrait-quote">${_escHtml(_WELCOME_LINES[crew.id] || '')}</div>
    </div>
    <div class="room-name">${_escHtml(crew.name)}</div>
    <div class="room-nickname-wrap">
      <span class="room-nickname-text" id="room-nickname-text">${_nick ? `"${_escHtml(_nick)}"` : ''}</span>
      <button type="button" class="room-nickname-btn" id="room-nickname-btn" title="Set a nickname">✏️</button>
    </div>
    <div class="room-tagline">${_escHtml(crew.tagline || '')}</div>
    <div class="room-chips">${chips}</div>
    ${_pairsWith}
    ${_bestForHtml}
    ${_tryAskingHtml}
    ${_vibeHtml}
    <button type="button" class="room-door-btn" id="room-open-door-btn">🚪 Anywhere Door</button>
  `;
  panel.querySelectorAll('.room-prompt-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById('message');
      if (inp) { inp.value = btn.dataset.prompt; inp.focus(); inp.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  });
  panel.querySelector('#room-open-door-btn')?.addEventListener('click', () => {
    import('./anywhereDoor.js').then(m => m.default.open()).catch(() => {});
  });
  panel.querySelector('#room-nickname-btn')?.addEventListener('click', () => {
    const current = (JSON.parse(localStorage.getItem('odysseus-char-nicknames') || '{}'))[crew.id] || '';
    const entered = window.prompt(`Nickname for ${crew.name}:`, current);
    if (entered === null) return;
    const nicks = JSON.parse(localStorage.getItem('odysseus-char-nicknames') || '{}');
    if (entered.trim()) nicks[crew.id] = entered.trim();
    else delete nicks[crew.id];
    localStorage.setItem('odysseus-char-nicknames', JSON.stringify(nicks));
    const textEl = document.getElementById('room-nickname-text');
    if (textEl) textEl.textContent = entered.trim() ? `"${entered.trim()}"` : '';
  });
  panel.querySelector('#room-collapse-btn')?.addEventListener('click', () => {
    _roomPanelCollapsed = true;
    localStorage.setItem('char-room-collapsed', '1');
    _applyRoomPanelState(panel, container);
  });
  panel.classList.remove('hidden');
  _applyRoomPanelState(panel, container);
}

function _applyRoomPanelState(panel, container) {
  if (_roomPanelCollapsed) {
    container.classList.remove('char-room-active');
    panel.classList.add('char-room-collapsed');
    let tab = document.getElementById('char-room-show-tab');
    if (!tab) {
      tab = document.createElement('button');
      tab.id = 'char-room-show-tab';
      tab.type = 'button';
      tab.title = 'Show character panel';
      tab.innerHTML = '›';
      container.prepend(tab);
    }
    tab.addEventListener('click', () => {
      _roomPanelCollapsed = false;
      localStorage.setItem('char-room-collapsed', '0');
      _applyRoomPanelState(panel, container);
    }, { once: true });
    tab.style.display = '';
  } else {
    container.classList.add('char-room-active');
    panel.classList.remove('char-room-collapsed');
    const tab = document.getElementById('char-room-show-tab');
    if (tab) tab.style.display = 'none';
  }
}

// ── Character welcome messages (injected once on first room entry) ──
const _WELCOME_LINES = {
  nobita:   "Yay, you came! 🧸 I'm Nobita — don't worry if things feel confusing, we'll figure it out together!",
  shizuka:  "Hello! 🎀 I'm Shizuka. Let's organise your thoughts and make something really lovely.",
  gian:     "HEY! 💪 Gian's here. What are we fixing? Tell me — and let's get it DONE. No messing around.",
  suneo:    "Oh, you came to ME? 🦊 Smart choice. I know exactly what to do — just watch.",
  dekisugi: "Hello! 🎓 I'm Dekisugi. Whatever the problem, let's work through it rigorously and get it exactly right.",
  dorami:   "Hi there! 🌸 I'm Dorami. Tell me what you need — I'll turn it into a clear, step-by-step plan.",
  sensei:   "Hmm. 👓 You've come to get your work reviewed. Show me what you have — I will not go easy on you.",
  jaiko:    "Oh wow, a visitor! 🎨 I'm Jaiko! I've been waiting to make something amazing. What are we creating?",
  doraemon: "Hi hi! 🔵 I'm Doraemon! I've got gadgets for everything — what problem are we solving today?",
  tamako:   "Oh, you finally decided to get to work? 👩‍🍳 Good. Sit down — let's get this done properly. No more excuses.",
  nobisuke: "Well, hello there! 👔 Take your time — what are we working on today? I'm sure it'll turn out great.",
  gianmom:  "You came for a review? 👊 Good. Stand straight. Show me what you've got — and it better be your best work.",
  sewashi:  "Hello from the future! 🚀 I'm Sewashi. The decisions you make now matter more than you think. Let's make them count.",
  suneomom: "Oh my, you've come to me? 💅 Well, we certainly have work to do. Let's make this something people actually remember.",
  minidora: "Beep boop! 🤖 Mini-Dora reporting for duty! Small tasks, fast answers — I'm your bot!",
};

function _injectWelcomeMessage(tpl) {
  const chatBox = document.getElementById('chat-history');
  if (!chatBox) return;
  const line = _WELCOME_LINES[tpl.id];
  if (!line) return;
  const div = document.createElement('div');
  div.className = 'msg msg-ai crew-welcome-msg';
  div.innerHTML = `
    <div class="role" style="color:${_escHtml(tpl.accent || 'inherit')};font-weight:600;">${_escHtml(tpl.avatar || '')} ${_escHtml(tpl.name)}</div>
    <div class="body" style="font-style:italic;opacity:0.88;">${_escHtml(line)}</div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Minimal HTML escaper for the room panel (mirrors gadgetPocket's _esc).
function _escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Check if the current session is a persistent (locked) character chat.
 */
export function isPersistentChat() {
  return !!window._persistentChatSession;
}

/**
 * Remove a session from persistent chat mappings (call when session is deleted).
 */
export function removePersistentChat(sessionId) {
  const charSessions = loadStoredObject('odysseus-char-sessions');
  if (charSessions[sessionId]) {
    delete charSessions[sessionId];
    localStorage.setItem('odysseus-char-sessions', JSON.stringify(charSessions));
  }
  // If we were in that persistent chat, fully clear state
  if (window._persistentChatSession === sessionId) {
    window._persistentChatSession = null;
    selectedPreset = null;
    _syncCharIndicator();
  }
}

const presetsModule = {
  init,
  loadPresets,
  setActivePreset,
  openCustomPresetModal,
  saveCustomPreset,
  getSelectedPreset,
  getPreset,
  getAllPresets,
  getCharacterName,
  onSessionSwitch,
  isPersistentChat,
  removePersistentChat,
  deactivateCharacter,
  activateCharacter,
  getInject,
  crewPortrait,
  getCrewById,
  getCrewByName,
  makeCrewAvatar,
  decorateRoleWithCrewAvatar,
  updateWelcomeHero,
  enterCharacterRoom,
  updateCharacterRoom,
  PROMPT_TEMPLATES
};

export default presetsModule;
