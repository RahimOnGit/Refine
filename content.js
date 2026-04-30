let floatingBtn = null;
let activeElem = null;

// Improved detection for standard and "hidden" (Shadow DOM) editors
function getEditableElement(path) {
  for (let el of path) {
    if (el.nodeType !== 1) continue;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el;
    if (el.isContentEditable) return el;
    // Check if the element or a parent is contenteditable
    const closest = el.closest ? el.closest('[contenteditable="true"]') : null;
    if (closest) return closest;
  }
  return null;
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
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    border: '1px solid #ccc'
  });

  container.addEventListener('mousedown', (e) => e.preventDefault());

  const mainBtn = createBtn('✨', 'Refine', '#ffdb58', 'black');
  mainBtn.onclick = (e) => onClick(e, null);

  const emailBtn = createBtn('📧', 'Email', '#4caf50', 'white');
  emailBtn.onclick = (e) => onClick(e, 'email');

  const socialBtn = createBtn('📱', 'Social', '#2196f3', 'white');
  socialBtn.onclick = (e) => onClick(e, 'social');

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
    fontWeight: 'bold'
  });
  return btn;
}

function positionButtons(el) {
  if (!floatingBtn) return;
  const rect = el.getBoundingClientRect();
  // Adjust position to stay visible even if the field is at the screen edge
  let top = window.scrollY + rect.top - 45;
  let left = window.scrollX + rect.left;

  if (top < window.scrollY) top = window.scrollY + rect.bottom + 10;

  floatingBtn.container.style.top = `${top}px`;
  floatingBtn.container.style.left = `${left}px`;
}

function onClick(e, format) {
  if (!activeElem) return;

  const btns = [floatingBtn.mainBtn, floatingBtn.emailBtn, floatingBtn.socialBtn];
  btns.forEach(b => b.textContent = '⏳');

  const text = activeElem.tagName === 'TEXTAREA' || activeElem.tagName === 'INPUT'
      ? activeElem.value
      : (activeElem.innerText || activeElem.textContent);

  chrome.runtime.sendMessage({ action: 'refineText', text, format }, (resp) => {
    floatingBtn.mainBtn.textContent = '✨';
    floatingBtn.emailBtn.textContent = '📧';
    floatingBtn.socialBtn.textContent = '📱';

    if (resp?.refined) {
      if (activeElem.tagName === 'TEXTAREA' || activeElem.tagName === 'INPUT') {
        activeElem.value = resp.refined;
      } else {
        activeElem.innerText = resp.refined;
        // Logic for complex contenteditable div
        if (activeElem.innerText !== resp.refined) activeElem.textContent = resp.refined;
      }
      activeElem.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (resp?.error) {
      alert("AI Error: " + resp.error);
    }
  });
}

// Global listener that handles Shadow DOM via composedPath
document.addEventListener('focusin', (e) => {
  const path = e.composedPath();
  const target = getEditableElement(path);

  if (target) {
    activeElem = target;
    if (!floatingBtn) {
      floatingBtn = createButtons();
      document.body.appendChild(floatingBtn.container);
    }
    positionButtons(activeElem);
  }
}, true);

document.addEventListener('mousedown', (e) => {
  if (floatingBtn && !floatingBtn.container.contains(e.target)) {
    // If we click outside, hide the buttons
    setTimeout(() => {
      if (!getEditableElement(e.composedPath())) {
        floatingBtn.container.remove();
        floatingBtn = null;
      }
    }, 150);
  }
});