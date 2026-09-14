# Properties JSON migration verification

Verified against the configured `real_estate` MySQL 8.0.46 database on 2026-09-14. The actual database was backfilled, compared, altered, and tested. This is not a source-only migration.

## Actual schema and retained data

The exact `SHOW CREATE TABLE properties` output is saved locally:

- [Before schema](../backups/property-json/before.sql): 30 columns.
- [After schema](../backups/property-json/after.sql): 18 columns.
- [Full before snapshot](../backups/property-json/before.json): original rows, column definitions, indexes and constraints.
- [Full after snapshot](../backups/property-json/after.json): final rows and schema.
- [Direct MySQL samples](../backups/property-json/verified-samples.json): properties 1, 44 and 49.

Backups contain real records and are kept under the existing ignored `backups/` directory.

The 18 retained columns are `id`, `agent_id`, `title`, `description`, `size_value`, `size_unit`, `price`, `price_currency`, `location`, `status`, `is_featured`, `submitted_at`, `approved_by`, `approved_at`, `rejected_at`, `created_at`, `updated_at`, and `property_data`. Their full column definitions are unchanged. `property_data` remains `JSON NULL`.

Preserved indexes: `PRIMARY (id)`, `idx_properties_agent (agent_id)`, `idx_properties_status (status)`, and `idx_properties_agent_featured (agent_id, is_featured, status)`. The `properties_ibfk_1` foreign key to `users(id)` is unchanged. All four incoming foreign keys from customer inquiries, images, videos and marketing links still reference the retained `properties.id`.

There was no `rejected` boolean column and no stored `slug` column. Rejected status remains in the existing `status` enum. All timestamps, including `rejected_at`, remain normal columns. URLs continue to use the existing routing/slug helpers.

## Exact migrated and removed columns

| Removed column | Sole stored JSON path | Originally populated rows |
|---|---|---:|
| property_type | property_data.listing_type | 44 |
| property_subtype | property_data.property_type | 44 |
| city | property_data.location.city | 10 |
| area | property_data.location.area | 10 |
| phase | property_data.location.phase | 3 |
| address | property_data.location.address | 8 |
| rejected_reason | property_data.rejection.reason | 1 |
| rejected_by | property_data.rejection.rejected_by | 1 |
| property_highlights | property_data.insights.property_highlights | 2 |
| why_this_home | property_data.insights.why_this_home | 1 |
| location_advantages | property_data.insights.location_advantages | 0 |
| investment_insights | property_data.insights.investment_insights | 0 |

The original taxonomy contains `sale`, `rent`, and `plot`. Those exact values are preserved in `listing_type`; the existing UI displays `plot` as For Sale. Kind values such as `shop`, `residential_plot`, and `commercial_plot` are also preserved exactly. Existing UI grouping and labels are unchanged.

## Migration safety results

- Original property count: **44**.
- Backfilled properties: **44**.
- Matching properties immediately before dropping columns: **44**.
- Mismatching properties immediately before dropping columns: **0**.
- Existing JSON conflict rows: **0**.
- Final property count: **44**.
- Final properties verified against the original snapshot: **44**, with **0 mismatches**.

All rows were migrated, including rows whose original `property_data` was NULL. The migration preserves JSON arrays/objects, exact strings, whitespace, empty strings and SQL NULL as JSON null. It refuses conflicting existing JSON rather than overwriting it, including conflicts where the old column is NULL but JSON already has a value. Unrelated JSON is preserved.

The backfill used a transaction and row locks, preserving `updated_at`. Before removal, a properties-table write lock protected the final comparison and the single ALTER TABLE statement. MySQL DDL is not transactionally reversible; the original full snapshot and DDL were retained before any changes. No other database table was modified by this migration. The earlier `030_property_data` migration was not replaced or reapplied destructively.

The 12 columns in the table above were removed only after application tests, integration checks and the production build passed. Temporary verification drafts were deleted; no original property records were deleted. Verification inserts advanced AUTO_INCREMENT naturally; it was not reset.

## Application behavior

Create and edit persist migrated information only in `property_data`. Type-specific sections remain supported. Partial JSON edits preserve omitted sections and values. Agents cannot replace reviewer-owned rejection data through the edit payload.

`propertyRecord` derives the existing API/view field names exclusively from JSON, preserving response compatibility for existing clients and cards. These are response projections, not duplicate database storage or fallback reads. Existing request field names remain accepted, and JSON-shaped classification/location input is also supported.

Location filters use JSON_VALUE with the existing case-insensitive collation and correct SQL NULL handling. The retained `location` display column continues serving existing compact displays and location queries.

Admin rejection/approval and agent submission write rejection metadata within JSON, retaining normal workflow/status/timestamp columns. Public insights and Edit Property read insights only from JSON. Migrated NULL insights retain the previous unset-section behavior; explicitly saved empty arrays hide a section.

No route names, public URLs, card markup, styles, media upload/reordering, featured-image selection, hero flags, or authentication code were changed.

## Tests and build

- **101 application tests passed**: property data, Add/Edit forms, type combinations, submissions, public details/cards, prices and location matching.
- **4 migration tests passed**: exact-value preservation, unrelated JSON retention, conflict detection and invalid JSON handling.
- **Real-MySQL integration checks passed before and after column removal** for sale/house, sale/apartment, sale/commercial, sale/plots, sale/file, rent/house, rent/apartment and rent/commercial, using both current and legacy-shaped inputs.
- Integration checks cover committed create/retrieval through a separate connection, actual API handlers, partial updates, Edit UI loading/saving, location search, admin reads/rejection/approval, public detail and listing cards.
- All 44 real properties were checked for database/admin retrieval, public detail/insight rendering where publicly accessible, featured images, hero flags and video retrieval. Original rows were hash-compared after verification cleanup.
- Production build **passed**. It reports the pre-existing `compress.js` top-level-await compatibility warning.
- `git diff --check` passed.

Integration runs use real SQL and actual handlers/components with authentication/session hooks, browser hooks, audit logging and tracking isolated. They are not browser-driven login tests. No real listing was published by testing; approval of temporary drafts was rolled back.

Evidence: [application tests](../backups/property-json/tests.log), [migration tests](../backups/property-json/migration-tests.log), [build](../backups/property-json/build.log), [before-drop integration](../backups/property-json/integration-before-drop.log), [after-drop integration](../backups/property-json/integration-after-drop.log), [locked pre-drop comparison](../backups/property-json/pre-drop-verification.json).

## Exact files changed

- `app/(public)/re/[estate_name]/dashboard/properties/[id]/edit/page.js`
- `app/api/admin/properties/[id]/route.js`
- `app/api/admin/properties/route.js`
- `app/api/properties/[id]/route.js`
- `app/api/properties/[id]/submit/route.js`
- `app/api/properties/route.js`
- `lib/propertyData.js`
- `lib/propertyData.test.cjs`
- `lib/propertyLocation.js`
- `lib/propertyRecord.js` (new)
- `lib/propertyValidation.js`
- `lib/publicPropertyData.js`
- `lib/publicPropertyData.test.cjs`
- `lib/queries.js`
- `lib/validators/propertyValidator.js`
- `package.json`
- `schema.sql`
- `scripts/migrate-property-json.cjs` (new)
- `scripts/migrate-property-json.test.cjs` (new)
- `scripts/verify-property-data.cjs`
- `docs/property-json-migration.md` (this report)

The new npm command is `npm run migrate:property-json -- <stage>`. Stages are `audit`, `backfill`, `verify`, `drop`, and `final`; the completed installation can be checked with `final`. The script refuses to overwrite its original backup.
