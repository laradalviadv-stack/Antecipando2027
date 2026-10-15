// Núcleo: constantes do desafio, datas, armazenamento e regras.
(function () {
  const A = (window.A = window.A || {});

  // ---------- Desafio (fixo) ----------
  A.START = '2026-10-15'; // quinta-feira, dia 1
  A.END = '2026-12-28';   // dia 75
  A.TOTAL = 75;
  A.TZ = 'America/Sao_Paulo';
  A.WAKE_LIMIT = '05:15';

  // Ordem = ordem dos círculos na aba Hoje. core = conta para as 7 tarefas do desafio.
  A.TASKS = [
    { id: 'acordar', name: '5h', kind: 'wake', core: true },
    { id: 'devocional', name: 'Devocional', kind: 'check', core: true },
    { id: 'ovo', name: 'Ovo', kind: 'check', core: true },
    { id: 'treino', name: 'Treino', kind: 'timer', minutes: 40, core: true },
    { id: 'estudo', name: 'Estudo', kind: 'timer', minutes: 30, core: true },
    { id: 'leitura', name: 'Leitura', kind: 'check', core: true },
    { id: 'registro', name: 'Registro', kind: 'photo', core: true },
    { id: 'doce', name: 'Doce', kind: 'sweet', core: false, limit: 2 },
    { id: 'conteudo', name: 'Conteúdo', kind: 'content', core: false, goal: 1 },
  ];
  A.task = (id) => A.TASKS.find((t) => t.id === id);

  // ---------- Modo teste: ?data=AAAA-MM-DD simula o dia (dados separados) ----------
  const params = new URLSearchParams(location.search);
  const sim = params.get('data');
  A.SIM = /^\d{4}-\d{2}-\d{2}$/.test(sim || '') ? sim : null;

  // ---------- Datas (chaves 'AAAA-MM-DD', aritmética em UTC para não sofrer com fuso) ----------
  const pad = (n) => String(n).padStart(2, '0');
  A.pad = pad;

  function partsNow() {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone: A.TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const o = {};
    for (const p of f.formatToParts(new Date())) o[p.type] = p.value;
    return o;
  }
  A.todayKey = () => {
    if (A.SIM) return A.SIM;
    const p = partsNow();
    return `${p.year}-${p.month}-${p.day}`;
  };
  A.nowHM = () => {
    const p = partsNow();
    return `${pad(+p.hour % 24)}:${p.minute}`;
  };

  const toUTC = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const fromUTC = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  A.addDays = (k, n) => fromUTC(toUTC(k) + n * 86400000);
  A.diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
  A.weekday = (k) => new Date(toUTC(k)).getUTCDay(); // 0 = domingo
  A.weekStart = (k) => A.addDays(k, -((A.weekday(k) + 6) % 7)); // segunda
  A.dayNum = (k) => A.diffDays(A.START, k) + 1;
  A.keyOf = (n) => A.addDays(A.START, n - 1);
  A.inChallenge = (k) => { const n = A.dayNum(k); return n >= 1 && n <= A.TOTAL; };

  A.WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  A.MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const dd = (k) => +k.slice(8, 10);
  const mm = (k) => +k.slice(5, 7);
  A.fmtBig = (k) => `${dd(k)}, ${A.WD[A.weekday(k)]}`;                   // "15, quinta"
  A.fmtShort = (k) => `${dd(k)} ${A.MES[mm(k) - 1]}`;                     // "15 out"
  A.fmtLong = (k) => `${A.fmtShort(k)}, ${A.WD[A.weekday(k)]}`;          // "15 out, quinta"

  // Dia do desafio "efetivo" para hoje (limitado a 1..75) e contagem regressiva.
  A.todayNum = () => A.dayNum(A.todayKey());
  A.faltam = () => {
    const n = A.todayNum();
    if (n < 1) return A.TOTAL;
    if (n > A.TOTAL) return 0;
    return 76 - n;
  };

  // ---------- Armazenamento (localStorage) ----------
  A.NS = A.SIM ? 'antecipando2027:teste' : 'antecipando2027';

  function defaults() {
    const tasks = {};
    A.TASKS.forEach((t) => (tasks[t.id] = { name: t.name, active: true }));
    return { v: 1, tasks, days: {}, reports: [], celebrated: {} };
  }
  function load() {
    try {
      const raw = localStorage.getItem(A.NS);
      if (!raw) return defaults();
      const s = JSON.parse(raw);
      const d = defaults();
      s.tasks = Object.assign(d.tasks, s.tasks || {});
      s.days = s.days || {};
      s.reports = s.reports || [];
      s.celebrated = s.celebrated || {};
      return s;
    } catch (e) {
      console.warn('Falha ao ler dados', e);
      return defaults();
    }
  }
  A.state = load();
  A.save = () => {
    try { localStorage.setItem(A.NS, JSON.stringify(A.state)); }
    catch (e) { console.warn('Falha ao salvar', e); }
  };
  A.resetState = () => { A.state = defaults(); A.save(); };

  A.rec = (k) => A.state.days[k] || {};
  A.recW = (k) => (A.state.days[k] = A.state.days[k] || {});
  A.taskName = (id) => (A.state.tasks[id] && A.state.tasks[id].name) || A.task(id).name;
  A.isActive = (id) => !A.state.tasks[id] || A.state.tasks[id].active !== false;
  A.activeTasks = () => A.TASKS.filter((t) => A.isActive(t.id));
  A.coreTasks = () => A.TASKS.filter((t) => t.core && A.isActive(t.id));

  // ---------- Cronômetros ----------
  A.timerElapsed = (k, id) => {
    const t = A.rec(k)[id];
    if (!t) return 0;
    return (t.acc || 0) + (t.run ? (Date.now() - t.run) / 1000 : 0);
  };
  A.timerTarget = (id) => A.task(id).minutes * 60;

  // ---------- Doce e conteúdo (semana de segunda a domingo) ----------
  A.weekSum = (k, field) => {
    let s = 0;
    for (let d = A.weekStart(k); d <= k; d = A.addDays(d, 1)) s += A.rec(d)[field] || 0;
    return s;
  };
  // Dia "estoura" o limite se nele foi comido um doce além do 2º da semana.
  A.sweetOver = (k) => {
    if (!A.isActive('doce')) return false;
    const today = A.rec(k).doce || 0;
    return today > 0 && A.weekSum(k, 'doce') > A.task('doce').limit;
  };
  A.weekSweetOver = (k) => A.isActive('doce') && A.weekSum(k, 'doce') > A.task('doce').limit;

  // ---------- Regras ----------
  A.taskDone = (k, id) => {
    const r = A.rec(k);
    switch (A.task(id).kind) {
      case 'wake': return !!r.acordar && r.acordar <= A.WAKE_LIMIT;
      case 'check': return !!r[id];
      case 'timer': return !!(r[id] && r[id].done);
      case 'photo': return !!(r.registro && (r.registro.foto || (r.registro.note || '').trim()));
      case 'sweet': return !A.sweetOver(k);
      case 'content': return A.weekSum(k, 'conteudo') >= A.task('conteudo').goal;
    }
    return false;
  };
  A.coreDone = (k) => A.coreTasks().filter((t) => A.taskDone(k, t.id)).length;
  A.coreTotal = () => A.coreTasks().length;
  A.dayComplete = (k) => A.coreDone(k) === A.coreTotal() && !A.sweetOver(k);

  // 'feito' | 'perdido' | 'andamento' | 'futuro' | null (fora do desafio)
  A.status = (k) => {
    if (!A.inChallenge(k)) return null;
    const t = A.todayKey();
    if (k > t) return 'futuro';
    if (A.dayComplete(k)) return 'feito';
    if (k === t) return 'andamento';
    return 'perdido'; // dia terminou sem as tarefas: marcado automaticamente
  };
  A.daysDone = () => {
    let n = 0;
    for (let i = 1; i <= A.TOTAL; i++) if (A.status(A.keyOf(i)) === 'feito') n++;
    return n;
  };
  A.daysMissed = () => {
    let n = 0;
    for (let i = 1; i <= A.TOTAL; i++) if (A.status(A.keyOf(i)) === 'perdido') n++;
    return n;
  };

  // ---------- Métricas ----------
  // Ordem e cores das 9 metas (gráfico "Metas × Dias", relatórios)
  A.META_ORDER = ['devocional', 'ovo', 'registro', 'acordar', 'leitura', 'treino', 'estudo', 'doce', 'conteudo'];
  A.META_COLOR = {
    devocional: '#670626', ovo: '#D1739B', registro: '#A2AD61', acordar: '#2F4A2C', leitura: '#BD5D5E',
    treino: '#3FA65A', estudo: '#C9A96E', doce: '#C596A6', conteudo: '#8FB8A0',
  };
  // Dias já iniciados do desafio (inclui hoje), de 0 a 75
  A.elapsed = () => Math.min(Math.max(A.todayNum(), 0), A.TOTAL);
  // Valor diário de cada meta: 1/0 para tarefas; Doce = dentro do limite; Conteúdo = quantos criados
  A.metaValue = (k, id) => {
    if (id === 'doce') return A.sweetOver(k) ? 0 : 1;
    if (id === 'conteudo') return A.rec(k).conteudo || 0;
    return A.taskDone(k, id) ? 1 : 0;
  };
  // Semanas (seg–dom) do desafio até o dia `upto`, com somas de doce e conteúdo
  A.weeks = (upto) => {
    const last = A.keyOf(upto);
    const out = [];
    for (let w = A.weekStart(A.START); w <= last; w = A.addDays(w, 7)) {
      let doce = 0, conteudo = 0;
      for (let i = 0; i < 7; i++) {
        const k = A.addDays(w, i);
        if (k < A.START || k > last) continue;
        doce += A.rec(k).doce || 0;
        conteudo += A.rec(k).conteudo || 0;
      }
      out.push({ start: w, end: A.addDays(w, 6), doce, conteudo });
    }
    return out;
  };
  A.streaks = () => {
    let cur = 0, best = 0;
    for (let i = 1; i <= A.elapsed(); i++) {
      const s = A.status(A.keyOf(i));
      if (s === 'feito') { cur++; best = Math.max(best, cur); }
      else if (s !== 'andamento') cur = 0; // hoje em andamento não quebra a sequência
    }
    return { cur, best };
  };

  // ---------- Relatórios a cada 5 dias (instantâneos acumulados, nunca sobrescritos) ----------
  A.REPORT_TASKS = ['acordar', 'devocional', 'ovo', 'treino', 'estudo', 'leitura', 'registro', 'doce'];
  function snapshot(d) {
    const counts = {};
    A.META_ORDER.forEach((id) => (counts[id] = 0));
    for (let i = 1; i <= d; i++) {
      const k = A.keyOf(i);
      A.META_ORDER.forEach((id) => (counts[id] += A.metaValue(k, id)));
    }
    const ws = A.weeks(d);
    const lim = A.task('doce').limit, goal = A.task('conteudo').goal;
    return {
      day: d, key: A.keyOf(d), at: new Date().toISOString(), counts,
      active: A.META_ORDER.filter((id) => A.isActive(id)),
      attention: ws.reduce((s, w) => s + Math.max(0, w.doce - lim), 0),
      extras: ws.reduce((s, w) => s + Math.max(0, w.conteudo - goal), 0),
    };
  }
  // Gera os relatórios dos dias múltiplos de 5 que já terminaram e ainda não existem.
  A.genReports = () => {
    const closed = Math.min(A.todayNum() - 1, A.TOTAL);
    let added = false;
    for (let d = 5; d <= closed; d += 5) {
      if (A.state.reports.some((r) => r.day === d)) continue;
      A.state.reports.push(snapshot(d));
      added = true;
    }
    if (added) { A.state.reports.sort((a, b) => a.day - b.day); A.save(); }
  };

  // Tarefas manuais (lista "Tarefas do dia")
  A.todos = (k) => A.rec(k).todos || [];
  A.todoStats = (k) => { const l = A.todos(k); return { done: l.filter((x) => x.d).length, total: l.length }; };

  // ---------- Fotos (IndexedDB) ----------
  const DB_NAME = A.SIM ? 'antecipando2027-teste' : 'antecipando2027';
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fotos');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then((d) => new Promise((res, rej) => {
      const t = d.transaction('fotos', mode);
      const req = fn(t.objectStore('fotos'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    }));
  }
  const urlCache = {};
  A.photos = {
    get: (k) => tx('readonly', (s) => s.get(k)),
    put: (k, blob) => { delete urlCache[k]; return tx('readwrite', (s) => s.put(blob, k)); },
    del: (k) => { delete urlCache[k]; return tx('readwrite', (s) => s.delete(k)); },
    keys: () => tx('readonly', (s) => s.getAllKeys()),
    clear: () => { Object.keys(urlCache).forEach((k) => delete urlCache[k]); return tx('readwrite', (s) => s.clear()); },
    url: async (k) => {
      if (urlCache[k]) return urlCache[k];
      const b = await A.photos.get(k).catch(() => null);
      if (!b) return null;
      return (urlCache[k] = URL.createObjectURL(b));
    },
  };

  // Reduz a foto (lado maior 1440px, JPEG) antes de guardar.
  A.shrinkImage = (file, max = 1440) => new Promise((res, rej) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * sc);
      c.height = Math.round(img.naturalHeight * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Imagem inválida')); };
    img.src = u;
  });
})();
