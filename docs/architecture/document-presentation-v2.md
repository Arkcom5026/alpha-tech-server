# ADR: Store Document Presentation V2

Status: PROPOSED / ARCHITECTURE-LOCK CANDIDATE
Date: 2026-08-19
Scope: branch-owned printable business documents across ALPHA-TECH

## 1. Decision

ALPHA-TECH will evolve the existing `Branch.documentHeaderConfig` foundation into a configuration-driven Store Document Presentation system. The system will not become a free-form page builder and will not own business/legal document data.

The architecture separates:

1. Business authority — branch identity, tax identity, customer/supplier data, document number/date/status/totals, payment accounts.
2. Document projection — stable business projection for a printable document.
3. Presentation resolution — system defaults -> branch defaults -> document-purpose override -> per-document override/snapshot.
4. Semantic presentation blocks — header, terms, notes, payment account, signature, footer, etc.
5. Renderer family — A4, thermal, or other constrained physical renderer.
6. Print routing — printer/device/copies. This remains a separate subsystem.

## 2. Non-goals

V2 must NOT introduce:

- arbitrary HTML/CSS/JavaScript templates;
- unrestricted drag/drop or pixel x/y placement;
- a universal renderer that replaces all document renderers;
- one database column per document/style option;
- a second document-purpose registry;
- presentation configuration inside printer-routing records;
- duplicated bank/supplier-account data as template authority.

## 3. Canonical document identity

`DocumentPurposeDefinition` is the long-term canonical registry for document identity. Existing runtime names (`SALE_RECEIPT`, `RECEIPT`, `SHORT_TAX_RECEIPT`, `SHORT_TAX_INVOICE`, etc.) are compatibility aliases and must be mapped through a thin adapter rather than renamed across all subsystems in one migration.

Presentation configuration is keyed by canonical document-purpose code. Renderer/media family is a separate dimension.

Examples:

- QUOTATION + A4
- DELIVERY_NOTE + A4
- SALE_RECEIPT + THERMAL_80MM
- SALE_RECEIPT + A4
- FULL_TAX_INVOICE + A4

## 4. Presentation inheritance

Resolution order:

`System Default -> Branch Default -> Document Purpose Override -> Per-document Override -> Issued Snapshot`

Rules:

- Missing values inherit; they are not expanded/copied into every document override.
- Draft documents may resolve current branch settings.
- Issued/finalized documents that require historical fidelity must render from an immutable presentation snapshot.
- A change to branch settings must never silently alter an already-issued historical document.

Quotation issued-snapshot behavior is the reference semantic model.

## 5. Config shape

Presentation configuration remains versioned structured JSON because its shape is presentation metadata and evolves independently from business relational data.

V2 should conceptually contain:

```text
version
shared
  header
  typography
  blocks
  layout
  paymentAccountSelection
documents
  <canonical-purpose-code>
    header
    typography
    blocks
    layout
    paymentAccountSelection
```

Only sparse overrides are persisted under `documents`.

V1 `documentHeaderConfig` must remain readable and backward compatible. Migration should prefer a compatibility reader/normalizer before destructive data migration.

## 6. Semantic block model

Initial semantic block vocabulary:

- STORE_HEADER
- DOCUMENT_META
- PARTY
- ITEM_TABLE
- TOTALS
- COMMERCIAL_TERMS
- PAYMENT_TERMS
- DELIVERY_TERMS
- PAYMENT_ACCOUNT
- NOTES
- SIGNATURES
- SYSTEM_NOTICE
- CUSTOM_FOOTER

A block is not arbitrary markup. Each block is rendered by a known component/renderer capability.

## 7. Ownership and safety

Each block/field declares ownership and capabilities.

Ownership:

- SYSTEM_OWNED — statutory/business-authority notices and protected semantics.
- STORE_OWNED — store-authored terms, notes, branding, payment-account selection.
- DOCUMENT_OWNED — document number/date/status/totals/recipient and other document data.

Capabilities may include:

- required
- visibilityLocked
- editableContent
- editableStyle
- editableOrder
- editableAlignment
- snapshotRequired

SYSTEM_OWNED or DOCUMENT_OWNED content cannot be replaced by template text.

## 8. Typography and layout

Use constrained tokens instead of arbitrary CSS.

Typography tokens: `xs`, `sm`, `md`, `lg`, `xl`.

Renderer families map tokens to safe physical values. Thermal renderers may adapt text further to preserve width.

Allowed layout controls should be semantic:

- visibility
- order within permitted zones
- alignment
- spacing token
- width variant
- typography token
- logo size within existing validated range

Absolute x/y positioning is out of scope for V2.

## 9. Renderer ownership

Do not create a universal document renderer.

Existing document-family renderers retain physical/pagination ownership. Shared semantic primitives and the Presentation Resolver are reused across them.

Examples of renderer-owned constraints:

- A4 page dimensions/margins
- thermal roll width
- pagination/row capacity
- statutory block placement constraints
- overflow handling

The existing `StoreDocumentHeaderScope` becomes a legacy compatibility adapter. Do not continue growing DOM-selector-specific CSS as the primary V2 mechanism.

## 10. Capability classes

### Commercial — high customization
Quotation, Delivery Note, Purchase Order, Combined Billing.

Allowed: branding, terms, payment accounts, notes, signature variants, constrained block ordering/style.

### Tax/statutory — restricted customization
Full Tax Invoice, Short Tax Invoice, Credit Note.

Business/legal identity, tax totals, document number, tax semantics and required notices remain protected.

### Finance/operational — medium customization
Customer Money Receipt, Delivery Credit Settlement, Refund Receipt, selected operational documents.

System-owned workflow notices remain protected.

### Reports / utility
Tax reports and barcode labels do not use the general presentation system unless a future explicit requirement justifies it.

## 11. Store payment account authority

Current `Bank` is a branch-scoped bank-name master and Supplier owns supplier account details. It is not a canonical store receiving account.

Introduce a small branch-owned business entity for store receiving/payment accounts rather than embedding raw bank details in presentation JSON.

Target responsibilities:

- branch ownership
- bank display identity
- account name
- account number
- optional account type / prompt-pay metadata
- active state
- deterministic branch-scoped identifiers

Presentation stores only selection/display preferences. Issued snapshots copy the rendered account facts required for historical fidelity.

## 12. Snapshot envelope

A finalized print/document snapshot should be able to contain:

```text
businessSnapshot
presentationSnapshot
presentationVersion
documentPurpose
rendererFamily
issuedAt
```

Native/local print jobs consume the resolved snapshot; local print executors must not query current branch presentation settings.

## 13. Server authority

Server is the validation authority for persisted presentation configuration.

Server responsibilities:

- branch/tenant authorization
- canonical document-purpose validation/alias mapping
- version validation
- sparse override normalization
- length/range/enum limits
- block capability enforcement
- payment-account branch ownership validation
- snapshot creation at appropriate lifecycle boundary

Client may normalize editor state for UX but must not become an independent competing contract authority.

## 14. Backward compatibility

- `null` continues to mean legacy/system fallback where applicable.
- V1 header config remains readable.
- Existing print surfaces continue working during migration.
- `StoreDocumentHeaderScope` remains until migrated consumers no longer require it.
- Runtime document-type aliases continue to work through adapters.
- Printer routing and local print bridge contracts are not renamed wholesale in this agenda.

## 15. Rollout waves

Wave 0 — contracts/foundation
- canonical identity adapter
- V2 normalizer/resolver
- capability registry
- V1 compatibility reader
- store payment account authority
- snapshot helper/envelope contracts

Wave 1 — Quotation
- reference implementation
- terms/payment account/notes/signature/footer
- live preview
- issued presentation snapshot

Wave 2 — Delivery Note + Customer Receipt
- migrate existing header consumers to semantic blocks where practical
- preserve existing A4 behavior

Wave 3 — Purchase Order + Combined Billing
- remove hard-coded issuer presentation
- add store presentation support

Wave 4 — Full Tax + Credit Note + Short Tax
- restricted statutory capability profiles
- protect tax/business authority

Wave 5 — Customer Money + Delivery Credit Settlement + Refund Receipt
- preserve system-owned notices
- A4/thermal media capability handling

Wave 6 — operational candidates
- Repair Intake/Return and receiving only when their renderer/runtime maturity justifies inclusion

## 16. Verification requirements

Before publication to `main`:

Server:
- Prisma validate/generate as applicable
- migration status/deploy validation when schema changes exist
- focused document-presentation contract tests
- tenant/branch authority tests
- snapshot immutability tests
- payment-account ownership tests

Client:
- focused presentation resolver/config tests
- document header compatibility tests
- A4 standardization tests
- affected document workspace tests
- typecheck
- production build

Manual verification must include at least Quotation, Delivery Note, Customer Receipt, Full Tax and one thermal surface before broad rollout.

## 17. Architecture invariants

1. Business/legal data is never authored by a presentation template.
2. Issued historical documents do not drift with later branch-setting changes.
3. Presentation and printer routing are separate domains.
4. Canonical document identity is not duplicated.
5. Sparse inheritance prevents configuration bloat.
6. Renderers own physical page safety.
7. Customization is capability-driven, not arbitrary.
8. Existing documents remain printable throughout migration.
