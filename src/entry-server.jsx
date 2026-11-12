import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import './styles/rj-2026.css';
import './components/atelie/atelie.css';

export const render = (url) =>
  renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
  );
