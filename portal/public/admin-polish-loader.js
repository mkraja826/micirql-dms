(() => {
  const href = '/portal/admin-polish.css?v=20260807-ui3';
  if (document.querySelector('link[data-capdent-polish="ui3"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.capdentPolish = 'ui3';
  document.head.appendChild(link);

  const accessibilityFix = document.createElement('style');
  accessibilityFix.dataset.capdentPolishFix = 'ui3';
  accessibilityFix.textContent = `
    @media (max-width:760px) {
      .admin-period-snapshot {
        display:grid !important;
        grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        overflow:visible !important;
        scroll-snap-type:none !important;
      }
      .admin-period-snapshot > div,
      .admin-period-snapshot > article {
        min-width:0 !important;
        width:auto !important;
      }
      .admin-period-snapshot > div {
        grid-column:1 / -1 !important;
      }
    }
  `;
  document.head.appendChild(accessibilityFix);
})();
