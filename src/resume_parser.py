"""
Resume parser module.
Extracts structured data from resume text for interview question generation.
Uses LLM to parse and structure the resume content.
"""

import json
import logging
import re
from pathlib import Path

logger = logging.getLogger("resume-parser")


def extract_text_from_file(file_path: str) -> str:
    """Extract text from a resume file (supports .txt, .md, .pdf placeholder)."""
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix in (".txt", ".md"):
        return path.read_text(encoding="utf-8")
    elif suffix == ".pdf":
        # Try to use PyPDF2 if available
        try:
            import PyPDF2

            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except ImportError:
            logger.warning(
                "PyPDF2 not installed. PDF parsing unavailable. Install with: uv add PyPDF2"
            )
            return ""
    elif suffix == ".docx":
        try:
            import docx

            doc = docx.Document(file_path)
            return "\n".join([p.text for p in doc.paragraphs])
        except ImportError:
            logger.warning(
                "python-docx not installed. DOCX parsing unavailable. Install with: uv add python-docx"
            )
            return ""
    else:
        # Try to read as text
        try:
            return path.read_text(encoding="utf-8")
        except Exception:
            logger.error(f"Cannot read file: {file_path}")
            return ""


def parse_resume_text(raw_text: str) -> dict:
    """
    Parse raw resume text into a structured format.
    Uses regex-based heuristic extraction as a fallback.
    The LLM-based parsing happens in the agent itself.
    """
    parsed = {
        "name": "",
        "email": "",
        "phone": "",
        "summary": "",
        "skills": [],
        "experience": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "raw_text": raw_text,
    }

    lines = raw_text.strip().split("\n")
    if not lines:
        return parsed

    # Extract email
    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    emails = re.findall(email_pattern, raw_text)
    if emails:
        parsed["email"] = emails[0]

    # Extract phone
    phone_pattern = r"[\+]?[\d\s\-\(\)]{10,15}"
    phones = re.findall(phone_pattern, raw_text)
    if phones:
        parsed["phone"] = phones[0].strip()

    # Try to extract name (usually the first non-empty line)
    for line in lines:
        line = line.strip()
        if line and not re.match(email_pattern, line) and len(line) < 60:
            parsed["name"] = line
            break

    # Extract skills (look for skills section)
    skills_section = _extract_section(raw_text, ["skills", "technical skills", "technologies", "tools"])
    if skills_section:
        # Split by common delimiters
        skills = re.split(r"[,|•·\n]", skills_section)
        parsed["skills"] = [s.strip() for s in skills if s.strip() and len(s.strip()) > 1]

    # Extract experience section
    exp_section = _extract_section(
        raw_text, ["experience", "work experience", "professional experience", "employment"]
    )
    if exp_section:
        parsed["experience"] = _parse_experience(exp_section)

    # Extract education
    edu_section = _extract_section(raw_text, ["education", "academic"])
    if edu_section:
        parsed["education"] = _parse_education(edu_section)

    # Extract projects
    proj_section = _extract_section(raw_text, ["projects", "personal projects", "key projects"])
    if proj_section:
        parsed["projects"] = _parse_projects(proj_section)

    # Extract summary
    summary_section = _extract_section(
        raw_text, ["summary", "objective", "about", "profile", "about me"]
    )
    if summary_section:
        parsed["summary"] = summary_section.strip()

    return parsed


def _extract_section(text: str, headers: list[str]) -> str:
    """Extract a section from resume text based on header keywords."""
    lines = text.split("\n")
    section_lines = []
    in_section = False
    section_headers = [
        "skills",
        "experience",
        "education",
        "projects",
        "certifications",
        "summary",
        "objective",
        "about",
        "profile",
        "work",
        "employment",
        "technical",
        "tools",
        "technologies",
        "achievements",
        "awards",
        "publications",
        "references",
        "interests",
        "languages",
        "contact",
    ]

    for line in lines:
        stripped = line.strip().lower()
        # Remove common formatting
        cleaned = re.sub(r"[#*\-_=:]+", "", stripped).strip()

        if any(h in cleaned for h in headers) and len(cleaned) < 40:
            in_section = True
            continue

        if in_section:
            # Check if we hit another section header
            if any(h in cleaned for h in section_headers) and cleaned not in headers and len(cleaned) < 40:
                break
            section_lines.append(line)

    return "\n".join(section_lines).strip()


def _parse_experience(text: str) -> list[dict]:
    """Parse experience section into structured entries."""
    entries = []
    current = None
    lines = text.split("\n")

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Look for date patterns (likely a new entry)
        date_pattern = r"(20\d{2}|19\d{2}|present|current)"
        if re.search(date_pattern, stripped, re.IGNORECASE) and len(stripped) < 100:
            if current:
                entries.append(current)
            current = {
                "title": stripped,
                "description": "",
            }
        elif current:
            current["description"] += stripped + " "
        else:
            current = {"title": stripped, "description": ""}

    if current:
        entries.append(current)

    # Clean up descriptions
    for entry in entries:
        entry["description"] = entry["description"].strip()

    return entries


def _parse_education(text: str) -> list[dict]:
    """Parse education section."""
    entries = []
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    current = None
    for line in lines:
        if re.search(r"(university|college|school|institute|bachelor|master|phd|degree)", line, re.IGNORECASE):
            if current:
                entries.append(current)
            current = {"institution": line, "details": ""}
        elif current:
            current["details"] += line + " "
        else:
            current = {"institution": line, "details": ""}

    if current:
        entries.append(current)

    for entry in entries:
        entry["details"] = entry["details"].strip()

    return entries


def _parse_projects(text: str) -> list[dict]:
    """Parse projects section."""
    entries = []
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    current = None
    for line in lines:
        # New project usually starts with a title (short line or line with bullet)
        if len(line) < 80 and not line.startswith(("-", "•", "*", "–")):
            if current:
                entries.append(current)
            current = {"name": line, "description": ""}
        elif current:
            # Remove bullet markers
            cleaned = re.sub(r"^[-•*–]\s*", "", line)
            current["description"] += cleaned + " "
        else:
            current = {"name": line, "description": ""}

    if current:
        entries.append(current)

    for entry in entries:
        entry["description"] = entry["description"].strip()

    return entries


def generate_interview_questions_prompt(parsed_resume: dict, interview_type: str = "general") -> str:
    """
    Generate a comprehensive prompt for the LLM to deeply analyze the CV
    and create highly tailored interview questions.
    """
    raw_text = parsed_resume.get("raw_text", "")
    
    prompt = f"""
Deeply analyze the following CV/Resume and generate 10 highly tailored interview questions for a {interview_type} interview.

--- CV CONTENT START ---
{raw_text}
--- CV CONTENT END ---

Your goal is to act as a world-class hiring manager. 
1. Identify the candidate's core role, seniority level, and industry.
2. Identify specific technologies, methodologies, and achievements mentioned.
3. Generate 10 questions that follow these criteria:
   - Technical Depth: For technical roles, ask about specific implementations, architectural choices, and problem-solving.
   - Project Specifics: Ask "How" and "Why" about their specific projects.
   - Behavioral/Leadership: Use STAR method principles (Situation, Task, Action, Result).
   - Progression: Start with an introduction/warm-up, then move to core experience, then deep technical/problem-solving, and end with behavioral/culture fit.

Return exactly 10 interview questions in the following JSON format:
[
    {{
        "question": "The interview question text",
        "category": "one of: technical, behavioral, experience, project, problem_solving",
        "difficulty": "one of: easy, medium, hard",
        "expected_topics": ["topic1", "topic2"]
    }}
]

Rules:
- NO generic questions like "Tell me about yourself".
- Questions MUST reference specific projects or skills mentioned in the CV.
- Ensure the difficulty matches the seniority level detected in the CV.
- Return ONLY the JSON array.
"""
    return prompt
