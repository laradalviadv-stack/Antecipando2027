// Aba Progresso: resumo, calendário dos 75 dias, cartão do dia e edição de dias passados.
(function () {
  const A = window.A;
  let root = null;
  let sel = null;      // dia selecionado no calendário
  let editing = null;  // dia aberto para edição (null = calendário)

  const defaultSel = () => {
    const n = A.todayNum();
    return A.keyOf(Math.min(Math.max(n, 1), A.TOTAL));
  };

  function render(c) {
    root = c;
    if (!sel || !A.inChallenge(sel)) sel = defaultSel();
    if (editing && A.status(editing) !== 'futuro') renderEdit(c);
    else { editing = null; renderMain(c); }
  }

  // ---------- Calendário ----------
  function renderMain(c) {
    const today = A.todayKey();
    const pct = Math.round((A.daysDone() / A.TOTAL) * 100);
    const weeks = [];
    for (let w = A.weekStart(A.START); w <= A.END; w = A.addDays(w, 7)) weeks.push(w);

    c.innerHTML = `
      <header class="page-head">
        <h1 class="page-title">Progresso</h1>
        <p class="kicker">15 out — 28 dez</p>
      </header>

      <div class="mini summary">
        <div><b>${A.daysDone()}</b><span>dias concluídos</span></div>
        <div><b>${pct}%</b><span>do desafio</span></div>
        <div><b>${A.daysMissed()}</b><span>dias perdidos</span></div>
      </div>

      <div class="legend">
        <span><i class="lg lg-feito"></i>feito</span>
        <span><i class="lg lg-perdido"></i>perdido</span>
        <span><i class="lg lg-hoje"></i>hoje</span>
      </div>

      <div class="cal" role="grid" aria-label="Calendário do desafio">
        <div class="cal-row cal-head" role="row"><span></span>${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d) => `<span>${d}</span>`).join('')}</div>
        ${weeks.map((w) => `
          <div class="cal-row" role="row">
            <span class="cal-mon">${A.fmtShort(w)}</span>
            ${[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const k = A.addDays(w, i);
              if (!A.inChallenge(k)) return '<span class="cal-x"></span>';
              const st = A.status(k);
              const cls = [`st-${st}`, k === today ? 'is-today' : '', k === sel ? 'sel' : ''].join(' ');
              return `<button class="cal-d ${cls}" data-k="${k}" aria-label="Dia ${A.dayNum(k)}, ${A.fmtLong(k)}, ${A.STATUS_TXT[st]}">${A.dayNum(k)}</button>`;
            }).join('')}
          </div>`).join('')}
      </div>

      <section class="daycard-wrap"></section>`;

    c.querySelector('.cal').addEventListener('click', (e) => {
      const b = e.target.closest('.cal-d');
      if (!b) return;
      sel = b.dataset.k;
      c.querySelectorAll('.cal-d.sel').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      drawCard();
    });
    drawCard();
  }

  function drawCard() {
    const wrap = root.querySelector('.daycard-wrap');
    if (!wrap) return;
    const k = sel;
    const n = A.dayNum(k);
    const st = A.status(k);
    const core = A.coreTasks();
    const ts = A.todoStats(k);
    const todosTxt = st === 'futuro' || !ts.total ? '—' : `${ts.done} de ${ts.total}`;
    wrap.innerHTML = `
      <article class="dc">
        <div class="dc-info">
          <p class="dc-day">Dia ${n}</p>
          <p class="chip dc-st st-${st}">${A.STATUS_TXT[st]}</p>
          <p class="dc-date">${A.fmtLong(k)}</p>
          <p class="dc-count">${st === 'futuro' ? 0 : A.coreDone(k)} de ${core.length} tarefas</p>
          <div class="dc-asts">
            ${core.map((t) => `<span class="mast ${st !== 'futuro' && A.taskDone(k, t.id) ? 'on' : ''}" title="${A.esc(A.taskName(t.id))}" aria-label="${A.esc(A.taskName(t.id))}">${A.ast()}</span>`).join('')}
          </div>
          <p class="dc-todos">Tarefas do dia: ${todosTxt}</p>
        </div>
        <div class="dc-photo">
          ${A.felpa()}
          <div class="dc-img"><div class="empty">${A.ast()}</div></div>
        </div>
      </article>
      ${st !== 'futuro' ? '<button class="link dc-edit">Editar este dia</button>' : ''}`;
    const ed = wrap.querySelector('.dc-edit');
    if (ed) ed.onclick = () => { editing = k; render(root); window.scrollTo(0, 0); };
    const reg = A.rec(k).registro;
    if (reg && reg.foto) {
      A.photos.url(k).then((u) => {
        if (!u || sel !== k) return;
        const box = wrap.querySelector('.dc-img');
        if (box) box.innerHTML = `<img src="${u}" alt="Foto do dia ${n}" />`;
      });
    }
  }

  // ---------- Edição de um dia ----------
  function renderEdit(c) {
    const k = editing;
    c.innerHTML = `
      <header class="page-head edit-head">
        <button class="link back">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Progresso
        </button>
        <p class="kicker">Editar · dia ${A.dayNum(k)}</p>
      </header>
      <h2 class="big-date edit-date">${A.fmtBig(k)}</h2>
      <p class="center"><span class="chip ed-st"></span></p>
      ${A.checksHTML(true)}
      <p class="prog-l center ed-count"></p>
      <section class="sec todos-sec">
        <div class="sec-head"><h3>Tarefas do dia</h3><span class="cap todo-cap"></span></div>
        <div class="todo-slot"></div>
      </section>`;
    c.querySelector('.back').onclick = () => { editing = null; render(root); };
    A.bindChecks(c, () => editing);
    c.querySelector('.todo-slot').appendChild(A.todoList(k, paintEdit));
    paintEdit();
  }

  function paintEdit() {
    if (!root || !editing) return;
    const k = editing;
    A.paintChecks(root, k);
    const st = A.status(k);
    const chip = root.querySelector('.ed-st');
    chip.className = `chip ed-st st-${st}`;
    chip.textContent = A.STATUS_TXT[st];
    let t = `${A.coreDone(k)} de ${A.coreTotal()} tarefas do desafio`;
    if (A.coreDone(k) === A.coreTotal() && A.sweetOver(k)) t += ' · limite de doce ultrapassado';
    root.querySelector('.ed-count').textContent = t;
    const ts = A.todoStats(k);
    root.querySelector('.todo-cap').textContent = ts.total ? `${ts.done} de ${ts.total}` : '';
  }

  A.views.progresso = {
    render,
    changed() { if (editing) paintEdit(); else A.rerender(); },
  };
})();
