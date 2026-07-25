import { site } from '../data/site';

export const createWhatsAppUrl = (message) =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
