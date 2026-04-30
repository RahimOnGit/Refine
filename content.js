// Content script – injects floating ✨ button next to editable fields
let floatingBtn = null;
let activeElem = null;

function isEditable(el) {
  return el && (el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function createButtons() {
  const container = document.createElement('div');
  container.id = 'ai-refiner-container';
  Object.assign(container.style, {
    position: 'absolute',
    zIndex: 2147483647,
    display: 'flex',
    gap: '6px',
    padding: '4px',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    border: '1px solid #ddd',
    pointerEvents: 'auto'
  });

  // Prevent the input from losing focus when clicking the container
  container.addEventListener('mousedown', (e) => {
    e.preventDefault(); 
  });

  const mainBtn = createBtn('✨', 'Refine text', '#ffdb58', 'black');
  mainBtn.addEventListener('click', (e) => onClick(e, null));

  const emailBtn = createBtn('📧', 'Refine as Email', '#4caf50', 'white');
  emailBtn.addEventListener('click', (e) => onClick(e, 'email'));

  const socialBtn = createBtn('📱', 'Refine as Social Post', '#2196f3', 'white');
  socialBtn.addEventListener('click', (e) => onClick(e, 'social'));

  container.appendChild(mainBtn);
  container.appendChild(emailBtn);
  container.appendChild(socialBtn);

  return { container, mainBtn, emailBtn, socialBtn };
}

function createBtn(text, title, bg, color) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.title = title;
  Object.assign(btn.style, {
    padding: '4px 10px',
    fontSize: '16px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '4px',
    background: bg,
    color: color,
    transition: 'transform 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  });
  btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
  btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
  return btn;
}

function positionButtons(el) {
  if (!floatingBtn) return;
  const rect = el.getBoundingClientRect();
  const top = window.scrollY + rect.top;
  const left = window.scrollX + rect.right + 10;
  
  floatingBtn.container.style.top = `${top}px`;
  floatingBtn.container.style.left = `${left}px`;
}

function onClick(e, format) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!activeElem) return;

  const btns = [floatingBtn.mainBtn, floatingBtn.emailBtn, floatingBtn.socialBtn];
  btns.forEach(btn => {
    btn.dataset.oldText = btn.textContent;
    btn.textContent = '⏳';
    btn.style.pointerEvents = 'none';
  });

  const text = activeElem.tagName === 'TEXTAREA' ? activeElem.value : activeElem.innerText;

  chrome.runtime.sendMessage({ action: 'refineText', text, format }, (resp) => {
    btns.forEach(btn => {
      btn.textContent = btn.dataset.oldText;
      btn.style.pointerEvents = 'auto';
    });

    if (chrome.runtime.lastError) {
      alert('Extension error: ' + chrome.runtime.lastError.message);
      return;
    }
    if (resp?.error) {
      alert('AI error: ' + resp.error);
      return;
    }
    
    if (activeElem.tagName === 'TEXTAREA') {
      activeElem.value = resp.refined;
    } else {
      activeElem.innerText = resp.refined;
    }
    
    activeElem.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// Global listener to handle showing/hiding
document.addEventListener('focusin', (e) => {
  if (isEditable(e.target)) {
    activeElem = e.target;
    if (!floatingBtn) {
      floatingBtn = createButtons();
      document.body.appendChild(floatingBtn.container);
    }
    positionButtons(activeElem);
  }
});

// Hide when clicking anywhere else on the page
document.addEventListener('mousedown', (e) => {
  if (floatingBtn && !floatingBtn.container.contains(e.target) && e.target !== activeElem) {
    floatingBtn.container.remove();
    floatingBtn = null;
  }
});

document.addEventListener('input', (e) => {
  if (floatingBtn && e.target === activeElem) positionButtons(activeElem);
});

// Re-position if window resizes
window.addEventListener('resize', () => {
  if (activeElem && floatingBtn) positionButtons(activeElem);
});