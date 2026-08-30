---
project: HUNDESALON_NIKA
system: n8n-makler
status: active
scope: legal-snapshot
jurisdiction:
  - DE
  - EU
as_of: 2026-08-28
---

# HUNDESALON_NIKA Makler Legal Snapshot

## Purpose

Current legal and operational baseline for the AI-assisted commercial-rental broker. This note is not legal advice. It is a dated working summary for prompt design, safe automation, and owner review.

## Scope

- Primary lease law for this workflow is German national law.
- The EU layer matters mainly for privacy, AI transparency, and cross-border digital compliance.
- The target use case is a commercial lease search for a dog grooming salon in Leipzig.

## Germany: commercial lease baseline

- `BGB § 535`: the landlord must grant use of the leased property and keep it suitable for the contractually agreed use during the lease term.
- `BGB § 578`: non-residential room leases follow a separate regime; for leases longer than one year, missing text form causes the lease to be treated as indefinite.
- `BGB § 580a Abs. 2`: for business premises, the default ordinary notice period is by the third working day of a calendar quarter to the end of the next calendar quarter.
- Practical inference for this broker:
  - never treat a listing as safe without checking permitted use, water and wastewater feasibility, WC, ventilation, noise tolerance, step-free access where needed, signage, and fit-out tolerance;
  - do not treat warm rent, deposit, lease start, or viewing availability as implied if they are not stated.

## Saxony and Leipzig: permit layer for dog-grooming use

- `SächsBO`: a change of use can require building-law review; the safe operating assumption for this broker is that commercial use must be verified, not assumed.
- City of Leipzig `Bauberatung`: for a `Nutzungsänderung`, building approval should generally be clarified before the business starts operating.
- City of Leipzig `Baugenehmigung beantragen`: Leipzig explicitly lists a use-change application path and required submission forms.
- Practical rule for this broker:
  - ask early whether the current permitted use already covers a grooming salon;
  - if not, ask whether the landlord supports a `Nutzungsänderung` and required fit-out;
  - do not present a property as ready-to-open if that point is unclear.

## Germany: broker regulation

- `GewO § 34c Abs. 1 Satz 1 Nr. 1`: brokering contracts for commercial or residential premises is a regulated activity.
- `GewO § 34c Abs. 2a` now applies to `Wohnimmobilienverwalter` under Nr. 4, not to `Immobilienmakler` under Nr. 1.
- `MaBV` still governs professional duties such as information, recordkeeping, advertising, supervision, storage, and inspections for covered activities.
- Operational interpretation:
  - the bot is an internal assistant, not a substitute for licensed legal or brokerage advice;
  - messages should stay factual, individualized, and auditable;
  - no claim of authority, exclusivity, or legal certainty without evidence.

## Germany: outreach and direct marketing limits

- `UWG § 7`: unreasonable nuisance is prohibited; this includes advertising against a clearly expressed wish not to be contacted.
- `GDPR Art. 21(2)-(4)`: a person may object at any time to processing for direct marketing, and once they object, the data may no longer be processed for that purpose.
- Operational rule derived from these sources:
  - landlord outreach must stay property-specific, low-volume, and easy to stop;
  - after an objection, unsubscribe request, or clear refusal, the broker must stop follow-up for that contact;
  - no bulk mail blasts from AI-generated candidate lists.

## EU: privacy and AI layer

- `GDPR`: apply data minimization, purpose limitation, access control, and deletion discipline.
- `GDPR Art. 28`: if a processor handles personal data on behalf of the controller, processing must be governed by a contract or legal act.
- `AI Act`: as of `2 August 2026`, transparency rules apply to certain AI systems, including chatbots and AI-generated or AI-altered content.
- Operational rule derived from these sources:
  - the Telegram broker should remain explicitly identifiable as a bot / AI assistant;
  - the workflow should not pretend that a human personally wrote or reviewed a message when that did not happen;
  - owner approval remains required before landlord send actions.

## Commercial-rental checklist for fast but safe decisions

- Verify the exact intended use: professional dog grooming salon.
- Verify whether the use is already permitted or whether landlord and authority approval is needed.
- Verify water, wastewater, WC, ventilation, power, and noise constraints.
- Verify customer access, visibility, parking, loading, and signage options.
- Verify total monthly cost structure:
  - base rent,
  - operating costs / Nebenkosten,
  - heating,
  - VAT treatment if applicable,
  - deposit,
  - fit-out obligations.
- Verify lease mechanics:
  - fixed term or indefinite,
  - extension options,
  - notice period,
  - renovation / reinstatement duties,
  - subletting or successor-tenant clause,
  - competition protection if relevant.
- Verify local opening readiness:
  - existing permitted use or required `Nutzungsänderung`,
  - landlord consent for signage and customer traffic,
  - whether water, wastewater, ventilation, and noise controls are already in place or need approval.

## Downloadable reference material

- IHK Berlin sample commercial lease contract PDF:
  - `https://www.ihk.de/blueprint/servlet/resource/blob/2253322/8ba241800a55aba57a8c734cd8d9e7ca/muster-eines-gewerbemietvertrages-data.pdf`
- IHK Dresden commercial lease guide PDF:
  - `https://www.ihk.de/blueprint/servlet/resource/blob/5920642/e196b9e259e7920afbedba0e36d2812f/gewerbliches-mietrecht-data.pdf`
- IHK Leipzig commercial-lease guide:
  - `https://www.leipzig.ihk.de/mb-02-61/`

## Further literature noted by IHK Leipzig

- Jürgen Fritz, `Gewerberaummietrecht, Leitfaden für die Praxis`, 5th edition.
- Hans Langenberg, `Betriebskostenrecht der Wohn- und Gewerberaummiete`, 5th edition.
- Johann-Christian Weber, `Geschäftsraummiete (Mustermietverträge)`, 1st edition.
- Wolfgang Gerber / Hans-Georg Eckart, `Gewerbliches Mietrecht: Aktuelle Fragen`, 7th edition.
- Kai-Jochen Neuhaus, `Handbuch der Geschäftsraummiete: Recht - Praxis - Verwaltung`, 3rd edition.

## Primary sources

- BGB § 535:
  - `https://www.gesetze-im-internet.de/bgb/__535.html`
- BGB § 578:
  - `https://www.gesetze-im-internet.de/bgb/__578.html`
- BGB § 580a:
  - `https://www.gesetze-im-internet.de/bgb/__580a.html`
- SächsBO:
  - `https://www.revosax.sachsen.de/vorschrift/1779-SaechsBO`
- City of Leipzig Bauberatung:
  - `https://www.leipzig.de/leben-in-leipzig/bauen-und-wohnen/bauen/bauberatung`
- City of Leipzig Baugenehmigung:
  - `https://www.leipzig.de/service-portal/dienstleistung/baugenehmigung-beantragen-52eb97fee518e`
- GewO § 34c:
  - `https://www.gesetze-im-internet.de/gewo/__34c.html`
- MaBV:
  - `https://www.gesetze-im-internet.de/gewo_34cdv/`
- UWG § 7:
  - `https://www.gesetze-im-internet.de/uwg_2004/__7.html`
- GDPR:
  - `https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng`
- AI Act:
  - `https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng`
