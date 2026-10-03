import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const sorgu = new URLSearchParams(window.location.search);

if (sorgu.get('embed') === '1') {
  document.body.classList.add('gomulu');
  document.documentElement.classList.add('gomulu');
  // Gomulu modda isletim sisteminin tema tercihini degil, forumun temasini izleriz.
  // Forum sayfasi ?tema=koyu gonderebilir; gondermezse acik tema varsayilir.
  document.documentElement.dataset.theme = sorgu.get('tema') === 'koyu' ? 'dark' : 'light';
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
