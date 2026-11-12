import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

// Estilos ligados à rolagem só depois da hidratação e sem "reduzir movimento".
export const useScrollMotionReady = () => {
  const shouldReduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && !shouldReduceMotion;
};
