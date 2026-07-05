(function () {
  'use strict';

  const modelContext = [document.modelContext, navigator.modelContext].find(
    api => api && typeof api.registerTool === 'function'
  );
  if (!modelContext) return;

  const origin = window.location.origin;
  const languagePages = {
    de: `${origin}/de/`,
    en: `${origin}/en/`,
    ru: `${origin}/ru/`,
    uk: `${origin}/uk/`,
  };

  const publicInfo = {
    name: 'HUNDESALON NIKA',
    url: `${origin}/`,
    address: 'Untere-Eichstaedtstrasse 38, 04299 Leipzig, Germany',
    phone: '+49 1515 1708888',
    email: 'info@hundesalon-nika.com',
    languages: Object.keys(languagePages),
    publicDiscovery: {
      llms: `${origin}/llms.txt`,
      apiCatalog: `${origin}/.well-known/api-catalog`,
      openApi: `${origin}/.well-known/openapi.json`,
      agentSkills: `${origin}/.well-known/agent-skills/index.json`,
    },
  };

  function normalizeLanguage(language) {
    const value = String(language || '')
      .trim()
      .toLowerCase();
    return Object.prototype.hasOwnProperty.call(languagePages, value) ? value : 'de';
  }

  function getPublicInfo(input) {
    const language = normalizeLanguage(input?.language);
    return {
      ...publicInfo,
      language,
      languagePage: languagePages[language],
      bookingPage: languagePages[language],
      note: 'Only public salon website information is exposed. Customer records, calendars, email, payments and internal tools are not available through WebMCP.',
    };
  }

  const languageSchema = {
    type: 'string',
    enum: ['de', 'en', 'ru', 'uk'],
    description: 'Preferred response language. Defaults to de.',
  };

  const tools = [
    {
      name: 'hundesalon_nika.get_public_info',
      title: 'Get public salon information',
      description: 'Returns public HUNDESALON NIKA contact, address, language, booking page and discovery links.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          language: languageSchema,
        },
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false,
      },
      execute: async (input = {}) => getPublicInfo(input),
    },
    {
      name: 'hundesalon_nika.get_booking_entrypoint',
      title: 'Get booking entrypoint',
      description:
        'Returns the public website entrypoint an agent can open when a user wants to book grooming services.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          language: languageSchema,
        },
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false,
      },
      execute: async (input = {}) => {
        const info = getPublicInfo(input);
        return {
          language: info.language,
          url: info.bookingPage,
          phone: info.phone,
          email: info.email,
          note: 'Open the public booking/contact section. Do not submit forms without explicit user review.',
        };
      },
    },
  ];

  const controller = typeof window.AbortController === 'function' ? new window.AbortController() : null;
  const options = controller ? { signal: controller.signal } : undefined;
  for (const tool of tools) {
    try {
      const registration = modelContext.registerTool(tool, options);
      if (registration && typeof registration.catch === 'function') registration.catch(() => {});
    } catch {
      try {
        const { name, ...definition } = tool;
        const registration = modelContext.registerTool(name, definition, options);
        if (registration && typeof registration.catch === 'function') registration.catch(() => {});
      } catch {
        // WebMCP is still experimental; unsupported implementations should not affect the page.
      }
    }
  }

  if (controller) window.addEventListener('pagehide', () => controller.abort(), { once: true });
})();
