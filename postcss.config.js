import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// Пути считаются от папки site/, откуда бы ни запускали vite
const config = fileURLToPath(new URL('./tailwind.config.js', import.meta.url))
export default { plugins: [tailwindcss({ config }), autoprefixer()] }
