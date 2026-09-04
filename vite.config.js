import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev
export default defineConfig(({ mode }) => {
  // Le nom de la plateforme est défini dans .env : il alimente à la fois
  // le manifeste ci-dessous, le titre de la page et l'écran de démarrage.
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  const nom = env.VITE_NOM_PLATEFORME || 'Babamoo'
  const nomCourt = env.VITE_NOM_COURT || 'Babamoo'
  const description =
    env.VITE_DESCRIPTION_PLATEFORME ||
    'La gestion de votre organisation, dans votre poche.'

  return {
     build: {
      // Certains téléphones embarquent un navigateur plus ancien que celui
      // visé par défaut. Compiler pour une base plus large coûte quelques
      // kilo-octets et évite un écran blanc chez les membres.
      target: ['es2017', 'chrome64', 'safari12'],
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        // 'prompt' et non 'autoUpdate' : la nouvelle version reste en
        // attente jusqu'à ce que la personne clique sur "Mettre à jour"
        // dans le bandeau, au lieu de s'appliquer d'elle-même en pleine
        // utilisation — parfois au milieu d'une saisie.
        registerType: 'prompt',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 4000000, // Modifié ici : Augmente la limite à 4 Mo pour éviter le bug
        },
        devOptions: {
          enabled: true,
          type: 'module',
          suppressWarnings: true,
        },
        manifest: {
          name: nom,
          short_name: nomCourt,
          description,
          lang: 'fr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#0D47A1',
          background_color: '#0D47A1',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
  }
})