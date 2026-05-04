"""
Database module for persistent interview storage.
Uses SQLite with aiosqlite for async operations.
"""

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("interview-db")

DB_PATH = Path(__file__).parent.parent / "data" / "interviews.db"


def _ensure_db_dir():
    """Ensure the data directory exists."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    """Get a synchronous SQLite connection."""
    _ensure_db_dir()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize the database schema."""
    conn = get_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_identity TEXT UNIQUE NOT NULL,
                display_name TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS resumes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                raw_text TEXT NOT NULL,
                parsed_data TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS interviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                resume_id INTEGER,
                session_id TEXT UNIQUE,
                room_name TEXT,
                status TEXT DEFAULT 'pending',
                interview_type TEXT DEFAULT 'general',
                total_questions INTEGER DEFAULT 0,
                questions_asked INTEGER DEFAULT 0,
                current_question_index INTEGER DEFAULT 0,
                overall_score REAL DEFAULT 0.0,
                started_at TEXT,
                completed_at TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (resume_id) REFERENCES resumes(id)
            );

            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                interview_id INTEGER NOT NULL,
                question_index INTEGER NOT NULL,
                category TEXT NOT NULL,
                question_text TEXT NOT NULL,
                difficulty TEXT DEFAULT 'medium',
                expected_topics TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (interview_id) REFERENCES interviews(id)
            );

            CREATE TABLE IF NOT EXISTS answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                interview_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                answer_text TEXT NOT NULL,
                score REAL DEFAULT 0.0,
                feedback TEXT,
                strengths TEXT,
                weaknesses TEXT,
                answered_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (interview_id) REFERENCES interviews(id),
                FOREIGN KEY (question_id) REFERENCES questions(id)
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                interview_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (interview_id) REFERENCES interviews(id)
            );

            CREATE INDEX IF NOT EXISTS idx_interviews_user ON interviews(user_id);
            CREATE INDEX IF NOT EXISTS idx_interviews_session ON interviews(session_id);
            CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
            CREATE INDEX IF NOT EXISTS idx_questions_interview ON questions(interview_id);
            CREATE INDEX IF NOT EXISTS idx_answers_interview ON answers(interview_id);
            CREATE INDEX IF NOT EXISTS idx_chat_interview ON chat_messages(interview_id);
        """
        )
        conn.commit()
        logger.info("Database initialized successfully")
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# User operations
# ──────────────────────────────────────────────────────────────


def get_or_create_user(user_identity: str, display_name: str = None) -> dict:
    """Get existing user or create a new one."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE user_identity = ?", (user_identity,)
        ).fetchone()
        if row:
            return dict(row)

        cursor = conn.execute(
            "INSERT INTO users (user_identity, display_name) VALUES (?, ?)",
            (user_identity, display_name or user_identity),
        )
        conn.commit()
        return {
            "id": cursor.lastrowid,
            "user_identity": user_identity,
            "display_name": display_name or user_identity,
        }
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# Resume operations
# ──────────────────────────────────────────────────────────────


def save_resume(user_id: int, filename: str, raw_text: str, parsed_data: dict) -> int:
    """Save a parsed resume to the database. Returns resume ID."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO resumes (user_id, filename, raw_text, parsed_data) VALUES (?, ?, ?, ?)",
            (user_id, filename, raw_text, json.dumps(parsed_data)),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_latest_resume(user_id: int) -> dict | None:
    """Get the most recent resume for a user."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
            (user_id,),
        ).fetchone()
        if row:
            result = dict(row)
            result["parsed_data"] = json.loads(result["parsed_data"])
            return result
        return None
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# Interview operations
# ──────────────────────────────────────────────────────────────


def create_interview(
    user_id: int,
    resume_id: int = None,
    session_id: str = None,
    room_name: str = None,
    interview_type: str = "general",
) -> int:
    """Create a new interview session. Returns interview ID."""
    conn = get_connection()
    try:
        now = datetime.now(timezone.utc).isoformat()
        cursor = conn.execute(
            """INSERT INTO interviews
            (user_id, resume_id, session_id, room_name, status, interview_type, started_at, updated_at)
            VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?)""",
            (user_id, resume_id, session_id, room_name, interview_type, now, now),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_interview(interview_id: int) -> dict | None:
    """Get an interview by ID."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM interviews WHERE id = ?", (interview_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_active_interview(user_id: int) -> dict | None:
    """Get the most recent in-progress interview for a user."""
    conn = get_connection()
    try:
        row = conn.execute(
            """SELECT * FROM interviews
            WHERE user_id = ? AND status = 'in_progress'
            ORDER BY created_at DESC LIMIT 1""",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_interviews(user_id: int, limit: int = 50) -> list[dict]:
    """Get all interviews for a user."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT * FROM interviews
            WHERE user_id = ?
            ORDER BY created_at DESC LIMIT ?""",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_interview(interview_id: int, **kwargs) -> None:
    """Update interview fields."""
    conn = get_connection()
    try:
        kwargs["updated_at"] = datetime.now(timezone.utc).isoformat()
        set_clause = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [interview_id]
        conn.execute(
            f"UPDATE interviews SET {set_clause} WHERE id = ?",
            values,
        )
        conn.commit()
    finally:
        conn.close()


def complete_interview(interview_id: int, overall_score: float) -> None:
    """Mark an interview as completed."""
    now = datetime.now(timezone.utc).isoformat()
    update_interview(
        interview_id,
        status="completed",
        overall_score=overall_score,
        completed_at=now,
    )


# ──────────────────────────────────────────────────────────────
# Question operations
# ──────────────────────────────────────────────────────────────


def save_questions(interview_id: int, questions: list[dict]) -> list[int]:
    """Save a batch of generated questions. Returns list of question IDs."""
    conn = get_connection()
    try:
        ids = []
        for i, q in enumerate(questions):
            cursor = conn.execute(
                """INSERT INTO questions
                (interview_id, question_index, category, question_text, difficulty, expected_topics)
                VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    interview_id,
                    i,
                    q.get("category", "general"),
                    q["question"],
                    q.get("difficulty", "medium"),
                    json.dumps(q.get("expected_topics", [])),
                ),
            )
            ids.append(cursor.lastrowid)
        conn.execute(
            "UPDATE interviews SET total_questions = ? WHERE id = ?",
            (len(questions), interview_id),
        )
        conn.commit()
        return ids
    finally:
        conn.close()


def get_questions(interview_id: int) -> list[dict]:
    """Get all questions for an interview."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT * FROM questions
            WHERE interview_id = ?
            ORDER BY question_index""",
            (interview_id,),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["expected_topics"] = json.loads(d["expected_topics"])
            results.append(d)
        return results
    finally:
        conn.close()


def get_next_unanswered_question(interview_id: int) -> dict | None:
    """Get the next question that hasn't been answered yet."""
    conn = get_connection()
    try:
        row = conn.execute(
            """SELECT q.* FROM questions q
            LEFT JOIN answers a ON q.id = a.question_id
            WHERE q.interview_id = ? AND a.id IS NULL
            ORDER BY q.question_index
            LIMIT 1""",
            (interview_id,),
        ).fetchone()
        if row:
            d = dict(row)
            d["expected_topics"] = json.loads(d["expected_topics"])
            return d
        return None
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# Answer operations
# ──────────────────────────────────────────────────────────────


def save_answer(
    interview_id: int,
    question_id: int,
    answer_text: str,
    score: float = 0.0,
    feedback: str = "",
    strengths: str = "",
    weaknesses: str = "",
) -> int:
    """Save an answer for a question. Returns answer ID."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            """INSERT INTO answers
            (interview_id, question_id, answer_text, score, feedback, strengths, weaknesses)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (interview_id, question_id, answer_text, score, feedback, strengths, weaknesses),
        )
        # Update questions_asked count
        conn.execute(
            """UPDATE interviews SET questions_asked = (
                SELECT COUNT(*) FROM answers WHERE interview_id = ?
            ), current_question_index = (
                SELECT COALESCE(MAX(q.question_index), 0)
                FROM answers a JOIN questions q ON a.question_id = q.id
                WHERE a.interview_id = ?
            ) WHERE id = ?""",
            (interview_id, interview_id, interview_id),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_answers(interview_id: int) -> list[dict]:
    """Get all answers for an interview with their questions."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT a.*, q.question_text, q.category, q.difficulty
            FROM answers a
            JOIN questions q ON a.question_id = q.id
            WHERE a.interview_id = ?
            ORDER BY q.question_index""",
            (interview_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# Chat message operations
# ──────────────────────────────────────────────────────────────


def save_chat_message(interview_id: int, role: str, content: str) -> int:
    """Save a chat message. Returns message ID."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO chat_messages (interview_id, role, content) VALUES (?, ?, ?)",
            (interview_id, role, content),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_chat_history(interview_id: int) -> list[dict]:
    """Get all chat messages for an interview."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM chat_messages WHERE interview_id = ? ORDER BY timestamp",
            (interview_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# Statistics
# ──────────────────────────────────────────────────────────────


def get_user_stats(user_id: int) -> dict[str, Any]:
    """Get aggregate statistics for a user."""
    conn = get_connection()
    try:
        # Total interviews
        total = conn.execute(
            "SELECT COUNT(*) as cnt FROM interviews WHERE user_id = ?",
            (user_id,),
        ).fetchone()["cnt"]

        # Completed interviews
        completed = conn.execute(
            "SELECT COUNT(*) as cnt FROM interviews WHERE user_id = ? AND status = 'completed'",
            (user_id,),
        ).fetchone()["cnt"]

        # Average score
        avg_score = conn.execute(
            "SELECT AVG(overall_score) as avg FROM interviews WHERE user_id = ? AND status = 'completed'",
            (user_id,),
        ).fetchone()["avg"]

        # Score by category
        category_scores = conn.execute(
            """SELECT q.category, AVG(a.score) as avg_score, COUNT(*) as count
            FROM answers a
            JOIN questions q ON a.question_id = q.id
            JOIN interviews i ON a.interview_id = i.id
            WHERE i.user_id = ?
            GROUP BY q.category""",
            (user_id,),
        ).fetchall()

        # Recent scores trend
        recent_scores = conn.execute(
            """SELECT overall_score, completed_at
            FROM interviews
            WHERE user_id = ? AND status = 'completed'
            ORDER BY completed_at DESC LIMIT 10""",
            (user_id,),
        ).fetchall()

        # Total questions answered
        total_answered = conn.execute(
            """SELECT COUNT(*) as cnt FROM answers a
            JOIN interviews i ON a.interview_id = i.id
            WHERE i.user_id = ?""",
            (user_id,),
        ).fetchone()["cnt"]

        return {
            "total_interviews": total,
            "completed_interviews": completed,
            "in_progress": total - completed,
            "average_score": round(avg_score or 0, 2),
            "total_questions_answered": total_answered,
            "category_scores": [dict(r) for r in category_scores],
            "recent_scores": [dict(r) for r in recent_scores],
        }
    finally:
        conn.close()


def get_all_interviews_with_details(limit: int = 100) -> list[dict]:
    """Get all interviews with basic details for the dashboard."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT i.*, u.display_name, u.user_identity,
                      r.filename as resume_filename
            FROM interviews i
            JOIN users u ON i.user_id = u.id
            LEFT JOIN resumes r ON i.resume_id = r.id
            ORDER BY i.created_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# Initialize on import
init_db()
