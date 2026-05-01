// content.js – robust version with fallback direct API call
let floatingBtn = null;
let activeElem = null;
let isRefining = false;

function isEditable(el) {
  return el && (el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function createButtons() {
  // Main button ✨
  const mainBtn = document.createElement('button');
  mainBtn.textContent = '✨';
  mainBtn.title = 'Refine text with AI (default)';
  Object.assign(mainBtn.style, {
    position: 'absolute',
    zIndex: 2147483647,
    padding: '2px 6px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '4px',
    background: '#ffdb58',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    opacity: '0.9',
    transition: 'opacity .2s'
  });
  mainBtn.addEventListener('mouseenter', () => (mainBtn.style.opacity = '1'));
  mainBtn.addEventListener('mouseleave', () => (mainBtn.style.opacity = '0.9'));
  mainBtn.addEventListener('mousedown', (e) => e.preventDefault());
  mainBtn.addEventListener('click', (e) => onClick(e, null));

  // Email button 📧
  const emailBtn = document.createElement('button');
  emailBtn.textContent = '📧';
  emailBtn.title = 'Refine as Email';
  Object.assign(emailBtn.style, {
    position: 'absolute',
    zIndex: 2147483647,
    padding: '2px 6px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '4px',
    background: '#4caf50',
    color: 'white',
    marginLeft: '4px',
    opacity: '0.9',
    transition: 'opacity .2s'
  });
  emailBtn.addEventListener('mouseenter', () => (emailBtn.style.opacity = '1'));
  emailBtn.addEventListener('mouseleave', () => (emailBtn.style.opacity = '0.9'));
  emailBtn.addEventListener('mousedown', (e) => e.preventDefault());
  emailBtn.addEventListener('click', (e) => onClick(e, 'email'));

  // Social button 📱
  const socialBtn = document.createElement('button');
  socialBtn.textContent = '📱';
  socialBtn.title = 'Refine as Social Post';
  Object.assign(socialBtn.style, {
    position: 'absolute',
    zIndex: 2147483647,
    padding: '2px 6px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '4px',
    background: '#2196f3',
    color: 'white',
    marginLeft: '4px',
    opacity: '0.9',
    transition: 'opacity .2s'
  });
  socialBtn.addEventListener('mouseenter', () => (socialBtn.style.opacity = '1'));
  socialBtn.addEventListener('mouseleave', () => (socialBtn.style.opacity = '0.9'));
  socialBtn.addEventListener('mousedown', (e) => e.preventDefault());
  socialBtn.addEventListener('click', (e) => onClick(e, 'social'));

  return { mainBtn, emailBtn, socialBtn };
}

function positionButtons(el) {
  const rect = el.getBoundingClientRect();
  const top = window.scrollY + rect.top + rect.height / 2 - 12;
  const left = window.scrollX + rect.right + 4;
  floatingBtn.mainBtn.style.top = `${top}px`;
  floatingBtn.mainBtn.style.left = `${left}px`;
  floatingBtn.emailBtn.style.top = `${top}px`;
  floatingBtn.emailBtn.style.left = `${left + 36}px`;
  floatingBtn.socialBtn.style.top = `${top}px`;
  floatingBtn.socialBtn.style.left = `${left + 72}px`;
}

// ========== REFINE LOGIC ==========
async function refineDirectly(text, format) {
  // Read API key directly from storage (content scripts can use chrome.storage)
  return new Promise((resolve, reject) => {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      return reject(new Error('Extension storage not available. Reload the extension.'));
    }
    chrome.storage.local.get(['groq_key'], async (result) => {
      const apiKey = result.groq_key;
      if (!apiKey) return reject(new Error('Please set your Groq API key in the extension popup.'));

      // System prompt
      let systemPrompt = 'You are a helpful writing assistant. Refine the user\'s text to be clearer and better written.';
      if (format) {
        const fmt = format.toLowerCase();
        if (fmt === 'email') {
          systemPrompt = 'You are a professional executive assistant. Expand the following notes into a polite, professional, and clear email. Output ONLY the email text.';
        } else if (fmt === 'social') {
          systemPrompt = 'You are a creative social media manager. Turn the following notes into an engaging post with 1-2 emojis and relevant hashtags. Output ONLY the post text.';
        }
      }

      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-70b-versatile',  // ← if this model exists, use it; otherwise try 'llama-3.3-70b-versatile'
            temperature: 0.7,
            max_tokens: 1024,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text },
            ],
          }),
        });
        const data = await res.json();
        if (data.choices && data.choices[0]) {
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

function onClick(e, format) {
  e.stopPropagation();
  e.preventDefault();
  if (!activeElem || isRefining) return;
  isRefining = true;

  // Show loading on all buttons
  [floatingBtn.mainBtn, floatingBtn.emailBtn, floatingBtn.socialBtn].forEach(btn => {
    btn.textContent = '⏳';
  });

  const text = activeElem.tagName === 'TEXTAREA' ? activeElem.value : activeElem.innerText;

  // Try to use background messenger if available, otherwise call Groq directly
  const useBackground = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage);

  if (useBackground) {
    // Original method
    chrome.runtime.sendMessage({ action: 'refineText', text, format }, (resp) => {
      // Restore buttons
      floatingBtn.mainBtn.textContent = '✨';
      floatingBtn.emailBtn.textContent = '📧';
      floatingBtn.socialBtn.textContent = '📱';
      isRefining = false;

      if (chrome.runtime.lastError) {
        alert('Extension error: ' + chrome.runtime.lastError.message);
        return;
      }
      if (resp.error) {
        alert('AI error: ' + resp.error);
        return;
      }
      if (activeElem) {
        if (activeElem.tagName === 'TEXTAREA') {
          activeElem.value = resp.refined;
        } else {
          activeElem.innerText = resp.refined;
        }
      }
    });
  } else {
    // Fallback: call Groq directly from content script
    console.warn('[Content] chrome.runtime not available, using direct API call.');
    refineDirectly(text, format)
      .then(refined => {
        if (activeElem) {
          if (activeElem.tagName === 'TEXTAREA') {
            activeElem.value = refined;
          } else {
            activeElem.innerText = refined;
          }
        }
      })
      .catch(err => {
        alert('AI error: ' + err.message);
      })
      .finally(() => {
        floatingBtn.mainBtn.textContent = '✨';
        floatingBtn.emailBtn.textContent = '📧';
        floatingBtn.socialBtn.textContent = '📱';
        isRefining = false;
      });
  }
}

// ----- Event listeners (unchanged) -----
document.addEventListener('focusin', (e) => {
  if (isEditable(e.target)) {
    activeElem = e.target;
    if (!floatingBtn) {
      const { mainBtn, emailBtn, socialBtn } = createButtons();
      floatingBtn = { mainBtn, emailBtn, socialBtn };
      document.body.appendChild(mainBtn);
      document.body.appendChild(emailBtn);
      document.body.appendChild(socialBtn);
    }
    positionButtons(activeElem);
  }
});

document.addEventListener('input', (e) => {
  if (floatingBtn && e.target === activeElem) positionButtons(activeElem);
});

document.addEventListener('focusout', (e) => {
  if (floatingBtn && e.target === activeElem) {
    setTimeout(() => {
      if (floatingBtn && !document.activeElement.closest('button')) {
        floatingBtn.mainBtn.remove();
        floatingBtn.emailBtn.remove();
        floatingBtn.socialBtn.remove();
        floatingBtn = null;
        activeElem = null;
      }
    }, 100);
  }
});