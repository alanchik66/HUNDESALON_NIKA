(function initPricePromotions(global) {
  // The price list currently has no active promotions. The first puppy grooming
  // visit is a regular paid service and is rendered from the main catalogue.
  const noPromotion = () => null;
  const promotionApi = {
    iconPath: '/assets/images/icons/clash-royale.png',
    keys: [],
    getPromotion: noPromotion,
    getPromotionForCategory: noPromotion,
    getPromotionByService: noPromotion,
  };

  global.PricePromotionCatalog = promotionApi;

  const hideEmptyPromotionSections = () => {
    document.querySelectorAll('[data-price-promotions-root]').forEach(root => {
      root.replaceChildren();
      root.closest('.promotions')?.setAttribute('hidden', '');
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideEmptyPromotionSections, { once: true });
  } else {
    hideEmptyPromotionSections();
  }
})(window);
