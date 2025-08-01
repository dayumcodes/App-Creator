import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
          
          // Monaco Editor chunk (large dependency)
          'monaco-editor': ['@monaco-editor/react', 'monaco-editor'],
          
          // Socket.io chunk
          'socket-vendor': ['socket.io-client'],
          
          // UI components chunk
          'ui-components': [
            './src/components/Modal.tsx',
            './src/components/LoadingSpinner.tsx',
            './src/components/ErrorBoundary.tsx'
          ]
        }
      }
    },
    // Enable code splitting
    chunkSizeWarningLimit: 1000,
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/]
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux'
    ]
  }
})
