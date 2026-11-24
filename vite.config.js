import { defineConfig } from 'vite';

function siteMetadata() {
  return {
    name: 'playroom-site-metadata',
    transformIndexHtml() {
      if (!process.env.PLAYROOM_SITE_URL) return [];
      const site = new URL(process.env.PLAYROOM_SITE_URL);
      if (site.protocol !== 'https:') throw new Error('PLAYROOM_SITE_URL must use HTTPS.');
      site.pathname = `${site.pathname.replace(/\/$/, '')}/`;
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: site.href } },
        { tag: 'meta', attrs: { property: 'og:url', content: site.href } },
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: new URL('playroom-share.png', site).href },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:alt', content: 'Playroom. Big fun. Little games.' },
        },
      ];
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [siteMetadata()],
});
