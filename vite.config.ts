import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// "singlefile" arma un único HTML para la vista previa; el modo normal es el de GitHub Pages.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'singlefile' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'singlefile' ? 'dist-preview' : 'dist' },
  test: { environment: 'node' },
}));
