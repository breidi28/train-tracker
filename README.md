# 🚄 Train Tracker - Trenul Meu

A comprehensive train tracking system for Romanian Railways (CFR) with a React Native mobile app and Python backend.

## 📱 Project Overview

This project consists of two main components:

1. **Backend** - Python Flask API that scrapes CFR data and provides train information
2. **Mobile App** - React Native application for iOS and Android

## 🎯 Features

### Mobile App
- ✅ Real-time train tracking
- ✅ Search trains by number or route  
- ✅ View all railway stations
- ✅ Delay information and alerts
- ✅ Modern, intuitive UI
- ✅ Offline capability (planned)
- ✅ Push notifications (planned)

### Backend API
- ✅ CFR data scraping and integration
- ✅ Railway station database
- ✅ Train schedule and routing
- ✅ Real-time delay information
- ✅ Government railway data integration
- ✅ RESTful API endpoints

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- React Native development environment
- Android Studio or Xcode

### 1. Start Backend

```bash
cd backend/cfr-iris-scraper
pip install -r requirements.txt
python app.py
```

Backend will run at `http://localhost:5000`

### 2. Start Mobile App

```bash
cd mobile
npm install
npm start

# In another terminal
npm run android  # or npm run ios
```

📖 See detailed setup instructions:
- [Mobile App Setup](mobile/GETTING_STARTED.md)
- [Backend Documentation](backend/cfr-iris-scraper/README.md)

## 📂 Project Structure

```
train-tracker/
├── backend/
│   └── cfr-iris-scraper/      # Python Flask backend
│       ├── src/               # Core scraping modules
│       ├── app.py            # Main API server
│       ├── requirements.txt  # Python dependencies
│       └── README.md         # Backend docs
│
└── mobile/                    # React Native app
    ├── src/
    │   ├── components/       # UI components
    │   ├── screens/          # App screens
    │   ├── navigation/       # Navigation setup
    │   ├── services/         # API integration
    │   └── types/           # TypeScript types
    ├── android/             # Android native code
    ├── ios/                 # iOS native code
    └── README.md           # Mobile app docs
```

## 🔧 Configuration

### Backend
Edit `backend/cfr-iris-scraper/src/config.py` for backend settings.

### Mobile App
Edit `mobile/src/config.ts` to configure:
- API endpoint URLs
- Timeouts and intervals
- Feature flags
- Theme colors

Or use the in-app Settings screen to change the backend URL dynamically.

## 📱 Mobile App Screens

| Screen | Description |
|--------|-------------|
| **Home** | Quick search by train number |
| **Search** | Advanced search with filters |
| **Stations** | Browse all railway stations |
| **Train Details** | Realtime train info & delays |
| **Settings** | App configuration |

## 🌐 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/train/:number` | Get train details |
| `GET /api/search/trains` | Search trains by route |
| `GET /api/stations` | List all stations |
| `GET /station/:id/departures/current` | Current departures |
| `GET /api/cfr-status` | API health check |

See full API documentation in the backend README.

## 🔌 Connecting Mobile to Backend

### During Development

**Android Emulator:**
```
Settings → Backend URL → http://10.0.2.2:5000
```

**iOS Simulator:**
```
Settings → Backend URL → http://localhost:5000
```

**Real Device (same network):**
```
Settings → Backend URL → http://YOUR_COMPUTER_IP:5000
```

Find your IP:
- Windows: `ipconfig`
- macOS/Linux: `ifconfig` or `ip addr`

## 🛠️ Development

### Adding Features

1. **Backend**: Add routes in `app.py`, create scrapers in `src/`
2. **Mobile**: Add screens in `src/screens/`, components in `src/components/`
3. **API Integration**: Update `src/services/api.ts`

### Code Style

- **Backend**: PEP 8 (Python)
- **Mobile**: ESLint + Prettier (TypeScript/React)

## 📦 Building for Production

### Mobile App

**Android:**
```bash
cd mobile/android
./gradlew assembleRelease
```

**iOS:**
Open `mobile/ios/TrainTrackerApp.xcworkspace` in Xcode and archive.

### Backend
Deploy using your preferred method (Docker, Railway, Heroku, etc.)

## 🐛 Troubleshooting

### Common Issues

**Can't connect to backend from mobile?**
- Ensure backend is running
- Check API URL in mobile Settings
- Verify firewall settings
- Use correct platform-specific URL

**Metro bundler cache issues?**
```bash
cd mobile
npm start -- --reset-cache
```

**Backend dependencies?**
```bash
cd backend/cfr-iris-scraper
pip install -r requirements.txt
```

## 🤝 Contributing

This is a personal project, but feel free to fork and customize for your needs.

## 📄 License

See LICENSE file in repository.

## 🙏 Acknowledgments

- CFR (Romanian Railways) for public timetable data
- React Native community
- Open source contributors

## 📞 Support

For issues and questions, please create an issue in the repository.

---

**Happy tracking! 🚄**
