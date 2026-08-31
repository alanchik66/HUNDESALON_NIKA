(function () {
  const root = document.querySelector('[data-review-page]');
  if (!root) {
    return;
  }

  const form = root.querySelector('[data-review-form]');
  const ratingSummary = root.querySelector('[data-review-rating-summary]');
  const followup = root.querySelector('[data-review-followup]');
  const followupPublic = root.querySelector('[data-review-followup-public]');
  const followupPrivate = root.querySelector('[data-review-followup-private]');
  const googleLinks = Array.from(root.querySelectorAll('[data-review-google-link]'));

  const syncGoogleLinks = () => {
    const googleUrl = root.dataset.reviewGoogleUrl || '';
    googleLinks.forEach(link => {
      if (!googleUrl) {
        link.hidden = true;
        link.removeAttribute('href');
        return;
      }
      link.hidden = false;
      link.href = googleUrl;
    });
  };

  const getSelectedRating = () => {
    const selected = form?.querySelector('input[name="review_rating"]:checked');
    const rating = Number(selected?.value || 0);
    return Number.isFinite(rating) ? rating : 0;
  };

  const syncRatingSummary = () => {
    if (!ratingSummary) {
      return getSelectedRating();
    }

    const rating = getSelectedRating();
    ratingSummary.textContent = rating > 0 ? `${rating} / 5` : '0 / 5';
    root.dataset.reviewRating = String(rating || '');
    return rating;
  };

  syncGoogleLinks();
  syncRatingSummary();

  form?.addEventListener('change', event => {
    const target = event.target;
    if (target?.tagName === 'INPUT' && target.name === 'review_rating') {
      syncRatingSummary();
    }
  });

  form?.addEventListener('sendmail:success', event => {
    const values = event.detail?.values || {};
    const rating = Number(values.review_rating || root.dataset.reviewRating || getSelectedRating() || 0);

    if (followup) {
      followup.hidden = false;
      followup.dataset.reviewRating = String(rating || '');
    }

    if (followupPublic) {
      followupPublic.hidden = false;
    }

    if (followupPrivate) {
      followupPrivate.hidden = false;
    }

    syncRatingSummary();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    followup?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  });
})();
