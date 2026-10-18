/* Aplica a preferência antes do conteúdo; sem preferência, abre no Grimório. */
(function () {
  var saved = null;
  try { saved = localStorage.getItem('circulos-tema'); } catch (_) { /* armazenamento opcional */ }
  var theme = saved === 'pergaminho' || saved === 'caderno' ? 'pergaminho' : saved === 'pauta' ? 'pauta' : 'grimorio';
  document.documentElement.dataset.theme = theme;
  document.body.classList.toggle('theme-sketch', theme !== 'grimorio');
  document.body.classList.toggle('theme-pauta', theme === 'pauta');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'grimorio' ? '#081426' : '#493222');
}());
