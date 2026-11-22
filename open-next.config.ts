import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Publicación en Cloudflare Workers (plan gratis). Sin caché de páginas: la demo y el panel son dinámicos.
export default defineCloudflareConfig({});
