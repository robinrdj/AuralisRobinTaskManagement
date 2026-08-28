/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin of the API in production, e.g. "https://auralis-api.up.railway.app".
   * Left unset in development, where Vite proxies /api instead.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
