// content.js – improved: Google Docs, all input types, smart positioning

let floatingBtn = null;
let activeElem = null;
let isRefining = false;
let isGoogleDocs = false; // tracks whether we're in a GDocs-style large editor

// Selection cache — updated continuously so button clicks never lose GDocs selection
let savedSelText  = '';   // plain text of last known selection
let savedSelRange = null; // Range object, used to restore selection before execCommand

// ========== EDITABLE DETECTION ==========
function isEditable(el) {
  if (!el) return false;
  const tag = el.tagName;

  // Standard textarea
  if (tag === 'TEXTAREA') return true;

  // <input> — support text-like types (not checkbox, radio, file, etc.)
  if (tag === 'INPUT') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return ['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''].includes(type);
  }

  // contenteditable (Gmail compose, Notion, Slack, Outlook, LinkedIn, etc.)
  if (el.isContentEditable) return true;

  // Google Docs main canvas editor (kix = Google Docs internal codename)
  // Note: 'kix-appview-editor' (no hyphen before "view") is the correct class
  if (el.closest && el.closest('.kix-appview-editor')) return true;

  return false;
}

// Returns true when we're inside a large/full-page editor (GDocs, Notion full-page, etc.)
function isLargeEditor(el) {
  if (!el) return false;
  if (el.closest && el.closest('.kix-appview-editor')) return true;
  const rect = el.getBoundingClientRect();
  return rect.width > window.innerWidth * 0.55; // element fills most of the viewport width
}

// ========== BUTTON CREATION ==========
function makeBtn(emoji, title, bg, color = 'inherit') {
  const btn = document.createElement('button');
  btn.textContent = emoji;
  btn.title = title;
  Object.assign(btn.style, {
    position: 'fixed',          // fixed so it never goes off-screen with scroll
    zIndex: '2147483647',
    padding: '4px 8px',
    fontSize: '15px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '6px',
    background: bg,
    color,
    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
    opacity: '0.92',
    transition: 'opacity .15s, transform .15s',
    userSelect: 'none',
    lineHeight: '1',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '1';
    btn.style.transform = 'scale(1.08)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '0.92';
    btn.style.transform = 'scale(1)';
  });
  btn.addEventListener('mousedown', (e) => {
    // Snapshot selection NOW — before preventDefault can affect GDocs internal state
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
      savedSelText  = sel.toString();
      savedSelRange = sel.getRangeAt(0).cloneRange(); // deep clone so it survives
    }
    e.preventDefault(); // don't steal focus from the editor
  });
  return btn;
}

function createButtons() {
  const mainBtn  = makeBtn('✨', 'Refine text with AI',      '#ffdb58');
  const emailBtn = makeBtn('📧', 'Refine as Professional Email', '#4caf50', 'white');
  const socialBtn= makeBtn('📱', 'Refine as Social Media Post',  '#2196f3', 'white');

  mainBtn.addEventListener ('click', (e) => onClick(e, null));
  emailBtn.addEventListener('click', (e) => onClick(e, 'email'));
  socialBtn.addEventListener('click', (e) => onClick(e, 'social'));

  return { mainBtn, emailBtn, socialBtn };
}

// ========== SMART POSITIONING ==========
/*
  Strategy:
  - For normal inputs/textareas: pin buttons just to the right of the element,
    clamped so they never overflow the viewport.
  - For large editors (Google Docs, full-page contenteditable):
    pin to the bottom-right corner of the viewport so they never get lost.
*/
function positionButtons(el) {
  if (!floatingBtn) return;
  const { mainBtn, emailBtn, socialBtn } = floatingBtn;
  const BTN_W = 36; // approximate button width in px
  const GAP   = 6;

  if (isGoogleDocs || isLargeEditor(el)) {
    // Fixed anchor: bottom-right of viewport
    const bottom = 24;
    const right  = 24;
    mainBtn.style.bottom  = `${bottom}px`;
    mainBtn.style.right   = `${right + BTN_W * 2 + GAP * 2}px`;
    mainBtn.style.top     = '';
    mainBtn.style.left    = '';

    emailBtn.style.bottom = `${bottom}px`;
    emailBtn.style.right  = `${right + BTN_W + GAP}px`;
    emailBtn.style.top    = '';
    emailBtn.style.left   = '';

    socialBtn.style.bottom = `${bottom}px`;
    socialBtn.style.right  = `${right}px`;
    socialBtn.style.top    = '';
    socialBtn.style.left   = '';
  } else {
    // Anchor to right edge of element, vertically centred
    const rect   = el.getBoundingClientRect();
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;
    const totalW = BTN_W * 3 + GAP * 2;

    // Try to put buttons to the right; if not enough room, put them to the left
    let left = rect.right + GAP;
    if (left + totalW > vw - 4) {
      left = Math.max(4, rect.left - totalW - GAP);
    }

    // Vertically centre on the element, clamped inside viewport
    let top = rect.top + rect.height / 2 - 14;
    top = Math.max(4, Math.min(top, vh - 34));

    mainBtn.style.top    = `${top}px`;
    mainBtn.style.left   = `${left}px`;
    mainBtn.style.bottom = '';
    mainBtn.style.right  = '';

    emailBtn.style.top   = `${top}px`;
    emailBtn.style.left  = `${left + BTN_W + GAP}px`;
    emailBtn.style.bottom= '';
    emailBtn.style.right = '';

    socialBtn.style.top  = `${top}px`;
    socialBtn.style.left = `${left + (BTN_W + GAP) * 2}px`;
    socialBtn.style.bottom='';
    socialBtn.style.right= '';
  }
}

// ========== TEXT EXTRACTION ==========
function extractText(el) {
  // 1. Live selection (works instantly for normal editors)
  const sel = window.getSelection();
  const liveSel = sel && sel.toString().trim();
  if (liveSel) {
    savedSelText  = liveSel;
    if (sel.rangeCount > 0) savedSelRange = sel.getRangeAt(0).cloneRange();
    return { text: liveSel, mode: 'selection' };
  }

  // 2. Cached selection — critical for Google Docs, where the selection is cleared
  //    by the time the click event fires (GDocs clears it on mousedown/blur).
  if (savedSelText.trim()) {
    return { text: savedSelText, mode: 'selection' };
  }

  // 3. textarea / input value
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    return { text: el.value, mode: 'full' };
  }

  // 4. contenteditable — innerText works for most (Gmail, Notion, Slack)
  if (el.isContentEditable) {
    return { text: el.innerText || el.textContent || '', mode: 'full' };
  }

  // 5. Google Docs with no selection — nothing we can read
  return { text: '', mode: 'none' };
}

// ========== TEXT INSERTION ==========
function applyText(el, refined, mode) {
  // ── Selection replacement ──────────────────────────────────────────────────
  if (mode === 'selection') {

    // For Google Docs: restore the saved Range before execCommand,
    // because GDocs clears the browser selection during the async API wait.
    if (isGoogleDocs || isLargeEditor(el)) {
      try { el.focus(); } catch (_) {}
      if (savedSelRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedSelRange); // put the cursor/selection back
      }
      const ok = document.execCommand('insertText', false, refined);
      if (!ok) {
        // GDocs shadow-DOM blocked execCommand — copy to clipboard instead
        showClipboardToast(refined);
        return;
      }
      savedSelText  = '';
      savedSelRange = null;
      return;
    }

    // Normal contenteditable / textarea selection replacement
    try { el.focus(); } catch (_) {}
    const ok = document.execCommand('insertText', false, refined);
    if (!ok) setFullText(el, refined);
    return;
  }

  // ── Full content replacement ───────────────────────────────────────────────
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    el.focus();
    el.select();
    document.execCommand('insertText', false, refined);
    if (el.value !== refined) el.value = refined;       // hard fallback
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  if (el.isContentEditable) {
    el.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, refined);
    if ((el.innerText || '').trim() !== refined.trim()) {
      el.innerText = refined;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }

  // Google Docs with no selection — copy to clipboard
  showClipboardToast(refined);
}

function setFullText(el, refined) {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    el.value = refined;
  } else {
    el.innerText = refined;
  }
}

// ── Clipboard toast (Google Docs fallback) ───────────────────────────────────
// Shows a small overlay with the refined text and copies it to the clipboard
// so the user can paste it with Ctrl+V.
function showClipboardToast(text) {
  navigator.clipboard.writeText(text).catch(() => {});

  // Remove any existing toast
  document.getElementById('__refiner_toast__')?.remove();

  const toast = document.createElement('div');
  toast.id = '__refiner_toast__';
  Object.assign(toast.style, {
    position:   'fixed',
    bottom:     '70px',
    right:      '20px',
    zIndex:     '2147483647',
    background: '#323232',
    color:      '#fff',
    padding:    '10px 14px',
    borderRadius: '8px',
    fontSize:   '13px',
    maxWidth:   '320px',
    boxShadow:  '0 4px 12px rgba(0,0,0,0.35)',
    lineHeight: '1.5',
    userSelect: 'none',
  });
  toast.innerHTML =
      '✅ <strong>Refined text copied!</strong><br>' +
      'Press <kbd style="background:#555;padding:1px 5px;border-radius:3px">Ctrl+V</kbd> ' +
      'to paste it into your document.';

  // Close on click
  toast.addEventListener('click', () => toast.remove());
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 7000);
}

// ========== GROQ API (direct fallback) ==========
const SYSTEM_PROMPTS = {
  default: 'You are a writing editor. The user will provide draft text. Your only task is to rewrite it with better grammar, clarity, and style, while keeping the original meaning. You must output ONLY the rewritten text. Do not add any preface, explanation, commentary, or ask questions. Output the refined version directly.',
  email:   'You are a professional executive assistant. The user will provide notes for an email. Turn them into a polite, professional, and clear email message. Output ONLY the email. Do not include any salutation like "Sure!" or "Here is your email". Just output the email body.',
  social:  'You are a creative social media manager. The user will provide notes for a post. Turn them into an engaging social media post with 1-2 emojis and relevant hashtags. Output ONLY the post text. Do not add commentary like "Here is your post".',
};

function getSystemPrompt(format) {
  if (!format) return SYSTEM_PROMPTS.default;
  return SYSTEM_PROMPTS[format.toLowerCase()] || SYSTEM_PROMPTS.default;
}

async function refineDirectly(text, format) {
  return new Promise((resolve, reject) => {
    if (!chrome?.storage?.local) {
      return reject(new Error('Extension storage not available. Reload the extension.'));
    }
    chrome.storage.local.get(['groq_key'], async (result) => {
      const apiKey = result.groq_key;
      if (!apiKey) return reject(new Error('Please set your Groq API key in the extension popup.'));
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            max_tokens: 1024,
            messages: [
              { role: 'system', content: getSystemPrompt(format) },
              { role: 'user',   content: text },
            ],
          }),
        });
        const data = await res.json();
        if (data.choices?.[0]) {
          resolve(data.choices[0].message.content.trim());
        } else {
          reject(new Error('Groq API error: ' + (data.error?.message || 'Unknown error')));
        }
      } catch (err) {
        reject(new Error('Failed to connect to Groq: ' + err.message));
      }
    });
  });
}

// ========== CLICK HANDLER ==========
function onClick(e, format) {
  e.stopPropagation();
  e.preventDefault();
  if (!activeElem || isRefining) return;

  const { text, mode } = extractText(activeElem);

  if (!text.trim()) {
    if (isGoogleDocs || isLargeEditor(activeElem)) {
      alert('Please select the text you want to refine first, then click the button.');
    } else {
      alert('The text field is empty. Type something first!');
    }
    return;
  }

  isRefining = true;
  const allBtns = [floatingBtn.mainBtn, floatingBtn.emailBtn, floatingBtn.socialBtn];
  allBtns.forEach(b => { b.textContent = '⏳'; b.style.cursor = 'wait'; });

  const restore = () => {
    floatingBtn.mainBtn.textContent  = '✨';
    floatingBtn.emailBtn.textContent = '📧';
    floatingBtn.socialBtn.textContent= '📱';
    allBtns.forEach(b => { b.style.cursor = 'pointer'; });
    isRefining = false;
  };

  // Capture reference now; activeElem may change by the time the async call returns
  const targetElem = activeElem;

  const useBackground = typeof chrome !== 'undefined' && chrome.runtime?.sendMessage;

  if (useBackground) {
    chrome.runtime.sendMessage({ action: 'refineText', text, format }, (resp) => {
      restore();
      if (chrome.runtime.lastError) {
        alert('Extension error: ' + chrome.runtime.lastError.message);
        return;
      }
      if (resp?.error) { alert('AI error: ' + resp.error); return; }
      if (targetElem)  applyText(targetElem, resp.refined, mode);
    });
  } else {
    console.warn('[Refiner] chrome.runtime unavailable — using direct API call.');
    refineDirectly(text, format)
        .then(refined => { if (targetElem) applyText(targetElem, refined, mode); })
        .catch(err => alert('AI error: ' + err.message))
        .finally(restore);
  }
}

// ========== SHOW / HIDE BUTTONS ==========
function showButtons(el) {
  activeElem  = el;
  isGoogleDocs = !!(el.closest && el.closest('.kix-appview-editor'));

  if (!floatingBtn) {
    const { mainBtn, emailBtn, socialBtn } = createButtons();
    floatingBtn = { mainBtn, emailBtn, socialBtn };
    document.body.appendChild(mainBtn);
    document.body.appendChild(emailBtn);
    document.body.appendChild(socialBtn);
  }
  positionButtons(el);
}

function hideButtons() {
  if (!floatingBtn) return;
  floatingBtn.mainBtn.remove();
  floatingBtn.emailBtn.remove();
  floatingBtn.socialBtn.remove();
  floatingBtn   = null;
  activeElem    = null;
  isGoogleDocs  = false;
  savedSelText  = '';
  savedSelRange = null;
}

// ========== EVENT LISTENERS ==========

// Cache selection continuously — this is what makes Google Docs work.
// selectionchange fires whenever the user changes the text selection anywhere on the page.
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (sel && sel.toString().trim()) {
    savedSelText = sel.toString();
    try {
      if (sel.rangeCount > 0) savedSelRange = sel.getRangeAt(0).cloneRange();
    } catch (_) {}
  }
});

// Standard focus for textareas, inputs, contenteditable
document.addEventListener('focusin', (e) => {
  if (isEditable(e.target)) showButtons(e.target);
});

// Google Docs doesn't fire focusin on its canvas — use mousedown on the editor area
document.addEventListener('mousedown', (e) => {
  const gdocsEditor = e.target.closest && e.target.closest('.kix-appview-editor');
  if (gdocsEditor) showButtons(gdocsEditor);
});

// Reposition when the user types (textarea/input may resize)
document.addEventListener('input', (e) => {
  if (floatingBtn && e.target === activeElem) positionButtons(activeElem);
});

// Reposition on scroll and resize so buttons don't drift
window.addEventListener('scroll', () => { if (floatingBtn && activeElem) positionButtons(activeElem); }, true);
window.addEventListener('resize', () => { if (floatingBtn && activeElem) positionButtons(activeElem); });

// Hide when focus leaves the active element
document.addEventListener('focusout', (e) => {
  if (!floatingBtn) return;
  if (e.target !== activeElem) return;
  setTimeout(() => {
    // Don't hide if focus moved to one of our own buttons
    const focused = document.activeElement;
    const ourButtons = floatingBtn && [floatingBtn.mainBtn, floatingBtn.emailBtn, floatingBtn.socialBtn];
    if (ourButtons && ourButtons.includes(focused)) return;
    // Don't hide if we're still inside a GDocs editor (GDocs shifts focus internally)
    if (isGoogleDocs && focused?.closest?.('.kix-appview-editor')) return;
    hideButtons();
  }, 120);
});