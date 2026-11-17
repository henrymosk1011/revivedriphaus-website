import '@fontsource/anton/400.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/manrope/index.css';
import './styles/main.css';

import { initUI } from './ui.js';

const scrollTo = (target) => {
  if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' });
  else target?.scrollIntoView?.({ behavior: 'smooth' });
};
initUI({ scrollTo });
