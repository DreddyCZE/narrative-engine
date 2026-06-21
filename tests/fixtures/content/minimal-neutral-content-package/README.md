# Minimal Neutral Content Package Fixture

This fixture is the first minimal neutral content package example for M3.

## Purpose

- provide a data-only content package fixture aligned with the M3 content contracts
- give TASK-034 and TASK-035 a neutral input sample
- prove representative section coverage without adding runtime behavior

## Included Sections

- `entities`
- `locations`
- `actors`
- `items`
- `documents`
- `dialogues`
- `quests`
- `systems`
- `commands`
- `conditions`
- `effects`
- `eventMappings`
- `localization`
- `assetReferences`
- `validationManifest`

## Included References

- actor to location
- location to entity
- item to location
- document to location
- dialogue to actor and location
- quest to location, item, and command
- command to condition and effect
- event mapping to command
- text-bearing records to localization keys

## Non-Goals

- no loader implementation
- no content graph resolver
- no schema validation engine
- no runtime execution
- no Save system
- no Event Store
- no persistence
- no UI/editor behavior
- no gameplay or branded content

## Future Use

TASK-034 may use this fixture as a loader-boundary input example.
TASK-035 may use this fixture as a neutral content sample when connecting validated content to M2
primitives.
