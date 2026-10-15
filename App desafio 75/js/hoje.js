// Aba Hoje
(function () {
  const A = window.A;
  let root = null;
  let key = null;

  // Lista "Tarefas do dia" (texto livre, salva por data). Reutilizável em outras abas.
  A.todoList = (k, onUpdate) => {
    const wrap = A.el(`
      <div class="todo">
        <ul class="todo-list"></ul>
        <form class="todo-add" autocomplete="off">
          <input type="text" maxlength="120" placeholder="Adicionar tarefa" aria-label="Nova tarefa" enterkeyhint="done" />
          <button type="submit" class="icon-btn add" aria-label="Adicionar">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </form>
      </div>`);
    const ul = wrap.querySelector('.todo-list');
    const list = () => A.recW(k).todos || (A.recW(k).todos = []);
    const commit = () => { A.changed(k); onUpdate && onUpdate(); };

    const draw = () => {
      const l = A.todos(k);
      ul.innerHTML = l.length ? l.map((x) => `
        <li class="todo-item ${x.d ? 'done' : ''}" data-id="${x.id}">
          <button class="todo-chk" aria-label="${x.d ? 'Desmarcar' : 'Marcar'}" aria-pressed="${!!x.d}">
            <span>${A.ast()}</span>
          </button>
          <span class="todo-t" role="button" tabindex="0">${A.esc(x.t)}</span>
          <button class="todo-del icon-btn" aria-label="Apagar">
            <svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>
          </button>
        </li>`).join('') : '<li class="todo-empty">Nada por aqui ainda.</li>';
    };

    const edit = (li) => {
      const id = li.dataset.id;
      const item = list().find((x) => x.id === id);
      const span = li.querySelector('.todo-t');
      const inp = A.el(`<input class="todo-edit" type="text" maxlength="120" enterkeyhint="done" />`);
      inp.value = item.t;
      span.replaceWith(inp);
      inp.focus();
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        const v = inp.value.trim();
        if (!v) A.recW(k).todos = list().filter((x) => x.id !== id);
        else item.t = v;
        commit(); draw();
      };
      inp.addEventListener('blur', finish);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    };

    ul.addEventListener('click', (e) => {
      const li = e.target.closest('.todo-item');
      if (!li) return;
      const id = li.dataset.id;
      if (e.target.closest('.todo-chk')) {
        const it = list().find((x) => x.id === id);
        it.d = !it.d; A.vibrate(8); commit(); draw();
      } else if (e.target.closest('.todo-del')) {
        A.recW(k).todos = list().filter((x) => x.id !== id);
        commit(); draw();
      } else if (e.target.closest('.todo-t')) edit(li);
    });
    ul.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('todo-t')) edit(e.target.closest('.todo-item'));
    });
    wrap.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = e.target.querySelector('input');
      const v = inp.value.trim();
      if (!v) return;
      list().push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: v, d: false });
      inp.value = '';
      commit(); draw();
    });
    draw();
    return wrap;
  };

  function render(c) {
    root = c;
    key = A.todayKey();
    const n = A.dayNum(key);
    const pre = n < 1, post = n > A.TOTAL;
    const live = !pre && !post;

    let kicker = `Dia ${n} de ${A.TOTAL}`;
    if (pre) kicker = n === 0 ? 'Começa amanhã' : `Começa em ${1 - n} dias`;
    if (post) kicker = 'Desafio encerrado';
    const frase = window.FRASES[Math.min(Math.max(n, 1), A.TOTAL) - 1];

    c.innerHTML = `
      ${A.SIM ? `<p class="sim-chip">modo teste · ${A.fmtShort(A.SIM)}</p>` : ''}
      <header class="brand">
        <span class="fio"></span><h1>Antecipando 2027</h1><span class="fio r"></span>
      </header>
      <p class="kicker k-day">${kicker}</p>
      <h2 class="big-date">${A.fmtBig(key)}</h2>

      ${A.checksHTML(live)}
      ${pre ? `<p class="hint center pre-note">O desafio começa na quinta, 15 de outubro.</p>` : ''}

      <section class="frase">
        ${A.felpa()}
        <p class="frase-t">${A.esc(frase)}</p>
        <span class="stars" aria-hidden="true">✦ ✦ ✦</span>
      </section>

      <section class="sec todos-sec">
        <div class="sec-head"><h3>Tarefas do dia</h3><span class="cap todo-cap"></span></div>
        <div class="todo-slot"></div>
      </section>

      <section class="progress">
        <div class="bar" role="progressbar" aria-valuemin="0">
          <div class="bar-fill"></div>
          <span class="bar-mark">${A.ast()}</span>
        </div>
        <div class="prog-row">
          <span class="prog-l"></span>
          <button class="selo" hidden>${A.ast()} Dia concluído</button>
        </div>
      </section>

      <footer class="mini">
        <div><b class="m-todos"></b><span>tarefas de hoje</span></div>
        <div><b class="m-pct"></b><span>do desafio</span></div>
        <div><b class="m-left"></b><span>dias para o fim</span></div>
      </footer>`;

    c.querySelector('.todo-slot').appendChild(A.todoList(key, refresh));
    A.bindChecks(c, () => key);
    c.querySelector('.selo').onclick = () => A.celebrate(key);
    refresh();
  }

  // Atualiza estados sem reconstruir a tela (preserva animações e foco).
  function refresh() {
    if (!root || A.currentTab !== 'hoje') return;
    A.paintChecks(root, key);

    const live = A.inChallenge(key);
    const total = A.coreTotal();
    const done = live ? A.coreDone(key) : 0;
    const complete = live && A.dayComplete(key);
    const p = total ? done / total : 0;
    const bar = root.querySelector('.bar');
    bar.style.setProperty('--p', String(complete ? 1 : p));
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-valuenow', String(done));
    bar.classList.toggle('full', complete);
    let label = `${done} de ${total} tarefas do desafio`;
    if (live && done === total && A.sweetOver(key)) label += ' · limite de doce ultrapassado';
    root.querySelector('.prog-l').textContent = label;
    root.querySelector('.selo').hidden = !complete;

    const ts = A.todoStats(key);
    root.querySelector('.m-todos').textContent = ts.total ? `${ts.done}/${ts.total}` : '—';
    root.querySelector('.todo-cap').textContent = ts.total ? `${ts.done} de ${ts.total}` : 'só hoje';
    root.querySelector('.m-pct').textContent = `${Math.round((A.daysDone() / A.TOTAL) * 100)}%`;
    root.querySelector('.m-left').textContent = A.faltam();
  }

  A.views.hoje = { render };
  A.refreshHoje = refresh;
  A.hojeKey = () => key;
})();
