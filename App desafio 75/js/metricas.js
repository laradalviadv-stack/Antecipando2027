// Aba Métricas: todos os gráficos em SVG, calculados a partir dos mesmos dados diários.
(function () {
  const A = window.A;
  const NS = 'http://www.w3.org/2000/svg';
  const W = 350;
  const C = { burg: '#670626', green: '#98FB98', silver: '#CAE2C6', olive: '#2F4A2C', muted: '#7A6D69', line: 'rgba(103,6,38,.09)', cotton: '#FFD7E7', surface: '#FFFDF8' };

  // estado da tela
  let span = 'hoje';          // 'hoje' | '75'
  const hidden = new Set();   // metas ocultas no gráfico geral
  let metaSel = null;         // dia selecionado no gráfico geral
  let habitEnd = null;        // último dia da janela de 15 do calendário de hábitos

  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const name = (id) => A.taskName(id);
  const svg = (h, inner, cls = '') => `<svg class="chart ${cls}" viewBox="0 0 ${W} ${h}" role="img" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  const t = (x, y, s, cls = 'ax', anchor = 'middle') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${A.esc(s)}</text>`;
  const niceStep = (max) => [1, 2, 5, 10, 15, 20, 25].find((s) => max / s <= 5) || 25;

  // Curva suave (Catmull-Rom → Bézier), limitada à faixa do gráfico
  function smooth(pts, yMin, yMax) {
    if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    const cl = (v) => Math.min(Math.max(v, yMin), yMax);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, cl(p1[1] + (p2[1] - p0[1]) / 6)];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, cl(p2[1] - (p3[1] - p1[1]) / 6)];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  // Toque/arraste num gráfico → índice mais próximo
  function scrub(el, toIndex, onPick) {
    const svgEl = el.querySelector('svg');
    const pick = (e) => {
      const r = svgEl.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      onPick(toIndex(x));
    };
    svgEl.addEventListener('pointerdown', (e) => { pick(e); svgEl.setPointerCapture && svgEl.setPointerCapture(e.pointerId); });
    svgEl.addEventListener('pointermove', (e) => { if (e.buttons) pick(e); });
  }

  function section(title, cap, body) {
    return `<section class="sec msec"><div class="sec-head"><h3>${title}</h3><span class="cap">${cap}</span></div>${body}</section>`;
  }

  // ---------- render ----------
  function render(c) {
    const L = A.elapsed();
    c.innerHTML = `
      <header class="page-head">
        <h1 class="page-title">Métricas</h1>
        <p class="kicker">${L ? `até o dia ${L}` : 'a partir de 15 out'}</p>
      </header>
      ${L ? '' : `<div class="soon">${A.ast()}<p>Os gráficos começam a se formar em 15 de outubro.</p></div>`}
      <div class="m-overview"></div>
      <div class="m-daily"></div>
      <div class="m-rank"></div>
      <div class="m-habits"></div>
      <div class="m-wake"></div>
      <div class="m-weekly"></div>
      <div class="m-metas"></div>
      <div class="m-reports"></div>`;
    if (L) {
      overview(c.querySelector('.m-overview'), L);
      daily(c.querySelector('.m-daily'), L);
      rank(c.querySelector('.m-rank'), L);
      habits(c.querySelector('.m-habits'), L);
      wake(c.querySelector('.m-wake'), L);
      weekly(c.querySelector('.m-weekly'), L);
      metas(c.querySelector('.m-metas'), L);
    }
    reports(c.querySelector('.m-reports'));
  }

  // 1. Visão geral
  function overview(el, L) {
    const core = A.coreTasks();
    let done = 0;
    for (let i = 1; i <= L; i++) done += A.coreDone(A.keyOf(i));
    const possible = L * core.length;
    const p = possible ? done / possible : 0;
    const r = 54, circ = 2 * Math.PI * r;
    const st = A.streaks();
    el.innerHTML = section('Visão geral', 'cumprimento', `
      <div class="ov">
        <div class="donut">
          <svg viewBox="0 0 140 140" role="img" aria-label="Taxa de cumprimento ${Math.round(p * 100)}%">
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="${C.silver}" stroke-width="12"/>
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="${C.green}" stroke-width="12" stroke-linecap="round"
              stroke-dasharray="${(circ * p).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 70 70)"/>
          </svg>
          <div class="donut-in"><b>${Math.round(p * 100)}%</b><span>${done} de ${possible}</span></div>
        </div>
        <div class="ov-nums">
          <div><b>${A.daysDone()}</b><span>dias feitos</span></div>
          <div><b>${st.cur}</b><span>sequência atual</span></div>
          <div><b>${st.best}</b><span>melhor sequência</span></div>
        </div>
      </div>`);
  }

  // 2. Progresso diário (% das tarefas do desafio por dia)
  function daily(el, L) {
    const H = 170, l = 34, r = 10, top = 14, b = 26;
    const total = A.coreTotal();
    const vals = [];
    for (let i = 1; i <= L; i++) vals.push(pct(A.coreDone(A.keyOf(i)), total));
    const xmax = Math.max(L, 2);
    const X = (d) => l + ((d - 1) / (xmax - 1)) * (W - l - r);
    const Y = (v) => top + (1 - v / 100) * (H - top - b);
    const pts = vals.map((v, i) => [X(i + 1), Y(v)]);
    const line = smooth(pts, Y(100), Y(0));
    const area = pts.length > 1 ? `${line} L${pts[pts.length - 1][0]},${Y(0)} L${pts[0][0]},${Y(0)} Z` : '';
    const step = niceStep(L);
    let ticks = '';
    for (let d = 1; d <= L; d += (d === 1 && step > 1 ? step - 1 : step)) ticks += t(X(d), H - 8, d);
    const inner = `
      <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.green}" stop-opacity=".55"/><stop offset="1" stop-color="${C.green}" stop-opacity="0"/></linearGradient></defs>
      ${[0, 50, 100].map((v) => `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>${t(l - 6, Y(v) + 3, v + '%', 'ax', 'end')}`).join('')}
      <line x1="${l}" x2="${W - r}" y1="${Y(60)}" y2="${Y(60)}" class="ref"/>
      ${area ? `<path d="${area}" fill="url(#gArea)"/>` : ''}
      <path d="${line}" fill="none" stroke="#5FCB6E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map((p, i) => vals[i] < 60
        ? `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${C.burg}" stroke="${C.surface}" stroke-width="2"/>`
        : `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="${C.green}" stroke="${C.olive}" stroke-width=".8"/>`).join('')}
      <g class="guide" style="display:none"><line y1="${top}" y2="${H - b}" class="gline"/><circle r="5" class="gdot"/></g>
      ${ticks}`;
    el.innerHTML = section('Progresso diário', '% das tarefas', `
      <p class="readout">Toque no gráfico para ver cada dia.</p>
      ${svg(H, inner)}
      <p class="mlegend"><span><i style="background:${C.green}"></i>% do dia</span><span><i style="background:${C.burg}"></i>abaixo de 60%</span></p>`);
    scrub(el, (x) => Math.min(L, Math.max(1, Math.round(((x - l) / (W - l - r)) * (xmax - 1)) + 1)), (d) => {
      const g = el.querySelector('.guide');
      g.style.display = '';
      g.querySelector('line').setAttribute('x1', X(d)); g.querySelector('line').setAttribute('x2', X(d));
      g.querySelector('circle').setAttribute('cx', X(d)); g.querySelector('circle').setAttribute('cy', Y(vals[d - 1]));
      const k = A.keyOf(d);
      el.querySelector('.readout').innerHTML = `<b>Dia ${d}</b> · ${A.fmtShort(k)} · ${A.coreDone(k)} de ${total} · <b>${vals[d - 1]}%</b>`;
    });
  }

  // 3. Mais e menos cumpridas
  function rank(el, L) {
    const rows = A.coreTasks().map((tk) => {
      let n = 0;
      for (let i = 1; i <= L; i++) n += A.taskDone(A.keyOf(i), tk.id) ? 1 : 0;
      return { id: tk.id, n };
    }).sort((a, b) => b.n - a.n);
    el.innerHTML = section('Mais e menos cumpridas', `${L} ${L === 1 ? 'dia' : 'dias'}`, barList(rows, L, {}));
  }

  // lista de barras horizontais (usada também nos relatórios)
  function barList(rows, total, { diff, unit } = {}) {
    if (!rows.length) return '<p class="hint">Nenhuma tarefa ativa.</p>';
    const max = rows[0].n, min = rows[rows.length - 1].n;
    return `<ul class="bars">${rows.map((r, i) => {
      const top = r.n === max && max > min, low = r.n === min && max > min; // empates recebem o mesmo selo
      const w = total ? (r.n / total) * 100 : 0;
      const dv = diff ? diff[r.id] : null;
      return `<li>
        <div class="bar-top">
          <span class="bar-name">${A.esc(name(r.id))}${top ? ' <em class="badge good">mais cumprida</em>' : ''}${low ? ' <em class="badge low">menos cumprida</em>' : ''}</span>
          <span class="bar-val">${r.n} de ${total}${unit || ''}${dv != null ? ` <small class="${dv > 0 ? 'up' : ''}">(${dv >= 0 ? '+' + dv : dv})</small>` : ''}</span>
        </div>
        <svg class="hbar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
          <rect x="0" y="0" width="100" height="8" rx="4" fill="rgba(103,6,38,.07)"/>
          ${w > 0 ? `<rect x="0" y="0" width="${Math.max(w, 3).toFixed(2)}" height="8" rx="4" fill="${top ? '#5FCB6E' : C.green}"/>` : ''}
        </svg>
      </li>`;
    }).join('')}</ul>`;
  }

  // 4. Calendário de hábitos (janelas de 15 dias)
  function habits(el, L) {
    const pages = Math.ceil(L / 15);
    if (habitEnd == null || habitEnd > pages * 15) habitEnd = pages * 15;
    const end = Math.min(habitEnd, A.TOTAL), start = end - 14;
    const ids = A.META_ORDER.filter((id) => A.isActive(id));
    const lw = 76, pw = 40, cw = (W - lw - pw) / 15, rh = 24, top = 18;
    const H = top + ids.length * rh + 4;
    let inner = '';
    for (let d = start; d <= end; d++) {
      const x = lw + (d - start + 0.5) * cw;
      inner += t(x, 10, d, d === A.todayNum() ? 'ax strong' : 'ax');
    }
    ids.forEach((id, ri) => {
      const y = top + ri * rh + rh / 2;
      let ok = 0, seen = 0;
      inner += `<text x="0" y="${y + 4}" class="lbl">${A.esc(name(id))}</text>`;
      for (let d = start; d <= end; d++) {
        const x = lw + (d - start + 0.5) * cw;
        if (d > L) { inner += `<circle cx="${x}" cy="${y}" r="2" fill="rgba(103,6,38,.12)"/>`; continue; }
        seen++;
        const v = A.metaValue(A.keyOf(d), id) > 0;
        if (v) ok++;
        inner += v
          ? `<circle cx="${x}" cy="${y}" r="5.5" fill="${C.green}" stroke="${C.olive}" stroke-opacity=".35" stroke-width=".8"/>`
          : `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="rgba(103,6,38,.22)" stroke-width="1"/>`;
      }
      inner += t(W, y + 4, seen ? pct(ok, seen) + '%' : '—', 'val', 'end');
    });
    el.innerHTML = section('Calendário de hábitos', `dias ${start}–${end}`, `
      <div class="pager">
        <button class="icon-btn" data-p="-1" aria-label="15 dias anteriores" ${start <= 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <span>${A.fmtShort(A.keyOf(start))} — ${A.fmtShort(A.keyOf(end))}</span>
        <button class="icon-btn" data-p="1" aria-label="Próximos 15 dias" ${end >= pages * 15 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      ${svg(H, inner, 'habits')}
      <p class="mlegend"><span><i style="background:${C.green}"></i>feito</span><span><i class="ring"></i>não feito</span><span class="muted">Doce: dentro do limite · Conteúdo: criado no dia</span></p>`);
    el.querySelector('.pager').addEventListener('click', (e) => {
      const b = e.target.closest('[data-p]');
      if (!b || b.disabled) return;
      habitEnd += 15 * Number(b.dataset.p);
      habits(el, L);
    });
  }

  // 5. Horário de acordar
  function wake(el, L) {
    const H = 170, l = 40, r = 10, top = 12, b = 24;
    const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const lim = toMin(A.WAKE_LIMIT);
    const data = [];
    for (let i = 1; i <= L; i++) { const w = A.rec(A.keyOf(i)).acordar; if (w) data.push({ d: i, m: toMin(w), s: w }); }
    const lo = Math.min(270, ...data.map((p) => Math.floor((p.m - 10) / 30) * 30));
    const hi = Math.max(420, ...data.map((p) => Math.ceil((p.m + 10) / 30) * 30));
    const xmax = Math.max(L, 2);
    const X = (d) => l + ((d - 1) / (xmax - 1)) * (W - l - r);
    const Y = (m) => top + ((m - lo) / (hi - lo)) * (H - top - b); // mais cedo em cima
    const hh = (m) => `${A.pad(Math.floor(m / 60))}:${A.pad(m % 60)}`;
    const yt = [];
    for (let m = lo; m <= hi; m += 30) yt.push(m);
    const inside = data.filter((p) => p.m <= lim).length;
    const step = niceStep(L);
    let ticks = '';
    for (let d = 1; d <= L; d += (d === 1 && step > 1 ? step - 1 : step)) ticks += t(X(d), H - 7, d);
    const inner = `
      <rect x="${l}" y="${Y(lo)}" width="${W - l - r}" height="${Y(lim) - Y(lo)}" fill="${C.green}" fill-opacity=".32" rx="4"/>
      ${yt.map((m) => `<line x1="${l}" x2="${W - r}" y1="${Y(m)}" y2="${Y(m)}" class="grid"/>${t(l - 6, Y(m) + 3, hh(m), 'ax', 'end')}`).join('')}
      <line x1="${l}" x2="${W - r}" y1="${Y(lim)}" y2="${Y(lim)}" stroke="${C.olive}" stroke-opacity=".5" stroke-width="1"/>
      ${t(l - 6, Y(lim) + 3, A.WAKE_LIMIT, 'ax olive strong', 'end')}
      ${data.map((p) => `<circle cx="${X(p.d)}" cy="${Y(p.m)}" r="4.5" fill="${p.m <= lim ? C.green : C.burg}" stroke="${p.m <= lim ? C.olive : C.surface}" stroke-width="${p.m <= lim ? 1 : 1.5}"/>`).join('')}
      <g class="guide" style="display:none"><line y1="${top}" y2="${H - b}" class="gline"/></g>
      ${ticks}`;
    el.innerHTML = section('Horário de acordar', `meta até ${A.WAKE_LIMIT}`, `
      <p class="readout"><b>${inside}</b> de ${L} ${L === 1 ? 'dia' : 'dias'} dentro da meta</p>
      ${svg(H, inner)}
      <p class="mlegend"><span><i style="background:${C.green}"></i>até ${A.WAKE_LIMIT}</span><span><i style="background:${C.burg}"></i>depois</span></p>`);
    scrub(el, (x) => Math.min(L, Math.max(1, Math.round(((x - l) / (W - l - r)) * (xmax - 1)) + 1)), (d) => {
      const g = el.querySelector('.guide');
      g.style.display = '';
      g.querySelector('line').setAttribute('x1', X(d)); g.querySelector('line').setAttribute('x2', X(d));
      const w = A.rec(A.keyOf(d)).acordar;
      el.querySelector('.readout').innerHTML = `<b>Dia ${d}</b> · ${A.fmtShort(A.keyOf(d))} · ${w ? `acordou às <b>${w}</b>` : 'sem registro'}`;
    });
  }

  // 6. Doce e conteúdo por semana
  function weekly(el, L) {
    const ws = A.weeks(L);
    const lim = A.task('doce').limit, goal = A.task('conteudo').goal;
    const over = ws.some((w) => w.doce > lim);
    const extra = ws.reduce((s, w) => s + Math.max(0, w.conteudo - goal), 0);
    const box = (field, ref, kind) => {
      const H = 120, l = 18, r = 6, top = 14, b = 20;
      const max = Math.max(ref + 1, ...ws.map((w) => w[field]));
      const band = (W - l - r) / Math.max(ws.length, 6);
      const bw = Math.min(22, band * 0.55);
      const Y = (v) => top + (1 - v / max) * (H - top - b);
      let inner = '';
      for (let v = 0; v <= max; v++) inner += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>${t(l - 5, Y(v) + 3, v, 'ax', 'end')}`;
      ws.forEach((w, i) => {
        const v = w[field];
        const x = l + band * i + band / 2;
        let fill = kind === 'doce' ? A.META_COLOR.doce : A.META_COLOR.conteudo;
        if (kind === 'doce' && v > ref) fill = C.burg;
        if (kind === 'conteudo' && v > ref) fill = C.green;
        if (v > 0) {
          const y = Y(v), h = Y(0) - y;
          inner += `<path d="M${x - bw / 2},${Y(0)} V${y + 4} a4,4 0 0 1 4,-4 H${x + bw / 2 - 4} a4,4 0 0 1 4,4 V${Y(0)} Z" fill="${fill}" ${kind === 'conteudo' && v > ref ? `stroke="${C.olive}" stroke-opacity=".4"` : ''}/>`;
          if (kind === 'conteudo' && v > ref) inner += t(x, y - 4, '+' + (v - ref), 'ax olive strong');
          else if (h > 0) inner += t(x, y - 4, v, 'ax');
        }
        inner += t(x, H - 6, 'S' + (i + 1), 'ax');
      });
      inner += `<line x1="${l}" x2="${W - r}" y1="${Y(ref)}" y2="${Y(ref)}" stroke="${kind === 'doce' ? C.burg : C.olive}" stroke-width="1.2" stroke-dasharray="4 4" stroke-opacity=".7"/>`;
      return svg(H, inner);
    };
    el.innerHTML = section('Doce e conteúdo por semana', 'seg a dom', `
      <div class="wbox ${over ? 'attention' : ''}">
        <div class="wbox-head"><b>${A.esc(name('doce'))}</b><span>limite ${lim} por semana</span>${over ? '<em class="badge low">ponto de atenção</em>' : ''}</div>
        ${box('doce', lim, 'doce')}
      </div>
      <div class="wbox ${extra ? 'highlight' : ''}">
        <div class="wbox-head"><b>${A.esc(name('conteudo'))}</b><span>meta ${goal} por semana</span>${extra ? `<em class="badge good">destaque +${extra}</em>` : ''}</div>
        ${box('conteudo', goal, 'conteudo')}
      </div>
      <p class="mlegend"><span><i class="dash"></i>limite / meta</span><span class="muted">S1 = semana de ${A.fmtShort(ws[0].start)}</span></p>`);
  }

  // 7. Metas × Dias (acumulado)
  function metas(el, L) {
    const X0 = span === '75' ? A.TOTAL : Math.max(L, 2);
    const H = 240, l = 30, r = 12, top = 12, b = 26;
    const ids = A.META_ORDER.filter((id) => A.isActive(id));
    const cum = {};
    ids.forEach((id) => {
      let s = 0;
      cum[id] = [0];
      for (let i = 1; i <= L; i++) { s += A.metaValue(A.keyOf(i), id); cum[id].push(s); }
    });
    const ymax = Math.max(X0, ...ids.map((id) => cum[id][L]));
    const X = (d) => l + (d / X0) * (W - l - r);
    const Y = (v) => top + (1 - v / ymax) * (H - top - b);
    const step = niceStep(X0);
    if (metaSel == null || metaSel > L) metaSel = L;
    let grid = '';
    for (let v = 0; v <= ymax; v += step) grid += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>${t(l - 6, Y(v) + 3, v, 'ax', 'end')}`;
    for (let d = step; d <= X0; d += step) grid += t(X(d), H - 8, d);
    const lines = ids.filter((id) => !hidden.has(id)).map((id) =>
      `<polyline points="${cum[id].map((v, d) => `${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${A.META_COLOR[id]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
    const inner = `${grid}
      <line x1="${X(0)}" y1="${Y(0)}" x2="${X(X0)}" y2="${Y(X0)}" stroke="${C.green}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="${X(L)}" x2="${X(L)}" y1="${top}" y2="${H - b}" class="today"/>
      ${t(X(L) + (X(L) > W - 40 ? -4 : 4), top + 8, 'hoje', 'ax burg', X(L) > W - 40 ? 'end' : 'start')}
      ${lines}
      <g class="guide"><line x1="${X(metaSel)}" x2="${X(metaSel)}" y1="${top}" y2="${H - b}" class="gline"/></g>`;
    el.innerHTML = section('Metas × Dias', 'acumulado', `
      <div class="seg seg-sm" role="tablist">
        <button role="tab" data-s="hoje" aria-selected="${span === 'hoje'}">Até hoje</button>
        <button role="tab" data-s="75" aria-selected="${span === '75'}">75 dias</button>
      </div>
      <p class="readout"><b>Dia ${metaSel}</b> · ideal ${metaSel}</p>
      ${svg(H, inner, 'metas')}
      <div class="mchips">
        ${ids.map((id) => `<button class="mchip ${hidden.has(id) ? 'off' : ''}" data-id="${id}" aria-pressed="${!hidden.has(id)}">
          <i style="background:${A.META_COLOR[id]}"></i>${A.esc(name(id))}<b>${cum[id][metaSel]}</b></button>`).join('')}
      </div>
      <p class="mlegend"><span><i class="ideal"></i>ideal (1 por dia)</span><span class="muted">Doce: dias dentro do limite · Conteúdo: criados</span></p>`);
    el.querySelector('.seg').addEventListener('click', (e) => {
      const bt = e.target.closest('[data-s]');
      if (!bt) return;
      span = bt.dataset.s;
      metas(el, L);
    });
    el.querySelector('.mchips').addEventListener('click', (e) => {
      const bt = e.target.closest('.mchip');
      if (!bt) return;
      const id = bt.dataset.id;
      hidden.has(id) ? hidden.delete(id) : hidden.add(id);
      metas(el, L);
    });
    scrub(el, (x) => Math.min(L, Math.max(0, Math.round(((x - l) / (W - l - r)) * X0))), (d) => {
      if (d === metaSel) return;
      metaSel = d;
      el.querySelector('.gline').setAttribute('x1', X(d));
      el.querySelector('.gline').setAttribute('x2', X(d));
      el.querySelector('.readout').innerHTML = `<b>Dia ${d}</b> · ideal ${d}`;
      el.querySelectorAll('.mchip').forEach((bt) => (bt.querySelector('b').textContent = cum[bt.dataset.id][d]));
    });
  }

  // 8. Relatórios a cada 5 dias
  function reports(el) {
    const list = A.state.reports.slice().sort((a, b) => b.day - a.day);
    if (!list.length) {
      el.innerHTML = section('Relatórios', 'a cada 5 dias', `<p class="hint">O primeiro relatório sai ao fim do dia 5 (${A.fmtShort(A.keyOf(5))}). Depois, a cada 5 dias, um novo retrato acumulado fica salvo aqui.</p>`);
      return;
    }
    el.innerHTML = section('Relatórios', `${list.length} ${list.length === 1 ? 'salvo' : 'salvos'}`, list.map((r, i) => {
      const prev = A.state.reports.find((p) => p.day === r.day - 5);
      const ids = A.REPORT_TASKS.filter((id) => (r.active || A.REPORT_TASKS).includes(id));
      const rows = ids.map((id) => ({ id, n: r.counts[id] || 0 })).sort((a, b) => b.n - a.n);
      const diff = prev ? Object.fromEntries(ids.map((id) => [id, (r.counts[id] || 0) - (prev.counts[id] || 0)])) : null;
      return `<details class="report" ${i === 0 ? 'open' : ''}>
        <summary>
          <span class="rp-day">Dia ${r.day}</span>
          <span class="rp-date">${A.fmtLong(r.key)}${i === 0 ? ' · <em>atual</em>' : ''}</span>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </summary>
        <div class="rp-body">
          ${barList(rows, r.day, { diff })}
          ${diff ? '<p class="hint rp-note">Entre parênteses: quanto cada tarefa cresceu desde o relatório anterior.</p>' : ''}
          ${i === 0 ? `
            <div class="rp-boxes">
              <div class="rp-box ${r.attention ? 'attention' : ''}"><em class="badge low">ponto de atenção</em>
                <p>${r.attention ? `<b>${r.attention}</b> ${r.attention === 1 ? 'doce' : 'doces'} acima do limite semanal` : 'Nenhum doce acima do limite.'}</p></div>
              <div class="rp-box ${r.extras ? 'highlight' : ''}"><em class="badge good">destaque</em>
                <p>${r.extras ? `<b>${r.extras}</b> ${r.extras === 1 ? 'conteúdo extra' : 'conteúdos extras'} além da meta` : 'Sem conteúdos extras ainda.'} · ${r.counts.conteudo || 0} no total</p></div>
            </div>` : ''}
        </div>
      </details>`;
    }).join(''));
  }

  A.views.metricas = { render, changed() { A.rerender(); } };
})();
