(() => {
  const MOBILE_QUERY = '(max-width: 760px)';
  let menuOpen = false;

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function closeMenu() {
    const menu = document.querySelector('.admin-mobile-account-menu');
    const trigger = document.querySelector('.admin-mobile-account-trigger');
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    menuOpen = false;
  }

  function openMenu() {
    const menu = document.querySelector('.admin-mobile-account-menu');
    const trigger = document.querySelector('.admin-mobile-account-trigger');
    if (!menu) return;
    menu.hidden = false;
    trigger?.setAttribute('aria-expanded', 'true');
    menuOpen = true;
  }

  function toggleMenu(event) {
    event.stopPropagation();
    menuOpen ? closeMenu() : openMenu();
  }

  function install() {
    if (!isMobile()) {
      closeMenu();
      return;
    }

    const topbar = document.querySelector('.admin-topbar');
    const user = document.querySelector('.admin-user');
    if (!topbar || !user || topbar.querySelector('.admin-mobile-account-wrap')) return;

    const profileName = user.querySelector('strong')?.textContent?.trim() || 'CapDent owner';
    const profileRole = user.querySelector('small')?.textContent?.trim() || 'Owner account';
    const avatarText = user.querySelector('.admin-avatar')?.textContent?.trim() || 'CD';
    const clinicName = document.querySelector('.admin-clinic strong')?.textContent?.trim() || 'Current clinic';

    const wrap = document.createElement('div');
    wrap.className = 'admin-mobile-account-wrap';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'admin-mobile-account-trigger';
    trigger.setAttribute('aria-label', 'Open account menu');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `<span class="admin-mobile-avatar" aria-hidden="true">${avatarText}</span><span class="admin-mobile-menu-caret" aria-hidden="true">⌄</span>`;
    trigger.addEventListener('click', toggleMenu);

    const menu = document.createElement('div');
    menu.className = 'admin-mobile-account-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <div class="admin-mobile-account-head">
        <span class="admin-mobile-avatar large" aria-hidden="true">${avatarText}</span>
        <div><strong>${profileName}</strong><small>${profileRole}</small></div>
      </div>
      <div class="admin-mobile-clinic-label"><span>Active clinic</span><strong>${clinicName}</strong></div>
      <button type="button" class="admin-mobile-settings" role="menuitem">Clinic settings</button>
      <button type="button" class="admin-mobile-signout" role="menuitem">Sign out</button>
    `;

    menu.querySelector('.admin-mobile-settings')?.addEventListener('click', () => {
      const settingsButton = Array.from(document.querySelectorAll('.admin-nav button')).find((button) =>
        button.textContent?.toLowerCase().includes('clinic settings')
      );
      settingsButton?.click();
      closeMenu();
    });

    menu.querySelector('.admin-mobile-signout')?.addEventListener('click', () => {
      const existingSignOut = document.querySelector('.admin-sidebar-footer button');
      if (existingSignOut) {
        closeMenu();
        existingSignOut.click();
      }
    });

    wrap.append(trigger, menu);
    user.replaceWith(wrap);
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.admin-mobile-account-wrap')) closeMenu();
  });

  window.addEventListener('resize', install, { passive: true });

  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  install();
})();