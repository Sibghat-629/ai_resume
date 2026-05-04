"""
Voice Interview Agent with multi-agent workflow.
Uses NVIDIA STT/TTS and handoffs between Greeter, Interviewer, and Feedback agents.
Persists all data to SQLite for session continuity.
"""

import json
import logging
import os
from dataclasses import dataclass, field

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    AgentServer,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    room_io,
)
from livekit.plugins import nvidia, silero, openai
from livekit.plugins.turn_detector.multilingual import MultilingualModel

import database as db
from resume_parser import generate_interview_questions_prompt

logger = logging.getLogger("interview-agent")

load_dotenv(".env.local")

LLM_MODEL = "openai/gpt-4.1-mini"


# ──────────────────────────────────────────────────────────────
# Session data shared across all agents via handoffs
# ──────────────────────────────────────────────────────────────


@dataclass
class InterviewData:
    """Shared state across all agents in the interview workflow."""

    user_identity: str = ""
    user_id: int = 0
    interview_id: int = 0
    resume_id: int = 0
    resume_data: dict = field(default_factory=dict)
    questions: list = field(default_factory=list)
    current_question_index: int = 0
    answers: list = field(default_factory=list)
    has_resume: bool = False
    is_resuming: bool = False
    interview_type: str = "general"


# ──────────────────────────────────────────────────────────────
# Greeter Agent - Welcome & session management
# ──────────────────────────────────────────────────────────────


class GreeterAgent(Agent):
    """
    First agent the user interacts with.
    Handles welcome, resume check, and existing session detection.
    """

    def __init__(self) -> None:
        super().__init__(
            instructions="""\
You are a professional and warm interview assistant named InterviewPro.
Your role is to welcome the candidate and prepare them for their interview.

# Your responsibilities:
1. Greet the candidate warmly and introduce yourself
2. Check if they have an existing interview session they want to resume
3. Ask about the type of interview they want (technical, behavioral, or mixed)
4. Once everything is ready, transfer them to the interviewer

# Output rules (voice interface):
- Respond in plain text only. No markdown, lists, JSON, or emojis.
- Keep replies brief: one to three sentences maximum.
- Speak naturally as if in a real conversation.
- Do not reveal system internals or tool names.

# Flow:
1. Welcome the candidate
2. Use the check_existing_session tool to see if they have a previous session
3. If they have an existing session, ask if they want to resume or start fresh
4. Once ready, use the start_interview tool to hand off to the interviewer
""",
        )

    @function_tool
    async def check_existing_session(self, context: RunContext[InterviewData]):
        """Check if the user has an existing interview session they can resume.
        Call this right after greeting the user.
        """
        data = context.userdata
        user = db.get_or_create_user(data.user_identity)
        data.user_id = user["id"]

        # Check for active interview
        active = db.get_active_interview(data.user_id)
        if active:
            data.is_resuming = True
            data.interview_id = active["id"]
            questions_asked = active.get("questions_asked", 0)
            total = active.get("total_questions", 0)
            return (
                f"Found an existing interview session with {questions_asked} of {total} questions completed. "
                f"The interview type was {active.get('interview_type', 'general')}. "
                "Ask the user if they want to resume this session or start a new one."
            )

        # Check for resume
        resume = db.get_latest_resume(data.user_id)
        if resume:
            data.has_resume = True
            data.resume_id = resume["id"]
            data.resume_data = resume["parsed_data"]
            return (
                f"No active session found, but the user has a resume on file: {resume['filename']}. "
                "Ask if they want to use this resume for the interview or upload a new one."
            )

        return (
            "No existing session or resume found. "
            "Let the user know they can upload a resume through the dashboard before starting, "
            "or you can conduct a general interview without one. "
            "Ask what they'd like to do."
        )

    @function_tool
    async def start_interview(
        self,
        context: RunContext[InterviewData],
        resume_interview: bool,
        interview_type: str,
    ):
        """Start the interview by handing off to the interviewer agent.

        Args:
            resume_interview: Whether to resume an existing interview or start new
            interview_type: Type of interview - technical, behavioral, or mixed
        """
        data = context.userdata
        data.interview_type = interview_type

        if resume_interview and data.is_resuming and data.interview_id:
            # Load existing questions and find where we left off
            questions = db.get_questions(data.interview_id)
            answers = db.get_answers(data.interview_id)
            data.questions = questions
            data.answers = answers
            data.current_question_index = len(answers)

            # Load resume if available
            interview = db.get_interview(data.interview_id)
            if interview and interview.get("resume_id"):
                resume = db.get_latest_resume(data.user_id)
                if resume:
                    data.resume_data = resume["parsed_data"]
                    data.has_resume = True

            logger.info(
                f"Resuming interview {data.interview_id} at question {data.current_question_index}"
            )
        else:
            # Start fresh
            data.is_resuming = False

            # Create new interview
            resume_id = data.resume_id if data.has_resume else None
            data.interview_id = db.create_interview(
                user_id=data.user_id,
                resume_id=resume_id,
                interview_type=interview_type,
            )
            logger.info(f"Created new interview {data.interview_id}")

        # Hand off to the interviewer
        return InterviewerAgent(data)


# ──────────────────────────────────────────────────────────────
# Interviewer Agent - Conducts the actual interview
# ──────────────────────────────────────────────────────────────


class InterviewerAgent(Agent):
    """
    Main interview agent. Asks questions and evaluates answers.
    Uses resume data to generate relevant questions.
    """

    def __init__(self, data: InterviewData) -> None:
        resume_context = ""
        if data.has_resume and data.resume_data:
            resume_context = f"""
# Candidate Resume Information:
- Name: {data.resume_data.get('name', 'Unknown')}
- Skills: {', '.join(data.resume_data.get('skills', [])[:15])}
- Summary: {data.resume_data.get('summary', 'Not provided')[:300]}

Use this information to make questions relevant to the candidate's background.
"""

        resuming_context = ""
        if data.is_resuming and data.current_question_index > 0:
            resuming_context = f"""
# Resuming Session:
The candidate is resuming from question {data.current_question_index + 1}.
Acknowledge that you're picking up where they left off and continue smoothly.
"""

        super().__init__(
            instructions=f"""\
You are a professional interviewer conducting a {data.interview_type} interview.
Your name is InterviewPro and you are experienced, fair, and encouraging.

{resume_context}
{resuming_context}

# Interview conduct rules:
1. Ask ONE question at a time. Wait for the answer before proceeding.
2. After receiving an answer, briefly acknowledge it before asking the next question.
3. Use the evaluate_answer tool after every answer. You MUST be a deep critic:
   - For Technical questions: Look for specific technologies, depth of implementation, and edge case awareness.
   - For Behavioral questions: Look for the STAR method (Situation, Task, Action, Result). If the Result is missing, note it in weaknesses.
   - For Experience: Verify they actually did what they claimed by asking "How" if the answer is vague.
4. Keep your voice responses concise.
5. Track which question number you're on.

# Output rules (voice interface):
- Plain text only. No markdown, JSON, lists, or emojis.
- Brief responses: one to three sentences between questions.
- Natural, conversational tone.
- Do not read out scores or technical evaluation details to the user, just acknowledge and move on.

# Flow:
1. Use the get_next_question tool to get the next question
2. Ask the question naturally
3. Listen to the answer
4. Use the evaluate_answer tool to score and record the answer deeply using official hiring standards.
5. Briefly acknowledge, then get the next question
6. When all 10 questions are done, use the finish_interview tool
""",
        )
        self._data = data

    @function_tool
    async def get_next_question(self, context: RunContext[InterviewData]):
        """Get the next interview question to ask.
        Call this when you need the next question for the candidate.
        """
        data = context.userdata

        # If no questions generated yet, generate them dynamically using the LLM
        if not data.questions:
            logger.info("Generating dynamic questions from CV...")
            prompt = generate_interview_questions_prompt(data.resume_data, data.interview_type)
            
            # Use the LLM to generate questions
            # Note: In a real production app, we'd use a dedicated Task or ChatContext
            # Here we use the session's LLM directly to get the structured JSON
            llm_response = await context.agent.session.llm.chat(
                history=[{"role": "system", "content": prompt}]
            )
            
            try:
                # Clean up the response (remove potential markdown wrappers)
                text = llm_response.message.content.strip()
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                
                questions = json.loads(text)
                db.save_questions(data.interview_id, questions)
                data.questions = db.get_questions(data.interview_id)
            except Exception as e:
                logger.error(f"Failed to parse LLM questions: {e}. Falling back to default.")
                questions = self._generate_default_questions(data)
                db.save_questions(data.interview_id, questions)
                data.questions = db.get_questions(data.interview_id)

        # Get next unanswered question
        next_q = db.get_next_unanswered_question(data.interview_id)
        if next_q is None:
            return "ALL_QUESTIONS_DONE"

        data.current_question_index = next_q["question_index"]
        question_num = next_q["question_index"] + 1
        total = len(data.questions)

        return (
            f"Question {question_num} of {total} "
            f"(Category: {next_q['category']}, Difficulty: {next_q['difficulty']}): "
            f"{next_q['question_text']}"
        )

    @function_tool
    async def evaluate_answer(
        self,
        context: RunContext[InterviewData],
        answer_summary: str,
        score: float,
        feedback: str,
        strengths: str,
        weaknesses: str,
    ):
        """Evaluate and record the candidate's answer based on official interviewing criteria.

        Args:
            answer_summary: A brief summary of what the candidate said
            feedback: Brief constructive feedback about the answer
            strengths: What the candidate did well
            weaknesses: Areas for improvement
        """
        data = context.userdata

        # Find the current question
        current_q = db.get_next_unanswered_question(data.interview_id)
        if current_q is None:
            return "No pending question to evaluate."

        # Save answer
        db.save_answer(
            interview_id=data.interview_id,
            question_id=current_q["id"],
            answer_text=answer_summary,
            score=min(max(score, 1.0), 10.0),
            feedback=feedback,
            strengths=strengths,
            weaknesses=weaknesses,
        )

        # Save chat messages
        db.save_chat_message(
            data.interview_id, "assistant", current_q["question_text"]
        )
        db.save_chat_message(data.interview_id, "user", answer_summary)

        data.answers.append(
            {
                "question": current_q["question_text"],
                "answer": answer_summary,
                "score": score,
            }
        )

        remaining = db.get_next_unanswered_question(data.interview_id)
        if remaining is None:
            return "Answer recorded. All questions have been answered. Use finish_interview to wrap up."

        return f"Answer recorded with score {score}/10. Proceed to the next question."

    @function_tool
    async def finish_interview(self, context: RunContext[InterviewData]):
        """Finish the interview and hand off to the feedback agent.
        Call this when all questions have been answered.
        """
        data = context.userdata

        # Calculate overall score
        answers = db.get_answers(data.interview_id)
        if answers:
            avg_score = sum(a["score"] for a in answers) / len(answers)
        else:
            avg_score = 0.0

        db.complete_interview(data.interview_id, round(avg_score, 2))

        # Hand off to feedback agent
        return FeedbackAgent(data, answers, avg_score)

    def _generate_default_questions(self, data: InterviewData) -> list[dict]:
        """Generate default questions based on interview type and resume."""
        questions = []

        if data.has_resume and data.resume_data:
            skills = data.resume_data.get("skills", [])
            experience = data.resume_data.get("experience", [])
            projects = data.resume_data.get("projects", [])

            # Technical questions based on skills
            if skills and data.interview_type in ("technical", "mixed"):
                top_skills = skills[:5]
                for i, skill in enumerate(top_skills[:3]):
                    questions.append(
                        {
                            "question": f"Can you explain your experience with {skill} and describe a challenging problem you solved using it?",
                            "category": "technical",
                            "difficulty": ["easy", "medium", "hard"][min(i, 2)],
                            "expected_topics": [skill],
                        }
                    )

            # Experience questions
            if experience:
                for exp in experience[:2]:
                    title = exp.get("title", "your previous role")
                    questions.append(
                        {
                            "question": f"Tell me about your role at {title}. What were your key contributions and achievements?",
                            "category": "experience",
                            "difficulty": "medium",
                            "expected_topics": [title],
                        }
                    )

            # Project questions
            if projects:
                for proj in projects[:2]:
                    name = proj.get("name", "your project")
                    questions.append(
                        {
                            "question": f"Walk me through the {name} project. What was the architecture and what challenges did you face?",
                            "category": "project",
                            "difficulty": "medium",
                            "expected_topics": [name],
                        }
                    )

        # Behavioral questions (always include)
        behavioral = [
            {
                "question": "Tell me about a time when you had to work under pressure to meet a tight deadline. How did you handle it?",
                "category": "behavioral",
                "difficulty": "medium",
                "expected_topics": ["time management", "pressure", "prioritization"],
            },
            {
                "question": "Describe a situation where you disagreed with a team member. How did you resolve the conflict?",
                "category": "behavioral",
                "difficulty": "medium",
                "expected_topics": ["conflict resolution", "teamwork", "communication"],
            },
        ]

        # Problem solving
        problem_solving = [
            {
                "question": "If you were tasked with building a system from scratch with no existing codebase, how would you approach the architecture and technology choices?",
                "category": "problem_solving",
                "difficulty": "hard",
                "expected_topics": [
                    "system design",
                    "architecture",
                    "decision making",
                ],
            },
        ]

        questions.extend(behavioral)
        questions.extend(problem_solving)

        # Pad to 10 questions if needed
        generic_technical = [
            {
                "question": "What is your approach to writing clean, maintainable code? Can you give an example?",
                "category": "technical",
                "difficulty": "easy",
                "expected_topics": ["clean code", "best practices"],
            },
            {
                "question": "How do you approach debugging a complex issue in production?",
                "category": "technical",
                "difficulty": "medium",
                "expected_topics": ["debugging", "troubleshooting", "monitoring"],
            },
            {
                "question": "What is your experience with version control and collaborative development workflows?",
                "category": "technical",
                "difficulty": "easy",
                "expected_topics": ["git", "code review", "collaboration"],
            },
        ]

        while len(questions) < 10 and generic_technical:
            questions.append(generic_technical.pop(0))

        return questions[:10]


# ──────────────────────────────────────────────────────────────
# Feedback Agent - Provides interview results
# ──────────────────────────────────────────────────────────────


class FeedbackAgent(Agent):
    """
    Final agent that provides interview feedback and results.
    """

    def __init__(
        self, data: InterviewData, answers: list[dict], overall_score: float
    ) -> None:
        # Build the performance summary for the agent
        score_summary = f"Overall Score: {overall_score:.1f}/10\n"
        category_breakdown = {}
        for a in answers:
            cat = a.get("category", "general")
            if cat not in category_breakdown:
                category_breakdown[cat] = []
            category_breakdown[cat].append(a["score"])

        for cat, scores in category_breakdown.items():
            avg = sum(scores) / len(scores) if scores else 0
            score_summary += f"- {cat}: {avg:.1f}/10\n"

        strengths_list = [a.get("strengths", "") for a in answers if a.get("strengths")]
        weaknesses_list = [a.get("weaknesses", "") for a in answers if a.get("weaknesses")]

        super().__init__(
            instructions=f"""\
You are InterviewPro providing interview feedback to the candidate.

# Interview Results:
{score_summary}

# Key Strengths Found:
{chr(10).join(f'- {s}' for s in strengths_list[:5]) if strengths_list else '- No specific strengths recorded'}

# Areas for Improvement:
{chr(10).join(f'- {w}' for w in weaknesses_list[:5]) if weaknesses_list else '- No specific areas recorded'}

# Your role:
1. Congratulate the candidate on completing the interview.
2. Provide a high-level summary of their performance using professional hiring terminology.
3. Share the overall score and the category where they performed best.
4. Highlight 2 specific technical or behavioral strengths you observed.
5. Provide 2 targeted areas for improvement based on official industry standards.
6. Provide an "Interview Recommendation" (e.g., Strongly Recommend, Hire, or Needs More Training).
7. Remind them that they can see the full breakdown and question-by-question feedback on their dashboard.
8. End with a professional sign-off.

# Output rules (voice interface):
- Plain text only. No markdown, JSON, lists, or emojis.
- Be warm, encouraging, and constructive.
- Keep the summary concise - about 30 seconds of speaking time.
- End by thanking them and wishing them well.
""",
        )


# ──────────────────────────────────────────────────────────────
# Server setup
# ──────────────────────────────────────────────────────────────

server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="interview-agent")
async def interview_session(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Initialize shared interview data
    interview_data = InterviewData()

    # Try to extract user identity from room metadata or participant
    # This will be set when the user connects
    interview_data.user_identity = ctx.room.name or "anonymous"

    # NVIDIA Riva/NIM Server configuration (optional for self-hosted Riva)
    nvidia_stt_url = os.getenv("NVIDIA_STT_URL")
    nvidia_tts_url = os.getenv("NVIDIA_TTS_URL")

    # Set up NVIDIA STT and TTS with the voice AI pipeline
    session = AgentSession(
        stt=nvidia.STT(
            model="parakeet-1.1b-en-US-asr-streaming-silero-vad-sortformer",
            language_code="en-US",
            server=nvidia_stt_url,
        ),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=nvidia.TTS(
            voice="Magpie-Multilingual.EN-US.Leo",
            language_code="en-US",
            server=nvidia_tts_url,
        ),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        userdata=interview_data,
    )

    # Start with the greeter agent
    await session.start(
        agent=GreeterAgent(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(),
        ),
    )

    await ctx.connect()

    # Update user identity once connected
    for participant in ctx.room.remote_participants.values():
        interview_data.user_identity = participant.identity or ctx.room.name
        break


if __name__ == "__main__":
    cli.run_app(server)
