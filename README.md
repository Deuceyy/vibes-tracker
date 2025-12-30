# Vibes TCG Tracker v2

Match tracker with **card tracking** and **automatic archetype detection** — like Hearthstone Deck Tracker.

## Features

- **Card Tracking**: Log cards as you see them during a match
- **Archetype Detection**: Automatically suggests opponent's deck archetype based on signature cards
- **Match Logging**: Track wins/losses, play/draw, opponent info
- **Statistics**: Win rates, matchup breakdowns, play/draw performance
- **Card Analytics**: See which cards you lose to most, win rates against specific cards
- **Decklists**: Import and manage your decklists

## Quick Start (Local)

```bash
pip install -r requirements.txt
python app.py
```

Open http://localhost:5000

## Deploy to Railway (New Instance)

1. **Create new GitHub repo:**
   - Go to github.com/new
   - Name it `vibes-tracker-v2`
   - Don't initialize with README

2. **Push this code:**
   ```bash
   cd vibes-tracker-v2
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/vibes-tracker-v2.git
   git push -u origin main
   ```

3. **Deploy on Railway:**
   - Go to railway.app
   - New Project → Deploy from GitHub
   - Select vibes-tracker-v2
   - Add Volume (mount at `/app`) for persistent database
   - Generate domain

## Archetype Detection

The system uses signature cards to identify deck archetypes:

| Archetype | Signature Cards |
|-----------|-----------------|
| GMP Caffeine Colo | Green Mega Penguin, Lil Caffeine, Colosseum |
| Red Removal | Potion Commotion, Not a Rod Anymore!, Layer a Lasagna |
| Bash Globe | Bashful Swordsman Penguin, Silent Snow Globe, Colosseum |
| Yum Yum | Yum Yum Penguin |
| ... | (see app.py for full list) |

To add/modify archetypes, edit the `ARCHETYPES` dict in `app.py`.

## Card Analytics

After logging matches with cards seen, you can analyze:
- **Cards in Losses**: Most common cards in games you lost
- **Cards in Wins**: Most common cards in games you won
- **Win Rate vs Card**: Your win rate when opponent plays specific cards

This helps identify problem cards and favorable matchups.
