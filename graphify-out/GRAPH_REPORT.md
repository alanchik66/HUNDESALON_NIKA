# Graph Report - .  (2026-07-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1433 nodes · 2276 edges · 133 communities (105 shown, 28 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- scripts
- cf-api-token.mjs
- openrouter.js
- rules
- cursor-cloud-complete.mjs
- site-shell.js
- cloudflare-auth.mjs
- normalize_html_pages.py
- syncHeaderWeatherUnifiedReadings
- mountHeaderWeatherWidget
- syncHeaderWeatherOrbOverlay
- enforceHeaderWeatherMenuPlacement
- bing-webmaster-complete.mjs
- build-moon-alpha-webm.mjs
- cursor-cloud-setup-playwright.mjs
- resolveZoneId
- build-sun-alpha-webm.mjs
- bing-consolidate-accounts.mjs
- cursor-cloud-finish.mjs
- google-search-console-audit.js
- bindHeaderWeatherState
- devDependencies
- bing-index-all-site.mjs
- HeaderWeatherSunScene
- cf-interactive-token.mjs
- configure-cloudflare-waf-rate-limits.mjs
- indexnow-submit.js
- update-brand-search-seo.js
- bing-webmaster-automate.mjs
- cursor-fix-4of4-slack.mjs
- sync-openrouter-from-devvars.mjs
- setHeaderWeatherOrbSource
- bing-professional-setup.mjs
- check-links.js
- create-full-backup.mjs
- fetch-nasa-sun-source.mjs
- getHeaderWeatherNowMs
- bing-finish-remaining.mjs
- bing-force-clean.mjs
- bing-robots-tester.mjs
- package.json
- bing-ai-performance-setup.mjs
- bing-finish-manual.mjs
- bing-webmaster-audit.mjs
- check-project.js
- generate-brand-assets.ps1
- gsc-browser-automate.js
- setup-cursor-cloud.mjs
- tooltip.js
- keywords
- add_comments.py
- bing-submit-brand-sitemap.mjs
- cf-aktionen-click.mjs
- cf-cdp.mjs
- site-crawl-live.mjs
- main.js
- bing-mail-setup-only.mjs
- cf-fix-token-full.mjs
- import-sun-reference.mjs
- normalize_seo_urls.cjs
- bing-verify-site.mjs
- build-production.js
- cf-dump-edit-form.mjs
- cf-edit-token-zone-rules.mjs
- cursor-cloud-fix-settings.mjs
- fix_file
- optimize_fcp_head.cjs
- convert_to_webm.ps1
- bing-list-sites.mjs
- cf-dashboard-probe.mjs
- generate-brand-sitemap.mjs
- git-cleanup.mjs
- normalize_seo_urls.js
- browserslist
- build_moon_alpha_assets.ps1
- verify_outputs.ps1
- bing-prefill-mail-login.mjs
- cf-token-edit-apply.mjs
- cf-www-robots-setup.mjs
- git-push-all.mjs
- patch-weather-search.mjs
- restore-weather-clouds-original.mjs
- start-edge-bing-debug.mjs
- sync-dev-vars.js
- weather-widget-smoke.mjs
- check-scene3d-brackets.mjs
- patch-weather-clouds.mjs
- patch-weather-clouds-fit.mjs
- patch-weather-service.mjs
- revert-weather-clouds.mjs
- sync-gitlab-merge.mjs
- engines
- repository
- cf-confirm-token.mjs
- check-all.mjs
- cursor-cloud-cancel-run.mjs
- open-bing-webmaster.mjs
- probe-weather-layout.mjs
- revert-clouds-only.mjs
- start-chrome-user-debug.mjs
- start-edge-bing-gmail.mjs
- start-edge-cf-dashboard.mjs
- start-edge-cursor-dashboard.mjs
- leaflet
- check-live-html.mjs
- ensure-cf-purge-token.mjs
- ensure-cf-zone-rules-token.mjs
- open-cursor-cloud-setup.mjs
- patch-weather-resilience.mjs
- patch-weather-stars-header.mjs
- patch-weather-stars-layer.mjs
- prune-pages-openrouter-secrets.mjs
- set-cf-purge-token.mjs
- set-cf-zone-rules-token.mjs
- unpatch-weather-resilience.mjs
- resolveRulesAuth

## God Nodes (most connected - your core abstractions)
1. `scripts` - 130 edges
2. `syncHeaderWeatherOrbOverlay()` - 33 edges
3. `enforceHeaderWeatherMenuPlacement()` - 32 edges
4. `resolveZoneId()` - 28 edges
5. `normalize_page()` - 24 edges
6. `loadAllCredentials()` - 21 edges
7. `auditToken()` - 21 edges
8. `loadDevVars()` - 21 edges
9. `cloudflareApi()` - 21 edges
10. `rules` - 20 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `auditToken()`  [EXTRACTED]
  tools/cf-interactive-token.mjs → tools/lib/cf-api-token.mjs
- `main()` --calls--> `isFullToken()`  [EXTRACTED]
  tools/cf-interactive-token.mjs → tools/lib/cf-api-token.mjs
- `main()` --calls--> `loadAllCredentials()`  [EXTRACTED]
  tools/cf-interactive-token.mjs → tools/lib/cf-api-token.mjs
- `main()` --calls--> `printAudit()`  [EXTRACTED]
  tools/cf-interactive-token.mjs → tools/lib/cf-api-token.mjs
- `main()` --calls--> `resolveCfAuth()`  [EXTRACTED]
  tools/cf-interactive-token.mjs → tools/lib/cf-api-token.mjs

## Import Cycles
- None detected.

## Communities (133 total, 28 thin omitted)

### Community 0 - "scripts"
Cohesion: 0.02
Nodes (130): scripts, ai:pilot:ollama, ai:pilot:ollama:balanced, ai:pilot:ollama:compare, ai:pilot:ollama:custom, ai:pilot:ollama:fast, ai:pilot:ollama:quality, ai:rollout:plan (+122 more)

### Community 1 - "cf-api-token.mjs"
Cohesion: 0.08
Nodes (46): auth, chromeExe, chromeUserData, runPlaywright(), tempProfile, auth, auth, chromeExe (+38 more)

### Community 2 - "openrouter.js"
Cohesion: 0.08
Nodes (52): forwardJson(), getBearerToken(), getEnvVarFromContext(), getInternalOrigin(), getRuntimeEnvs(), isAuthorizedBySharedSecret(), onRequest(), applyApiResponseHeaders() (+44 more)

### Community 3 - "rules"
Cohesion: 0.06
Nodes (48): env, browser, es2021, node, extends, globals, console, document (+40 more)

### Community 4 - "cursor-cloud-complete.mjs"
Cohesion: 0.06
Nodes (32): edge(), ensureEdge(), LOG, needSecrets, bodyText(), clickFirst(), cloudItemVisible(), ensureDefaults() (+24 more)

### Community 5 - "site-shell.js"
Cohesion: 0.11
Nodes (36): applyHeaderWeatherAutoGeoLocation(), applyHeaderWeatherEqualMetricSpacing(), bindHeaderWeatherLayoutObserver(), bindHeaderWeatherScrollContainment(), buildHeaderWeatherDistrictLabel(), fetchHeaderWeatherAstroDay(), fetchHeaderWeatherReverseGeoMeta(), fetchHeaderWeatherSourceTimeMs() (+28 more)

### Community 6 - "cloudflare-auth.mjs"
Cohesion: 0.10
Nodes (22): listPath, root, urlList, enableContentScan(), getContentScanStatus(), getCrawlerHintsStatus(), main(), parseArgs() (+14 more)

### Community 7 - "normalize_html_pages.py"
Cohesion: 0.15
Nodes (26): add_page_modules_link(), add_page_modules_script(), add_site_shell_script(), clean_decorative_emoji(), ensure_after(), fix_known_copy_issues(), fix_known_text_artifacts(), get_asset_prefix() (+18 more)

### Community 8 - "syncHeaderWeatherUnifiedReadings"
Cohesion: 0.14
Nodes (27): applyHeaderWeatherConditionTypography(), applyHeaderWeatherDropdownConditionTypography(), applyHeaderWeatherDropdownReadings(), applyHeaderWeatherPreviewReadings(), buildHeaderWeatherConditionLineTexts(), buildHeaderWeatherReadingsFromMeta(), convertHeaderWeatherHpaToMmHg(), ensureHeaderWeatherPreviewMetricsVisible() (+19 more)

### Community 9 - "mountHeaderWeatherWidget"
Cohesion: 0.12
Nodes (26): buildLanguageUrl(), createHeaderMarkup(), emitHeaderWeatherEvent(), extractSupportedLang(), fitHomeLabelToLogo(), getHeaderWeatherHost(), getLaunchLanguageRedirectUrl(), getLocalizedRoute() (+18 more)

### Community 10 - "syncHeaderWeatherOrbOverlay"
Cohesion: 0.14
Nodes (25): applyHeaderWeatherOrbAtmosphere(), applyHeaderWeatherOrbCrossfade(), applyHeaderWeatherOrbLayout(), applyHeaderWeatherTextReadability(), clampHeaderWeatherValue(), createHeaderWeatherOrbOverlay(), ensureHeaderWeatherDropdownStarsBackLayer(), ensureHeaderWeatherOrbStack() (+17 more)

### Community 11 - "enforceHeaderWeatherMenuPlacement"
Cohesion: 0.13
Nodes (23): alignHeaderWeatherFeelsLikeRow(), applyHeaderWeatherFeelsLikePreview(), applyHeaderWeatherFeelsReferencePresetLayout(), buildHeaderWeatherCelsiusUnitMarkup(), enforceHeaderWeatherMenuPlacement(), ensureHeaderWeatherCollapsedFeelsFallback(), ensureHeaderWeatherInfoPanel(), ensureHeaderWeatherMenuPlacementLock() (+15 more)

### Community 12 - "bing-webmaster-complete.mjs"
Cohesion: 0.13
Nodes (16): CdpSession, getJson(), inspectTargets, loadSubmitUrls(), openSession(), pageScript(), pending, port (+8 more)

### Community 13 - "build-moon-alpha-webm.mjs"
Cohesion: 0.09
Nodes (18): bitrateK, buildFallbackMp4(), buildWebm(), DURATION_META_OUT, FALLBACK_MP4_OUT, ffmpeg, LEGACY_FILES, moonDir (+10 more)

### Community 14 - "cursor-cloud-setup-playwright.mjs"
Cohesion: 0.18
Nodes (21): bodyText(), BUILD_WAIT_MS, cfToken, clickFirst(), connectCdp(), edgePath(), ensureEnvironment(), log() (+13 more)

### Community 15 - "resolveZoneId"
Cohesion: 0.16
Nodes (16): addRedirectRule(), auth, createRedirectEntrypoint(), createRobotsPageRule(), desiredRule, getRedirectEntrypoint(), listPageRules(), live (+8 more)

### Community 16 - "build-sun-alpha-webm.mjs"
Cohesion: 0.11
Nodes (16): BITRATE_K, BRIGHTNESS, buildFromMp4(), CANVAS_SIZE, ffmpeg, KEY_BLEND, KEY_SIMILARITY, LOOP_SECONDS (+8 more)

### Community 17 - "bing-consolidate-accounts.mjs"
Cohesion: 0.30
Nodes (17): connect(), ensureEdge(), evaluate(), getJson(), getTarget(), mailFullSetup(), main(), pageScript() (+9 more)

### Community 18 - "cursor-cloud-finish.mjs"
Cohesion: 0.25
Nodes (17): bodyText(), clickFirst(), deleteBadSecrets(), dismissSecretForm(), edgePath(), fixDefaults(), log(), logFile (+9 more)

### Community 19 - "google-search-console-audit.js"
Cohesion: 0.13
Nodes (13): checkStatus(), fail(), failures, fetchText(), indexUrls, parseJsonLd(), report, reportPath (+5 more)

### Community 20 - "bindHeaderWeatherState"
Cohesion: 0.21
Nodes (17): applyHeaderWeatherLocationSearchCopy(), applyHeaderWeatherTransparency(), bindHeaderWeatherDropdownScrollState(), bindHeaderWeatherOutsideDismiss(), bindHeaderWeatherReadingsObserver(), bindHeaderWeatherState(), enforceHeaderWeatherToggleArrow(), enhanceHeaderWeatherCloudRenderer() (+9 more)

### Community 21 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, htmlhint, devDependencies, eslint, htmlhint, playwright, prettier, serve (+9 more)

### Community 22 - "bing-index-all-site.mjs"
Cohesion: 0.13
Nodes (13): evalPage(), getJson(), listPath, pageScript(), pending, port, priorityInspect, report (+5 more)

### Community 23 - "HeaderWeatherSunScene"
Cohesion: 0.21
Nodes (6): buildCoronaSprite(), dayOfYearUtc(), EARTH_AXIAL_TILT, HeaderWeatherSunScene, mountHeaderWeatherSunScene(), unmountHeaderWeatherSunScene()

### Community 24 - "cf-interactive-token.mjs"
Cohesion: 0.23
Nodes (14): FLAG, formReady(), main(), MAX_WAIT_MS, notifyUser(), POLL_MS, root, runSave() (+6 more)

### Community 25 - "configure-cloudflare-waf-rate-limits.mjs"
Cohesion: 0.23
Nodes (15): addRule(), buildCombinedRulePayload(), buildRulePayload(), COMBINED_RULE_LIMIT, createPhaseRuleset(), ENDPOINT_LIMITS, ensureRules(), getPhaseRuleset() (+7 more)

### Community 26 - "indexnow-submit.js"
Cohesion: 0.13
Nodes (11): apexList, getSitemapUrls(), isDryRun, key, keyPath, manualListPath, read(), root (+3 more)

### Community 27 - "update-brand-search-seo.js"
Cohesion: 0.19
Nodes (12): buildBrandHeadBlock(), getLanguage(), indexFiles, logoObject(), normalizeBrandHead(), normalizeJsonLd(), organizationObject(), root (+4 more)

### Community 28 - "bing-webmaster-automate.mjs"
Cohesion: 0.18
Nodes (10): evaluate(), getJson(), getTarget(), inspectHome(), listPath, pending, port, priorityUrls (+2 more)

### Community 29 - "cursor-fix-4of4-slack.mjs"
Cohesion: 0.26
Nodes (12): body(), clickFirst(), completeOnboarding(), configureCloudAgents(), configureSlackIntegration(), edge(), ensureEdge(), PROFILE (+4 more)

### Community 30 - "sync-openrouter-from-devvars.mjs"
Cohesion: 0.16
Nodes (11): validateInferenceKey(), devPath, keyLine, lines, newKey, result, root, devPath (+3 more)

### Community 31 - "setHeaderWeatherOrbSource"
Cohesion: 0.24
Nodes (13): clearHeaderWeatherOrbCanvas(), drawHeaderWeatherOrbFrame(), mountHeaderWeatherNasaEyesSun(), resolveHeaderWeatherOrbCropBox(), setHeaderWeatherOrbSource(), startHeaderWeatherOrbRender(), startHeaderWeatherOrbTextureRender(), startHeaderWeatherOrbTimelineSync() (+5 more)

### Community 32 - "bing-professional-setup.mjs"
Cohesion: 0.18
Nodes (10): evalPage(), getJson(), inspectUrls, pageScript(), pending, port, report, root (+2 more)

### Community 33 - "check-links.js"
Cohesion: 0.18
Nodes (9): collectHtmlFiles(), failures, htmlRoots, ignoredDirs, resolveLocalReference(), root, stripUrl(), validRoutes (+1 more)

### Community 34 - "create-full-backup.mjs"
Cohesion: 0.15
Nodes (12): archivePath, backupDir, excludeArgs, excludes, listing, manifest, manifestPath, parentDir (+4 more)

### Community 35 - "fetch-nasa-sun-source.mjs"
Cohesion: 0.18
Nodes (10): buildLoopMp4(), buildWarmDisk(), ffmpeg, JPG_RAW, JPG_WARM, LOOP_SECONDS, MP4_OUT, root (+2 more)

### Community 36 - "getHeaderWeatherNowMs"
Cohesion: 0.24
Nodes (12): buildHeaderWeatherMetaText(), formatHeaderWeatherLiveTime(), formatHeaderWeatherLiveWeekday(), getHeaderWeatherKnownWeekdayTokens(), getHeaderWeatherNowMs(), getHeaderWeatherTimestampMs(), isHeaderWeatherCurrentMetaFresh(), resolveHeaderWeatherDateLocale() (+4 more)

### Community 37 - "bing-finish-remaining.mjs"
Cohesion: 0.18
Nodes (9): devVars, getJson(), openSession(), out, pending, port, report, root (+1 more)

### Community 38 - "bing-force-clean.mjs"
Cohesion: 0.32
Nodes (11): cleanupGmail(), evalPage(), getJson(), getPageTarget(), gmailPort, mailPort, navigate(), setupMail() (+3 more)

### Community 39 - "bing-robots-tester.mjs"
Cohesion: 0.20
Nodes (10): getJson(), openSession(), out, pageScript(), pending, port, report, root (+2 more)

### Community 40 - "package.json"
Cohesion: 0.18
Nodes (10): author, description, license, main, name, overrides, ws, private (+2 more)

### Community 41 - "bing-ai-performance-setup.mjs"
Cohesion: 0.22
Nodes (9): evalPage(), getJson(), logoUrls, pageScript(), pending, port, report, siteQ (+1 more)

### Community 42 - "bing-finish-manual.mjs"
Cohesion: 0.20
Nodes (8): getJson(), openSession(), out, pending, port, report, root, siteQ

### Community 43 - "bing-webmaster-audit.mjs"
Cohesion: 0.24
Nodes (7): evaluate(), getJson(), getTarget(), pending, port, scrapePage(), targets

### Community 44 - "check-project.js"
Cohesion: 0.20
Nodes (6): failures, ignoredDirs, indexFiles, outdatedCityPattern, requiredFiles, root

### Community 45 - "generate-brand-assets.ps1"
Cohesion: 0.40
Nodes (8): Get-EdgePaddingPx(), Get-FittedSquareRect(), Get-ImageAlphaBounds(), New-BrandIconPng(), New-Canvas(), New-LogoPng(), New-SocialPreview(), Save-Png()

### Community 46 - "gsc-browser-automate.js"
Cohesion: 0.27
Nodes (7): evaluate(), getJson(), getTarget(), pageSummary(), pending, port, submitSitemap()

### Community 47 - "setup-cursor-cloud.mjs"
Cohesion: 0.29
Nodes (9): DASHBOARD_URLS, main(), openUrl(), OPTIONAL_SECRETS, parseDevVarKeys(), REMOVE_SECRETS, REQUIRED_SECRETS, root (+1 more)

### Community 48 - "tooltip.js"
Cohesion: 0.47
Nodes (8): attach(), getHeaderHeight(), hideTip(), normalizeTooltipText(), routeKey(), scanAndAttach(), showTip(), socialKey()

### Community 49 - "keywords"
Cohesion: 0.22
Nodes (9): keywords, cats, dogs, grooming, leipzig, multilingual, salon, weather-widget (+1 more)

### Community 50 - "add_comments.py"
Cohesion: 0.28
Nodes (8): add_page_header_comment(), add_section_comments_to_index(), insert_comment_before(), process_root_index(), Вставляет комментарий перед первым вхождением search, если ещё нет., Добавляет секционные комментарии в index.html (во вторую — рабочую — часть файла, Добавляет красивый заголовочный комментарий в начало подстраницы., Добавляет комментарии в корневой index.html (страница выбора языка).

### Community 51 - "bing-submit-brand-sitemap.mjs"
Cohesion: 0.25
Nodes (7): getJson(), pending, port, results, sitemaps, siteQ, withCdp()

### Community 52 - "cf-aktionen-click.mjs"
Cohesion: 0.22
Nodes (6): auth, list, p, step, t, ws

### Community 53 - "cf-cdp.mjs"
Cohesion: 0.39
Nodes (8): browser, browserExe(), CF_CDP_PORT, connectCfTab(), ensureCfCdp(), getJson(), sleep(), userDataDir()

### Community 54 - "site-crawl-live.mjs"
Cohesion: 0.22
Nodes (5): failed, outPath, report, root, urls

### Community 55 - "main.js"
Cohesion: 0.32
Nodes (4): positionCursorTips(), projectToEdge(), startTouchLoop(), tickTouches()

### Community 56 - "bing-mail-setup-only.mjs"
Cohesion: 0.36
Nodes (6): ensureMailEdge(), getJson(), mailPort, siteQ, wait(), withCdp()

### Community 57 - "cf-fix-token-full.mjs"
Cohesion: 0.36
Nodes (7): auth, connect(), ensureEdge(), getJson(), port, sleep(), WAIT_SPA_MS

### Community 58 - "import-sun-reference.mjs"
Cohesion: 0.25
Nodes (6): OUT, root, searchRoots, sizeMb, source, sunDir

### Community 59 - "normalize_seo_urls.cjs"
Cohesion: 0.25
Nodes (4): languages, workspaceRoot, fs, path

### Community 60 - "bing-verify-site.mjs"
Cohesion: 0.33
Nodes (4): getJson(), mailPort, siteQ, withCdp()

### Community 61 - "build-production.js"
Cohesion: 0.33
Nodes (5): copyEntries, copyRecursive(), dist, root, SKIP_RELATIVE_PATHS

### Community 62 - "cf-dump-edit-form.mjs"
Cohesion: 0.29
Nodes (5): list, pending, port, t, ws

### Community 63 - "cf-edit-token-zone-rules.mjs"
Cohesion: 0.38
Nodes (6): auth, getJson(), openSession(), pageScript(), pending, port

### Community 64 - "cursor-cloud-fix-settings.mjs"
Cohesion: 0.29
Nodes (5): baseBranch, cancel, edge, inputs, userDataDir

### Community 65 - "fix_file"
Cohesion: 0.33
Nodes (6): fix_file(), main(), Path, fix_html_stubs.py ----------------- Removes the old stub/template block from t, Returns True if the file was modified, False otherwise., Iterate over all HTML files in each language directory and fix stubs.

### Community 66 - "optimize_fcp_head.cjs"
Cohesion: 0.29
Nodes (4): fs, locales, path, workspaceRoot

### Community 67 - "convert_to_webm.ps1"
Cohesion: 0.53
Nodes (4): Convert-FallbackMp4(), Convert-WithAlpha(), Format-CommandArgs(), Invoke-Ffmpeg()

### Community 69 - "cf-dashboard-probe.mjs"
Cohesion: 0.33
Nodes (4): list, pending, port, ws

### Community 70 - "generate-brand-sitemap.mjs"
Cohesion: 0.33
Nodes (5): brandPaths, out, root, today, urls

### Community 71 - "git-cleanup.mjs"
Cohesion: 0.33
Nodes (4): extraWorktrees, prunable, staleBranches, worktrees

### Community 73 - "browserslist"
Cohesion: 0.40
Nodes (5): browserslist, > 1%, last 2 versions, not dead, not ie <= 11

### Community 74 - "build_moon_alpha_assets.ps1"
Cohesion: 0.60
Nodes (3): Build-Job(), Format-CommandArgs(), Invoke-Ffmpeg()

### Community 76 - "bing-prefill-mail-login.mjs"
Cohesion: 0.40
Nodes (3): pending, port, ws

### Community 78 - "cf-www-robots-setup.mjs"
Cohesion: 0.40
Nodes (3): redirect, root, token

### Community 79 - "git-push-all.mjs"
Cohesion: 0.40
Nodes (3): current, mirror, mirrorOut

### Community 80 - "patch-weather-search.mjs"
Cohesion: 0.40
Nodes (4): copyReplacements, service, servicePath, widgetFiles

### Community 81 - "restore-weather-clouds-original.mjs"
Cohesion: 0.40
Nodes (4): hEnd, hStart, replacements, s

### Community 82 - "start-edge-bing-debug.mjs"
Cohesion: 0.40
Nodes (4): candidates, child, site, userDataDir

### Community 83 - "sync-dev-vars.js"
Cohesion: 0.40
Nodes (4): distDir, keyAssetPath, lines, source

### Community 84 - "weather-widget-smoke.mjs"
Cohesion: 0.40
Nodes (4): consoleErrors, failedRequests, host, sunScene404

### Community 86 - "check-scene3d-brackets.mjs"
Cohesion: 0.50
Nodes (3): s, start, tail

### Community 87 - "patch-weather-clouds.mjs"
Cohesion: 0.50
Nodes (3): intensityPatches, replacements, s

### Community 88 - "patch-weather-clouds-fit.mjs"
Cohesion: 0.50
Nodes (3): replacements, s, widgetFiles

### Community 89 - "patch-weather-service.mjs"
Cohesion: 0.50
Nodes (3): inEnd, inStart, s

### Community 90 - "revert-weather-clouds.mjs"
Cohesion: 0.50
Nodes (3): replacements, s, widgetFiles

### Community 92 - "engines"
Cohesion: 0.67
Nodes (3): engines, node, npm

### Community 93 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

## Knowledge Gaps
- **569 isolated node(s):** `browser`, `es2021`, `node`, `eslint:recommended`, `ecmaVersion` (+564 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `keywords` connect `keywords` to `package.json`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `cloudflareApi()` connect `resolveZoneId` to `configure-cloudflare-waf-rate-limits.mjs`, `cloudflare-auth.mjs`, `cf-api-token.mjs`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `browser`, `es2021`, `node` to the rest of the system?**
  _569 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.015384615384615385 - nodes in this community are weakly interconnected._
- **Should `cf-api-token.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07704918032786885 - nodes in this community are weakly interconnected._
- **Should `openrouter.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08458646616541353 - nodes in this community are weakly interconnected._