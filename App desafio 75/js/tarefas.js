// Folhas das tarefas do desafio. Recebem a data (k), então servem para hoje e para dias passados.
(function () {
  const A = window.A;

  // Chamado depois de qualquer alteração de dados de um dia.
  A.changed = (k) => {
    A.save();
    if (A.onChange) A.onChange(k);
  };

  const mmss = (s) => { s = Math.max(0, Math.round(s)); return `${A.pad(Math.floor(s / 60))}:${A.pad(s % 60)}`; };
  A.mmss = mmss;

  // Ação ao tocar no círculo de uma tarefa
  A.tapTask = (k, id) => {
    const t = A.task(id);
    const r = A.recW(k);
    switch (t.kind) {
      case 'check':
        r[id] = !r[id];
        A.vibrate(r[id] ? 14 : 6);
        A.changed(k);
        break;
      case 'wake':
        if (!r.acordar && k === A.todayKey()) { r.acordar = A.nowHM(); A.vibrate(14); A.changed(k); }
        openWake(k);
        break;
      case 'timer': openTimer(k, id); break;
      case 'photo': openRegistro(k); break;
      case 'sweet': openDoce(k); break;
      case 'content': openConteudo(k); break;
    }
  };

  // ---------- 5h ----------
  function openWake(k) {
    const body = A.el('<div class="sh-wake center"></div>');
    const draw = () => {
      const t = A.rec(k).acordar;
      const ok = t && t <= A.WAKE_LIMIT;
      body.innerHTML = `
        <p class="big-num">${t || '—'}</p>
        <p class="chip ${t ? (ok ? 'ok' : 'late') : ''}">${t ? (ok ? 'no horário' : 'depois das ' + A.WAKE_LIMIT) : 'sem registro'}</p>
        <p class="hint">Conta como no horário até ${A.WAKE_LIMIT}.</p>
        <label class="field">
          <span>Ajustar horário</span>
          <input type="time" value="${t || ''}" />
        </label>
        ${t ? '<button class="btn ghost wide" data-a="clear">Limpar registro</button>' : ''}`;
      body.querySelector('input').addEventListener('change', (e) => {
        const v = e.target.value;
        if (!/^\d{2}:\d{2}$/.test(v)) return;
        A.recW(k).acordar = v; A.changed(k); draw();
      });
      const c = body.querySelector('[data-a=clear]');
      if (c) c.onclick = () => { delete A.recW(k).acordar; A.changed(k); draw(); };
    };
    draw();
    A.sheet.open({ title: 'Acordar às 5h', kicker: sheetKicker(k), body });
  }

  // ---------- Treino / Estudo ----------
  function openTimer(k, id) {
    const target = A.timerTarget(id);
    const R = 92, C = 2 * Math.PI * R;
    const body = A.el(`
      <div class="sh-timer center">
        <div class="ring">
          <svg viewBox="0 0 220 220" aria-hidden="true">
            <circle class="ring-track" cx="110" cy="110" r="${R}"/>
            <circle class="ring-fill" cx="110" cy="110" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
          </svg>
          <div class="ring-in">
            <p class="big-num t-left">${mmss(target)}</p>
            <p class="kicker t-cap">restantes</p>
          </div>
        </div>
        <div class="t-actions"></div>
        <p class="hint t-hint">Conta ao chegar a ${mmss(target)} ou ao concluir manualmente.</p>
      </div>`);
    const fill = body.querySelector('.ring-fill');
    const left = body.querySelector('.t-left');
    const cap = body.querySelector('.t-cap');
    const actions = body.querySelector('.t-actions');
    let lastState = '';

    const st = () => A.recW(k)[id] || (A.recW(k)[id] = { acc: 0, run: null, done: false });
    const pause = () => { const s = st(); if (s.run) { s.acc = A.timerElapsed(k, id); s.run = null; } };

    const drawActions = () => {
      const s = st();
      const state = s.done ? 'done' : s.run ? 'run' : (s.acc > 0 ? 'paused' : 'idle');
      if (state === lastState) return;
      lastState = state;
      if (state === 'done') {
        actions.innerHTML = `
          <p class="chip ok">${s.manual ? 'concluído manualmente' : 'concluído'}</p>
          <button class="btn ghost wide" data-a="undo">Desmarcar</button>`;
      } else {
        actions.innerHTML = `
          <button class="btn primary wide" data-a="toggle">${state === 'run' ? 'Pausar' : state === 'paused' ? 'Retomar' : 'Iniciar'}</button>
          <button class="btn ghost wide" data-a="finish">Concluir</button>
          ${state !== 'idle' ? '<button class="link" data-a="reset">Zerar cronômetro</button>' : ''}`;
      }
    };

    const draw = () => {
      const s = st();
      const el = s.done ? Math.max(target, s.acc || 0) : A.timerElapsed(k, id);
      const p = Math.min(1, el / target);
      fill.setAttribute('stroke-dashoffset', String(C * (1 - p)));
      left.textContent = s.done ? mmss(Math.min(el, target)) : mmss(target - el);
      cap.textContent = s.done ? 'feito' : 'restantes';
      body.classList.toggle('is-done', !!s.done);
      drawActions();
    };

    actions.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const s = st();
      if (a.dataset.a === 'toggle') {
        if (s.run) pause(); else s.run = Date.now();
        A.vibrate(8);
        A.changed(k);
      } else if (a.dataset.a === 'finish') {
        pause();
        if (A.timerElapsed(k, id) >= target) { s.done = true; s.manual = false; }
        else {
          A.changed(k);
          const ok = await A.confirm(`O cronômetro está em ${mmss(A.timerElapsed(k, id))}. Marcar ${A.taskName(id)} como feito mesmo assim?`, { ok: 'Marcar como feito' });
          if (!ok) { draw(); return; }
          s.done = true; s.manual = true;
        }
        A.vibrate(20);
        A.changed(k);
      } else if (a.dataset.a === 'undo') {
        s.done = false; s.manual = false; s.run = null;
        if (s.acc >= target) s.acc = 0;
        A.changed(k);
      } else if (a.dataset.a === 'reset') {
        s.acc = 0; s.run = null;
        A.changed(k);
      }
      draw();
    });

    draw();
    const iv = setInterval(draw, 250);
    A.sheet.open({ title: A.taskName(id), kicker: `${A.task(id).minutes} minutos · ${sheetKicker(k)}`, body, onClose: () => clearInterval(iv) });
  }

  // Chamado a cada segundo pelo app: conclui cronômetros que chegaram ao alvo.
  A.tickTimers = () => {
    const days = A.state.days;
    for (const k in days) {
      for (const id of ['treino', 'estudo']) {
        const s = days[k][id];
        if (!s || !s.run || s.done) continue;
        if (A.timerElapsed(k, id) >= A.timerTarget(id)) {
          s.acc = A.timerTarget(id); s.run = null; s.done = true; s.manual = false;
          A.vibrate([30, 60, 30]);
          A.toast(`${A.taskName(id)} concluído`);
          A.changed(k);
        }
      }
    }
  };

  // ---------- Registro (foto + nota) ----------
  function openRegistro(k) {
    const body = A.el(`
      <div class="sh-reg">
        <div class="reg-photo"></div>
        <div class="row2">
          <label class="btn primary">Câmera<input type="file" accept="image/*" capture="environment" hidden /></label>
          <label class="btn ghost">Galeria<input type="file" accept="image/*" hidden /></label>
        </div>
        <button class="link reg-del" hidden>Remover foto</button>
        <label class="field">
          <span>Nota do dia</span>
          <input type="text" class="reg-note" maxlength="140" placeholder="Uma linha sobre hoje" enterkeyhint="done" />
        </label>
        <p class="hint">Basta a foto ou a nota.</p>
      </div>`);
    const ph = body.querySelector('.reg-photo');
    const del = body.querySelector('.reg-del');
    const note = body.querySelector('.reg-note');
    const reg = () => A.recW(k).registro || (A.recW(k).registro = { note: '', foto: false });
    note.value = (A.rec(k).registro && A.rec(k).registro.note) || '';

    const drawPhoto = async () => {
      const url = A.rec(k).registro && A.rec(k).registro.foto ? await A.photos.url(k) : null;
      ph.innerHTML = url ? `<img src="${url}" alt="Foto do dia" />` : `<div class="empty">${A.ast()}<span>Sem foto ainda</span></div>`;
      del.hidden = !url;
    };
    body.querySelectorAll('input[type=file]').forEach((inp) => {
      inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0];
        inp.value = '';
        if (!f) return;
        ph.innerHTML = '<div class="empty"><span>Guardando…</span></div>';
        try {
          const blob = await A.shrinkImage(f);
          await A.photos.put(k, blob);
          reg().foto = true;
          A.vibrate(14);
          A.changed(k);
        } catch (e) {
          console.warn(e);
          A.toast('Não foi possível usar essa foto');
        }
        drawPhoto();
      });
    });
    del.onclick = async () => {
      if (!(await A.confirm('Remover a foto deste dia?', { ok: 'Remover', danger: true }))) return;
      await A.photos.del(k);
      reg().foto = false;
      A.changed(k);
      drawPhoto();
    };
    let t = null;
    note.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { reg().note = note.value.trim(); A.changed(k); }, 300);
    });
    note.addEventListener('keydown', (e) => { if (e.key === 'Enter') note.blur(); });
    drawPhoto();
    A.sheet.open({
      title: 'Registro de progresso', kicker: sheetKicker(k), body,
      onClose: () => { clearTimeout(t); const v = note.value.trim(); if (v !== ((A.rec(k).registro || {}).note || '')) { reg().note = v; A.changed(k); } },
    });
  }

  // ---------- Contadores semanais (doce e conteúdo) ----------
  function openCounter(k, cfg) {
    const body = A.el(`<div class="sh-count center"></div>`);
    const draw = () => {
      const week = A.weekSum(k, cfg.field);
      const todayN = A.rec(k)[cfg.field] || 0;
      body.innerHTML = cfg.html(week, todayN) + `
        <button class="btn ${cfg.btnClass} wide" data-a="add">${cfg.btn}</button>
        ${todayN > 0 ? `<button class="link" data-a="undo">Desfazer um (${A.fmtShort(k)})</button>` : ''}
        <p class="hint">Semana de segunda a domingo · zera na segunda.</p>`;
    };
    body.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const r = A.recW(k);
      if (a.dataset.a === 'add') { r[cfg.field] = (r[cfg.field] || 0) + 1; A.vibrate(14); }
      else r[cfg.field] = Math.max(0, (r[cfg.field] || 0) - 1);
      A.changed(k);
      draw();
    });
    draw();
    A.sheet.open({ title: cfg.title, kicker: sheetKicker(k), body });
  }

  function openDoce(k) {
    const lim = A.task('doce').limit;
    openCounter(k, {
      field: 'doce', title: A.taskName('doce'), btn: 'Comi um doce', btnClass: 'ghost',
      html: (w) => `
        <p class="big-num ${w > lim ? 'over' : ''}">${w}/${lim}</p>
        <p class="kicker">doces nesta semana</p>
        <p class="chip ${w > lim ? 'late' : w === lim ? 'warn' : 'ok'}">${w > lim ? 'limite ultrapassado' : w === lim ? 'limite atingido' : `pode mais ${lim - w}`}</p>`,
    });
  }

  function openConteudo(k) {
    const goal = A.task('conteudo').goal;
    openCounter(k, {
      field: 'conteudo', title: A.taskName('conteudo'), btn: 'Criei um conteúdo', btnClass: 'primary',
      html: (w) => `
        <p class="big-num">${Math.min(w, goal)}/${goal}</p>
        <p class="kicker">conteúdo jurídico nesta semana</p>
        ${w > goal ? `<p class="chip ok extra">+${w - goal}</p>` : `<p class="chip ${w >= goal ? 'ok' : ''}">${w >= goal ? 'meta da semana feita' : 'meta: 1 por semana'}</p>`}`,
    });
  }

  function sheetKicker(k) {
    const n = A.dayNum(k);
    return k === A.todayKey() ? `Hoje · dia ${n}` : `Dia ${n} · ${A.fmtLong(k)}`;
  }

  // Círculos das tarefas (5 + 4), usados na aba Hoje e na edição de um dia.
  A.checksHTML = (enabled) => {
    const tasks = A.activeTasks();
    const half = Math.ceil(tasks.length / 2);
    const rows = [tasks.slice(0, half), tasks.slice(half)].filter((r) => r.length);
    return `<div class="checks ${enabled ? '' : 'locked'}">
      ${rows.map((r) => `<div class="checks-row">${r.map((t) => `
        <button class="chk" data-id="${t.id}" data-kind="${t.kind}" ${enabled ? '' : 'disabled'}>
          <span class="chk-c">${A.ast()}</span>
          <span class="chk-l">${A.esc(A.taskName(t.id))}</span>
        </button>`).join('')}</div>`).join('')}
    </div>`;
  };
  A.bindChecks = (root, getKey) => {
    root.querySelector('.checks').addEventListener('click', (e) => {
      const b = e.target.closest('.chk');
      if (!b || b.disabled) return;
      A.tapTask(getKey(), b.dataset.id);
    });
  };
  A.paintChecks = (root, k) => {
    root.querySelectorAll('.chk').forEach((b) => {
      const s = A.circleState(k, b.dataset.id);
      b.classList.toggle('on', s === 'on');
      b.classList.toggle('some', s === 'some');
      b.classList.toggle('over', s === 'over');
      b.setAttribute('aria-pressed', String(s === 'on'));
    });
  };

  A.STATUS_TXT = { feito: 'concluído', perdido: 'perdido', andamento: 'em andamento', futuro: 'a fazer' };

  // Estado visual do círculo: 'on' | 'some' | 'over' | ''
  A.circleState = (k, id) => {
    const t = A.task(id);
    if (t.kind === 'sweet') {
      const w = A.weekSum(k, 'doce');
      return A.weekSweetOver(k) ? 'over' : w > 0 ? 'some' : '';
    }
    if (t.kind === 'content') return A.taskDone(k, id) ? 'on' : '';
    return A.taskDone(k, id) ? 'on' : '';
  };
})();
