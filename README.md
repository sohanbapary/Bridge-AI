# Bridge

Bridge is a compassionate, AI-powered first-step support assistant designed to assist individuals experiencing emotional distress. It serves as a gentle transition tool, providing immediate conversational support while actively bridging users to professional human resources and crisis helplines.

## 🌟 Key Features

- **Compassionate AI Chat**: Powered by Google's Gemini API, Bridge provides a safe, non-judgmental space for users to share what's on their mind.
- **Smart Crisis Detection**: Specifically designed to identify signs of acute distress and offer immediate access to human support.
- **Intelligent Location Awareness**: Automatically detects (with permission) or allows users to filter regional crisis helplines (e.g., 988 in the USA, Samaritans in the UK).
- **Global Resource Database**: A curated list of international support organizations, text lines, and phone services.
- **Secure Profiles**: Integrated with Firebase for secure Google Authentication, allowing users to maintain a private session history.
- **Minimalist Design**: A calm, "Swiss-inspired" interface designed to reduce cognitive load during stressful moments.

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **Animations**: Framer Motion
- **AI**: Google Gemini API (@google/generative-ai)
- **Backend/Auth**: Firebase Authentication & Cloud Firestore
- **Content**: React Markdown for formatted AI responses

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Google Cloud Project with Gemini API enabled
- A Firebase Project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/bridge.git
   cd bridge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Environment Variables:
   Create a `.env` file in the root and add your keys:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_key
   # Firebase config is typically loaded from firebase-applet-config.json
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## ⚖️ Disclaimer

Bridge is an AI-powered conversational tool intended for emotional support and resource guidance. It is **not** a substitute for professional therapy, medical advice, or psychiatric intervention. In case of an emergency, users are always directed to contact their local emergency services (911, 999, 112).

## 📄 License

MIT License - feel free to use and adapt this project to help more people.
