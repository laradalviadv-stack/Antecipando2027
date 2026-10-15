// Aba Registro: galeria de fotos e comparação lado a lado.
(function () {
  const A = window.A;
  let mode = 'galeria';
  let cmpA = null, cmpB = null;

  const lastDay = () => Math.min(Math.max(A.todayNum(), 0), A.TOTAL);
  const hasPhoto = (k) => !!(A.rec(k).registro && A.rec(k).registro.foto);
  const photoDays = () => {
    const l = [];
    for (let i = 1; i <= lastDay(); i++) if (hasPhoto(A.keyOf(i))) l.push(A.keyOf(i));
    return l;
  };

  function render(c) {
    const photos = photoDays();
    c.innerHTML = `
      <header class="page-head">
        <h1 class="page-title">Registro</h1>
        <p class="kicker">${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}</p>
      </header>
      <div class="seg" role="tablist">
        <button role="tab" data-m="galeria" aria-selected="${mode === 'galeria'}">Galeria</button>
        <button role="tab" data-m="comparar" aria-selected="${mode === 'comparar'}">Comparar</button>
      </div>
      <div class="reg-body"></div>`;
    c.querySelector('.seg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m;
      render(c);
    });
    const body = c.querySelector('.reg-body');
    if (mode === 'galeria') gallery(body);
    else compare(body, photos);
  }

  // ---------- Galeria ----------
  function gallery(body) {
    const n = lastDay();
    if (n < 1) {
      body.innerHTML = `<div class="soon">${A.ast()}<p>As fotos aparecem aqui a partir de 15 de outubro.</p></div>`;
      return;
    }
    const today = A.todayKey();
    const keys = [];
    for (let i = n; i >= 1; i--) keys.push(A.keyOf(i));
    body.innerHTML = `<div class="grid3">${keys.map((k) => `
      <button class="tile ${k === today ? 'is-today' : ''} ${hasPhoto(k) ? 'has' : ''}" data-k="${k}" aria-label="Dia ${A.dayNum(k)}, ${A.fmtLong(k)}">
        <span class="tile-img">${hasPhoto(k) ? '' : A.ast()}</span>
        <span class="tile-cap"><b>${A.dayNum(k)}</b><small>${A.fmtShort(k)}</small></span>
      </button>`).join('')}</div>`;
    body.querySelectorAll('.tile.has').forEach((t) => {
      A.photos.url(t.dataset.k).then((u) => { if (u) t.querySelector('.tile-img').innerHTML = `<img src="${u}" alt="" loading="lazy" />`; });
    });
    body.querySelector('.grid3').addEventListener('click', (e) => {
      const t = e.target.closest('.tile');
      if (t) A.tapTask(t.dataset.k, 'registro');
    });
  }

  // ---------- Comparar ----------
  function compare(body, photos) {
    if (!photos.includes(cmpA)) cmpA = photos[0] || null;
    if (!photos.includes(cmpB)) cmpB = photos[photos.length - 1] || null;
    if (cmpA && cmpB && cmpA > cmpB) [cmpA, cmpB] = [cmpB, cmpA];

    const n = lastDay();
    const today = A.todayKey();
    // dias já vividos sem foto (hoje só conta se já tiver foto)
    const lived = n - (A.inChallenge(today) && !hasPhoto(today) ? 1 : 0);
    const semFoto = Math.max(0, lived - photos.length);
    const diff = cmpA && cmpB ? A.dayNum(cmpB) - A.dayNum(cmpA) : 0;

    const frame = (k, label) => `
      <figure class="cmp-f">
        <div class="cmp-img" data-k="${k || ''}">${k ? '' : `<div class="empty">${A.ast()}</div>`}</div>
        <figcaption><b>${k ? 'Dia ' + A.dayNum(k) : label}</b><small>${k ? A.fmtShort(k) : 'sem foto'}</small></figcaption>
      </figure>`;
    const chips = (cur, which) => photos.length
      ? photos.map((k) => `<button class="chipbtn ${k === cur ? 'on' : ''}" data-w="${which}" data-k="${k}">Dia ${A.dayNum(k)}</button>`).join('')
      : '<span class="hint">Nenhuma foto ainda.</span>';

    body.innerHTML = `
      <div class="cmp">
        ${frame(cmpA, 'Antes')}
        <span class="cmp-ast">${A.ast()}</span>
        ${frame(cmpB, 'Depois')}
      </div>
      ${photos.length < 2 ? '<p class="hint center cmp-hint">Com duas fotos ou mais, dá para comparar a evolução.</p>' : ''}
      <div class="pick">
        <p class="kicker">Antes</p>
        <div class="chips">${chips(cmpA, 'a')}</div>
        <p class="kicker">Depois</p>
        <div class="chips">${chips(cmpB, 'b')}</div>
      </div>
      <div class="mini">
        <div><b>${diff}</b><span>dias de diferença</span></div>
        <div><b>${photos.length}</b><span>fotos no total</span></div>
        <div><b>${semFoto}</b><span>dias sem foto</span></div>
      </div>`;

    body.querySelectorAll('.cmp-img[data-k]').forEach((el) => {
      const k = el.dataset.k;
      if (k) A.photos.url(k).then((u) => { if (u) el.innerHTML = `<img src="${u}" alt="Foto do dia ${A.dayNum(k)}" />`; });
    });
    body.querySelector('.pick').addEventListener('click', (e) => {
      const b = e.target.closest('.chipbtn');
      if (!b) return;
      if (b.dataset.w === 'a') cmpA = b.dataset.k; else cmpB = b.dataset.k;
      compare(body, photos);
    });
    // mantém o chip escolhido visível
    body.querySelectorAll('.chips').forEach((ch) => {
      const on = ch.querySelector('.on');
      if (on) ch.scrollLeft = on.offsetLeft - ch.clientWidth / 2 + on.clientWidth / 2;
    });
  }

  A.views.registro = { render, changed() { A.rerender(); } };
})();
