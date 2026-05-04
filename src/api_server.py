"""
REST API server for the Interview Dashboard.
Provides endpoints for resume upload, interview history, and statistics.
Runs alongside the LiveKit agent.
"""

import json
import logging
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import database as db
from resume_parser import extract_text_from_file, parse_resume_text

load_dotenv(".env.local")

logger = logging.getLogger("interview-api")

app = FastAPI(
    title="Voice Interview Agent API",
    description="REST API for the AI-powered voice interview system",
    version="1.0.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
UPLOAD_DIR = Path(__file__).parent.parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ──────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# ──────────────────────────────────────────────────────────────
# Resume endpoints
# ──────────────────────────────────────────────────────────────


@app.post("/api/resume/upload")
async def upload_resume(
    file: UploadFile = File(...),
    user_identity: str = "default_user",
):
    """Upload and parse a resume file."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Validate file type
    allowed = {".pdf", ".txt", ".md", ".docx"}
    suffix = Path(file.filename).suffix.lower()
    if suffix not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed)}",
        )

    # Save the file
    file_id = str(uuid.uuid4())[:8]
    save_path = UPLOAD_DIR / f"{file_id}_{file.filename}"

    try:
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Parse the resume
        raw_text = extract_text_from_file(str(save_path))
        if not raw_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from file. Please try a different format.",
            )

        parsed = parse_resume_text(raw_text)

        # Save to database
        user = db.get_or_create_user(user_identity)
        resume_id = db.save_resume(
            user_id=user["id"],
            filename=file.filename,
            raw_text=raw_text,
            parsed_data=parsed,
        )

        return {
            "success": True,
            "resume_id": resume_id,
            "filename": file.filename,
            "parsed": {
                "name": parsed.get("name", ""),
                "email": parsed.get("email", ""),
                "skills_count": len(parsed.get("skills", [])),
                "experience_count": len(parsed.get("experience", [])),
                "education_count": len(parsed.get("education", [])),
                "projects_count": len(parsed.get("projects", [])),
                "skills": parsed.get("skills", [])[:10],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading resume: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/resume/{user_identity}")
async def get_resume(user_identity: str):
    """Get the latest resume for a user."""
    user = db.get_or_create_user(user_identity)
    resume = db.get_latest_resume(user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="No resume found")

    return {
        "resume_id": resume["id"],
        "filename": resume["filename"],
        "parsed_data": resume["parsed_data"],
        "created_at": resume["created_at"],
    }


# ──────────────────────────────────────────────────────────────
# Interview endpoints
# ──────────────────────────────────────────────────────────────


@app.get("/api/interviews")
async def list_interviews(user_identity: str = None, limit: int = 50):
    """List interviews, optionally filtered by user."""
    if user_identity:
        user = db.get_or_create_user(user_identity)
        interviews = db.get_user_interviews(user["id"], limit)
    else:
        interviews = db.get_all_interviews_with_details(limit)

    return {"interviews": interviews, "count": len(interviews)}


@app.get("/api/interviews/{interview_id}")
async def get_interview_details(interview_id: int):
    """Get detailed information about a specific interview."""
    interview = db.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    questions = db.get_questions(interview_id)
    answers = db.get_answers(interview_id)
    chat = db.get_chat_history(interview_id)

    return {
        "interview": interview,
        "questions": questions,
        "answers": answers,
        "chat_history": chat,
    }


@app.get("/api/interviews/{interview_id}/chat")
async def get_interview_chat(interview_id: int):
    """Get chat history for an interview."""
    interview = db.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    messages = db.get_chat_history(interview_id)
    return {"messages": messages}


# ──────────────────────────────────────────────────────────────
# Statistics endpoints
# ──────────────────────────────────────────────────────────────


@app.get("/api/stats/{user_identity}")
async def get_user_statistics(user_identity: str):
    """Get aggregate interview statistics for a user."""
    user = db.get_or_create_user(user_identity)
    stats = db.get_user_stats(user["id"])
    return stats


@app.get("/api/stats")
async def get_global_statistics():
    """Get global statistics across all users."""
    conn = db.get_connection()
    try:
        total_interviews = conn.execute(
            "SELECT COUNT(*) as cnt FROM interviews"
        ).fetchone()["cnt"]

        completed = conn.execute(
            "SELECT COUNT(*) as cnt FROM interviews WHERE status = 'completed'"
        ).fetchone()["cnt"]

        avg_score = conn.execute(
            "SELECT AVG(overall_score) as avg FROM interviews WHERE status = 'completed'"
        ).fetchone()["avg"]

        total_questions = conn.execute(
            "SELECT COUNT(*) as cnt FROM answers"
        ).fetchone()["cnt"]

        total_users = conn.execute(
            "SELECT COUNT(*) as cnt FROM users"
        ).fetchone()["cnt"]

        # Recent interviews
        recent = conn.execute(
            """SELECT i.*, u.display_name
            FROM interviews i
            JOIN users u ON i.user_id = u.id
            ORDER BY i.created_at DESC LIMIT 10"""
        ).fetchall()

        return {
            "total_interviews": total_interviews,
            "completed_interviews": completed,
            "average_score": round(avg_score or 0, 2),
            "total_questions_answered": total_questions,
            "total_users": total_users,
            "recent_interviews": [dict(r) for r in recent],
        }
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# Serve frontend static files
# ──────────────────────────────────────────────────────────────

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
