<div align="center">
  <h1>ApexLive: F1 Race Replay & Telemetry Dashboard</h1>
  <p>
    <strong>A sophisticated web application for replaying and analyzing Formula 1 race sessions, powered by the OpenF1 API.</strong>
  </p>
  <p>
    <a href="https://github.com/DVDHSN/ApexLive/blob/main/LICENSE"><img src="https://img.shields.io/github/license/DVDHSN/ApexLive?style=for-the-badge" alt="license"></a>
    <a href="https://github.com/DVDHSN/ApexLive/stargazers"><img src="https://img.shields.io/github/stars/DVDHSN/ApexLive?style=for-the-badge&logo=github&color=FF8000" alt="stars"></a>
    <a href="https://github.com/DVDHSN/ApexLive/issues"><img src="https://img.shields.io/github/issues/DVDHSN/ApexLive?style=for-the-badge&logo=github" alt="issues"></a>
  </p>
</div>

## Description

ApexLive is a comprehensive, interactive dashboard designed for Formula 1 enthusiasts. It allows you to replay any F1 session from recent years with a rich, data-driven interface that simulates a real-time race engineering environment.

The application features a primary **Dashboard View** with a live leaderboard, a dynamic 2D track map, and widgets for race control messages and weather. A secondary **Telemetry View** provides a deep dive into any selected driver's performance, with real-time charts for speed, RPM, throttle, brake, and gear usage.

Whether you're reliving a classic race, analyzing driver performance, or following a live session, ApexLive provides all the tools you need in one place.

## Key Features

-   **Interactive Race Replay**: Watch historical F1 sessions from 2023 onwards with full playback controls (play, pause, seek, and variable speed).
-   **Live Timing Simulation**: Detects and follows currently live sessions, providing a near real-time experience that stays at the head of the data stream.
-   **Dynamic Leaderboard**: Real-time updates on driver positions, gaps to the leader, intervals to the car ahead, last lap times, and tire strategies (compound and age).
-   **Live Track Map**: Visualizes all active drivers on a dynamically generated 2D circuit map with zoom and pan controls.
-   **In-depth Telemetry View**: Dive deep into any driver's telemetry with real-time charts for speed, RPM, throttle vs. brake trace, and gear usage.
-   **Comprehensive Dashboard**: Includes widgets for the official race control incident feed, track status flags (Green, Yellow, SC, VSC, Red), and live weather data (air/track temp, wind, rain).
-   **Easy Session Selection**: Browse and load sessions by year, Grand Prix, and session type (Race, Qualifying, Practice).
-   **Modern UI/UX**: A sleek, dark-themed interface built for data visualization, using custom motorsport-inspired fonts and icons for an authentic feel.

## Tech Stack

-   **Frontend Framework**: React
-   **Language**: TypeScript
-   **Build Tool**: Vite
-   **Styling**: Tailwind CSS
-   **Data Visualization/Charts**: Recharts
-   **Icons**: Lucide React
-   **Data Source**: [OpenF1 API](https://openf1.org/)

## Installation & Setup

Follow these steps to get a local copy of ApexLive up and running.

**Prerequisites:**
- Node.js (v18 or newer recommended)
- npm or yarn

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

3.  **Set up environment variables (Optional):**
    The project includes an optional AI chat feature powered by Google Gemini. To enable it, you need to provide an API key.

    -   Create a new file named `.env.local` in the root of the project.
    -   Add your Gemini API key to the file:
        ```
        GEMINI_API_KEY=YOUR_API_KEY_HERE
        ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

The application should now be running on `http://localhost:3000`.

## Usage

Once the application is running, you can start exploring F1 sessions:

1.  **Select a Session**: Use the dropdown menus in the header to select the desired `Year`, `Grand Prix`, and `Session` (e.g., Race, Qualifying).
2.  **Control Playback**: After the session data loads, use the playback controls at the top right to play, pause, change speed, or seek through the timeline.
3.  **Go Live**: If a session is currently live, a "Go Live" button will appear. Click it to jump to the most recent data available.
4.  **Switch Views**: Toggle between the main `Dashboard` view and the `Telemetry` view using the navigation buttons in the header.
5.  **Analyze Telemetry**: In the Telemetry view, select any driver from the sidebar to view their detailed performance data and live charts.

## File Structure

Here is a brief overview of the key directories and files in the project:

```
.
├── public/                # Static assets
├── src/
│   ├── components/        # Reusable React components
│   │   ├── DashboardWidgets.tsx
│   │   ├── LiveLeaderboard.tsx
│   │   ├── TelemetryDashboard.tsx
│   │   └── TrackMap.tsx
│   ├── services/          # API communication logic
│   │   ├── openf1Service.ts # OpenF1 API fetching and parsing
│   │   └── geminiService.ts   # Optional Gemini AI service
│   ├── App.tsx            # Main application component and state management
│   ├── index.tsx          # React entry point
│   ├── types.ts           # Core TypeScript type definitions
│   └── constants.ts       # Team colors and other constants
├── .gitignore             # Files to ignore in git
├── index.html             # Main HTML entry point
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript compiler options
└── vite.config.ts         # Vite configuration
```

## Contributing

Contributions are welcome! If you have ideas for new features or improvements, feel free to open an issue or submit a pull request.

1.  **Fork** the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes and commit them (`git commit -m 'Add some feature'`).
4.  Push to the branch (`git push origin feature/your-feature-name`).
5.  Open a **Pull Request**.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for more details.
