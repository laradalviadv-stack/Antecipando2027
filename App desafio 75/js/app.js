// Inicialização: navegação, virada do dia, cronômetros e service worker.
(function () {
  const A = window.A;

  // Relatórios dos dias múltiplos de 5 já encerrados (inclui os que faltarem)
  A.genReports();

  // Qualquer alteração de dados passa por aqui
  A.onChange = (k) => {
    if (A.currentTab === 'hoje') A.refreshHoje();
    else { const v = A.views[A.currentTab]; if (v && v.changed) v.changed(k); }
    A.checkCelebrate(k);
  };

  A.buildNav();
  A.go((location.hash || '#hoje').slice(1));

  // Virada do dia (meia-noite em America/Sao_Paulo): redesenha a tela.
  let lastKey = A.todayKey();
  const checkDay = () => {
    const k = A.todayKey();
    if (k !== lastKey) {
      lastKey = k;
      A.sheet.close(true);
      A.genReports();
      A.rerender();
    }
  };
  setInterval(() => { A.tickTimers(); checkDay(); }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { A.tickTimers(); checkDay(); if (A.currentTab === 'hoje') A.refreshHoje(); }
  });

  // Offline
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e)));
  }
})();
