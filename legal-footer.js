(function () {
  'use strict';

  const CNPJ = '53.373.466/0001-07';
  const REQUIRED_LINKS = [
    { label: 'Política de Privacidade', href: 'privacidade.html' },
    { label: 'Termos de Uso', href: 'termos.html' },
    { label: 'Produtos Digitais', href: 'produtos-digitais.html' },
    { label: 'Acessibilidade', href: 'acessibilidade.html' },
    { label: 'Contato', href: 'index.html#contato' }
  ];

  function normalizeHref(anchor) {
    return anchor.getAttribute('href') || '';
  }

  function uniqueLinks(links) {
    const seen = new Set();
    return links.filter(function (link) {
      const key = link.href.trim();
      if (!key || key === '#' || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function makeLinks(links) {
    return links.map(function (link) {
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.textContent = link.label;
      if (/^https?:\/\//.test(link.href)) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      return anchor;
    });
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (typeof text === 'string') element.textContent = text;
    return element;
  }

  function fallbackCopy(value) {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  }

  function initializeFooter(footer, index) {
    const oldLinks = uniqueLinks(Array.from(footer.querySelectorAll('a')).map(function (anchor) {
      return { label: anchor.textContent.trim(), href: normalizeHref(anchor) };
    }));

    const requiredHrefs = new Set(REQUIRED_LINKS.map(function (link) { return link.href; }));
    const navigationLinks = oldLinks.filter(function (link) {
      return !requiredHrefs.has(link.href) && link.label;
    });

    const dialogId = 'rj-legal-dialog-' + index;
    footer.className = 'rj-footer';
    footer.replaceChildren();
    const footerInner = createElement('div', 'rj-footer__inner');
    footerInner.append(
      createElement('p', 'rj-footer__item', '© 2026 Renata Join'),
      createElement('p', 'rj-footer__item', 'Brasília • Brasil')
    );
    const trigger = createElement('button', 'rj-footer__legal-trigger', 'Informações legais');
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialogId);
    footerInner.append(trigger, createElement('p', 'rj-footer__item rj-footer__devotion', 'Ad Dei gloriam.'));
    footer.appendChild(footerInner);

    const dialog = createElement('div', 'rj-legal-dialog');
    dialog.className = 'rj-legal-dialog';
    dialog.id = dialogId;
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', dialogId + '-title');
    dialog.setAttribute('aria-describedby', dialogId + '-intro');
    const panel = createElement('div', 'rj-legal-dialog__panel');
    const closeButton = createElement('button', 'rj-legal-dialog__close', 'Fechar');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Fechar informações legais');
    const title = createElement('h2', 'rj-legal-dialog__title', 'Informações legais');
    title.id = dialogId + '-title';
    const intro = createElement('p', 'rj-legal-dialog__intro', 'Dados institucionais e caminhos importantes, reunidos de forma simples.');
    intro.id = dialogId + '-intro';

    const facts = createElement('dl', 'rj-legal-dialog__facts');
    const companyFact = createElement('div', 'rj-legal-dialog__fact');
    companyFact.append(createElement('dt', '', 'Empresa'), createElement('dd', '', 'Renata Gomes Araujo'));
    const cnpjFact = createElement('div', 'rj-legal-dialog__fact');
    const copyButton = createElement('button', 'rj-legal-dialog__copy', 'Copiar CNPJ');
    copyButton.type = 'button';
    const status = createElement('p', 'rj-legal-dialog__status');
    status.setAttribute('aria-live', 'polite');
    cnpjFact.append(createElement('dt', '', 'CNPJ'), createElement('dd', '', CNPJ), copyButton, status);
    facts.append(companyFact, cnpjFact);

    const institutionalNav = createElement('nav', 'rj-legal-dialog__links');
    institutionalNav.setAttribute('aria-label', 'Links institucionais');
    panel.append(
      closeButton,
      createElement('p', 'rj-legal-dialog__eyebrow', 'Transparência institucional'),
      title,
      intro,
      facts,
      createElement('p', 'rj-legal-dialog__links-title', 'Institucional'),
      institutionalNav
    );
    if (navigationLinks.length) {
      const secondary = createElement('div', 'rj-legal-dialog__secondary');
      const navigation = createElement('nav', 'rj-legal-dialog__links rj-legal-dialog__navigation');
      navigation.setAttribute('aria-label', 'Navegação preservada do rodapé');
      secondary.append(createElement('p', 'rj-legal-dialog__links-title', 'Navegação'), navigation);
      panel.appendChild(secondary);
    }
    dialog.appendChild(panel);

    document.body.appendChild(dialog);
    makeLinks(REQUIRED_LINKS).forEach(function (link) { institutionalNav.appendChild(link); });
    const navigation = dialog.querySelector('.rj-legal-dialog__navigation');
    if (navigation) makeLinks(navigationLinks).forEach(function (link) { navigation.appendChild(link); });

    function closeDialog() {
      dialog.classList.remove('is-open');
      dialog.hidden = true;
      document.body.classList.remove('rj-dialog-open');
      trigger.focus();
    }

    trigger.addEventListener('click', function () {
      dialog.hidden = false;
      document.body.classList.add('rj-dialog-open');
      window.requestAnimationFrame(function () { dialog.classList.add('is-open'); });
      closeButton.focus();
    });

    dialog.addEventListener('click', function (event) {
      if (event.target.closest('.rj-legal-dialog__close') || event.target === dialog) closeDialog();
    });
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll('button, a[href]')).filter(function (element) {
        return !element.hasAttribute('disabled');
      });
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    copyButton.addEventListener('click', async function () {
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(CNPJ);
          copied = true;
        } else {
          copied = fallbackCopy(CNPJ);
        }
      } catch (error) {
        copied = fallbackCopy(CNPJ);
      }
      status.textContent = copied ? 'CNPJ copiado.' : 'Não foi possível copiar. Selecione o número acima.';
    });
  }

  function removeFloatingButtons() {
    document.querySelectorAll('.home-fab, .back#back').forEach(function (element) { element.remove(); });
    document.querySelectorAll('a[aria-label="Voltar ao início"]').forEach(function (element) {
      if ((element.getAttribute('style') || '').includes('position:fixed')) element.remove();
    });
  }

  function addSkipLink() {
    const main = document.querySelector('main');
    if (!main || document.querySelector('.rj-skip-link')) return;
    if (!main.id) main.id = 'conteudo-principal';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    const link = document.createElement('a');
    link.className = 'rj-skip-link';
    link.href = '#' + main.id;
    link.textContent = 'Ir para o conteúdo';
    document.body.prepend(link);
  }

  function initialize() {
    addSkipLink();
    removeFloatingButtons();
    document.querySelectorAll('footer').forEach(initializeFooter);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
