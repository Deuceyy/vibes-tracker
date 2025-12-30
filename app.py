"""
Vibes TCG Tracker v2 - With Card Tracking & Archetype Detection
Flask backend with SQLite database
"""

from flask import Flask, render_template, request, jsonify, send_file
import sqlite3
import json
import os
import csv
import io
from datetime import datetime
from collections import Counter

app = Flask(__name__)

# Configuration
DB_FILE = os.environ.get("DB_PATH", "vibes_tracker.sqlite")

# ─────────────────────────────────────────────────────────────────────────────
# Card Database - All Vibes TCG Cards
# ─────────────────────────────────────────────────────────────────────────────

CARD_LIST = [
    "Mount Fuji", "Samantha Feathers, Pop Idol", "Penguin Who Bakes", "Lil Moonlight",
    "Lil Frosty", "Lil With Balloon", "Lil Zoomer", "Lil Daydreamer", "Green Mega Penguin",
    "Tina Who Tears", "Lil Extrovert", "Colosseum", "Bounce House Rod", "Lil Bellyacher",
    "Popcorn Penguin", "Lil Lookout", "The Champion of Clouds", "Lil Waker", "Lil Singer",
    "Layer a Lasagna", "Not Today!", "The Rampage of Duels", "Lil Wisher", "Lil Farmer",
    "Penguin a Lasagna", "Not Today", "The Warmest of Hugs", "Potion Commotion",
    "Not Holding", "Angel Ink Squad", "Inspiring Story", "Lil Singer", "Peace Out Penguin",
    "Heads I Win, Tails You Lose", "Toss Up", "Bashful Swordsman Penguin", "Silent Snow Globe",
    "Not a Rod Anymore!", "Serene Penguin", "Prosperous Penguin", "Simon Smasher",
    "What a Twist!", "Adventure Squad", "Lil Caffeine", "Lil Cozy", "Lil Floaty",
    "Lil Groovy", "Lil Happy", "Lil Hopeful", "Lil Joyful", "Lil Lucky", "Lil Mellow",
    "Lil Peaceful", "Lil Playful", "Lil Radiant", "Lil Serene", "Lil Snuggly",
    "Lil Sparkly", "Lil Sunny", "Lil Sweet", "Lil Tranquil", "Lil Warm", "Lil Whimsical",
    "Lil Zen", "Yum Yum Penguin", "Belly Flop", "Cosmic Penguin", "Disco Penguin",
    "Festival Penguin", "Fountain Penguin", "Galaxy Penguin", "Glitter Penguin",
    "Harmony Penguin", "Ice Cream Penguin", "Jubilee Penguin", "Karaoke Penguin",
    "Lantern Penguin", "Melody Penguin", "Neon Penguin", "Orchestra Penguin",
    "Party Penguin", "Quantum Penguin", "Rainbow Penguin", "Starlight Penguin",
    "Thunder Penguin", "Umbrella Penguin", "Velvet Penguin", "Waterfall Penguin",
    "Xylophone Penguin", "Yoga Penguin", "Zephyr Penguin", "Big Belly Penguin",
    "Bizbunk", "Alxi"
]

# ─────────────────────────────────────────────────────────────────────────────
# Archetype Detection - Signature Cards for Each Deck Type
# ─────────────────────────────────────────────────────────────────────────────

ARCHETYPES = {
    "GMP Caffeine Colo": {
        "signature": ["Green Mega Penguin", "Lil Caffeine", "Colosseum"],
        "supporting": ["Lil Bellyacher", "Lil Extrovert", "Mount Fuji"],
        "weight": 3
    },
    "GMP Colo": {
        "signature": ["Green Mega Penguin", "Colosseum"],
        "supporting": ["Lil Bellyacher", "Lil Extrovert", "Lil Lookout"],
        "weight": 2
    },
    "Red Removal": {
        "signature": ["Potion Commotion", "Not a Rod Anymore!", "Layer a Lasagna"],
        "supporting": ["Not Today!", "Lil Singer", "Silent Snow Globe"],
        "weight": 3
    },
    "Red Control": {
        "signature": ["Potion Commotion", "Layer a Lasagna"],
        "supporting": ["Lil Moonlight", "Mount Fuji", "Inspiring Story"],
        "weight": 2
    },
    "Yellow Control": {
        "signature": ["Silent Snow Globe", "Bashful Swordsman Penguin"],
        "supporting": ["Serene Penguin", "Prosperous Penguin", "What a Twist!"],
        "weight": 2
    },
    "Bash Globe": {
        "signature": ["Bashful Swordsman Penguin", "Silent Snow Globe", "Colosseum"],
        "supporting": ["Simon Smasher", "Lil Extrovert"],
        "weight": 3
    },
    "Colo Bash Globe": {
        "signature": ["Colosseum", "Bashful Swordsman Penguin", "Silent Snow Globe"],
        "supporting": ["Green Mega Penguin", "Lil Bellyacher"],
        "weight": 3
    },
    "Belly Colo": {
        "signature": ["Lil Bellyacher", "Colosseum", "Belly Flop"],
        "supporting": ["Big Belly Penguin", "Lil Extrovert"],
        "weight": 3
    },
    "Yum Yum": {
        "signature": ["Yum Yum Penguin"],
        "supporting": ["Lil Cozy", "Lil Snuggly", "Penguin Who Bakes"],
        "weight": 2
    },
    "Green Control": {
        "signature": ["Green Mega Penguin", "Inspiring Story"],
        "supporting": ["Mount Fuji", "Lil Moonlight", "Serene Penguin"],
        "weight": 2
    },
    "Green Aggro": {
        "signature": ["Green Mega Penguin", "Lil Zoomer", "Lil Extrovert"],
        "supporting": ["Lil Caffeine", "Bounce House Rod"],
        "weight": 2
    },
    "GMP Aggro": {
        "signature": ["Green Mega Penguin", "Lil Zoomer"],
        "supporting": ["Lil Caffeine", "Lil Extrovert", "Bounce House Rod"],
        "weight": 2
    },
    "Blue Mill": {
        "signature": ["Cosmic Penguin", "Galaxy Penguin"],
        "supporting": ["Quantum Penguin", "Starlight Penguin"],
        "weight": 2
    },
    "Bizbunk": {
        "signature": ["Bizbunk"],
        "supporting": ["Lil Groovy", "Lil Mellow"],
        "weight": 2
    },
    "Alxi": {
        "signature": ["Alxi"],
        "supporting": ["Adventure Squad", "Lil Lucky"],
        "weight": 2
    }
}

def detect_archetype(cards_seen):
    """
    Score each archetype based on cards seen.
    Returns list of (archetype, score, confidence) sorted by score.
    """
    if not cards_seen:
        return []
    
    cards_set = set(cards_seen)
    scores = []
    
    for archetype, data in ARCHETYPES.items():
        score = 0
        signature_hits = 0
        supporting_hits = 0
        
        # Signature cards are worth more
        for card in data["signature"]:
            if card in cards_set:
                score += 10
                signature_hits += 1
        
        # Supporting cards add smaller bonus
        for card in data["supporting"]:
            if card in cards_set:
                score += 3
                supporting_hits += 1
        
        # Apply archetype weight
        score *= data["weight"]
        
        # Calculate confidence based on signature card coverage
        if len(data["signature"]) > 0:
            confidence = (signature_hits / len(data["signature"])) * 100
        else:
            confidence = 0
        
        if score > 0:
            scores.append({
                "archetype": archetype,
                "score": score,
                "confidence": round(confidence),
                "signature_hits": signature_hits,
                "supporting_hits": supporting_hits
            })
    
    # Sort by score descending
    scores.sort(key=lambda x: x["score"], reverse=True)
    return scores

# ─────────────────────────────────────────────────────────────────────────────
# Database Helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    
    # Main matches table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS matches(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_time TEXT,
            my_deck TEXT,
            opp_name TEXT,
            opp_deck TEXT,
            result_match INTEGER,
            on_play_start INTEGER,
            notes TEXT
        );
    """)
    
    # Cards seen per match
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cards_seen(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            card_name TEXT,
            FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
        );
    """)
    
    # User's decklists
    conn.execute("""
        CREATE TABLE IF NOT EXISTS decklists(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            cards TEXT,
            created_at TEXT,
            is_public INTEGER DEFAULT 0
        );
    """)
    
    conn.execute("CREATE INDEX IF NOT EXISTS idx_dt ON matches(date_time);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_my ON matches(my_deck);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cards_match ON cards_seen(match_id);")
    conn.commit()
    conn.close()

def now_iso():
    return datetime.now().strftime("%Y-%m-%d %H:%M")

# ─────────────────────────────────────────────────────────────────────────────
# Routes - Pages
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

# ─────────────────────────────────────────────────────────────────────────────
# Routes - Card List & Archetype Detection
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/cards")
def get_cards():
    """Return all card names for autocomplete"""
    return jsonify(sorted(CARD_LIST))

@app.route("/api/archetypes")
def get_archetypes():
    """Return all archetype names"""
    return jsonify(sorted(ARCHETYPES.keys()))

@app.route("/api/detect-archetype", methods=["POST"])
def detect_archetype_api():
    """Detect archetype from list of cards seen"""
    cards = request.json.get("cards", [])
    results = detect_archetype(cards)
    return jsonify(results)

# ─────────────────────────────────────────────────────────────────────────────
# Routes - Matches API
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/matches", methods=["GET"])
def get_matches():
    conn = get_db()
    
    query = """
        SELECT id, date_time, my_deck, opp_name, opp_deck, 
               result_match, on_play_start, notes 
        FROM matches WHERE 1=1
    """
    params = []
    
    if request.args.get("date_from"):
        query += " AND date_time >= ?"
        params.append(request.args.get("date_from") + " 00:00")
    if request.args.get("date_to"):
        query += " AND date_time <= ?"
        params.append(request.args.get("date_to") + " 23:59")
    if request.args.get("my_deck"):
        query += " AND my_deck LIKE ?"
        params.append("%" + request.args.get("my_deck") + "%")
    if request.args.get("opp_deck"):
        query += " AND opp_deck LIKE ?"
        params.append("%" + request.args.get("opp_deck") + "%")
    if request.args.get("result") == "win":
        query += " AND result_match = 1"
    elif request.args.get("result") == "loss":
        query += " AND result_match = 0"
    
    query += " ORDER BY date_time DESC, id DESC"
    
    rows = conn.execute(query, params).fetchall()
    matches = [dict(row) for row in rows]
    
    # Get cards seen for each match
    for match in matches:
        cards = conn.execute(
            "SELECT card_name FROM cards_seen WHERE match_id = ?",
            (match["id"],)
        ).fetchall()
        match["cards_seen"] = [c["card_name"] for c in cards]
    
    conn.close()
    return jsonify(matches)

@app.route("/api/matches", methods=["POST"])
def add_match():
    data = request.json
    conn = get_db()
    
    cursor = conn.execute("""
        INSERT INTO matches (date_time, my_deck, opp_name, opp_deck, result_match, on_play_start, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        now_iso(),
        data.get("my_deck", ""),
        data.get("opp_name", ""),
        data.get("opp_deck", ""),
        1 if data.get("result") == "win" else 0,
        data.get("on_play"),
        data.get("notes", "")
    ))
    
    match_id = cursor.lastrowid
    
    # Insert cards seen
    cards_seen = data.get("cards_seen", [])
    for card in cards_seen:
        conn.execute(
            "INSERT INTO cards_seen (match_id, card_name) VALUES (?, ?)",
            (match_id, card)
        )
    
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "id": match_id})

@app.route("/api/matches/<int:match_id>", methods=["DELETE"])
def delete_match(match_id):
    conn = get_db()
    conn.execute("DELETE FROM cards_seen WHERE match_id = ?", (match_id,))
    conn.execute("DELETE FROM matches WHERE id = ?", (match_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/matches/<int:match_id>/cards", methods=["POST"])
def add_card_to_match(match_id):
    """Add a card to an existing match"""
    card_name = request.json.get("card_name")
    conn = get_db()
    conn.execute(
        "INSERT INTO cards_seen (match_id, card_name) VALUES (?, ?)",
        (match_id, card_name)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/matches/<int:match_id>/cards/<card_name>", methods=["DELETE"])
def remove_card_from_match(match_id, card_name):
    """Remove a card from a match"""
    conn = get_db()
    conn.execute(
        "DELETE FROM cards_seen WHERE match_id = ? AND card_name = ? LIMIT 1",
        (match_id, card_name)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})

# ─────────────────────────────────────────────────────────────────────────────
# Routes - Stats & Analytics
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/stats")
def get_stats():
    conn = get_db()
    
    my_deck = request.args.get("my_deck")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    
    where_clauses = []
    params = []
    
    if my_deck:
        where_clauses.append("my_deck = ?")
        params.append(my_deck)
    if date_from:
        where_clauses.append("date_time >= ?")
        params.append(date_from + " 00:00")
    if date_to:
        where_clauses.append("date_time <= ?")
        params.append(date_to + " 23:59")
    
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    # Overall stats
    total = conn.execute(f"SELECT COUNT(*) FROM matches WHERE {where_sql}", params).fetchone()[0]
    wins = conn.execute(f"SELECT COUNT(*) FROM matches WHERE {where_sql} AND result_match = 1", params).fetchone()[0]
    
    # Play/Draw stats
    otp_total = conn.execute(f"SELECT COUNT(*) FROM matches WHERE {where_sql} AND on_play_start = 1", params).fetchone()[0]
    otp_wins = conn.execute(f"SELECT COUNT(*) FROM matches WHERE {where_sql} AND on_play_start = 1 AND result_match = 1", params).fetchone()[0]
    otd_total = conn.execute(f"SELECT COUNT(*) FROM matches WHERE {where_sql} AND on_play_start = 0", params).fetchone()[0]
    otd_wins = conn.execute(f"SELECT COUNT(*) FROM matches WHERE {where_sql} AND on_play_start = 0 AND result_match = 1", params).fetchone()[0]
    
    # Matchup breakdown
    matchups_query = f"""
        SELECT opp_deck, 
               COUNT(*) as total,
               SUM(CASE WHEN result_match = 1 THEN 1 ELSE 0 END) as wins
        FROM matches 
        WHERE {where_sql} AND opp_deck != ''
        GROUP BY opp_deck
        ORDER BY total DESC
    """
    matchup_rows = conn.execute(matchups_query, params).fetchall()
    matchups = []
    for row in matchup_rows:
        matchups.append({
            "opp_deck": row["opp_deck"],
            "total": row["total"],
            "wins": row["wins"],
            "losses": row["total"] - row["wins"],
            "win_rate": round(row["wins"] / row["total"] * 100, 1) if row["total"] > 0 else 0
        })
    
    conn.close()
    
    return jsonify({
        "total": total,
        "wins": wins,
        "losses": total - wins,
        "win_rate": round(wins / total * 100, 1) if total > 0 else 0,
        "otp_total": otp_total,
        "otp_wins": otp_wins,
        "otp_win_rate": round(otp_wins / otp_total * 100, 1) if otp_total > 0 else 0,
        "otd_total": otd_total,
        "otd_wins": otd_wins,
        "otd_win_rate": round(otd_wins / otd_total * 100, 1) if otd_total > 0 else 0,
        "matchups": matchups
    })

@app.route("/api/analytics/cards-in-losses")
def cards_in_losses():
    """Cards most commonly seen in losses"""
    conn = get_db()
    my_deck = request.args.get("my_deck")
    
    query = """
        SELECT cs.card_name, COUNT(*) as count
        FROM cards_seen cs
        JOIN matches m ON cs.match_id = m.id
        WHERE m.result_match = 0
    """
    params = []
    
    if my_deck:
        query += " AND m.my_deck = ?"
        params.append(my_deck)
    
    query += " GROUP BY cs.card_name ORDER BY count DESC LIMIT 20"
    
    rows = conn.execute(query, params).fetchall()
    conn.close()
    
    return jsonify([{"card": r["card_name"], "count": r["count"]} for r in rows])

@app.route("/api/analytics/cards-in-wins")
def cards_in_wins():
    """Cards most commonly seen in wins"""
    conn = get_db()
    my_deck = request.args.get("my_deck")
    
    query = """
        SELECT cs.card_name, COUNT(*) as count
        FROM cards_seen cs
        JOIN matches m ON cs.match_id = m.id
        WHERE m.result_match = 1
    """
    params = []
    
    if my_deck:
        query += " AND m.my_deck = ?"
        params.append(my_deck)
    
    query += " GROUP BY cs.card_name ORDER BY count DESC LIMIT 20"
    
    rows = conn.execute(query, params).fetchall()
    conn.close()
    
    return jsonify([{"card": r["card_name"], "count": r["count"]} for r in rows])

@app.route("/api/analytics/winrate-vs-card")
def winrate_vs_card():
    """Win rate when opponent plays specific cards"""
    conn = get_db()
    my_deck = request.args.get("my_deck")
    
    query = """
        SELECT cs.card_name,
               COUNT(*) as total,
               SUM(CASE WHEN m.result_match = 1 THEN 1 ELSE 0 END) as wins
        FROM cards_seen cs
        JOIN matches m ON cs.match_id = m.id
    """
    params = []
    
    if my_deck:
        query += " WHERE m.my_deck = ?"
        params.append(my_deck)
    
    query += " GROUP BY cs.card_name HAVING total >= 3 ORDER BY total DESC"
    
    rows = conn.execute(query, params).fetchall()
    conn.close()
    
    results = []
    for r in rows:
        results.append({
            "card": r["card_name"],
            "total": r["total"],
            "wins": r["wins"],
            "losses": r["total"] - r["wins"],
            "win_rate": round(r["wins"] / r["total"] * 100, 1)
        })
    
    return jsonify(results)

# ─────────────────────────────────────────────────────────────────────────────
# Routes - Decklists
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/decklists", methods=["GET"])
def get_decklists():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM decklists ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route("/api/decklists", methods=["POST"])
def add_decklist():
    data = request.json
    conn = get_db()
    conn.execute("""
        INSERT INTO decklists (name, cards, created_at, is_public)
        VALUES (?, ?, ?, ?)
    """, (
        data.get("name", "Unnamed Deck"),
        json.dumps(data.get("cards", {})),
        now_iso(),
        1 if data.get("is_public") else 0
    ))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/decklists/<int:deck_id>", methods=["DELETE"])
def delete_decklist(deck_id):
    conn = get_db()
    conn.execute("DELETE FROM decklists WHERE id = ?", (deck_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/my-decks")
def get_my_deck_names():
    """Get list of deck names for dropdown"""
    conn = get_db()
    rows = conn.execute("SELECT DISTINCT name FROM decklists ORDER BY name").fetchall()
    conn.close()
    return jsonify([row["name"] for row in rows])

# ─────────────────────────────────────────────────────────────────────────────
# Routes - Session Stats
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/session")
def session_stats():
    today = datetime.now().strftime("%Y-%m-%d")
    conn = get_db()
    
    rows = conn.execute("""
        SELECT * FROM matches 
        WHERE date_time >= ?
        ORDER BY date_time DESC, id DESC
    """, (today + " 00:00",)).fetchall()
    conn.close()
    
    matches = [dict(row) for row in rows]
    wins = sum(1 for m in matches if m["result_match"] == 1)
    
    return jsonify({
        "matches": matches,
        "total": len(matches),
        "wins": wins,
        "losses": len(matches) - wins,
        "win_rate": round(wins / len(matches) * 100, 1) if matches else 0
    })

# ─────────────────────────────────────────────────────────────────────────────
# Routes - Export
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/export/csv")
def export_csv():
    conn = get_db()
    rows = conn.execute("""
        SELECT date_time, my_deck, opp_name, opp_deck, result_match, on_play_start, notes
        FROM matches ORDER BY date_time DESC
    """).fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "My Deck", "Opponent", "Their Deck", "Result", "On Play", "Notes"])
    
    for row in rows:
        writer.writerow([
            row["date_time"],
            row["my_deck"],
            row["opp_name"],
            row["opp_deck"],
            "Win" if row["result_match"] == 1 else "Loss",
            "Yes" if row["on_play_start"] == 1 else "No" if row["on_play_start"] == 0 else "Unknown",
            row["notes"]
        ])
    
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"vibes_matches_{datetime.now().strftime('%Y%m%d')}.csv"
    )

# ─────────────────────────────────────────────────────────────────────────────
# Initialize and Run
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
