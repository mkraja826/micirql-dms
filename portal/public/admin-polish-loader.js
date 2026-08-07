(() => {
  const href = '/portal/admin-polish.css?v=20260807-ui2';
  if (document.querySelector(`link[data-capdent-polish="ui2"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.capdentPolish = 'ui2';
  document.head.appendChild(link);
})();
