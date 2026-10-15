// Tela de conclusão do dia + cartão de progresso salvo como imagem.
(function () {
  const A = window.A;

  const faltamTxt = (n) => { const f = 76 - n; return f === 1 ? 'falta 1 dia' : `faltam ${f} dias`; };

  A.checkCelebrate = (k) => {
    if (k !== A.todayKey() || !A.dayComplete(k)) return;
    if (A.state.celebrated[k]) return;
    A.state.celebrated[k] = true;
    A.save();
    setTimeout(() => A.celebrate(k), 350);
  };

  A.celebrate = async (k) => {
    if (document.querySelector('.celebrate')) return;
    A.sheet.close(true);
    const n = A.dayNum(k);
    const reg = A.rec(k).registro || {};
    const url = reg.foto ? await A.photos.url(k) : null;
    const ov = A.el(`
      <div class="celebrate" role="dialog" aria-modal="true" aria-label="Dia concluído">
        <div class="glow" aria-hidden="true"></div>
        <div class="cel-inner">
          <p class="kicker cel-k">${A.ast()} Dia concluído</p>
          <article class="card">
            <p class="card-brand"><span class="fio"></span>Antecipando 2027<span class="fio r"></span></p>
            <p class="card-day">Dia ${n}</p>
            <p class="kicker card-sub">de ${A.TOTAL} · ${A.fmtLong(k)}</p>
            <div class="card-photo">
              ${A.felpa()}
              <div class="card-img">${url ? `<img src="${url}" alt="Foto do dia ${n}" />` : `<div class="empty">${A.ast()}${reg.note ? `<span>${A.esc(reg.note)}</span>` : ''}</div>`}</div>
            </div>
            <p class="kicker card-left">${faltamTxt(n)}</p>
            <p class="card-sign">Lara</p>
          </article>
          <div class="cel-actions">
            <button class="btn primary" data-a="save">Salvar imagem</button>
            <button class="btn ghost" data-a="close">Fechar</button>
          </div>
        </div>
      </div>`);
    ov.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'close') { ov.classList.remove('open'); setTimeout(() => ov.remove(), 320); }
      if (a.dataset.a === 'save') {
        a.disabled = true; a.textContent = 'Gerando…';
        try { await saveCard(k); } catch (err) { console.warn(err); A.toast('Não foi possível gerar a imagem'); }
        a.disabled = false; a.textContent = 'Salvar imagem';
      }
    });
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    A.vibrate([20, 40, 20]);
  };

  // ---------- Imagem do cartão (canvas 1080 × 1350) ----------
  const C = { burg: '#670626', cotton: '#FFD7E7', surface: '#FFFDF8', olive: '#2F4A2C', green: '#98FB98', text: '#2A1C1F' };

  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
  }

  function felpaImg(w, h) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <filter id="f" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="7" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <filter id="g" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      <rect x="22" y="22" width="${w - 44}" height="${h - 44}" rx="60" fill="${C.cotton}" opacity=".55" filter="url(#g)"/>
      <rect x="40" y="40" width="${w - 80}" height="${h - 80}" rx="52" fill="${C.cotton}" filter="url(#f)"/>
    </svg>`;
    return loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }

  function spaced(ctx, text, x, y, sp) {
    // texto centralizado com espaçamento entre letras
    const chars = [...text];
    const w = chars.reduce((s, ch) => s + ctx.measureText(ch).width, 0) + sp * (chars.length - 1);
    let cx = x - w / 2;
    ctx.textAlign = 'left';
    for (const ch of chars) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
    ctx.textAlign = 'center';
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function asterisk(ctx, cx, cy, r, color, lw) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 4) * i;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.restore();
  }

  async function drawCard(k) {
    await Promise.all([
      document.fonts.load('700 120px Gloock'),
      document.fonts.load('600 30px Figtree'),
      document.fonts.load('110px "Mrs Saint Delafield"'),
    ]).catch(() => {});
    const W = 1080, H = 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const n = A.dayNum(k);

    // fundo + listras verticais finas bordô e rosa
    ctx.fillStyle = C.surface; ctx.fillRect(0, 0, W, H);
    for (let x = 9, i = 0; x < W; x += 18, i++) {
      ctx.fillStyle = i % 2 ? 'rgba(103,6,38,.07)' : 'rgba(255,215,231,.95)';
      ctx.fillRect(x, 0, i % 2 ? 1.5 : 4, H);
    }
    // halo verde suave
    const g = ctx.createRadialGradient(W / 2, 700, 50, W / 2, 700, 620);
    g.addColorStop(0, 'rgba(152,251,152,.22)'); g.addColorStop(1, 'rgba(152,251,152,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // borda
    ctx.strokeStyle = 'rgba(103,6,38,.18)'; ctx.lineWidth = 2;
    rr(ctx, 30, 30, W - 60, H - 60, 44); ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.burg;
    ctx.font = '700 40px Gloock';
    ctx.fillText('Antecipando 2027', W / 2, 128);
    const tw = ctx.measureText('Antecipando 2027').width;
    const lg = (x1, x2) => { const gr = ctx.createLinearGradient(x1, 0, x2, 0); return gr; };
    let gl = lg(W / 2 - tw / 2 - 150, W / 2 - tw / 2 - 24); gl.addColorStop(0, 'rgba(103,6,38,0)'); gl.addColorStop(1, 'rgba(103,6,38,.5)');
    ctx.fillStyle = gl; ctx.fillRect(W / 2 - tw / 2 - 150, 114, 126, 2);
    gl = lg(W / 2 + tw / 2 + 24, W / 2 + tw / 2 + 150); gl.addColorStop(0, 'rgba(103,6,38,.5)'); gl.addColorStop(1, 'rgba(103,6,38,0)');
    ctx.fillStyle = gl; ctx.fillRect(W / 2 + tw / 2 + 24, 114, 126, 2);

    ctx.fillStyle = C.burg;
    ctx.font = '700 130px Gloock';
    ctx.fillText(`Dia ${n}`, W / 2, 280);
    ctx.font = '600 26px Figtree';
    ctx.fillStyle = 'rgba(103,6,38,.6)';
    spaced(ctx, `DE ${A.TOTAL} · ${A.fmtLong(k).toUpperCase()}`, W / 2, 334, 5);

    // foto com moldura felpuda
    const px = 270, py = 400, pw = 540, ph = 640;
    try { ctx.drawImage(await felpaImg(pw + 140, ph + 140), px - 70, py - 70); }
    catch (e) { ctx.fillStyle = C.cotton; rr(ctx, px - 30, py - 30, pw + 60, ph + 60, 50); ctx.fill(); }
    ctx.save();
    rr(ctx, px, py, pw, ph, 30); ctx.clip();
    const reg = A.rec(k).registro || {};
    const blob = reg.foto ? await A.photos.get(k).catch(() => null) : null;
    if (blob) {
      const u = URL.createObjectURL(blob);
      const img = await loadImg(u);
      const s = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
      const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      ctx.drawImage(img, px + (pw - iw) / 2, py + (ph - ih) / 2, iw, ih);
      URL.revokeObjectURL(u);
    } else {
      ctx.fillStyle = C.surface; ctx.fillRect(px, py, pw, ph);
      asterisk(ctx, W / 2, py + ph / 2 - (reg.note ? 40 : 0), 46, 'rgba(103,6,38,.35)', 3);
      if (reg.note) {
        ctx.fillStyle = C.text; ctx.font = '400 30px Figtree';
        wrap(ctx, reg.note, W / 2, py + ph / 2 + 60, pw - 80, 40);
      }
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(103,6,38,.7)';
    ctx.font = '600 28px Figtree';
    spaced(ctx, faltamTxt(n).toUpperCase(), W / 2, 1162, 6);
    asterisk(ctx, W / 2, 1112, 10, C.olive, 2);
    ctx.fillStyle = C.burg;
    ctx.font = '120px "Mrs Saint Delafield"';
    ctx.fillText('Lara', W / 2, 1270);
    return cv;
  }

  function wrap(ctx, text, x, y, maxW, lh) {
    const words = text.split(/\s+/);
    let line = '', lines = [];
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  }

  async function saveCard(k) {
    const cv = await drawCard(k);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const name = `antecipando-2027-dia-${A.pad(A.dayNum(k))}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Antecipando 2027' }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  A.drawCard = drawCard;
})();
