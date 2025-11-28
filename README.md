<div align="center">
  <h1>ApexLive - F1 Live Timing & Telemetry Dashboard</h1>
  <p>
    A comprehensive Formula 1 dashboard for replaying and analyzing race sessions with real-time telemetry, a live circuit map, and broadcast-style data visualization.
  </p>
  <p>
    <a href="https://github.com/DVDHSN/ApexLive/stargazers"><img src="https://img.shields.io/github/stars/DVDHSN/ApexLive?style=social" alt="GitHub stars"></a>
    <a href="https://github.com/DVDHSN/ApexLive/network/members"><img src="https://img.shields.io/github/forks/DVDHSN/ApexLive?style=social" alt="GitHub forks"></a>
  </p>
</div>

---

## 📖 Description

**ApexLive** is a sophisticated web application that brings the intensity and detail of a Formula 1 pit wall to your browser. Powered by the free [OpenF1 API](https://openf1.org/), it allows users to select and replay any F1 session from recent years, simulating the race in real-time.

The application provides multiple views to analyze the action:
- A **Dashboard** with a broadcast-style live leaderboard, race control messages, and track conditions.
- A detailed **Telemetry** view to scrutinize individual driver performance with live charts for speed, throttle, brake, and RPM.
- An interactive **Circuit Map** that visualizes every driver's position on the track in real-time.

Whether you're a die-hard F1 fan, a data enthusiast, or a developer interested in real-time data visualization, ApexLive offers a rich, immersive experience.

## ✨ Key Features

- **Full Session Replay**: Select any Grand Prix and session (Practice, Qualifying, Race) from 2023 onwards to watch a full replay.
- **Live Playback Controls**: Full control over the replay with play/pause, variable playback speeds (1x, 5x, 10x, 30x), and a timeline seek bar.
- **Live Session Detection**: Automatically identifies if a session is currently live and provides a "Go Live" button to jump to the action.
- **Broadcast-Style Dashboard**:
    - A dynamic classification table showing driver positions, intervals, tire compounds, and tire age.
    - Real-time updates for track status (Green, Yellow, SC, VSC, Red Flag), lap count, and DRS status.
    - A live feed of official Race Control messages.
    - A weather widget displaying air/track temperature, wind speed, and rain conditions.
- **In-Depth Telemetry View**:
    - Select any driver to view their live car data.
    - Real-time gauges for Speed, Gear, RPM, Throttle, and Brake.
    - Live-updating charts for speed and driver inputs over time.
    - Calculated G-Force display.
- **Interactive 2D Circuit Map**:
    - Dynamically generated track map for the selected session.
    - Smooth, interpolated live markers for every driver on the circuit.
    - Click to follow a specific driver, automatically centering and zooming the camera.
    - On-screen telemetry HUD when following a driver.
    - Full pan and zoom controls for manual exploration.
- **Responsive Design**: A clean, modern interface that works on both desktop and mobile devices.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (via CDN)
- **Charting**: Recharts
- **Icons**: Lucide React
- **AI Integration**: Google Gemini API (for potential future features)
- **Data Source**: [OpenF1 API](https://openf1.org/)

## 🚀 Installation & Setup

Follow these steps to get a local copy of ApexLive up and running.

**Prerequisites:**
- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)

**Steps:**

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/DVDHSN/ApexLive.git
    cd ApexLive
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project. This file is used for the optional Gemini API key.
    ```bash
    touch .env
    ```
    Add your Google Gemini API key to the `.env` file. You can get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
    ```ini
    # .env
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
    ```
    *Note: The application will function without this key, but any AI-related features will be disabled.*

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Open the application:**
    Navigate to `http://localhost:3000` (or the URL provided in your terminal) in your web browser.

## 🕹️ Usage

Once the application is running, you can interact with it as follows:

1.  **Select a Session**: Use the dropdown menus in the header to choose the **Season**, **Grand Prix**, and **Session Type** (e.g., Race, Qualifying). The data for the selected session will begin to load automatically.
2.  **Control Playback**: Use the player controls in the header to play, pause, change speed, or drag the seek bar to jump to a specific point in the session.
3.  **Switch Views**:
    - **Dashboard**: The default view, showing the live leaderboard and session status.
    - **Telemetry**: Click the "Telemetry" tab. Select a driver from the list on the left to view their detailed data.
    - **Circuit**: Click the "Circuit" tab. The track map will load with live driver positions. You can pan by clicking and dragging, and zoom with your mouse wheel. Click on a driver's dot to lock the camera onto them.

## 📂 File Structure

Here's a brief overview of the key files and directories in the project:

```
.
├── public/
├── src/
│   ├── components/      # Reusable React components (Leaderboard, Telemetry, Circuit Map, etc.)
│   ├── services/        # API service modules (openf1Service.ts, geminiService.ts)
│   ├── App.tsx          # Main application component and state management
│   ├── index.tsx        # React application entry point
│   ├── types.ts         # TypeScript type definitions
│   └── constants.ts     # Constants like team colors
├── .env                 # Environment variables (you need to create this)
├── index.html           # Main HTML file
├── package.json         # Project dependencies and scripts
└── vite.config.ts       # Vite configuration
```

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features or improvements, feel free to contribute.

1.  **Fork** the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes and **commit** them (`git commit -m 'Add some feature'`).
4.  **Push** to the branch (`git push origin feature/your-feature-name`).
5.  Open a **Pull Request**.

Please ensure your code follows the existing style and that you test your changes thoroughly.

## 📄 License

This project is licensed under the **MIT License**. See the `LICENSE` file for more details.
