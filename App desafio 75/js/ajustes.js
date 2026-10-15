// Aba Ajustes: tarefas do desafio (nome, ativar/desativar) e dados (backup, importar, apagar).
(function () {
  const A = window.A;

  function render(c) {
    c.innerHTML = `
      <header class="page-head">
        <h1 class="page-title">Ajustes</h1>
        <p class="kicker">tarefas e dados</p>
      </header>

      <section class="sec">
        <div class="sec-head"><h3>Tarefas do desafio</h3><span class="cap">${A.activeTasks().length} ativas</span></div>
        <ul class="set-list">
          ${A.TASKS.map((t) => {
            const on = A.isActive(t.id);
            return `<li class="set-item ${on ? '' : 'off'}" data-id="${t.id}">
              <span class="set-ast">${A.ast()}</span>
              <span class="set-name">
                <b>${A.esc(A.taskName(t.id))}</b>
                <small>${t.core ? 'conta para o dia' : t.kind === 'sweet' ? 'limite semanal' : 'meta semanal'}</small>
              </span>
              <button class="icon-btn set-edit" aria-label="Editar nome de ${A.esc(A.taskName(t.id))}">
                <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>
              </button>
              <label class="switch" aria-label="${on ? 'Desativar' : 'Ativar'} ${A.esc(A.taskName(t.id))}">
                <input type="checkbox" ${on ? 'checked' : ''} />
                <span></span>
              </label>
            </li>`;
          }).join('')}
        </ul>
        <p class="hint set-hint">Desativar tira a tarefa da tela Hoje e das contas a partir de agora (o total "de 7" se ajusta).</p>
      </section>

      <section class="sec">
        <div class="sec-head"><h3>Dados</h3><span class="cap">só neste aparelho</span></div>
        <div class="data-actions">
          <button class="btn ghost wide" data-a="export">Exportar backup</button>
          <label class="btn ghost wide">Importar backup<input type="file" accept="application/json,.json" hidden /></label>
          <button class="btn danger-ghost wide" data-a="wipe">Apagar tudo</button>
        </div>
        <p class="hint set-hint">O backup inclui registros, tarefas do dia, relatórios e fotos.</p>
      </section>`;

    c.querySelector('.set-list').addEventListener('click', (e) => {
      const li = e.target.closest('.set-item');
      if (li && e.target.closest('.set-edit')) editName(li.dataset.id);
    });
    c.querySelectorAll('.switch input').forEach((inp) => {
      inp.addEventListener('change', () => {
        const id = inp.closest('.set-item').dataset.id;
        if (!inp.checked && A.task(id).core && A.coreTasks().length === 1) {
          inp.checked = true;
          A.toast('Mantenha ao menos uma tarefa do desafio ativa');
          return;
        }
        A.state.tasks[id].active = inp.checked;
        A.save();
        A.rerender();
      });
    });
    c.querySelector('[data-a=export]').onclick = exportBackup;
    c.querySelector('input[type=file]').addEventListener('change', importBackup);
    c.querySelector('[data-a=wipe]').onclick = wipe;
  }

  function editName(id) {
    const body = A.el(`
      <form class="sh-name" autocomplete="off">
        <label class="field">
          <span>Nome (uma palavra)</span>
          <input type="text" maxlength="14" value="${A.esc(A.taskName(id))}" enterkeyhint="done" />
        </label>
        <p class="hint">Aparece embaixo do círculo na tela Hoje.</p>
        <button class="btn primary wide" type="submit">Salvar</button>
        <button class="link" type="button" data-a="reset">Voltar ao nome original (${A.esc(A.task(id).name)})</button>
      </form>`);
    const inp = body.querySelector('input');
    const set = (v) => { A.state.tasks[id].name = v; A.save(); A.sheet.close(); A.rerender(); };
    body.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = inp.value.trim();
      if (!v) { A.toast('Escolha um nome'); return; }
      set(v);
    });
    body.querySelector('[data-a=reset]').onclick = () => set(A.task(id).name);
    A.sheet.open({ title: 'Editar tarefa', kicker: A.task(id).name, body });
    setTimeout(() => inp.focus(), 300);
  }

  // ---------- Backup ----------
  const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

  async function exportBackup() {
    try {
      const keys = await A.photos.keys();
      const photos = {};
      for (const k of keys) { const b = await A.photos.get(k); if (b) photos[k] = await blobToDataURL(b); }
      const data = { app: 'antecipando2027', version: 1, exportedAt: new Date().toISOString(), state: A.state, photos };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const name = `antecipando-2027-backup-${A.todayKey()}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Backup Antecipando 2027' }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      A.toast('Backup exportado');
    } catch (e) {
      console.warn(e);
      A.toast('Não foi possível exportar');
    }
  }

  async function importBackup(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch (err) { A.toast('Arquivo inválido'); return; }
    if (!data || data.app !== 'antecipando2027' || !data.state || typeof data.state.days !== 'object') {
      A.toast('Esse arquivo não é um backup do app');
      return;
    }
    const n = Object.keys(data.state.days).length;
    const ok = await A.confirm(`Importar o backup de ${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('pt-BR') : 'data desconhecida'} (${n} dias registrados)? Os dados atuais serão substituídos.`, { ok: 'Importar' });
    if (!ok) return;
    try {
      await A.photos.clear();
      for (const [k, url] of Object.entries(data.photos || {})) {
        const blob = await (await fetch(url)).blob();
        await A.photos.put(k, blob);
      }
      localStorage.setItem(A.NS, JSON.stringify(data.state));
      location.reload();
    } catch (err) {
      console.warn(err);
      A.toast('Falha ao importar');
    }
  }

  async function wipe() {
    const ok = await A.confirm('Apagar todos os registros, tarefas, relatórios e fotos deste aparelho? Isso não pode ser desfeito.', { ok: 'Apagar tudo', danger: true });
    if (!ok) return;
    try { await A.photos.clear(); } catch (e) {}
    localStorage.removeItem(A.NS);
    location.reload();
  }

  A.views.ajustes = { render };
})();
