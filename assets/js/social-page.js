(function () {
  'use strict';

  const TILE_VIDEO_SELECTOR = '.social-card__media-video[autoplay]';
  const VIDEO_TRIGGER_SELECTOR = '[data-social-video-trigger]';
  const SOUND_TOGGLE_SELECTOR = '[data-social-sound-toggle]';
  const MODAL_SELECTOR = '[data-social-reel-modal]';
  const MODAL_VIDEO_SELECTOR = '[data-social-reel-modal-video]';
  const MODAL_BRAND_SELECTOR = '[data-social-reel-modal-brand]';
  const MODAL_CLOSE_SELECTOR = '[data-social-reel-close]';
  const VIDEO_CONTENT_TOP_PROPERTY = '--social-video-content-top';
  const VIDEO_CONTENT_BOTTOM_PROPERTY = '--social-video-content-bottom';
  const LETTERBOX_SAMPLE_WIDTH = 72;
  const LETTERBOX_SCAN_INTERVAL = 140;

  const tileVideos = Array.from(document.querySelectorAll(TILE_VIDEO_SELECTOR));
  const modal = document.querySelector(MODAL_SELECTOR);
  const modalDialog = modal?.querySelector('.social-reel-modal__dialog') ?? null;
  const modalVideo = modal?.querySelector(MODAL_VIDEO_SELECTOR) ?? null;
  const modalBrand = modal?.querySelector(MODAL_BRAND_SELECTOR) ?? null;
  const modalCloseControls = modal ? Array.from(modal.querySelectorAll(MODAL_CLOSE_SELECTOR)) : [];
  let activeTileVideo = null;
  let lastFocusedElement = null;

  if (!tileVideos.length) {
    return;
  }

  const safePlay = video => {
    if (!video) {
      return;
    }

    const playback = video.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {});
    }
  };

  const findLetterboxInset = (rowDarkRatios, fromTop) => {
    const rowCount = rowDarkRatios.length;
    const maxRows = Math.max(1, Math.floor(rowCount * 0.36));
    const ratioAt = step => rowDarkRatios[fromTop ? step : rowCount - 1 - step];
    const smoothRatioAt = step => {
      let total = 0;
      let samples = 0;

      for (let offset = -1; offset <= 1; offset += 1) {
        const sampleStep = Math.min(maxRows - 1, Math.max(0, step + offset));
        total += ratioAt(sampleStep);
        samples += 1;
      }

      return total / samples;
    };

    if (smoothRatioAt(0) < 0.7) {
      return 0;
    }

    let lastBarRow = -1;
    let contentRun = 0;

    for (let step = 0; step < maxRows; step += 1) {
      if (smoothRatioAt(step) >= 0.58) {
        lastBarRow = step;
        contentRun = 0;
        continue;
      }

      contentRun += 1;
      if (contentRun >= 5) {
        return lastBarRow + 1;
      }
    }

    return 0;
  };

  const startVideoContentTracking = video => {
    const card = video.closest('.social-card--instagram');
    if (!card) {
      return;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return;
    }

    const applyInsets = (topInset, bottomInset, boundsMode) => {
      card.style.setProperty(VIDEO_CONTENT_TOP_PROPERTY, `${topInset}%`);
      card.style.setProperty(VIDEO_CONTENT_BOTTOM_PROPERTY, `${bottomInset}%`);
      card.dataset.videoContentBounds = boundsMode;
    };

    const fallbackTopInset = Number.parseFloat(video.dataset.socialContentTop || '0');
    const fallbackBottomInset = Number.parseFloat(video.dataset.socialContentBottom || '0');
    const applyFallbackInsets = () => {
      applyInsets(fallbackTopInset, fallbackBottomInset, 'fallback-safe-area');
    };

    applyFallbackInsets();

    const updateInsets = () => {
      if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
        applyFallbackInsets();
        return;
      }

      const sampleHeight = Math.max(
        LETTERBOX_SAMPLE_WIDTH,
        Math.round((LETTERBOX_SAMPLE_WIDTH * video.videoHeight) / video.videoWidth)
      );
      if (canvas.width !== LETTERBOX_SAMPLE_WIDTH || canvas.height !== sampleHeight) {
        canvas.width = LETTERBOX_SAMPLE_WIDTH;
        canvas.height = sampleHeight;
      }

      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const rowDarkRatios = new Array(canvas.height).fill(0);

        for (let y = 0; y < canvas.height; y += 1) {
          let darkPixels = 0;

          for (let x = 0; x < canvas.width; x += 1) {
            const pixelIndex = (y * canvas.width + x) * 4;
            const red = pixels[pixelIndex];
            const green = pixels[pixelIndex + 1];
            const blue = pixels[pixelIndex + 2];
            const brightestChannel = Math.max(red, green, blue);
            const darkestChannel = Math.min(red, green, blue);

            if (brightestChannel <= 24 && brightestChannel - darkestChannel <= 12) {
              darkPixels += 1;
            }
          }

          rowDarkRatios[y] = darkPixels / canvas.width;
        }

        const topRows = findLetterboxInset(rowDarkRatios, true);
        const bottomRows = findLetterboxInset(rowDarkRatios, false);
        const minimumInsetRows = Math.max(2, Math.round(canvas.height * 0.02));
        const isUnavailableFrame = rowDarkRatios.every(darkRatio => darkRatio >= 0.98);
        const hasOpposingBars = topRows >= minimumInsetRows && bottomRows >= minimumInsetRows;

        if (isUnavailableFrame) {
          applyFallbackInsets();
          return;
        }

        if (!hasOpposingBars) {
          applyFallbackInsets();
          return;
        }

        const toPercent = rows => Math.round((((rows + 1) / canvas.height) * 100) * 2) / 2;
        applyInsets(toPercent(topRows), toPercent(bottomRows), 'letterboxed');
      } catch {
        applyFallbackInsets();
      }
    };

    video.addEventListener('loadeddata', updateInsets);
    video.addEventListener('seeked', updateInsets);

    if (typeof video.requestVideoFrameCallback === 'function') {
      let lastScanTime = 0;
      const inspectFrame = now => {
        if (now - lastScanTime >= LETTERBOX_SCAN_INTERVAL) {
          lastScanTime = now;
          updateInsets();
        }
        video.requestVideoFrameCallback(inspectFrame);
      };
      video.requestVideoFrameCallback(inspectFrame);
      return;
    }

    video.addEventListener('timeupdate', updateInsets, { passive: true });
  };

  const isModalOpen = () => Boolean(modal && !modal.hidden);

  const syncSoundToggle = video => {
    const toggle = video.closest('.social-card')?.querySelector(SOUND_TOGGLE_SELECTOR);
    if (!toggle) {
      return;
    }

    const isMuted = video.muted;
    toggle.dataset.muted = isMuted ? 'true' : 'false';
    toggle.setAttribute('aria-pressed', isMuted ? 'false' : 'true');
    toggle.setAttribute(
      'aria-label',
      isMuted ? toggle.dataset.soundOnLabel || 'Turn sound on' : toggle.dataset.soundOffLabel || 'Turn sound off'
    );
  };

  const applyTileAudioState = video => {
    const shouldMute = video.dataset.forceUnmuted !== 'true';
    video.defaultMuted = shouldMute;
    video.muted = shouldMute;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    syncSoundToggle(video);
  };

  const playTileVideo = video => {
    if (!video || isModalOpen()) {
      return;
    }

    applyTileAudioState(video);
    safePlay(video);
  };

  const resumeVisibleTiles = () => {
    tileVideos.forEach(video => {
      playTileVideo(video);
    });
  };

  const copyBrandLinkToModal = sourceBrand => {
    if (!modalBrand || !sourceBrand) {
      return;
    }

    modalBrand.href = sourceBrand.href;
    modalBrand.target = sourceBrand.target || '_blank';
    modalBrand.rel = sourceBrand.rel || 'noopener noreferrer';
    modalBrand.setAttribute('aria-label', sourceBrand.getAttribute('aria-label') || 'Instagram');
  };

  const openModal = (video, triggerElement) => {
    if (!modal || !modalDialog || !modalVideo) {
      return;
    }

    const card = video.closest('.social-card');
    const brandLink = card?.querySelector('.social-card__media-brand');

    activeTileVideo = video;
    lastFocusedElement = triggerElement instanceof HTMLElement ? triggerElement : document.activeElement;

    video.pause();
    copyBrandLinkToModal(brandLink);

    modalVideo.pause();
    modalVideo.removeAttribute('src');
    modalVideo.load();
    modalVideo.src = video.currentSrc || video.getAttribute('src') || '';
    modalVideo.poster = video.getAttribute('poster') || '';
    modalVideo.defaultMuted = false;
    modalVideo.muted = false;
    modalVideo.loop = true;
    modalVideo.controls = true;
    modalVideo.playsInline = true;
    modalVideo.setAttribute('playsinline', '');
    modalVideo.load();

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('social-reel-modal-open');

    requestAnimationFrame(() => {
      modalDialog.focus({ preventScroll: true });
      safePlay(modalVideo);
    });

    modalVideo.addEventListener(
      'loadeddata',
      () => {
        safePlay(modalVideo);
      },
      { once: true }
    );
  };

  const closeModal = () => {
    if (!modal || modal.hidden) {
      return;
    }

    modalVideo?.pause();
    if (modalVideo) {
      modalVideo.removeAttribute('src');
      modalVideo.load();
    }

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('social-reel-modal-open');

    if (activeTileVideo) {
      playTileVideo(activeTileVideo);
      activeTileVideo = null;
    }

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  };

  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          entries => {
            entries.forEach(entry => {
              const video = entry.target;
              if (document.hidden || isModalOpen()) {
                video.pause();
                return;
              }

              if (entry.isIntersecting) {
                playTileVideo(video);
                return;
              }

              video.pause();
            });
          },
          { threshold: 0.45 }
        )
      : null;

  tileVideos.forEach(video => {
    const card = video.closest('.social-card');
    const trigger = card?.querySelector(VIDEO_TRIGGER_SELECTOR);
    const soundToggle = card?.querySelector(SOUND_TOGGLE_SELECTOR);

    startVideoContentTracking(video);
    applyTileAudioState(video);
    playTileVideo(video);

    ['loadedmetadata', 'loadeddata', 'canplay'].forEach(eventName => {
      video.addEventListener(eventName, () => {
        playTileVideo(video);
      });
    });

    trigger?.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest(SOUND_TOGGLE_SELECTOR)) {
        return;
      }

      openModal(video, trigger);
    });

    trigger?.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      openModal(video, trigger);
    });

    soundToggle?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      const shouldUnmute = video.dataset.forceUnmuted !== 'true';
      video.dataset.forceUnmuted = shouldUnmute ? 'true' : 'false';
      applyTileAudioState(video);
      safePlay(video);
    });

    observer?.observe(video);
  });

  modalCloseControls.forEach(control => {
    control.addEventListener('click', event => {
      event.preventDefault();
      closeModal();
    });
  });

  modalDialog?.addEventListener('click', event => {
    event.stopPropagation();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      tileVideos.forEach(video => {
        video.pause();
      });
      modalVideo?.pause();
      return;
    }

    if (isModalOpen()) {
      safePlay(modalVideo);
      return;
    }

    resumeVisibleTiles();
  });

  window.addEventListener(
    'pageshow',
    () => {
      if (isModalOpen()) {
        safePlay(modalVideo);
        return;
      }

      resumeVisibleTiles();
    },
    { passive: true }
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', resumeVisibleTiles, { once: true });
  } else {
    resumeVisibleTiles();
  }
})();
