import { useEffect, useId, useRef, useState } from 'react';

/*
 * Entrada discreta para a futura área de membros.
 * Ainda não existe autenticação no projeto: em vez de uma rota ou formulário
 * sem backend, o botão abre uma nota informativa. Quando o login existir,
 * troque o botão por um <Link> para a rota real de acesso.
 */
export function AccountEntry() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const noteId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  const onBlur = (event) => {
    if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <span className="rj-account" ref={rootRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={buttonRef}
        className="rj-account__button"
        type="button"
        aria-expanded={open}
        aria-controls={noteId}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M4.8 19.5a7.4 7.4 0 0 1 14.4 0" />
        </svg>
        Entrar
      </button>
      <span className="rj-account__note" id={noteId} role="status" hidden={!open}>
        <strong>Área de membros em preparação</strong>O acesso com login e senha ainda não está
        disponível.
      </span>
    </span>
  );
}
