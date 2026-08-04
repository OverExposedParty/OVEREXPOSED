(function initialiseOeSocialMediaLinks(root) {
  const links = Object.freeze({
    instagram: Object.freeze({
      label: 'Instagram',
      url: 'https://www.instagram.com/oe.app/',
      iconPath: '/images/icons/social-media/instagram-icon.svg'
    }),
    tiktok: Object.freeze({
      label: 'TikTok',
      url: 'https://www.tiktok.com/@overexposed.app',
      iconPath: '/images/icons/social-media/tik-tok-icon.svg'
    })
  });

  if (typeof module === 'object' && module.exports) {
    module.exports = links;
  }

  if (root) {
    root.OE_SOCIAL_MEDIA_LINKS = links;
  }
})(typeof window !== 'undefined' ? window : globalThis);
