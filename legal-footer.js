(function () {
  'use strict';

  const CNPJ = '53.373.466/0001-07';
  const REQUIRED_LINKS = [
    { label: 'Política de Privacidade', href: 'privacidade.html' },
    { label: 'Termos de Uso', href: 'termos.html' },
    { label: 'Produtos Digitais', href: 'ferramentas.html' },
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
    footer.innerHTML = '';
    footer.innerHTML = '<div class="rj-footer__inner">' +
      '<p class="rj-footer__item">© 2026 Renata Join</p>' +
      '<p class="rj-footer__item">Brasília • Brasil</p>' +
      '<button class="rj-footer__legal-trigger" type="button" aria-haspopup="dialog" aria-controls="' + dialogId + '">Informações legais</button>' +
      '<p class="rj-footer__item rj-footer__devotion">Ad Dei gloriam.</p>' +
      '</div>';

    const trigger = footer.querySelector('.rj-footer__legal-trigger');
    const dialog = document.createElement('div');
    dialog.className = 'rj-legal-dialog';
    dialog.id = dialogId;
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', dialogId + '-title');
    dialog.setAttribute('aria-describedby', dialogId + '-intro');
    dialog.innerHTML = '<div class="rj-legal-dialog__panel">' +
      '<button class="rj-legal-dialog__close" type="button" aria-label="Fechar informações legais">Fechar</button>' +
      '<p class="rj-legal-dialog__eyebrow">Transparência institucional</p>' +
      '<h2 class="rj-legal-dialog__title" id="' + dialogId + '-title">Informações legais</h2>' +
      '<p class="rj-legal-dialog__intro" id="' + dialogId + '-intro">Dados institucionais e caminhos importantes, reunidos de forma simples.</p>' +
      '<dl class="rj-legal-dialog__facts">' +
      '<div class="rj-legal-dialog__fact"><dt>Empresa</dt><dd>Renata Gomes Araujo</dd></div>' +
      '<div class="rj-legal-dialog__fact"><dt>CNPJ</dt><dd>' + CNPJ + '</dd><button class="rj-legal-dialog__copy" type="button">Copiar CNPJ</button><p class="rj-legal-dialog__status" aria-live="polite"></p></div>' +
      '</dl>' +
      '<p class="rj-legal-dialog__links-title">Institucional</p>' +
      '<nav class="rj-legal-dialog__links" aria-label="Links institucionais"></nav>' +
      (navigationLinks.length ? '<div class="rj-legal-dialog__secondary"><p class="rj-legal-dialog__links-title">Navegação</p><nav class="rj-legal-dialog__links rj-legal-dialog__navigation" aria-label="Navegação preservada do rodapé"></nav></div>' : '') +
      '</div>';

    document.body.appendChild(dialog);
    const institutionalNav = dialog.querySelector('[aria-label="Links institucionais"]');
    makeLinks(REQUIRED_LINKS).forEach(function (link) { institutionalNav.appendChild(link); });
    const navigation = dialog.querySelector('.rj-legal-dialog__navigation');
    if (navigation) makeLinks(navigationLinks).forEach(function (link) { navigation.appendChild(link); });

    const closeButton = dialog.querySelector('.rj-legal-dialog__close');
    const copyButton = dialog.querySelector('.rj-legal-dialog__copy');
    const status = dialog.querySelector('.rj-legal-dialog__status');

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

  function initialize() {
    removeFloatingButtons();
    document.querySelectorAll('footer').forEach(initializeFooter);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
