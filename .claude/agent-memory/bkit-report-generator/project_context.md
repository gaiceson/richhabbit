---
name: rich_habbit project context
description: Key information about the rich_habbit project structure and recent work
type: project
---

## Project Overview

**Project**: rich_habbit (habit tracking application)
**Type**: Mobile app with Toss integration
**Architecture**: JavaScript/TypeScript with cloud sync capabilities

## Key Modules

### Core JavaScript Modules
- **ai-coach.js**: Statistics and habit completion rate calculations, evening messaging
- **db.js**: Database management with cloud sync functionality
- **ad-manager.js**: Ad loading and reward system integration (Toss app)

## Recent Activity (2026-03-19)

### Critical Bugs Fixed

1. **ai-coach.js - Stats Overcounting**
   - Issue: `_getWeeklyRate()`, `_getPrevWeeklyRate()`, `_eveningMsg()` counted ALL habits including deleted ones
   - Fix: Added `habitIds` Set filtering against current active habits
   - Files: js/ai-coach.js + dist/web/js/ai-coach.js

2. **db.js - Cloud Sync Race Condition**
   - Issue: User-added library habits lost during cloud sync; cloud habits lacked `timeSlot` field
   - Fix: Preserve local-only habits during merge; use RichDB.getHabitById() as template for missing fields
   - Files: js/db.js + dist/web/js/db.js

3. **ad-manager.js - Ad Loading Failure**
   - Issue: Previous callback pattern broke ad loading; TypeError from missing `_rewardAdCallbacks` property
   - Fix: Reverted to direct `loadFullScreenAd` calls; restored live ad ID: `ait.v2.live.7b90676a43a94211`
   - Files: js/ad-manager.js + dist/web/js/ad-manager.js

## File Structure
- Source code: js/
- Distribution: dist/web/js/
- Reports: docs/04-report/features/

## Next Steps

- Unit test coverage for stats and sync logic needed
- Gap analysis for js fixes pending
- Error tracking system recommended for detecting regressions
