# M0 Gate D Review

## Datum

2026-06-13

## Rozsah kontroly

Formální plánovací kontrola dokončení milestone `M0 - Governance and Contracts`. Kontrola ověřila
kanonické dokumenty, workflow tasků a handoffů, CI a reprodukovatelnost, non-goals, připravenost
M1 a rizika. Nebyla provedena žádná implementace enginu ani změna veřejných kontraktů.

## Kontrolované commity

- 2849bb8
- 6a45f41
- c2b3c3f

## Vstupní podmínky

- [x] Working tree byl před Gate D čistý.
- [x] Repozitář je Git repozitář na větvi `main`.
- [x] Kanonický kontext byl načten z charteru, agent pravidel, master specifikace, roadmapy,
  statusů, ADR, kontraktů, tasků, handoffů, CI a root `package.json`.
- [x] M0 tasky TASK-001, TASK-002 a TASK-003 byly před kontrolou ve stavu `DONE`.
- [x] Žádný task nebyl v `docs/tasks/active`.

## Výstupní podmínky

- [x] Povinné governance dokumenty existují.
- [x] `docs/spec/MASTER_SPEC.md` je kanonická neutralizovaná kopie specifikace.
- [x] Roadmapa existuje a označuje M0 jako dokončené po Gate D.
- [x] `CURRENT_STATE.md`, `RISKS.md` a `TECH_DEBT.md` existují a odpovídají aktuálnímu stavu.
- [x] Task, idea, ADR, handoff a PR workflow mají šablony.
- [x] Contract inventory, dependency order a versioning policy existují.
- [x] Architecture boundary dokumentace, checker a testovací fixtures existují.
- [x] CI používá Node 22, pnpm, frozen lockfile a spouští předepsané kontroly.
- [x] Jednotné projektové příkazy existují a provádějí skutečné kontroly.
- [x] Neexistuje aktivní task.
- [x] Byl vytvořen pouze jeden nový READY task pro další krok: TASK-004.

## Kontroly a výsledky

- `git status --short` - čistý před Gate D.
- `git log --oneline --decorate -10` - obsahuje commity `c2b3c3f`, `6a45f41`, `2849bb8`.
- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm test` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm check:boundaries` - passed.
- `corepack pnpm validate` - passed.

Lokální prostředí používalo Node `v24.16.0`, takže pnpm hlásí očekávaný engine warning. Není to
blocker, protože projekt i CI jsou pinované na Node 22.

## Dokumentační konzistence

Hierarchie autority je konzistentní:

1. `PROJECT_CHARTER.md`
2. `docs/spec/MASTER_SPEC.md`
3. `docs/adr/`
4. `docs/contracts/`
5. `docs/roadmap/ROADMAP.md`
6. `docs/status/CURRENT_STATE.md`
7. `docs/tasks/`
8. implementace a testy

Nalezená malá procesní nesrovnalost: roadmapa původně říkala, že M0 exit criteria vyžadují přesně
jeden aktivní task. To platí pro práci během tasku, ne pro uzavření milestone. Roadmapa byla
redakčně zpřesněna na konzistentní stav: při práci nejvýše jeden aktivní task, při uzavření
milestone žádný aktivní task.

## Task a handoff konzistence

- [x] TASK-001 je `DONE` a má handoff.
- [x] TASK-002 je `DONE` a má handoff.
- [x] TASK-003 je `DONE` a má handoff.
- [x] `DOC-001` byl procesně uzavřen jako `DONE`, protože governance dokumenty byly dodány
  bootstrap commitem.
- [x] `ADR-0001` byl procesně uzavřen jako `DONE`, protože přijatý ADR existuje a zůstává
  konzistentní.
- [x] Každý dokončený task má odpovídající handoff a commit.
- [x] `docs/tasks/active/` neobsahuje aktivní task.
- [x] `docs/tasks/ready/` obsahuje pouze další návrhový task `TASK-004`.

## CI a reprodukovatelnost

- [x] `.nvmrc` pinujeme na Node 22.
- [x] `packageManager` pinujeme na `pnpm@9.15.4`.
- [x] `pnpm-lock.yaml` existuje.
- [x] CI používá `node-version-file: .nvmrc`.
- [x] CI používá `pnpm install --frozen-lockfile`.
- [x] CI spouští lint, typecheck, test, build, boundary check a validate.
- [x] CI má minimální `contents: read` permissions.
- [x] CI neobsahuje secrets, deployment ani publishing kroky.

## Non-goals kontrola

M0 neimplementovalo:

- Engine State,
- Condition Resolver,
- Effect Executor,
- Command pipeline,
- Transaction Manager,
- Domain Event runtime,
- Scheduler,
- Save systém,
- runtime UI,
- editor UI,
- game framework,
- konkrétní hru,
- plugin runtime,
- theme systém.

Skeleton balíčků, kontraktová dokumentace, validace a boundary fixtures nejsou porušením non-goals.

## Připravenost M1

1. První kontrakt M1: Entity Identity Contract.
2. Závislosti: žádné tvrdé předchozí kontrakty; musí být kompatibilní se Schema Versioning,
   Source Provenance a Validation Diagnostic návrhem.
3. Scope: stabilní ID formát, entity type, schema version, tagy, provenance, change metadata,
   aliasy, přejmenování, validace, serializace, fixtures a kompatibilita.
4. Explicitně mimo scope: runtime registry, State Store, resolvery, executory, konkrétní game
   entities, editor UI a save migration implementace.
5. Potřebné fixtures: minimální validní identita, reprezentativní validní identita, nevalidní ID,
   kolize, alias na chybějící cíl, validní alias po přejmenování, nekompatibilní schema version.
6. Vlastník: `packages/engine-contracts`.
7. Verzování: Contract version a schema-level identity rules podle
   `CONTRACT_VERSIONING_POLICY.md`.
8. Done: samostatný contract dokument, jasné fixture požadavky, validace rozsahu a všechny
   předepsané kontroly.

## Otevřená rizika

- Scope creep při prvním M1 contract design tasku.
- Předčasná implementace pipeline místo návrhu kontraktu.
- Falešný pocit bezpečí z boundary checkeru, který neověřuje doménovou logiku.
- Lokální Node 24 warning mimo CI.
- Směšování contract designu a implementace.

## Blockery

NONE

## Gate D rozhodnutí

PASS

## Zdůvodnění

M0 povinné výstupy existují, kontroly procházejí, dokumentační autorita je bez blocker rozporu,
task workflow je po procesní opravě konzistentní a M1 má jednoznačně určený první contract-first
task bez zahájení implementace.

## Povolený následující krok

Review a případná aktivace `TASK-004 - Design Entity Identity Contract`.
