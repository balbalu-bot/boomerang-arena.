// Navigazione dei menu con controller (croce direzionale / levetta) — navigazione spaziale.

function visible(el) {
  if (el.disabled) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

export function activeContainer() {
  const ov = document.querySelector('.overlay.show');
  if (ov) return ov;
  return document.querySelector('.screen.active');
}

export function focusables(root) {
  if (!root) return [];
  return [...root.querySelectorAll('button, select, input, [tabindex="0"]')].filter(visible);
}

export function focusFirst() {
  const f = focusables(activeContainer());
  if (f.length) f[0].focus();
}

export function navigate(dir) {
  const root = activeContainer();
  const list = focusables(root);
  if (!list.length) return;
  let cur = document.activeElement;
  if (!list.includes(cur)) { list[0].focus(); return; }
  // le frecce laterali su select e slider cambiano il valore
  if ((dir === 'left' || dir === 'right') && (cur.tagName === 'SELECT' || cur.type === 'range')) {
    const d = dir === 'right' ? 1 : -1;
    if (cur.tagName === 'SELECT') cur.selectedIndex = Math.max(0, Math.min(cur.options.length - 1, cur.selectedIndex + d));
    else cur.value = String(Math.max(+cur.min, Math.min(+cur.max, +cur.value + d * (+cur.step || 1))));
    cur.dispatchEvent(new Event('change', { bubbles: true }));
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const dx = x - ax, dy = y - ay;
    let main, side;
    if (dir === 'up') { main = -dy; side = Math.abs(dx); }
    else if (dir === 'down') { main = dy; side = Math.abs(dx); }
    else if (dir === 'left') { main = -dx; side = Math.abs(dy); }
    else { main = dx; side = Math.abs(dy); }
    if (main <= 2) continue;
    const score = main + side * 2.2;
    if (score < bs) { bs = score; best = el; }
  }
  if (best) { best.focus(); best.scrollIntoView?.({ block: 'nearest' }); }
}

export function confirm() {
  const el = document.activeElement;
  if (!el || el === document.body) { focusFirst(); return; }
  if (el.type === 'checkbox') { el.checked = !el.checked; el.dispatchEvent(new Event('change', { bubbles: true })); return; }
  if (el.tagName === 'BUTTON') el.click();
}
