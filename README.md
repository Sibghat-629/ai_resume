# InterviewPro AI: Voice-Powered Interview Agent 🎙️🚀

InterviewPro AI is a state-of-the-art, multi-agent voice interview system designed to help candidates practice their interviewing skills with real-time AI feedback. Leveraging **LiveKit**, **NVIDIA NIM**, and **GPT-4o**, this platform generates CV-relevant technical and behavioral questions, conducts immersive voice sessions, and provides deep performance analytics.

![UI Preview](https://img.shields.io/badge/UI-Premium-blueviolet)
![LiveKit](https://img.shields.io/badge/LiveKit-Streaming-brightgreen)
![NVIDIA](https://img.shields.io/badge/NVIDIA-NIM-green)
![React](https://img.shields.io/badge/React-18.x-blue)

## ✨ Features

- **🗣️ Immersive Voice Interviewing**: Real-time, low-latency voice interaction using LiveKit Agents and NVIDIA STT/TTS.
- **📄 AI Resume Parsing**: Automatically extracts skills, experience, and projects from PDF/DOCX to tailor the interview.
- **🤖 Multi-Agent Workflow**: Handoffs between specialized agents (Greeter, Interviewer, Feedback) for a structured experience.
- **📊 Advanced Analytics Dashboard**:
  - Score trends and category-wise performance breakdown.
  - AI-driven insights on communication and problem-solving.
  - Detailed interview history with question-by-question feedback.
- **🎨 Premium UI/UX**: A React-based glassmorphic dashboard with fluid animations and a responsive "Voice Orb".
- **💾 Session Persistence**: Resume existing interviews where you left off.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 (Vite)
- **Styling**: Vanilla CSS (Custom Glassmorphism)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Streaming**: LiveKit Components for React

### Backend
- **Core**: FastAPI (Python)
- **Real-time AI**: LiveKit Agents SDK
- **Voice Intelligence**: NVIDIA Riva / NIM (STT/TTS)
- **LLM**: GPT-4o-mini
- **Database**: SQLite (SQLAlchemy)
- **Parsing**: PyMuPDF / python-docx

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- LiveKit Cloud or Self-Hosted Server
- NVIDIA NIM API Keys (Optional for self-hosted Riva)
- OpenAI API Key

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Sibghat-629/ai_resume.git
   cd ai_resume
   ```

2. **Backend Setup**:
   ```bash
   # Install dependencies with uv or pip
   uv sync
   # Or: pip install -r requirements.txt (if available)
   
   # Set up environment variables
   cp .env.example .env.local
   # Fill in your LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and OPENAI_API_KEY
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend-new
   npm install
   ```

### Running the Project

1. **Start the API Server**:
   ```bash
   python src/api_server.py
   ```

2. **Start the LiveKit Agent**:
   ```bash
   python src/agent.py dev
   ```

3. **Run the Frontend**:
   ```bash
   cd frontend-new
   npm run dev
   ```

## 🔮 Future Enhancements

- **🎭 Video Avatars**: Integrating realistic AI avatars to accompany the voice agent.
- **📈 Company-Specific Tracks**: Tailored interview sets for FAANG and other top-tier companies.
- **🧩 Mock Coding Environment**: Synchronized code editor for technical screening sessions.
- **🌍 Multilingual Support**: Conduct interviews in Spanish, French, German, and more.
- **📑 LinkedIn Integration**: Direct import of professional profiles.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built with ❤️ by [Sibghatullah](https://github.com/Sibghat-629)
