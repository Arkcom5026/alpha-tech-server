# ALPHA-TECH Input Tax 10/10 — Step 10C Certification Preparation

## Server authority

Branch: `feature/input-tax-step-9-10-assurance`

Baseline main SHA: `6e5bf4b4013f405bdc601825690c4274cd2ae6d0`

Repository comparison at handoff: branch ahead of main, behind 0. No Prisma migration files were introduced by Step 9–10A work.

## Local gate sequence

Run from `D:\alpha-tech\server` after fetching the branch. Do not push to `origin/main` until every required gate passes.

```powershell
git fetch origin
git status --short
git switch main
git pull --ff-only origin main
git switch -c integration/input-tax-step-9-10 origin/feature/input-tax-step-9-10-assurance

git diff --check origin/main...HEAD
npx prisma validate
npx prisma generate

node tests/input-tax-step-9a-capability.contract.test.js
node tests/input-tax-step-9b-concurrency-replay.contract.test.js
node tests/input-tax-step-9c-bounds.contract.test.js
node tests/input-tax-step-9d-operational-assurance.contract.test.js
node tests/input-tax-step-10a-frontend-contract.contract.test.js
npm run test:tax-intake
npm run test:input-tax-overview
npm run verify:tax-authority
```

If targeted verification passes, perform the repository-required broader certification that is practical in the Local gate. Startup/runtime verification must use the existing local/test DB authority and must not mutate Production merely to pass certification.

## Merge-to-local-main rule

After verification on the integration branch:

```powershell
git switch main
git merge --no-ff integration/input-tax-step-9-10
```

Re-run the required targeted checks on merged local `main`. Push `main` only after PASS.

## Operational evidence still required

Repository PASS does not equal Operational PASS. Step 10D must still prove browser → FE API → BE → Prisma → DB → projection → UI and inspect read-only DB post-conditions for the selected master/adverse scenarios.
