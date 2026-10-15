// Componentes de interface: helpers, folhas (bottom sheets), confirmação, aviso e navegação.
(function () {
  const A = window.A;

  A.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  A.ast = (cls = '') => `<svg class="ast ${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#ast"/></svg>`;
  // Moldura felpuda: só uma camada de fundo recebe o filtro, nunca o texto.
  A.felpa = () => `<svg class="felpa" aria-hidden="true"><rect class="f2" x="2%" y="3%" width="96%" height="94%" rx="26" filter="url(#felpa2)"/><rect class="f1" x="4%" y="6%" width="92%" height="88%" rx="22" filter="url(#felpa)"/></svg>`;
  A.vibrate = (p = 12) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  // ---------- Folha inferior ----------
  let current = null;
  A.sheet = {
    open({ title, kicker = '', body, onClose }) {
      A.sheet.close(true);
      const root = A.el(`
        <div class="sheet-wrap" role="dialog" aria-modal="true" aria-label="${A.esc(title)}">
          <div class="sheet-backdrop"></div>
          <section class="sheet">
            <div class="sheet-grab" aria-hidden="true"></div>
            <header class="sheet-head">
              <div>
                ${kicker ? `<p class="kicker">${A.esc(kicker)}</p>` : ''}
                <h2 class="sheet-title">${A.esc(title)}</h2>
              </div>
              <button class="icon-btn sheet-x" aria-label="Fechar">
                <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </header>
            <div class="sheet-body"></div>
          </section>
        </div>`);
      root.querySelector('.sheet-body').appendChild(body);
      root.querySelector('.sheet-backdrop').onclick = () => A.sheet.close();
      root.querySelector('.sheet-x').onclick = () => A.sheet.close();
      document.body.appendChild(root);
      requestAnimationFrame(() => root.classList.add('open'));
      current = { root, onClose };
      // Arrastar para baixo para fechar
      const sh = root.querySelector('.sheet');
      let y0 = null, dy = 0;
      const head = root.querySelector('.sheet-grab');
      const startDrag = (e) => { y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; };
      const moveDrag = (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; };
      const endDrag = () => { if (y0 == null) return; sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) A.sheet.close(); y0 = null; };
      [head, root.querySelector('.sheet-head')].forEach((h) => {
        h.addEventListener('touchstart', startDrag, { passive: true });
        h.addEventListener('touchmove', moveDrag, { passive: true });
        h.addEventListener('touchend', endDrag);
      });
      return root;
    },
    close(instant) {
      if (!current) return;
      const { root, onClose } = current;
      current = null;
      if (onClose) onClose();
      if (instant) { root.remove(); return; }
      root.classList.remove('open');
      setTimeout(() => root.remove(), 280);
    },
    isOpen: () => !!current,
  };

  // ---------- Confirmação ----------
  A.confirm = (msg, { ok = 'Confirmar', cancel = 'Cancelar', danger = false } = {}) =>
    new Promise((res) => {
      const d = A.el(`
        <div class="dialog-wrap">
          <div class="dialog" role="alertdialog" aria-modal="true">
            <p>${A.esc(msg)}</p>
            <div class="dialog-actions">
              <button class="btn ghost" data-v="0">${A.esc(cancel)}</button>
              <button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${A.esc(ok)}</button>
            </div>
          </div>
        </div>`);
      d.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b && e.target !== d) return;
        const v = b ? b.dataset.v === '1' : false;
        d.classList.remove('open');
        setTimeout(() => d.remove(), 200);
        res(v);
      });
      document.body.appendChild(d);
      requestAnimationFrame(() => d.classList.add('open'));
    });

  // ---------- Aviso rápido ----------
  let toastT = null;
  A.toast = (msg) => {
    let t = document.querySelector('.toast');
    if (!t) { t = A.el('<div class="toast" role="status"></div>'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2200);
  };

  // ---------- Navegação ----------
  A.views = {}; // id -> { render(container) }
  A.TABS = [
    { id: 'hoje', label: 'Hoje', icon: '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>' },
    { id: 'progresso', label: 'Progresso', icon: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="9" cy="14.5" r=".6"/><circle cx="15" cy="14.5" r=".6"/>' },
    { id: 'registro', label: 'Registro', icon: '<rect x="3" y="6.5" width="18" height="13.5" rx="3"/><path d="M8.5 6.5l1.5-2.5h4l1.5 2.5"/><circle cx="12" cy="13.2" r="3.4"/>' },
    { id: 'metricas', label: 'Métricas', icon: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>' },
    { id: 'ajustes', label: 'Ajustes', icon: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>' },
  ];
  A.currentTab = null;

  A.buildNav = () => {
    const nav = document.getElementById('tabbar');
    nav.innerHTML = A.TABS.map((t) => `
      <button class="tab" data-tab="${t.id}" aria-label="${t.label}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg>
        <span>${t.label}</span>
      </button>`).join('');
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('.tab');
      if (b) A.go(b.dataset.tab);
    });
  };

  A.go = (id, { keepScroll = false } = {}) => {
    if (!A.TABS.some((t) => t.id === id)) id = 'hoje';
    const changed = A.currentTab !== id;
    A.currentTab = id;
    document.querySelectorAll('.tab').forEach((b) => {
      const on = b.dataset.tab === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    if (location.hash !== '#' + id) history.replaceState(null, '', location.pathname + location.search + '#' + id);
    const main = document.getElementById('view');
    main.innerHTML = '';
    main.className = 'view view-' + id;
    const v = A.views[id];
    if (v) v.render(main);
    if (changed && !keepScroll) window.scrollTo(0, 0);
  };

  A.rerender = () => A.go(A.currentTab, { keepScroll: true });
})();
