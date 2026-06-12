# Neutralizovaná master specifikace

Tato kopie zachovává obecné architektonické a procesní principy dodané specifikace. Není definicí žádné existující hry ani plánem referenční hry. Příklady v dokumentu jsou nekanonické ilustrace a nesmí být přebírány jako herní obsah.

---

# MASTER SPECIFIKACE A ŘÍZENÍ PROJEKTU
# Univerzální narativní RPG engine, AI-first editor a Git-first spolupráce

**Stav:** kanonické zadání projektu  
**Účel:** jednotný zdroj pravdy pro vlastníka projektu, ChatGPT, Codex a další vývojové nástroje  
**Hlavní zásada:** konkrétní hra je datový a modulární balíček nad univerzálním enginem, nikoli součást jádra

---

# 1. Vize projektu

Cílem je vytvořit dlouhodobě použitelný webový engine pro narativní hry kombinující:

- textové RPG,
- visual novel,
- gamebook,
- adventuru,
- simulaci živého světa,
- větvené dialogy,
- průzkum,
- hádanky a minihry,
- vztahové, stavové a dedukční systémy.

Engine musí být opakovaně použitelný pro:

- žánrově specifické,
- fantasy,
- postapo,
- detektivku,
- horor,
- historické drama,
- satiru,
- pokračování stejné hry,
- zcela nový herní modul s jinou estetikou a pravidly.

První referenční hra může používat žánrově specifické, absurdní humor, byrokracii, cynismus, beznaděj a časovou smyčku. Tyto prvky ale nesmí být pevně zakódované do univerzálního jádra.

---

# 2. Základní architektura

Projekt musí být rozdělen na:

- **Engine Core** – stav, pravidla, podmínky, efekty a simulace.
- **Runtime UI** – prezentace konkrétní hry.
- **Editor** – tvorba, kontrola a vizualizace obsahu.
- **Game Data** – konkrétní herní obsah.
- **Game Modules** – volitelné mechaniky.
- **Tooling** – validace, migrace, export, simulace.
- **Tests** – jednotkové, integrační, obsahové a vizuální testy.

## 2.1 Co nesmí být v jádru natvrdo

Jádro nesmí předpokládat:

- žánrově specifické terminály,
- vysílačky,
- environmentální riziko,
- opakující se časový model,
- kritický časovač,
- K20,
- konkrétní inventární sekce,
- konkrétní sloty vybavení,
- konkrétní typy miniher,
- konkrétní questový model,
- konkrétní UI skin.

Tyto věci musí být řešeny jako data, konfigurace nebo moduly.

## 2.2 Stabilní identifikátory

Každá entita musí mít:

- stabilní textové ID,
- typ entity,
- verzi schématu,
- tagy,
- metadata o původu,
- metadata o změně.

Příklad:

```text
room.example_world.p0.area_07
npc.example_world.EXAMPLE_AGENT
portal.example_world.p0.area_to_corridor
fact.example_world.system.manual_override
```

Přejmenování publikovaného ID vyžaduje alias nebo migraci.

---


# 2A. Striktní oddělení Engine, Data a UX

Toto je jeden z nejdůležitějších architektonických principů projektu a nesmí být porušen.

Projekt musí být rozdělen na tři hlavní nezávislé vrstvy:

## A. Engine

Engine obsahuje pouze:

- správu stavu,
- vyhodnocování podmínek,
- provádění efektů,
- čas,
- eventy,
- scény,
- dialogovou logiku,
- questovou logiku,
- simulaci NPC,
- validaci,
- save/load,
- pluginová rozhraní.

Engine nesmí obsahovat:

- konkrétní příběh,
- konkrétní dialogy,
- konkrétní názvy NPC,
- konkrétní mapu,
- konkrétní obrázky,
- konkrétní CSS,
- konkrétní layout,
- konkrétní žánrově specifické terminologii,
- konkrétní UI texty.

Engine musí být spustitelný:

- bez grafického UI,
- s testovacím CLI,
- s jinou prezentační vrstvou,
- s jiným herním balíčkem.

## B. Herní data

Herní data obsahují:

- příběh,
- dialogy,
- scény,
- místnosti,
- NPC,
- questy,
- předměty,
- fakta,
- stopy,
- události,
- mapu,
- audio odkazy,
- vizuální odkazy,
- lokalizační texty,
- pravidlovou konfiguraci konkrétní hry.

Herní data nesmí obsahovat:

- vykonatelný kód mimo povolený deklarativní formát,
- přímé DOM operace,
- CSS,
- logiku konkrétního UI,
- engine implementaci,
- nevalidované skripty.

Výměnou herního balíčku musí být možné spustit úplně jinou hru bez změny enginu.

## C. UX / Prezentační vrstva

Prezentační vrstva obsahuje:

- layout,
- CSS,
- komponenty,
- animace,
- theme,
- typografii,
- ikony,
- vizuální styl,
- způsob zobrazení dialogů,
- způsob zobrazení mapy,
- způsob zobrazení inventáře,
- přístupnost,
- ovládání,
- responzivitu.

UX vrstva nesmí rozhodovat o herní logice.

UX pouze:

1. načte stav z enginu,
2. zobrazí dostupné akce,
3. odešle uživatelský vstup,
4. zobrazí výsledek.

Změna UX nesmí vyžadovat změnu příběhu ani logiky enginu.

Musí být možné vytvořit více klientů nad stejnou hrou:

- desktop web UI,
- mobilní UI,
- minimalistické textové UI,
- visual novel UI,
- přístupné UI,
- editorový preview klient,
- headless testovací klient.

## D. Editor

Editor nesmí být součástí runtime logiky.

Editor:

- vytváří a upravuje data,
- validuje data,
- zobrazuje náhled,
- generuje diff,
- připravuje handoff,
- spouští testy.

Runtime hry nesmí být závislý na editoru.

## E. Kontrakty mezi vrstvami

Vrstvy spolu komunikují pouze přes stabilní kontrakty.

Povinné kontrakty:

- Game Data Schema,
- Engine State API,
- Command API,
- Event API,
- View Model API,
- Save Schema,
- Plugin API,
- Theme API,
- Localization API.

Žádná vrstva nesmí sahat přímo do interní implementace jiné vrstvy.

## F. View Model vrstva

Mezi enginem a UX musí být samostatná View Model vrstva.

Jejím úkolem je převést interní stav enginu na bezpečný prezentační model.

Příklad:

Engine ví:

```text
choice.dialogue.guard.bribe
condition_result = false
reason = reputation.guard < 40
```

UX dostane:

```text
label = "Pokusit se strážného podplatit"
visible = true
enabled = false
locked_reason = "Strážný ti zatím nevěří."
```

UX nikdy nemá přímo vyhodnocovat herní podmínky.

## G. Theme systém

Grafická reprezentace musí být plně zaměnitelná přes theme balíčky.

Theme může definovat:

- barvy,
- fonty,
- rámečky,
- spacing,
- ikony,
- portrétní styl,
- zvukový profil,
- animace,
- vzhled dialogu,
- vzhled mapy,
- vzhled terminálu,
- vzhled journalu.

Jedna hra může mít více theme variant.

Příklad:

```text
themes/neutral-theme-text/
themes/neutral-theme-minimal/
themes/fantasy-parchment/
themes/postapo-rust/
```

## H. Zakázané vazby

Je zakázáno:

- zapisovat příběh do React komponent,
- zapisovat CSS do herních dat,
- rozhodovat questový stav v UI,
- používat ID DOM elementů v datech,
- ukládat herní logiku do editoru,
- číst interní stav enginu přímo z UI,
- měnit engine kvůli změně vzhledu,
- měnit data kvůli změně layoutu.

## I. Povinné testy oddělení

Musí existovat testy, které ověří:

- stejná herní data fungují ve dvou různých UI,
- stejné UI funguje se dvěma různými hrami,
- engine funguje bez UI,
- editor není nutný pro spuštění hry,
- změna theme nemění save ani stav,
- změna lokalizace nemění logiku,
- herní data neobsahují nepovolený kód,
- UI nevyhodnocuje podmínky mimo View Model API.

## J. Architektonické pravidlo

Každá nová funkce musí být zařazena do správné vrstvy:

- pokud mění pravidla hry, patří do enginu nebo modulu,
- pokud mění obsah, patří do herních dat,
- pokud mění vzhled nebo ovládání, patří do UX,
- pokud mění tvorbu obsahu, patří do editoru,
- pokud mění komunikaci mezi vrstvami, vyžaduje změnu kontraktu a případně ADR.

Toto pravidlo má vyšší prioritu než pohodlí krátkodobé implementace.


# 3. Herní balíček

Každá hra nebo epizoda musí mít vlastní manifest.

Manifest určuje:

- ID hry,
- verzi hry,
- kompatibilní verzi enginu,
- aktivní moduly,
- startovní scénu,
- startovní lokaci,
- jazyky,
- theme,
- assets,
- pravidlový profil,
- save namespace,
- pluginy,
- migrace,
- obsahové balíčky.

Příklad:

```text
games/original-example/
games/original-example-episode-02/
games/fantasy-demo/
games/postapo-investigation/
```

---

# 4. Jednotný systém podmínek

Všechny herní systémy musí používat společný **Condition Resolver**.

Podmínky mohou pracovat s:

- fakty,
- proměnnými,
- inventářem,
- vybavením,
- capabilities,
- statusy,
- statistikami,
- questy,
- vztahy,
- reputací,
- polohou,
- časem,
- počasím,
- stavem prostředí,
- stavem zařízení,
- stavem dveří,
- historií rozhodnutí,
- počtem návštěv,
- počtem smyček,
- výsledkem předchozí akce.

Podporovat:

- `all`,
- `any`,
- `not`,
- porovnání,
- rozsahy,
- existenci,
- počet,
- množinovou příslušnost,
- čas od události,
- vlastní validované predikáty.

Každá podmínka musí být v debug režimu vysvětlitelná.

---

# 5. Jednotný systém efektů

Veškeré změny stavu musí probíhat přes společný **Effect Executor**.

Efekty mohou:

- změnit proměnnou,
- přidat nebo odebrat fakt,
- přidat nebo odebrat předmět,
- vybavit předmět,
- aplikovat status,
- změnit vztah,
- změnit reputaci,
- posunout quest,
- přesunout NPC,
- změnit dveře,
- změnit zařízení,
- spustit scénu,
- spustit dialog,
- spustit minihru,
- přehrát zvuk,
- změnit hudbu,
- naplánovat událost,
- vytvořit encounter,
- přerušit cestu,
- spustit cycle reset,
- spustit konec hry.

Žádný plugin ani obsah nesmí obcházet validovaný stavový systém.

---

# 6. Doménové události a event log

Každá významná změna musí vytvořit doménovou událost.

Příklady:

```text
PlayerMoved
SceneStarted
DialogueChoiceSelected
SkillCheckResolved
FactLearned
ItemAcquired
NpcMoved
NpcRelationshipChanged
PortalUnlocked
QuestStageChanged
ScheduledEventTriggered
FastTravelInterrupted
CycleReset
EndingResolved
```

Event log se používá pro:

- reprodukci chyb,
- replay průchodu,
- automatické testy,
- vysvětlení stavu,
- analytiku,
- migrace,
- porovnání verzí,
- shrnutí průchodu.

Všechny náhodné systémy musí podporovat seed.

---

# 7. Čas a Event Scheduler

Engine musí podporovat:

- tahy,
- hodiny a dny,
- fáze,
- kapitoly,
- hybridní čas.

Akce může stát 0, 1 nebo více časových jednotek.

Scheduler musí umět:

- událost za X tahů,
- událost v konkrétní čas,
- opakování,
- cooldown,
- událost jednou za průchod,
- událost jednou za smyčku,
- reakci na změnu stavu,
- reakci na vstup a odchod,
- prioritu,
- přerušení scény,
- odložení.

Typy událostí:

- ambientní,
- informační,
- důležité,
- přerušující,
- kritické,
- systémové.

---

# 8. Svět, regiony a lokace

Svět musí podporovat hierarchii:

- svět,
- planeta nebo kontinent,
- region,
- oblast,
- budova nebo komplex,
- patro,
- místnost,
- sublokace.

Každá úroveň může definovat:

- počasí,
- hudbu,
- hazardy,
- encounter tabulky,
- frakční kontrolu,
- lokální pravidla,
- time scale,
- cestovní náklady.

---

# 9. Místnosti a hotspoty

Místnost může mít:

- popis,
- varianty popisu,
- obrázek,
- ambient,
- hudbu,
- hotspoty,
- NPC,
- zařízení,
- předměty,
- portály,
- hazardy,
- storylety,
- lokální eventy.

Hotspot nabízí kontextové akce.

Obecné akce:

- examine,
- talk,
- use,
- take,
- give,
- equip,
- read,
- listen,
- repair,
- sabotage,
- unlock,
- hack,
- search,
- combine,
- wait,
- communicate,
- travel.

Herní balíček může přidat vlastní akce, například:

- cast_spell,
- pray,
- scavenge,
- purify,
- diagnose,
- reroute_power.

Každá akce má:

- podmínky,
- cenu,
- čas,
- nástroj,
- check,
- text,
- efekty,
- opakovatelnost,
- cooldown.

---

# 10. Portály, dveře a průchody

Portál je samostatná entita.

Může mít:

- fyzický stav,
- bezpečnostní stav,
- energetický stav,
- environmentální stav,
- přístupová pravidla,
- capability požadavky,
- více způsobů překonání.

Možnosti překonání:

- předmět,
- kód,
- capability,
- reputace,
- skill check,
- minihra,
- dialog,
- změna jiného systému,
- násilné otevření,
- alternativní cesta.

---

# 11. Mapa a fast travel

Mapa podporuje:

- objevování lokací,
- známé a neznámé cesty,
- dynamické portály,
- vrstvy a patra,
- filtry,
- vazby na questy a problémy.

Fast travel:

1. vypočítá trasu,
2. simuluje mezikroky,
3. posouvá čas,
4. aktualizuje NPC,
5. vyhodnocuje hazardy,
6. zapisuje drobné události,
7. přeruší přesun při důležitém encounteru.

Fast travel nesmí být teleport.

---

# 12. Scene System

Scéna je obecnější než dialog.

Může obsahovat:

- vyprávění,
- více postav,
- dialog,
- volby,
- checky,
- zvuky,
- animace,
- portréty,
- pohyb,
- minihru,
- přerušení,
- následky.

Typy scén:

- rozhovor,
- nehoda,
- rituál,
- výslech,
- sen,
- flashback,
- přepadení,
- cestovní sekvence,
- epilog.

---

# 13. Dialogový systém

Dialogy musí podporovat:

- hluboké větvení,
- konvergenci,
- návraty k tématům,
- více mluvčích,
- vypravěče,
- vnitřní monology,
- skryté možnosti,
- pasivní checky,
- aktivní checky,
- emoce,
- portréty,
- přerušení,
- lokální a vzdálenou komunikaci,
- reakce podle historie,
- vstup pomocníka.

Každá řádka musí mít stabilní lokalizační ID.

---

# 14. Storylety

Storylet je malý kontextový narativní blok.

Obsahuje:

- podmínky,
- účastníky,
- lokaci,
- tagy,
- prioritu,
- váhu,
- cooldown,
- limit použití,
- scénu,
- efekty.

Použití:

- ambientní dialog,
- reakce na převlek,
- lokální incident,
- krátká vzpomínka,
- sen,
- cestovní událost,
- komentář pomocníka,
- důsledek dřívější volby.

---

# 15. NPC a sociální simulace

NPC může mít:

- identitu,
- roli,
- osobnost,
- cíle,
- potřeby,
- obavy,
- hodnoty,
- tón,
- slovník,
- tabu,
- citlivá témata,
- vztahy,
- reputační vazby,
- paměť,
- rutiny,
- capabilities,
- komunikační kanály,
- vlastnictví,
- vnímanou identitu hráče.

## 15.1 Paměť NPC

Paměť zaznamenává:

- výrok,
- čin,
- slib,
- lež,
- urážku,
- pomoc,
- citlivé téma,
- svědectví,
- důležitost,
- jistotu,
- čas,
- zdroj.

Paměť ovlivňuje:

- důvěru,
- podezření,
- respekt,
- strach,
- náklonnost,
- dialogy,
- pomoc,
- ceny,
- rutiny.

## 15.2 Rutiny a cíle

NPC může používat:

- pevný rozvrh,
- podmíněný rozvrh,
- eventové chování,
- jednoduchý utility systém priorit.

Chování musí být omezené, datové a vysvětlitelné.

## 15.3 Interakce mezi NPC

NPC mohou:

- mluvit,
- předávat informace,
- měnit vztahy,
- spolupracovat,
- hádat se,
- svědčit o činu,
- měnit rutinu.

---

# 16. Frakce, reputace, autorita a vlastnictví

Engine musí podporovat:

- frakce,
- podfrakce,
- reputaci,
- hodnosti,
- aliance,
- nepřátelství,
- kontrolu regionu,
- sdílení informací,
- oprávnění.

Systém vlastnictví podporuje:

- vlastnictví předmětu,
- vlastnictví oblasti,
- zakázaný vstup,
- krádež,
- svědky,
- důkazy,
- oznámení činu,
- reakci frakce.

---

# 17. Identita hráče a převleky

Engine může podporovat:

- jméno,
- zájmena,
- původ,
- povolání,
- archetyp,
- veřejnou roli,
- tajemství,
- frakci,
- počáteční dovednosti.

Převlek rozlišuje:

- skutečnou identitu,
- deklarovanou identitu,
- vnímanou identitu,
- kvalitu převleku,
- podezření,
- schopnost NPC převlek odhalit,
- falešné dokumenty.

---

# 18. RPG pravidla a checky

Jádro poskytuje obecný **Check Resolver**.

Herní balíček může používat:

- K20,
- 2K6,
- procenta,
- pool kostek,
- karty,
- deterministický test,
- resource spend,
- beznáhodový dialog.

Výsledky:

- kritické selhání,
- selhání,
- částečný úspěch,
- úspěch,
- kritický úspěch.

Referenční žánrově specifické hra může používat K20 a absurdní kritické výsledky.

---

# 19. Statistiky, zdroje a statusy

## Statistiky

- číselné,
- kategoriální,
- skryté,
- odvozené,
- trvalé,
- dočasně modifikované.

## Zdroje

Volitelné:

- zdraví,
- stres,
- energie,
- hlad,
- kyslík,
- magie,
- baterie,
- měna,
- časové body.

## Statusy

Status má:

- typ,
- intenzitu,
- vrstvy,
- dobu trvání,
- periodický efekt,
- zdroj,
- podmínku odstranění,
- viditelnost,
- modifikátory.

---

# 20. Capability systém

Engine nesmí testovat konkrétní jména předmětů.

Používá obecné capabilities:

```text
communication.remote
protection.vacuum
protection.toxin
vision.dark
access.arcane
access.security_level_2
identity.guard
repair.electronics
```

Jiný žánr může stejnou capability poskytnout jiným objektem.

---

# 21. Inventář, vybavení, dokumenty a stopy

Engine podporuje konfigurovatelné kolekce:

- předměty,
- vybavení,
- přístupy,
- dokumenty,
- stopy,
- aktivní problémy,
- hypotézy.

Předmět může být:

- sebratelný,
- spotřební,
- vybavitelný,
- kombinovatelný,
- použitelný na cíl,
- předatelný,
- důkazní,
- questový,
- unikátní,
- virtuální.

---

# 22. Journal, fakta a hypotézy

Engine podporuje:

- historii textu,
- historii rozhodnutí,
- fakta,
- stopy,
- dokumenty,
- codex,
- questy,
- aktivní problémy,
- hypotézy,
- shrnutí posledního hraní.

Fakt má:

- zdroj,
- čas,
- jistotu,
- viditelnost,
- persistenci,
- vazby na jiné fakty.

Hypotéza může:

- vzniknout automaticky,
- být aktivována hráčem,
- vyžadovat více stop,
- být mylná,
- odemykat dialogy a akce.

---

# 23. Questy a aktivní problémy

Quest podporuje:

- větve,
- více cest řešení,
- volitelné cíle,
- tajné cíle,
- časové podmínky,
- částečný úspěch,
- selhání,
- zrušení,
- reaktivaci,
- odlišné následky.

Fail-forward je výchozí pravidlo.

---

# 24. Komunikační kanály

Kanál může být:

- osobní,
- rádio,
- interkom,
- telefon,
- terminál,
- magie,
- dopis,
- posel,
- telepatie,
- síť.

Kanál definuje:

- dosah,
- dostupnost,
- cenu,
- zpoždění,
- soukromí,
- riziko odposlechu,
- kvalitu spojení,
- podporované scény.

---

# 25. Minihry a pluginy

Minihra je izolovaný plugin.

Musí mít:

- vstupní konfiguraci,
- seed,
- pravidlový kontext,
- časovou cenu,
- možné výsledky,
- výstupní efekty,
- save/restore,
- testovací adaptér,
- přístupnost.

Referenční minihry:

- dedukce hesla,
- propojení obvodů,
- byrokratické bludiště,
- páčení zámku.

Jiné hry mohou přidat:

- alchymii,
- rituál,
- opravu,
- dekódování mapy,
- karetní spor.

---

# 26. Hazardy

Hazard má:

- typ,
- intenzitu,
- oblast,
- zdroj,
- detekovatelnost,
- účinek za čas,
- ochrannou capability,
- možnost zmírnění,
- šíření,
- stav.

Příklady:

- environmentální riziko,
- radiace,
- toxin,
- oheň,
- mráz,
- tma,
- infekce,
- magická nákaza,
- prokletí.

---

# 27. Volitelné moduly

Volitelné moduly mohou zahrnovat:

- opakující se časový model,
- ekonomiku,
- survival,
- crafting,
- magii,
- stealth,
- počasí,
- boj,
- procedurální generování,
- New Game Plus.

Modul nesmí narušit veřejné kontrakty jádra.

---

# 28. Konec hry a epilog

Epilog se skládá z podmíněných fragmentů:

- osud hráče,
- osud NPC,
- osud frakcí,
- stav regionů,
- vztahy,
- vyřešené problémy,
- počet smyček,
- vedlejší následky.

Resolver musí:

- řešit priority,
- zabránit rozporům,
- vysvětlit výběr,
- umožnit test všech konců.

---

# 29. Lokalizace

Lokalizace musí být součástí návrhu od začátku.

Požadavky:

- stabilní line ID,
- oddělení textu od logiky,
- UI překlady,
- dialogové překlady,
- lokalizované assets,
- rody,
- množná čísla,
- skloňování,
- fallback,
- kontrola chybějících překladů,
- import/export tabulek.

---

# 30. Narrative Bible

Každá hra musí mít Narrative Bible:

- žánr,
- tón,
- témata,
- zakázaná témata,
- pravidla světa,
- technologii nebo magii,
- chronologii,
- terminologii,
- stylistická pravidla,
- vypravěče,
- míru humoru,
- míru násilí,
- pravidla názvů,
- kanonická fakta,
- profily postav.

AI smí generovat obsah jen s relevantním kontextem z Bible.

---

# 31. Runtime UI

UI může kombinovat:

- gamebookový text,
- visual novel scény,
- portréty,
- hotspoty,
- mapu,
- journal,
- quest log,
- codex,
- komunikaci,
- minihry.

Požadavky:

- responzivita,
- klávesnice,
- historie textu,
- přeskočení známého textu,
- nastavení rychlosti,
- omezení animací,
- velikost písma,
- přístupnost,
- oddělený theme systém.

---

# 32. Audio a VFX

Engine podporuje:

- hudební vrstvy,
- ambient,
- SFX,
- hlasové linky,
- fade,
- priority,
- textové efekty,
- animace.

Efekty musí mít:

- fallback,
- možnost vypnutí,
- omezení blikání,
- validaci neznámých tagů.

---

# 33. Save, load a migrace

Save musí obsahovat:

- verzi enginu,
- verzi hry,
- verzi schématu,
- aktivní moduly,
- seed,
- runtime stav,
- stav průchodu,
- metastav,
- event trace.

Požadavky:

- manuální save/load,
- atomický zápis,
- ochrana proti poškození,
- migrace,
- testy migrací,
- hard reset,
- import testovacího save.

---

# 34. Editor

Editor je samostatná webová aplikace.

Musí umět editovat:

- svět,
- regiony,
- místnosti,
- portály,
- hotspoty,
- zařízení,
- NPC,
- frakce,
- scény,
- dialogy,
- storylety,
- questy,
- předměty,
- fakta,
- stopy,
- hypotézy,
- codex,
- eventy,
- audio,
- minihry.

Vizuální nástroje:

- node editor,
- map editor,
- timeline,
- relationship graph,
- dependency graph,
- reference explorer,
- diff,
- preview,
- simulace.

## 34.1 Explain State

Editor musí vysvětlit:

- proč je volba dostupná,
- proč je volba skrytá,
- kdo změnil stav,
- odkud přišel fakt,
- proč se NPC přesunulo,
- proč se spustil event,
- jak byl spočítán check,
- proč byl vybrán epilog.

## 34.2 AI-first workflow

1. Autor vybere kontext.
2. Editor sestaví context pack.
3. AI vytvoří návrh podle kontraktu.
4. Proběhne schema validace.
5. Proběhne referenční validace.
6. Proběhne narativní validace.
7. Editor zobrazí diff.
8. Člověk změnu schválí.
9. Vznikne task report a commit.
10. CI spustí testy.

AI nesmí zapisovat neschválená data do hlavní větve.

---

# 35. Validace

Validátor musí kontrolovat:

- duplicitní ID,
- neexistující reference,
- typovou správnost,
- cykly,
- slepé uzly,
- nedosažitelný obsah,
- nesplnitelné questy,
- chybějící předměty,
- konfliktní podmínky,
- chybějící assets,
- chybějící lokalizaci,
- neplatné capabilities,
- chybějící migrace,
- nekonzistentní epilogy,
- soft-locky,
- nevyužité entity.

Závažnost:

- info,
- warning,
- error,
- blocker.

---

# 36. Testování

## Jednotkové testy

- Condition Resolver,
- Effect Executor,
- Check Resolver,
- Scheduler,
- pathfinding,
- save migrace,
- capability systém,
- epilog resolver.

## Integrační testy

- dialog + quest,
- dveře + capability,
- NPC rutina + event,
- fast travel + interruption,
- minihra + efekty,
- cycle reset + persistence.

## Headless simulátor

- skriptované průchody,
- random testing,
- test konkrétního questu,
- test všech voleb,
- test všech konců,
- seed,
- replay,
- export trace.

## Coverage

- místnosti,
- scény,
- volby,
- quest větve,
- storylety,
- konce,
- nepoužité entity.

## Visual QA

- screenshot scénáře,
- různé viewporty,
- overflow,
- dlouhé texty,
- visual regression,
- screenshot při chybě.

---

# 37. Git-first spolupráce

Repozitář je jediný zdroj pravdy.

Konverzace, ZIP balíky a lokální poznámky nejsou kanonické, dokud nejsou zapsané do repozitáře.

## 37.1 Doporučená struktura

```text
/
├─ PROJECT_CHARTER.md
├─ AGENTS.md
├─ README.md
├─ CHANGELOG.md
├─ apps/
│  ├─ runtime/
│  └─ editor/
├─ packages/
│  ├─ engine-core/
│  ├─ engine-contracts/
│  ├─ condition-engine/
│  ├─ event-engine/
│  ├─ dialogue-engine/
│  ├─ simulation/
│  ├─ validation/
│  ├─ save-system/
│  └─ ui-components/
├─ games/
│  ├─ original-example/
│  └─ examples/
├─ plugins/
├─ schemas/
├─ docs/
│  ├─ spec/
│  ├─ adr/
│  ├─ contracts/
│  ├─ roadmap/
│  ├─ status/
│  ├─ ideas/
│  ├─ tasks/
│  │  ├─ ready/
│  │  ├─ active/
│  │  ├─ review/
│  │  ├─ blocked/
│  │  └─ done/
│  ├─ handoffs/
│  ├─ reports/
│  ├─ narrative/
│  └─ diagrams/
├─ tests/
├─ migrations/
├─ tools/
└─ .github/
```

---

# 38. Hierarchie autority dokumentů

Při rozporu platí:

1. `PROJECT_CHARTER.md`
2. `docs/spec/MASTER_SPEC.md`
3. `docs/adr/`
4. `docs/contracts/`
5. `docs/roadmap/ROADMAP.md`
6. `docs/status/CURRENT_STATE.md`
7. `docs/tasks/`
8. zdrojový kód a testy
9. komentáře a poznámky

Implementace odporující vyššímu dokumentu je chyba, dokud není schválená změna specifikace.

---

# 39. AGENTS.md

Soubor musí obsahovat závazné instrukce pro AI nástroje:

- které dokumenty jsou autoritativní,
- jaké příkazy spustit,
- jak pracovat s tasky,
- jak předat výsledek,
- které soubory nesmí nástroj měnit bez ADR,
- zákaz tichého rozšíření scope,
- zákaz změny kontraktů bez migrace,
- zákaz práce mimo aktivní task,
- povinnost aktualizovat stav a handoff.

---

# 40. Řízení projektu

Projekt musí mít vždy jasný:

- směr,
- milestone,
- aktuální stav,
- pořadí práce,
- aktivní úkoly,
- blokace,
- rozhodnutí,
- rizika,
- následující krok.

Projekt nesmí fungovat jako nekonečný seznam nápadů bez priorit.

---

# 41. Kanonický TODO systém

## 41.1 Kategorie záznamů

Každý záznam musí patřit právě do jedné kategorie:

### IDEA
Neschválený nápad. Není součástí plánu a nesmí se implementovat.

### CANDIDATE
Nápad prošel základním posouzením a může být zařazen do budoucího milestone.

### PLANNED
Schválená položka v roadmapě, ale ještě není připravená k implementaci.

### READY
Má kompletní zadání, závislosti a akceptační kritéria.

### ACTIVE
Právě se implementuje.

### REVIEW
Implementace je hotová a čeká na kontrolu.

### BLOCKED
Nelze pokračovat kvůli konkrétní překážce.

### DONE
Splňuje Definition of Done.

### REJECTED
Nebude se realizovat. Musí obsahovat důvod.

### DEFERRED
Odloženo mimo aktuální roadmapu.

## 41.2 Pravidlo WIP limitu

Aby se projekt nerozjel do všech stran:

- jeden vývojový agent smí mít pouze jeden hlavní ACTIVE task,
- projekt smí mít omezený počet aktivních tasků,
- nový task se neaktivuje, dokud není předchozí dokončen nebo explicitně zablokován,
- výjimka vyžaduje záznam v `CURRENT_STATE.md`.

Doporučený limit:

- 1 aktivní architektonický task,
- 1 aktivní implementační task na vývojový proud,
- 1 aktivní obsahový task,
- 1 aktivní výzkumný task.

## 41.3 Identifikace úkolů

Každý úkol má stabilní ID:

```text
TASK-001
TASK-002
BUG-001
SPIKE-001
DOC-001
CONTENT-001
```

Typy:

- `TASK` – implementace,
- `BUG` – chyba,
- `SPIKE` – výzkum nebo prototyp,
- `DOC` – dokumentace,
- `CONTENT` – herní obsah,
- `MIGRATION` – migrace dat nebo saveů.

## 41.4 Povinná pole tasku

```markdown
# TASK-012: Název

## Stav
READY

## Priorita
P0 / P1 / P2 / P3

## Milestone
M1 – Core Foundation

## Cíl
Jedna jasná věta.

## Kontext
Proč task existuje.

## Autoritativní odkazy
- MASTER_SPEC: kapitola 4
- ADR-0003
- CONTRACT-condition-v1

## Scope
Co se smí měnit.

## Out of scope
Co se nesmí měnit.

## Závislosti
- TASK-008

## Blokuje
- TASK-017

## Akceptační kritéria
- [ ] ...

## Povinné testy
- [ ] ...

## Povolené soubory
- packages/condition-engine/**
- tests/unit/condition/**

## Zakázané změny
- save schema
- dialogue schema

## Rizika
...

## Migrační dopad
NONE / REQUIRED

## Výstupní artefakty
...

## Definition of Done
...
```

## 41.5 Priority

### P0 – kritické
Blokuje aktuální milestone nebo poškozuje data.

### P1 – vysoké
Nutné pro aktuální milestone.

### P2 – střední
Důležité, ale neblokuje dokončení milestone.

### P3 – nízké
Vylepšení nebo komfort.

Priorita není totéž jako pořadí. Pořadí určuje roadmapa a závislosti.

---

# 42. Aktuální stav projektu

Musí existovat jediný soubor:

```text
docs/status/CURRENT_STATE.md
```

Tento soubor je krátký, aktuální a vždy se aktualizuje po významné změně.

Povinná struktura:

```markdown
# Aktuální stav projektu

## Datum aktualizace
YYYY-MM-DD

## Aktuální milestone
M1 – Core Foundation

## Hlavní cíl milestone
...

## Celkové zdraví
GREEN / YELLOW / RED

## Hotovo
- ...

## Právě probíhá
- TASK-012 – ...

## Následující úkol
- TASK-013 – ...

## Blokace
- ...

## Poslední rozhodnutí
- ADR-0004 – ...

## Otevřená rizika
- RISK-003 – ...

## Co se nyní nesmí dělat
- nezačínat editor mapy
- neměnit save schema

## Nejbližší kontrolní bod
- po dokončení TASK-013
```

Soubor nesmí být dlouhý backlog. Je to řídicí panel projektu.

---

# 43. Roadmapa a milestones

Roadmapa musí být vedena v:

```text
docs/roadmap/ROADMAP.md
```

Každý milestone musí mít:

- jasný výsledek,
- vstupní podmínky,
- výstupní podmínky,
- seznam povinných funkcí,
- seznam výslovně odložených funkcí,
- závislosti,
- rizika,
- demonstrační scénář,
- Definition of Done.

Doporučené milestone:

## M0 – Governance and Contracts
- repozitář,
- dokumentace,
- AGENTS,
- task systém,
- ADR,
- contracts,
- CI skeleton.

## M1 – Core Foundation
- state,
- conditions,
- effects,
- event log,
- scheduler,
- validation.

## M2 – Narrative Vertical Slice
- scény,
- dialog,
- fakta,
- quest,
- jedna místnost,
- jedno NPC,
- save/load.

## M3 – World Simulation
- mapa,
- portály,
- NPC rutiny,
- storylety,
- fast travel,
- hazardy.

## M4 – Editor Foundation
- entity editor,
- graph,
- validation,
- diff,
- preview.

## M5 – AI-first Workflow
- context pack,
- schema generation,
- review,
- handoff,
- Git integration.

## M6 – Reference Game
- žánrově specifické modul,
- opakující se časový model,
- terminály,
- minihry,
- kompletní demo.

Nový milestone se nesmí zahájit bez dokončení výstupních podmínek předchozího, kromě schválené výjimky.

---

# 44. Systém nápadů

Nápady se nesmí zapisovat přímo do TODO.

Každý nápad patří do:

```text
docs/ideas/IDEA-XXXX-short-name.md
```

Povinná struktura:

```markdown
# IDEA-0021: Název

## Stav
IDEA

## Problém
Jaký problém řeší?

## Návrh
Co navrhuje?

## Přínos
...

## Náklady
LOW / MEDIUM / HIGH

## Rizika
...

## Dopad na architekturu
NONE / LOW / HIGH

## Dopad na UX
...

## Závislosti
...

## Alternativy
...

## Doporučení
REJECT / DEFER / CANDIDATE

## Rozhodnutí
Nevyplněno do schválení.
```

## 44.1 Idea review

Nápady se vyhodnocují pouze v plánovací kontrole.

Každý nápad může být:

- zamítnut,
- odložen,
- sloučen s jiným,
- přijat jako candidate,
- převeden na SPIKE,
- zařazen do budoucího milestone.

Nápad se nesmí implementovat jen proto, že je zajímavý.

---

# 45. Change Control

Každá změna směru musí být klasifikována.

## Malá změna
Nemění kontrakt ani milestone. Stačí změna tasku.

## Střední změna
Mění více tasků nebo roadmapu. Vyžaduje change request.

## Velká změna
Mění architekturu, veřejné API, save formát nebo hlavní směr. Vyžaduje ADR a aktualizaci MASTER_SPEC.

Change request obsahuje:

- důvod,
- dopad,
- alternativy,
- náklady,
- rizika,
- změnu roadmapy,
- migrační plán.

---

# 46. Rozhodovací brány

Projekt musí mít pravidelné brány.

## Gate A – Ready for Development

Task může do READY pouze pokud:

- má scope,
- má out of scope,
- má akceptační kritéria,
- má závislosti,
- má testy,
- neobsahuje otevřenou architektonickou otázku.

## Gate B – Ready for Review

Task může do REVIEW pouze pokud:

- kód je hotový,
- testy běží,
- dokumentace je aktualizovaná,
- handoff existuje,
- známé limity jsou popsané.

## Gate C – Done

Task je DONE pouze pokud:

- splnil akceptační kritéria,
- prošel CI,
- prošel kontrolou,
- nemá skrytý dluh,
- CURRENT_STATE je aktualizovaný.

## Gate D – Milestone Complete

Milestone je hotový pouze pokud:

- jsou splněny výstupní podmínky,
- demo scénář funguje,
- blocker bugy jsou uzavřené,
- dokumentace odpovídá implementaci,
- existuje stavový report.

---

# 47. Handoff mezi ChatGPT a Codexem

Každá implementační dávka musí obsahovat:

1. task package,
2. relevantní specifikaci,
3. relevantní ADR,
4. povolené soubory,
5. akceptační kritéria,
6. příkazy k testování,
7. očekávaný handoff.

Po dokončení vznikne:

```text
docs/handoffs/TASK-012-HANDOFF.md
```

Obsah:

- shrnutí změny,
- seznam souborů,
- provedené testy,
- výsledky,
- neprovedené testy,
- známé limity,
- technický dluh,
- migrační dopad,
- bezpečnostní dopad,
- doporučený další task,
- commit nebo PR.

ChatGPT při další práci nejprve čte:

1. `CURRENT_STATE.md`,
2. aktivní task,
3. poslední handoff,
4. relevantní ADR,
5. změny v repozitáři.

Codex nebo jiný nástroj nesmí pokračovat podle starého promptu, pokud se kanonické soubory změnily.

---

# 48. Architektonická rozhodnutí

Každá zásadní změna vyžaduje ADR:

```text
docs/adr/ADR-0007-event-log-storage.md
```

ADR obsahuje:

- stav,
- kontext,
- rozhodnutí,
- alternativy,
- důsledky,
- migrační dopad,
- související tasky.

Stavy:

- proposed,
- accepted,
- superseded,
- rejected,
- deprecated.

---

# 49. Git workflow

## Větve

```text
feat/TASK-012-condition-engine
fix/BUG-044-fast-travel
docs/DOC-052-master-spec
spike/SPIKE-008-editor-graph
```

Jedna větev = jeden task.

## Commity

Používat Conventional Commits:

```text
feat(condition): add nested all/any/not evaluation
fix(save): preserve persistent facts during cycle reset
docs(spec): define plugin sandbox contract
test(dialogue): add unreachable-choice coverage
```

## Pull request

PR musí obsahovat:

- task ID,
- změny,
- důvod,
- testy,
- rizika,
- migrace,
- screenshoty,
- handoff.

---

# 50. CI brány

Merge je zakázán při selhání:

- lint,
- typecheck,
- unit tests,
- contract tests,
- schema validation,
- content validation,
- migration tests,
- determinism tests,
- build,
- dependency audit,
- relevant visual tests.

---

# 51. Risk Register

Musí existovat:

```text
docs/status/RISKS.md
```

Každé riziko má:

- ID,
- popis,
- pravděpodobnost,
- dopad,
- skóre,
- vlastníka,
- mitigaci,
- trigger,
- stav.

Příklady hlavních rizik:

- příliš široký scope,
- nekontrolované AI změny,
- rozpad datových kontraktů,
- editor předbíhá engine,
- save nekompatibilita,
- příliš složitá simulace NPC,
- nedostatečná validace obsahu,
- monolitické game data,
- předčasná optimalizace,
- příliš mnoho aktivních modulů.

---

# 52. Technický dluh

Technický dluh se nesmí skrývat v komentářích.

Eviduje se jako task nebo záznam:

```text
docs/status/TECH_DEBT.md
```

Každý dluh má:

- příčinu,
- dopad,
- oblast,
- prioritu,
- plán odstranění,
- nejzazší milestone.

---

# 53. Pravidelné projektové reporty

Po každém významném balíčku vznikne report:

```text
docs/reports/REPORT-YYYY-MM-DD.md
```

Obsah:

- co bylo plánováno,
- co bylo dokončeno,
- co nebylo dokončeno,
- proč,
- nové problémy,
- změny rizik,
- změny roadmapy,
- doporučený další krok.

Report nesmí přepisovat CURRENT_STATE; pouze jej dokládá.

---

# 54. Definition of Ready

Task je připravený pouze pokud:

- je napojen na milestone,
- má jednoznačný cíl,
- scope je omezený,
- out of scope je jasný,
- existují akceptační kritéria,
- jsou známé závislosti,
- nejsou otevřené zásadní otázky,
- jsou určené testy,
- je určeno, co se nesmí změnit.

---

# 55. Definition of Done

Task je dokončený pouze pokud:

- implementace odpovídá zadání,
- testy prošly,
- dokumentace odpovídá,
- handoff je hotový,
- migrace jsou hotové,
- není známý blocker,
- CURRENT_STATE je aktualizovaný,
- task je přesunut do `done/`,
- PR je sloučený.

---

# 56. Anti-scope pravidla

Aby se projekt nerozjel do všech stran:

1. Nápad se nikdy neimplementuje přímo.
2. Každá práce musí mít task ID.
3. Každý task musí patřit do milestone.
4. Jeden task nesmí řešit více nesouvisejících systémů.
5. Editor nesmí předbíhat kontrakty enginu.
6. Herní obsah nesmí určovat architekturu jádra bez ADR.
7. Nový modul se nepřidává, dokud není jasný skutečný use case.
8. Refaktor se nespojuje s novou funkcí bez důvodu.
9. Po změně směru se aktualizuje roadmapa a CURRENT_STATE.
10. Nástroj nesmí tajně rozšířit scope.
11. Pokud vznikne nový nápad během implementace, zapíše se jako IDEA.
12. Další krok se vždy vybírá podle roadmapy, závislostí a rizik, ne podle atraktivity.

13. Engine, herní data a UX musí zůstat striktně oddělené; změna jedné vrstvy nesmí vynucovat změnu ostatních mimo veřejný kontrakt.

---

# 57. Doporučený první vývojový postup

## Fáze 0 – Governance

1. vytvořit repozitář,
2. přidat PROJECT_CHARTER,
3. přidat MASTER_SPEC,
4. přidat AGENTS,
5. vytvořit roadmapu,
6. vytvořit CURRENT_STATE,
7. vytvořit task a ADR šablony,
8. nastavit CI skeleton.

## Fáze 1 – Contracts

1. definovat entity ID,
2. definovat schema versioning,
3. definovat Condition kontrakt,
4. definovat Effect kontrakt,
5. definovat Event kontrakt,
6. definovat Game Manifest,
7. vytvořit contract testy.

## Fáze 2 – Core

1. state store,
2. condition resolver,
3. effect executor,
4. event log,
5. scheduler,
6. save snapshot,
7. validation.

## Fáze 3 – První vertical slice

1. jedna místnost,
2. jeden hotspot,
3. jedna NPC,
4. jeden dialog,
5. jeden fakt,
6. jeden quest,
7. jeden check,
8. save/load,
9. headless test.

Teprve po úspěšném vertical slice se rozšiřují mapa, rutiny, editor a moduly.

---

# 58. Další doporučení k vývoji

## 58.1 Contract-first

Nejdříve veřejné kontrakty, až potom implementace.

## 58.2 Vertical slice před šířkou

Nejdříve malý plně funkční průchod, ne deset polovičních systémů.

## 58.3 Editor nesmí být zdroj logiky

Editor tvoří a validuje data. Logika patří do enginu.

## 58.4 Referenční hra jako test, ne diktátor

existující hra ověřuje engine, ale nesmí ho uzamknout do žánrově specifické.

## 58.5 Malé PR

Malé změny se lépe kontrolují, testují a vracejí.

## 58.6 Automatické generování dokumentace

Datová schémata a plugin API by měla generovat referenční dokumentaci.

## 58.7 Kompatibilitní matice

Udržovat kompatibilitu:

- engine,
- editor,
- schema,
- save,
- game package,
- plugin API.

## 58.8 Feature flags

Nedokončené systémy musí být skryté za feature flagy.

## 58.9 Deprecation policy

Veřejné rozhraní se nejprve označí jako deprecated, pak migruje a až poté odstraní.

## 58.10 Decision log

Každé „proč“ musí být dohledatelné v ADR, tasku nebo reportu.

---

# 59. Povinné řídicí soubory při startu projektu

Před první větší implementací musí existovat:

```text
PROJECT_CHARTER.md
AGENTS.md
docs/spec/MASTER_SPEC.md
docs/roadmap/ROADMAP.md
docs/status/CURRENT_STATE.md
docs/status/RISKS.md
docs/status/TECH_DEBT.md
docs/tasks/TASK_TEMPLATE.md
docs/ideas/IDEA_TEMPLATE.md
docs/adr/ADR_TEMPLATE.md
docs/handoffs/HANDOFF_TEMPLATE.md
.github/PULL_REQUEST_TEMPLATE.md
```

---

# 60. Výchozí pravidlo pro další práci

Každý nový pracovní cyklus musí začít odpovědí na pět otázek:

1. Jaký je aktuální milestone?
2. Jaký je aktuální stav?
3. Jaký je jediný následující nejdůležitější úkol?
4. Co tento úkol nesmí měnit?
5. Jak poznáme, že je hotový?

Pokud na tyto otázky nelze odpovědět z repozitáře, projekt není připraven pokračovat.


# 61. Doplňující produkční a architektonická pravidla

Tato kapitola doplňuje povinné oblasti z celkové revize zadání. Výslovně nejsou zahrnuty:
- Narrative Director a repetition management,
- samostatný autorský DSL oddělený od runtime formátu.

Tyto dvě oblasti jsou odloženy a mohou být později řešeny samostatným ADR, pokud se ukáže jejich skutečná potřeba.

---

## 61.1 Command, Transaction a Event pipeline

Veškeré hráčské a systémové akce musí procházet jednotným tokem:

```text
UI nebo AI agent
→ Command
→ validace commandu
→ vyhodnocení pravidel
→ příprava efektů
→ transakční aplikace efektů
→ validace výsledného stavu
→ commit transakce
→ doménové události
→ aktualizace View Modelu
```

### Command

Command představuje záměr:

- `MovePlayer`
- `SelectDialogueChoice`
- `UseItemOnTarget`
- `EquipItem`
- `StartCommunication`
- `AttemptCheck`
- `FastTravel`
- `Wait`

UI nesmí přímo měnit stav.

### Effect

Effect je validovaná změna:

- `SetFact`
- `ChangeRelationship`
- `UnlockPortal`
- `AdvanceQuest`
- `ApplyStatus`
- `MoveNpc`

### Event

Event je záznam toho, co skutečně nastalo:

- `PlayerMoved`
- `DialogueChoiceSelected`
- `ItemUsed`
- `PortalUnlocked`
- `QuestStageChanged`
- `TurnAdvanced`

---

## 61.2 Transakční změny stavu

Každá akce, která obsahuje více efektů, musí být atomická.

Postup:

1. načíst aktuální validní stav,
2. vytvořit pracovní kopii,
3. ověřit podmínky a reference,
4. aplikovat efekty na pracovní kopii,
5. validovat výsledný stav,
6. potvrdit všechny změny najednou,
7. zapsat eventy a trace.

Pokud některý krok selže:

- nesmí zůstat částečně aplikovaný stav,
- transakce se zruší,
- zachová se poslední validní stav,
- vytvoří se diagnostický záznam,
- runtime zobrazí bezpečnou chybu.

Efekty se standardně provádějí v pořadí uvedeném v datech, ale celý balík musí být předem validován.

---

## 61.3 Script Extension API

Libovolný JavaScript v herních datech je zakázán.

Vlastní logika může být dostupná pouze přes předem registrované a typované rozšíření.

Každá funkce musí deklarovat:

- stabilní ID,
- verzi API,
- vstupy,
- výstupy,
- možné efekty,
- determinismus,
- použití náhody,
- požadovaná oprávnění,
- testovací adaptér.

Neověřený balíček nesmí:

- používat `eval`,
- spouštět shell,
- číst lokální soubory uživatele,
- přistupovat k síti bez oprávnění,
- číst secrets,
- měnit DOM,
- zapisovat mimo vlastní namespace.

---

## 61.4 Pravda, znalost, přesvědčení a hypotézy

Engine musí rozlišovat:

### Objektivní pravdu světa

Co je skutečně pravda.

```text
truth.system_failure_cause = sabotage
```

### Znalost hráčské postavy

Co hráčská postava zjistila nebo považuje za známé.

```text
knowledge.system_failure_cause = maintenance_error
```

### Přesvědčení NPC

Čemu věří konkrétní NPC.

```text
belief.marta.system_failure_cause = player_fault
```

### Informaci nebo stopu

Informace musí mít:

- zdroj,
- čas získání,
- jistotu,
- věrohodnost,
- možnost vyvrácení,
- vztah k jiným informacím,
- stav ověření.

### Hypotézu

Stavy:

- nepotvrzená,
- podporovaná,
- vyvrácená,
- potvrzená,
- částečně pravdivá.

`Known Facts` nesmí míchat objektivní pravdu, tvrzení NPC a hráčovy domněnky do jedné neodlišené kolekce.

---

## 61.5 Viditelnost a spoiler policy

Každá informace musí mít definovanou úroveň viditelnosti:

- interní stav,
- znalost postavy,
- hráčsky viditelná informace,
- autorská informace,
- debug informace.

Zamčená volba může být:

- skrytá,
- viditelná a zamčená,
- viditelná s obecným důvodem,
- viditelná s přesnou podmínkou.

Každá hra musí definovat vlastní `Spoiler Policy`.

Debug režim může zobrazit přesné podmínky. Produkční UX smí zobrazit pouze to, co povoluje herní design.

---

## 61.6 Source provenance a dohledatelnost

Každá kompilovaná nebo generovaná entita musí být dohledatelná ke zdroji.

Metadata:

- `source_file`,
- `source_entity_id`,
- `source_revision`,
- `source_line`, pokud je dostupný,
- `generated_by`,
- `task_id`,
- `commit`,
- `approval_state`.

Runtime chyba musí být převoditelná na konkrétní zdrojovou entitu.

---

## 61.7 Asset pipeline

Všechny assets musí být spravovány přes Asset Manifest.

Každý asset má:

- stabilní ID,
- typ,
- soubor,
- hash,
- autora,
- licenci,
- původ,
- rozměry nebo délku,
- formát,
- varianty,
- fallback,
- stav schválení,
- lokalizační variantu.

Pipeline musí podporovat:

- import,
- validaci,
- optimalizaci,
- kompresi,
- lazy loading,
- cache busting,
- fallback,
- detekci nepoužitých assetů,
- kontrolu licencí.

Portréty mají podporovat:

- postavu,
- emoci,
- pózu,
- kostým,
- poškození,
- světlo,
- lokalizovanou variantu.

Audio rozlišuje:

- hudbu,
- ambient,
- UI zvuky,
- voice-over,
- looping,
- priority,
- ducking,
- fade,
- přerušitelnost.

---

## 61.8 Build a distribuční pipeline

Build hry musí provést:

1. validaci dat,
2. validaci referencí,
3. zpracování lokalizace,
4. zpracování assetů,
5. vytvoření runtime bundle,
6. vytvoření indexů,
7. výpočet hashů,
8. test kompatibility,
9. vytvoření distribučního manifestu,
10. spuštění smoke testů.

Podporované profily:

- development,
- preview,
- staging,
- production,
- offline build.

Výchozí doporučení:

- klientský runtime,
- statický hosting,
- možnost offline provozu,
- žádná povinná serverová závislost,
- lokální save s importem a exportem.

---

## 61.9 Error Recovery Policy

Runtime nesmí hráči zobrazovat technické stack traces.

Typy chyb:

- obsahová chyba,
- neexistující reference,
- nekompatibilní save,
- poškozená data,
- chyba pluginu,
- chyba assetu,
- chyba úložiště,
- chyba UX,
- neočekávaná runtime chyba.

Runtime musí umět:

- obnovit poslední validní snapshot,
- zrušit neúspěšnou transakci,
- použít fallback asset,
- přeskočit nekritickou ambientní událost,
- bezpečně zastavit kritickou scénu,
- exportovat diagnostický balíček.

Editor musí:

- chybu lokalizovat,
- otevřít problémovou entitu,
- zobrazit trace,
- nabídnout založení BUG tasku.

---

## 61.10 Performance Budget

Projekt musí definovat měřitelné limity:

- čas jednoho game-loop kroku,
- čas sestavení View Modelu,
- velikost save,
- velikost počátečního bundle,
- dobu načtení lokace,
- počet eventů na tah,
- počet plně simulovaných NPC,
- počet aktivních audio stop.

NPC mohou používat úrovně simulace:

- full simulation,
- coarse simulation,
- scheduled summary,
- suspended.

Vzdálené entity nesmí být zbytečně simulovány se stejnou podrobností jako aktuální oblast hráče.

---

## 61.11 Build-time indexy

Při buildu se mají vytvářet indexy:

- entity podle typu,
- entity podle tagu,
- reverse references,
- storylety podle lokace,
- scény podle účastníků,
- facts používané podmínkami,
- assets používané scénami,
- lokalizační line IDs,
- reference graph.

Runtime nemá draze prohledávat všechna data při každém tahu.

---

## 61.12 Plugin kontrakt

Každý plugin deklaruje:

- ID,
- verzi,
- kompatibilitu s enginem,
- závislosti,
- capabilities,
- nové entity,
- commands,
- effects,
- view model extensions,
- UI extension points,
- save data,
- migrace,
- permissions,
- test adapter.

Lifecycle:

1. register,
2. validate,
3. initialize,
4. load game,
5. restore save,
6. run,
7. unload.

Musí být definováno:

- řešení konfliktu ID,
- řešení nekompatibilní verze,
- chování při chybějícím pluginu,
- pořadí inicializace,
- dopad na save.

---

## 61.13 Explicitní non-goals první verze

První stabilní verze nebude obsahovat:

- multiplayer,
- real-time boj,
- plnohodnotnou fyziku,
- 3D renderer,
- libovolný JavaScript v datech,
- automatické publikování AI obsahu,
- plugin marketplace,
- cloudové účty,
- povinný backend,
- komplexní ekonomickou simulaci,
- procedurální generování celé hry,
- online simultánní editaci více autorů.

Rozšíření non-goals vyžaduje změnu roadmapy.

---

## 61.14 Role a oprávnění editoru

Editor musí architektonicky počítat s rolemi:

- owner,
- designer,
- writer,
- editor,
- translator,
- developer,
- reviewer,
- AI agent.

Není nutné implementovat účty v první verzi. Každá změna ale musí zaznamenat původ a roli.

Příklad:

- překladatel smí změnit překlad,
- nesmí měnit questovou logiku,
- AI agent smí vytvořit draft,
- nesmí publikovat kanonický obsah.

---

## 61.15 Undo, redo a návrhový stav

Editor musí podporovat:

- undo,
- redo,
- lokální draft,
- autosave konceptu,
- diff proti Gitu,
- zahazování změn,
- obnovu po pádu,
- batch editaci,
- validaci před potvrzením.

AI výstup je vždy návrh, dokud jej člověk neschválí.

---

## 61.16 Semantic diff a merge

Data musí mít:

- canonical formatting,
- stabilní pořadí,
- atomické soubory,
- žádné náhodné přeuspořádání,
- semantic diff,
- reference-aware merge report.

Konflikt stejné entity změněné ve více větvích musí být explicitně označen.

---

## 61.17 Ownership oblastí

Repozitář musí mít odpovědnost za oblasti, například pomocí CODEOWNERS nebo interní tabulky.

Příklad:

```text
engine-core      → architecture owner
schemas          → contract owner
editor           → editor owner
game-data        → narrative owner
localization     → localization owner
save-system      → persistence owner
```

AI agent není vlastníkem architektonického rozhodnutí.

---

## 61.18 Release management

Odděleně verzovat:

- engine,
- schema,
- editor,
- game package,
- save format,
- plugin API.

Používat:

- semantic versioning,
- release candidate,
- release notes,
- compatibility matrix,
- hotfix proces,
- rollback plán.

Příklad:

```text
engine 0.4.0
schema 3
editor 0.3.2
game 0.1.0
save 2
plugin-api 1
```

---

## 61.19 Bezpečnost dodavatelského řetězce

Požadavky:

- lockfile,
- dependency audit,
- secret scanning,
- kontrola licencí,
- automatické aktualizace pouze přes PR,
- zákaz API klíčů v repozitáři,
- SBOM pro release,
- hash release balíčků.

Neověřená závislost se nesmí přidat bez review.

---

## 61.20 Ochrana dat a soukromí

Pokud projekt použije:

- cloud save,
- telemetry,
- crash reporting,
- LLM API,
- účty,

musí být definováno:

- jaká data se odesílají,
- souhlas,
- anonymizace,
- retence,
- možnost vypnutí,
- ochrana příběhového obsahu.

První verze nebude vyžadovat povinnou telemetrii.

---

## 61.21 Observabilita

Log musí obsahovat:

- timestamp,
- úroveň,
- subsystém,
- command ID,
- transaction ID,
- entity ID,
- turn,
- scene,
- seed,
- verzi save a dat.

Režimy:

- player,
- developer,
- test,
- editor.

Logování citlivých textů a AI promptů musí být vypnuté ve výchozím stavu.

---

## 61.22 Playtest metriky

Playtest trace může sledovat:

- místa zaseknutí,
- přehlížené volby,
- žádosti o nápovědu,
- opakované akce,
- čas řešení problému,
- místa ukončení,
- orientaci na mapě,
- používání journalu.

Metriky nemusí být odesílány automaticky. Mohou být exportovány se souhlasem hráče.

---

## 61.23 Onboarding

Onboarding musí být datově řízený.

Podporuje:

- kontextové vysvětlení,
- první použití funkce,
- postupné odemykání UI,
- bezpečné tutorialové situace,
- opakování nápovědy,
- přeskočení tutorialu.

Onboarding nesmí být pevně svázán s jedním žánrem.

---

## 61.24 Kognitivní zátěž

UX musí:

- zobrazovat relevantní informace,
- postupně odemykat systémy,
- seskupovat položky podle problémů,
- zvýraznit nový obsah,
- umožnit filtrování,
- umožnit připnutí problému,
- propojovat fakta, dokumenty, NPC, lokace a questy.

Journal nesmí být pouhý archiv textu.

---

## 61.25 Přístupnost

Povinné možnosti:

- ovládání klávesnicí,
- viditelný focus,
- screen-reader labels,
- TTS kompatibilita,
- titulky a přepis zvuků,
- nezávislé hlasitosti,
- vysoký kontrast,
- změna velikosti textu,
- omezení pohybu,
- omezení blikání,
- alternativní ovládání miniher,
- časově neomezené varianty,
- ukládání nastavení mimo save hry.

---

## 61.26 Asistence a obtížnost

Obtížnost má být konfigurovatelná po jednotlivých systémech.

Možnosti:

- zobrazit nebo skrýt pravděpodobnost checku,
- více pokusů,
- neomezený čas,
- zvýraznit stopu,
- silnější nápověda,
- přeskočit minihru,
- omezit kritická selhání,
- ochrana proti ztrátě postupu.

Asistence nesmí automaticky měnit příběhový obsah.

---

## 61.27 Prezentace důsledků

Každá hra definuje, zda volba ukazuje:

- použitý skill,
- obtížnost,
- časovou cenu,
- spotřebu předmětu,
- nevratnost,
- ukončení dialogu,
- významnou změnu světa.

Herní modul rozhoduje o množství zveřejněných informací.

---

## 61.28 Progress Guarantees

Každá kritická překážka musí mít:

- dosažitelnou cestu,
- nebo fail-forward větev,
- nebo možnost resetu,
- nebo musí být označena jako nepovinná.

Validátor musí sledovat:

- required capabilities,
- zdroje capabilities,
- spotřebu kritických předmětů,
- nevratné volby,
- časové limity,
- jednosměrné portály,
- kritická NPC.

---

## 61.29 Golden paths

Každá hra musí obsahovat testovací průchody:

- minimální hlavní cesta,
- alternativní cesta,
- fail-forward cesta,
- kritické selhání,
- test resetu,
- test epilogu,
- test bez nepovinných mechanik.

Golden paths jsou součástí verzovaného repozitáře.

---

## 61.30 Playtest režim editoru

Autor musí umět:

- přepínat fakta,
- měnit vztahy,
- teleportovat se,
- nastavit čas,
- vynutit hod,
- zobrazit skryté volby,
- přeskočit do scény,
- simulovat smyčku,
- uložit stav jako fixture,
- vytvořit screenshot,
- vytvořit bug report.

---

## 61.31 Narativní lint

Kontrolovat:

- extrémně dlouhé repliky,
- opakované formulace,
- změnu jména,
- porušení tónu NPC,
- nekonzistentní tykání a vykání,
- předčasně známou informaci,
- neznámou terminologii,
- spoiler v textu volby,
- chybějící reakci na zásadní událost.

Narativní lint vytváří warningy. Nesmí automaticky měnit kanonický obsah.

---

## 61.32 Content budgets

Konfigurovatelná varování:

- počet voleb,
- délka repliky,
- délka scény,
- počet nových pojmů,
- počet nepřečtených položek,
- počet aktivních questů,
- četnost ambientních událostí.

Jedná se o designová varování, ne vždy o build blocker.

---

## 61.33 AI provenance

AI návrh musí zaznamenat:

- použitý nástroj nebo model,
- datum,
- prompt template,
- context pack verzi,
- schema verzi,
- task ID,
- stav lidského schválení.

Stavy:

- AI draft,
- human edited,
- approved,
- canonical.

AI nesmí bez schválení:

- publikovat obsah,
- měnit veřejný kontrakt,
- měnit save schema,
- mazat obsah,
- měnit Narrative Bible.

---

## 61.34 Context Pack kontrakt

Context pack musí obsahovat:

- aktivní task,
- CURRENT_STATE,
- relevantní specifikaci,
- relevantní ADR,
- kontrakty,
- dotčené entity,
- Narrative Bible,
- validační pravidla,
- povolené soubory,
- poslední handoff.

Context pack musí mít:

- manifest,
- verzi,
- hash,
- seznam zahrnutých souborů.

AI nástroj nesmí pokračovat podle zastaralého context packu.

---

## 61.35 Reprodukovatelné vývojové prostředí

Musí být pevně určeno:

- verze Node.js,
- package manager,
- verze TypeScriptu,
- příkazy,
- lint,
- formatter,
- pre-commit hooks,
- dev container nebo ekvivalent,
- test fixtures.

Povinné jednotné příkazy:

```text
install
build
test
validate
simulate
preview
```

---

## 61.36 Architektonické boundary testy

Automaticky kontrolovat:

- UI neimportuje interní engine moduly,
- engine neimportuje konkrétní hru,
- editor není runtime dependency,
- herní data neobsahují kód,
- theme nemění stav,
- plugin nepoužívá zakázané interní API,
- core neobsahuje žánrové termíny.

---

## 61.37 Kompatibilitní fixtures

Repozitář musí obsahovat:

- minimální validní hru,
- kompletní referenční hru,
- nevalidní datové příklady,
- starší save,
- migrační fixture,
- plugin fixture,
- dvě UI nad stejnou hrou,
- dvě hry nad stejným UI.

Tyto fixtures dokazují univerzálnost architektury.

---

## 61.38 Doporučená modularizace jádra

Doporučené logické členění:

```text
engine-kernel
engine-state
engine-rules
module-scenes
module-dialogue
module-world
module-npc
module-quests
module-inventory
module-knowledge
module-travel
```

Není cílem vytvářet mikrobalíček pro každý soubor. Hranice musí vycházet ze skutečné odpovědnosti a stabilních kontraktů.

---

## 61.39 Hráčská rizika

### Příliš mnoho systémů
Řešit progresivním odemykáním a kontextovým UI.

### Ambientní šum
Řešit frekvenčními limity a relevancí.

### Obtížně dostupné NPC
Řešit rozvrhem, komunikací a poslední známou polohou.

### Opakující se časový model únava
Řešit přeskočením známého obsahu a rychlejšími postupy.

### Frustrace ze skill checků
Řešit fail-forward, částečnými úspěchy a alternativami.

### Journal jako skladiště
Řešit vazbami, filtry a prioritou relevance.

