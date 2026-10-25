(function () {
  'use strict';

  const TILE_VIDEO_SELECTOR = '.social-card__media-video[autoplay]';
  const VIDEO_TRIGGER_SELECTOR = '[data-social-video-trigger]';
  const SOUND_TOGGLE_SELECTOR = '[data-social-sound-toggle]';
  const MODAL_SELECTOR = '[data-social-reel-modal]';
  const MODAL_VIDEO_SELECTOR = '[data-social-reel-modal-video]';
  const MODAL_BRAND_SELECTOR = '[data-social-reel-modal-brand]';
  const MODAL_CLOSE_SELECTOR = '[data-social-reel-close]';
  const MODAL_PREVIOUS_SELECTOR = '[data-social-reel-previous]';
  const MODAL_NEXT_SELECTOR = '[data-social-reel-next]';
  const MODAL_COUNTER_SELECTOR = '[data-social-reel-counter]';
  const HEADER_SELECTOR = '.header';
  const MODAL_HEADER_OFFSET_PROPERTY = '--social-modal-header-offset';
  const VIDEO_CONTENT_TOP_PROPERTY = '--social-video-content-top';
  const VIDEO_CONTENT_BOTTOM_PROPERTY = '--social-video-content-bottom';
  const VIDEO_CONTENT_ASPECT_PROPERTY = '--social-video-content-aspect';
  const VIDEO_CONTENT_POSITION_PROPERTY = '--social-video-content-position-y';
  const VIDEO_OVERLAY_TOP_PROPERTY = '--social-video-overlay-top';
  const VIDEO_OVERLAY_BOTTOM_PROPERTY = '--social-video-overlay-bottom';
  const MODAL_VIDEO_ASPECT_PROPERTY = '--social-modal-video-aspect';
  const MODAL_VIDEO_POSITION_PROPERTY = '--social-modal-video-position-y';
  const LETTERBOX_SAMPLE_WIDTH = 72;
  const LETTERBOX_SCAN_INTERVAL = 140;
  const SWIPE_MIN_DISTANCE = 48;
  const SWIPE_AXIS_RATIO = 1.2;

  // Share the existing reel controls and layout across all network cards.
  const reelTemplate = document.querySelector('.social-card--instagram');
  if (reelTemplate) {
    const networkOrder = ['instagram', 'tiktok', 'facebook', 'whatsapp', 'telegram', 'viber', 'youtube'];
    const networkCards = new Map([['instagram', reelTemplate]]);
    document.querySelectorAll('.social-grid .social-card').forEach(card => {
      if (card === reelTemplate) return;
      const title = card.querySelector('h3')?.textContent.trim();
      const destination = card.querySelector('a[href]');
      if (!title || !destination) return;
      if (destination.getAttribute('href').startsWith('mailto:')) {
        card.remove();
        return;
      }
      const icon = title.toLowerCase();
      if (icon === 'youtube') {
        card.classList.add('social-card--youtube');
        const notice = document.createElement('p');
        notice.className = 'social-youtube-notice';
        notice.textContent = ({
          ru: 'Пока нет доступных видео. Открыть наш YouTube-канал.',
          uk: 'Поки немає доступних відео. Відкрити наш YouTube-канал.',
          de: 'Noch keine verfügbaren Videos. Unseren YouTube-Kanal öffnen.',
          en: 'No videos available yet. Visit our YouTube channel.',
        })[document.documentElement.lang.slice(0, 2)] || 'No videos available yet. Visit our YouTube channel.';
        const preview = destination.cloneNode(false);
        preview.className = 'social-youtube-preview';
        preview.setAttribute('aria-label', 'YouTube — HUNDESALON_NIKA');
        const logo = document.createElement('img');
        logo.src = '/assets/images/icons/youtube.png';
        logo.alt = 'YouTube';
        preview.appendChild(logo);
        card.replaceChildren(preview, notice, destination);
      }
      if (['whatsapp', 'telegram', 'viber'].includes(icon)) {
        const link = destination.cloneNode(false);
        link.className = 'social-contact-link';
        link.setAttribute('aria-label', `${title} HUNDESALON_NIKA`);
        const image = document.createElement('img');
        image.src = `/assets/images/icons/${icon}.png`;
        image.alt = '';
        link.appendChild(image);
        const label = document.createElement('span');
        label.textContent = title;
        link.appendChild(label);
        card.replaceChildren(link);
        card.classList.add('social-card--contact');
      }
      networkCards.set(icon, card);
    });
    const grid = reelTemplate.closest('.social-grid');
    networkOrder.forEach(network => {
      const card = networkCards.get(network);
      if (card) grid.appendChild(card);
    });
  }

  const networkReels = {
    instagram: ['Dc84c7QoQgF', 'Dcnzb9Io1vy', 'Dcnyb_tKcPJ', 'DcA_hw5IeVI', 'Db-dof2ouXT', 'Db-cyrpImZZ', 'DbVRxvooNo2', 'DbVOzA4ohes', 'DZ75d1koAKx', 'DZ7ysW0I9bE', 'DZPs54RIjp6', 'DZPqwnBoshi', 'DZPafT1osAN', 'DZNhz4gIMFF', 'DZMiq1KocyI', 'DZK_JwNoR8U', 'DZJ-mYOIAGR', 'DZHh012oUDs'],
    tiktok: ['7679448492682661153', '7679414436393667873', '7673454588619525408', '7673451996900265248', '7667520898852719904', '7667519736111975712', '7654632698404687137', '7648270612749667617', '7648268335271988512', '7648226446262996257', '7647955742078586145', '7647810676236307744', '7647586063191493920', '7647448125166210337', '7647093881367973152', '7645584322979777824', '7645330576022457632', '7645223763830770976', '7644803714078756128', '7644625287887686945', '7644453382165450017', '7644098845483257121', '7643525193813478688', '7643387210317827360'],
    facebook: ['4707718502794989', '908401655242933', '1786217192410832', '1743793083484797', '1622146542613507', '1038550702305459', '1384106527192555', '1749692789559570', '2041332996503274', '1412116040940620', '1016152731354279', '2356222184868096', '1323768095826802', '1488074069730042', '984314621136293', '1333573998727280', '997775212662724', '1341887474486555', '1251971057149401', '1420706640092610'],
  };
  const language = document.documentElement.lang.slice(0, 2);
  const navigationCopy = {
    ru: ['Предыдущее видео', 'Следующее видео', 'Открыть оригинал'],
    uk: ['Попереднє відео', 'Наступне відео', 'Відкрити оригінал'],
    de: ['Vorheriges Video', 'Nächstes Video', 'Original öffnen'],
    en: ['Previous video', 'Next video', 'Open original'],
  }[language] || ['Previous video', 'Next video', 'Open original'];
  document.querySelectorAll('.social-grid .social-card').forEach(card => {
    const network = card === reelTemplate ? 'instagram' : card.querySelector('h3')?.textContent.trim().toLowerCase();
    const reels = networkReels[network];
    if (!reels) return;
    card.className = 'social-card social-card--reel-carousel';
    card.dataset.socialNetwork = network;
    const frame = document.createElement('iframe');
    frame.className = 'social-reel-frame';
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    frame.loading = 'lazy';
    frame.scrolling = 'no';
    const controls = document.createElement('div');
    controls.className = 'social-reel-controls';
    const previous = document.createElement('button');
    const next = document.createElement('button');
    const counter = document.createElement('output');
    previous.type = next.type = 'button';
    previous.textContent = '‹';
    next.textContent = '›';
    previous.setAttribute('aria-label', navigationCopy[0]);
    next.setAttribute('aria-label', navigationCopy[1]);
    counter.setAttribute('aria-live', 'polite');
    const original = document.createElement('a');
    original.className = 'social-reel-original';
    original.target = '_blank';
    original.rel = 'noopener noreferrer';
    original.textContent = `${network[0].toUpperCase()}${network.slice(1)} · ${navigationCopy[2]}`;
    let index = 0;
    const show = direction => {
      index = (index + direction + reels.length) % reels.length;
      const id = reels[index];
      const url = network === 'instagram' ? `https://www.instagram.com/reel/${id}/`
        : network === 'facebook' ? `https://www.facebook.com/reel/${id}/`
          : `https://www.tiktok.com/@hundesalon_nika/video/${id}`;
      frame.src = network === 'instagram' ? `${url}embed/`
        : network === 'facebook' ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=360`
          : `https://www.tiktok.com/player/v1/${id}?autoplay=0&rel=0`;
      frame.title = `${network} — ${index + 1} / ${reels.length}`;
      counter.textContent = `${index + 1} / ${reels.length}`;
      original.href = url;
    };
    previous.addEventListener('click', () => show(-1));
    next.addEventListener('click', () => show(1));
    let start = null;
    controls.addEventListener('pointerdown', event => { start = event.clientX; });
    controls.addEventListener('pointerup', event => {
       if (start !== null && Math.abs(event.clientX - start) > SWIPE_MIN_DISTANCE) show(event.clientX < start ? 1 : -1);
      start = null;
    });
    controls.addEventListener('pointercancel', () => { start = null; });
    controls.append(previous, counter, next);
    card.replaceChildren(frame, controls, original);
    show(0);
    if (network === 'instagram') {
      const topMask = document.createElement('span');
      const bottomMask = document.createElement('div');
      topMask.className = 'social-reel-mask social-reel-mask--top';
      bottomMask.className = 'social-reel-mask social-reel-mask--bottom';
      topMask.setAttribute('aria-hidden', 'true');
      const actionCopy = {
        ru: ['Нравится', 'Комментарий', 'Поделиться'],
        uk: ['Подобається', 'Коментар', 'Поділитися'],
        de: ['Gefällt mir', 'Kommentieren', 'Teilen'],
        en: ['Like', 'Comment', 'Share'],
      }[language] || ['Like', 'Comment', 'Share'];
      ['♡', '◌', '↗'].forEach((icon, actionIndex) => {
        const action = document.createElement('button');
        action.type = 'button';
        action.textContent = icon;
        action.setAttribute('aria-label', actionCopy[actionIndex]);
        action.addEventListener('click', async () => {
          if (actionIndex < 2) {
            window.open(original.href, '_blank', 'noopener,noreferrer');
            return;
          }
          try {
            if (navigator.share) await navigator.share({ title: frame.title, url: original.href });
            else await navigator.clipboard.writeText(original.href);
          } catch { /* The user can cancel the native share dialog. */ }
        });
        bottomMask.append(action);
      });
      card.append(topMask, bottomMask);
    } else if (network === 'tiktok') {
      const topMask = document.createElement('span');
      topMask.className = 'social-reel-mask social-reel-mask--top social-reel-mask--tiktok';
      topMask.setAttribute('aria-hidden', 'true');
      card.append(topMask);
    }
  });

  const tileVideos = Array.from(document.querySelectorAll(TILE_VIDEO_SELECTOR));
  const modal = document.querySelector(MODAL_SELECTOR);
  const modalDialog = modal?.querySelector('.social-reel-modal__dialog') ?? null;
  const modalVideo = modal?.querySelector(MODAL_VIDEO_SELECTOR) ?? null;
  const modalBrand = modal?.querySelector(MODAL_BRAND_SELECTOR) ?? null;
  const modalCloseControls = modal ? Array.from(modal.querySelectorAll(MODAL_CLOSE_SELECTOR)) : [];
  const modalPrevious = modal?.querySelector(MODAL_PREVIOUS_SELECTOR) ?? null;
  const modalNext = modal?.querySelector(MODAL_NEXT_SELECTOR) ?? null;
  const modalCounter = modal?.querySelector(MODAL_COUNTER_SELECTOR) ?? null;
  const reelItems = tileVideos
    .map(video => {
      const card = video.closest('.social-card');
      return {
        video,
        trigger: card?.querySelector(VIDEO_TRIGGER_SELECTOR) ?? null,
        brandLink: card?.querySelector('.social-card__media-brand') ?? null,
        src: video.getAttribute('src') || '',
        poster: video.getAttribute('poster') || '',
        label: video.getAttribute('aria-label') || 'Social video',
      };
    })
    .filter(item => item.src);
  let activeTileVideo = null;
  let activeReelIndex = 0;
  let lastFocusedElement = null;
  let swipeStart = null;

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

      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        card.style.removeProperty(VIDEO_CONTENT_ASPECT_PROPERTY);
        card.style.removeProperty(VIDEO_CONTENT_POSITION_PROPERTY);
        card.style.setProperty(VIDEO_OVERLAY_TOP_PROPERTY, `${topInset}%`);
        card.style.setProperty(VIDEO_OVERLAY_BOTTOM_PROPERTY, `${bottomInset}%`);
        delete card.dataset.videoContentCropped;
        return;
      }

      const safeTopInset = Math.max(0, Math.min(40, topInset));
      const safeBottomInset = Math.max(0, Math.min(40, bottomInset));
      const totalInset = Math.min(80, safeTopInset + safeBottomInset);
      const contentHeightRatio = Math.max(0.2, 1 - totalInset / 100);
      const contentAspect = video.videoWidth / (video.videoHeight * contentHeightRatio);
      if (card === reelTemplate) {
        card.closest('.social-grid')?.style.setProperty('--social-grid-reel-aspect', String(contentAspect));
      }
      const contentPosition = totalInset > 0 ? (safeTopInset / totalInset) * 100 : 50;

      card.style.setProperty(VIDEO_CONTENT_ASPECT_PROPERTY, contentAspect.toFixed(6));
      card.style.setProperty(VIDEO_CONTENT_POSITION_PROPERTY, `${contentPosition.toFixed(2)}%`);
      card.style.setProperty(VIDEO_OVERLAY_TOP_PROPERTY, '0%');
      card.style.setProperty(VIDEO_OVERLAY_BOTTOM_PROPERTY, '0%');
      card.dataset.videoContentCropped = String(totalInset > 0);
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

  const syncModalHeaderOffset = () => {
    if (!modal) {
      return;
    }

    const currentHeader = document.querySelector(HEADER_SELECTOR);
    const headerHeight = currentHeader ? currentHeader.getBoundingClientRect().height : 0;
    const safeOffset = Math.ceil(Math.max(0, Math.min(window.innerHeight, headerHeight)));
    modal.style.setProperty(MODAL_HEADER_OFFSET_PROPERTY, `${safeOffset}px`);
  };

  const updateModalNavigation = () => {
    const hasMultipleReels = reelItems.length > 1;

    [modalPrevious, modalNext].forEach(control => {
      if (!control) {
        return;
      }

      control.disabled = !hasMultipleReels;
      control.setAttribute('aria-disabled', String(!hasMultipleReels));
    });

    if (!modalCounter) {
      return;
    }

    const currentPosition = reelItems.length ? activeReelIndex + 1 : 0;
    modalCounter.textContent = `${currentPosition} / ${reelItems.length}`;
    modalCounter.setAttribute(
      'aria-label',
      (modalCounter.dataset.counterLabel || 'Video {current} of {total}')
        .replace('{current}', String(currentPosition))
        .replace('{total}', String(reelItems.length))
    );
  };

  const syncModalVideoLayout = item => {
    if (!modalDialog) {
      return;
    }

    const sourceCard = item.video.closest('.social-card--instagram');
    const contentAspect = sourceCard?.style.getPropertyValue(VIDEO_CONTENT_ASPECT_PROPERTY).trim() || '';
    const contentPosition =
      sourceCard?.style.getPropertyValue(VIDEO_CONTENT_POSITION_PROPERTY).trim() || '';

    if (contentAspect) {
      modalDialog.style.setProperty(MODAL_VIDEO_ASPECT_PROPERTY, contentAspect);
    } else {
      modalDialog.style.removeProperty(MODAL_VIDEO_ASPECT_PROPERTY);
    }

    if (contentPosition) {
      modalDialog.style.setProperty(MODAL_VIDEO_POSITION_PROPERTY, contentPosition);
    } else {
      modalDialog.style.removeProperty(MODAL_VIDEO_POSITION_PROPERTY);
    }
  };

  const loadModalReel = (index, direction = 0) => {
    if (!modalVideo || !reelItems.length) {
      return;
    }

    activeReelIndex = ((index % reelItems.length) + reelItems.length) % reelItems.length;
    const item = reelItems[activeReelIndex];

    copyBrandLinkToModal(item.brandLink);
    syncModalVideoLayout(item);
    modalDialog?.classList.add('is-switching');
    if (modalDialog) {
      modalDialog.dataset.reelDirection = direction > 0 ? 'next' : direction < 0 ? 'previous' : 'initial';
    }

    modalVideo.pause();
    modalVideo.removeAttribute('src');
    modalVideo.load();
    modalVideo.src = item.video.currentSrc || item.src;
    modalVideo.poster = item.poster;
    modalVideo.setAttribute('aria-label', item.label);
    modalVideo.defaultMuted = false;
    modalVideo.muted = false;
    modalVideo.loop = reelItems.length === 1;
    modalVideo.controls = true;
    modalVideo.playsInline = true;
    modalVideo.setAttribute('playsinline', '');
    modalVideo.load();
    updateModalNavigation();

    modalVideo.addEventListener(
      'loadeddata',
      () => {
        modalDialog?.classList.remove('is-switching');
        safePlay(modalVideo);
      },
      { once: true }
    );
  };

  const showAdjacentReel = direction => {
    if (!isModalOpen() || reelItems.length < 2) {
      return;
    }

    loadModalReel(activeReelIndex + direction, direction);
  };

  const openModal = (video, triggerElement) => {
    if (!modal || !modalDialog || !modalVideo) {
      return;
    }

    const reelIndex = reelItems.findIndex(item => item.video === video);

    activeTileVideo = video;
    lastFocusedElement = triggerElement instanceof HTMLElement ? triggerElement : document.activeElement;

    tileVideos.forEach(tileVideo => {
      tileVideo.pause();
    });

    document.body.classList.add('social-reel-modal-open');
    document.body.classList.remove('hide-header');
    syncModalHeaderOffset();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    loadModalReel(reelIndex >= 0 ? reelIndex : 0);

    requestAnimationFrame(() => {
      modalDialog.focus({ preventScroll: true });
      safePlay(modalVideo);
    });
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
    modalDialog?.classList.remove('is-switching');
    swipeStart = null;

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

  modalPrevious?.addEventListener('click', () => {
    showAdjacentReel(-1);
  });

  modalNext?.addEventListener('click', () => {
    showAdjacentReel(1);
  });

  modalVideo?.addEventListener('ended', () => {
    showAdjacentReel(1);
  });

  modalDialog?.addEventListener(
    'pointerdown',
    event => {
      if (reelItems.length < 2) {
        return;
      }

      swipeStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    },
    { passive: true }
  );

  modalDialog?.addEventListener(
    'pointerup',
    event => {
      if (!swipeStart || swipeStart.pointerId !== event.pointerId) {
        return;
      }

      const horizontalDistance = event.clientX - swipeStart.x;
      const verticalDistance = event.clientY - swipeStart.y;
      swipeStart = null;

      if (
        Math.abs(horizontalDistance) < SWIPE_MIN_DISTANCE ||
        Math.abs(horizontalDistance) < Math.abs(verticalDistance) * SWIPE_AXIS_RATIO
      ) {
        return;
      }

      showAdjacentReel(horizontalDistance < 0 ? 1 : -1);
    },
    { passive: true }
  );

  modalDialog?.addEventListener(
    'pointercancel',
    () => {
      swipeStart = null;
    },
    { passive: true }
  );

  const observedHeader = document.querySelector(HEADER_SELECTOR);
  if ('ResizeObserver' in window && observedHeader) {
    new ResizeObserver(() => {
      if (isModalOpen()) {
        syncModalHeaderOffset();
      }
    }).observe(observedHeader);
  }

  window.addEventListener(
    'resize',
    () => {
      if (isModalOpen()) {
        syncModalHeaderOffset();
      }
    },
    { passive: true }
  );

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
      return;
    }

    if (!isModalOpen()) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showAdjacentReel(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showAdjacentReel(1);
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

  updateModalNavigation();
})();
