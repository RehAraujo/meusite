// Resposta delicada ao cursor: posição relativa em CSS (--mx/--my), só com mouse.
export const trackPointer = (event) => {
  if (event.pointerType !== 'mouse') return;
  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  element.style.setProperty('--mx', ((event.clientX - bounds.left) / bounds.width).toFixed(3));
  element.style.setProperty('--my', ((event.clientY - bounds.top) / bounds.height).toFixed(3));
};

export const resetPointer = (event) => {
  event.currentTarget.style.removeProperty('--mx');
  event.currentTarget.style.removeProperty('--my');
};
