// One root-scoped worker for the PWA cache and SendPulse Web Push.
// Both the PWA bootstrap and SendPulse loader register this exact filename.
importScripts('/sw.js');
importScripts('https://web.webpushs.com/sp-push-worker-fb.js?ver=2.0');
