# Security Policy

## Supported Surface

Security review covers the production website, Cloudflare Pages Functions, GitHub/GitLab CI configuration, dependency lockfiles, and deployment automation in this repository.

## Reporting a Vulnerability

Report suspected vulnerabilities privately. Do not open a public issue with exploit details, credentials, tokens, customer data, or logs containing secrets.

Preferred contact:

- Email: info@hundesalon-nika.com

Include the affected URL or file path, reproduction steps, impact, and any safe proof of concept. Do not include live secrets or personal data.

## Dependency Security

This repository uses GitHub Dependabot alerts, Dependabot security updates, npm audit gates, and GitHub secret scanning push protection. Dependency fixes should target `main` and pass:

```bash
npm run audit:all
npm run validate
npm run build
```

## Secrets

Production secrets must stay in Cloudflare Pages secrets or the relevant provider vault. Do not commit `.dev.vars`, API tokens, OAuth refresh tokens, private keys, cookies, or exported credentials.
