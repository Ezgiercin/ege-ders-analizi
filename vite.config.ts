import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Sayfa forumun yanında https://ege.uniforum.app/ders-analizi/ altında sunulacak.
export default defineConfig({
  base: '/ders-analizi/',
  plugins: [react(), tailwindcss()],
});
