# 🎬 SyncStream - Watch Together, Stay Synchronized

<div align="center">

![SyncStream Logo](https://img.shields.io/badge/SyncStream-Real--time%20Sync-blue?style=for-the-badge&logo=youtube&logoColor=white)

**A real-time media synchronization platform that lets you watch YouTube videos and listen to audio files together with friends, family, or colleagues in perfect sync.**

[![Next.js](https://img.shields.io/badge/Next.js-15.4.6-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green?style=flat&logo=node.js)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--time-purple?style=flat&logo=socket.io)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Enabled-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com/)

</div>

## 🌟 Features

### � **Core Functionality**
- **🏠 Room Management**: Create and join synchronized viewing rooms
- **👑 Leader Controls**: Room leaders have full control over playback
- **🔄 Real-time Sync**: Perfect synchronization across all participants
- **📱 Responsive Design**: Works seamlessly on desktop, tablet, and mobile

### 🎨 **User Experience**
- **� Dark/Light Theme**: Toggle between themes with persistent storage
- **🖥️ Full-Screen Layout**: Immersive viewing without distractions
- **📋 One-Click Sharing**: Generate and copy shareable room links instantly
- **🔗 Direct Access**: Share links bypass approval for instant joining

### 👥 **Participant Management**
- **✅ Approval System**: Leaders can approve or reject new participants
- **� Kick Participants**: Remove disruptive participants with confirmation
- **📝 Real-time Notifications**: Instant updates for all room activities
- **🎫 Share Tokens**: 24-hour expiring links for secure access

### 🎵 **Media Controls**
- **▶️ Synchronized Playbook**: Play, pause, and seek in perfect sync
- **📊 Smooth Updates**: 100ms precision for seamless experience
- **🎬 YouTube Integration**: Full YouTube IFrame API integration
- **🎵 Audio Support**: MP3 and audio file synchronization with HTML5 Audio API
- **🔍 Auto-Detection**: Automatically detects YouTube URLs vs audio file URLs
- **🔧 Leader-Only Controls**: Only room leaders can control playback
- **⚡ Advanced Sync**: ±150ms accuracy with drift correction

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

### 💨 One-Command Setup

```bash
# Clone and start everything in one go
git clone (https://github.com/sagarjsr/syncstream.git)
cd app
./start.sh
```

The script will:
- ✅ Check for Node.js and npm
- 📦 Install all dependencies in a shared node_modules (saves storage!)
- 🔧 Start both backend and frontend servers
- 🌐 Open your browser to http://localhost:3000

### 📋 Manual Setup

If you prefer manual control:

```bash
# Install all dependencies once (shared between backend and frontend)
npm install

# Backend Server (Terminal 1)
cd syncstream-server && node server.js
# Server runs on http://localhost:3001

# Frontend (Terminal 2)
cd syncstream-web && npm run dev
# App runs on http://localhost:3000
```

## 🎮 How to Use

### 👑 **As a Room Leader**

1. **Create Room**
   ```
   📝 Enter room name (e.g., "Movie Night")
   👤 Enter your name
   🏠 Click "Create Room"
   ```

2. **Share Your Room**
   ```
   🔗 Click "Share Room" button
   📋 Link automatically copies to clipboard
   📤 Share with friends via any messaging platform
   ```

3. **Manage Participants**
   ```
   ✅ Approve/reject join requests via popups
   👥 See all participants in the sidebar
   🚪 Kick disruptive participants if needed
   ```

4. **Control Media**
   ```
   🎬 Paste YouTube URL to load video
   🎵 Paste MP3/audio URL for audio playback
   🔍 System auto-detects media type
   ▶️ Play, pause, seek - everyone follows your lead
   🔄 All participants stay perfectly synchronized (±150ms)
   ```

### 👥 **As a Participant**

1. **Join Room**
   ```
   Option A: Click shared link → Enter name → Join instantly
   Option B: Enter Room ID manually → Wait for approval
   ```

2. **Enjoy Synchronized Media**
   ```
   📺 YouTube videos automatically sync with room leader
   🎵 Audio files play in perfect synchronization
   💬 See who else is watching/listening in the participant list
   🎯 Perfectly synchronized experience with ±150ms precision!
   ```

## 🏗️ Architecture

```
┌─────────────────┐    Socket.IO    ┌─────────────────┐
│   Frontend      │◄──────────────►│   Backend       │
│  (Next.js)      │   Real-time     │  (Node.js)      │
│                 │   Communication │                 │
│ • React UI      │                 │ • Socket.IO     │
│ • Zustand State │                 │ • Room State    │
│ • YouTube API   │                 │ • Token System  │
│ • Tailwind CSS  │                 │ • CORS Setup    │
└─────────────────┘                 └─────────────────┘
```

### 🎨 **Frontend Stack**
- **⚛️ Next.js 15.4.6**: React framework with TypeScript
- **🎯 Zustand**: Lightweight state management
- **🎨 Tailwind CSS**: Utility-first CSS framework
- **🔌 Socket.IO Client**: Real-time communication
- **🎬 YouTube IFrame API**: Video player integration
- **🎵 HTML5 Audio API**: Audio file playback and synchronization
- **⚡ Advanced Sync Engine**: Drift correction and precision timing

### 🔧 **Backend Stack**
- **🟢 Node.js + Express**: Fast, minimal web framework
- **🔌 Socket.IO**: Real-time bidirectional communication
- **🏠 In-Memory State**: Room and participant management
- **🎫 Token System**: Secure share link generation
- **🔒 CORS Configured**: Secure cross-origin requests

## 🌐 API Reference

### 📤 **Client → Server Events**

| Event | Description | Payload |
|-------|-------------|---------|
| `create_room` | Create new room | `{roomName, userName}` |
| `join_room` | Join existing room | `{roomId, userName, shareToken?}` |
| `leave_room` | Leave current room | `{roomId}` |
| `approve_participant` | Approve participant | `{roomId, participantId}` |
| `reject_participant` | Reject participant | `{roomId, participantId}` |
| `kick_participant` | Remove participant | `{roomId, participantId}` |
| `create_share_token` | Generate share link | `{roomId}` |
| `video_play` | Play video | `{roomId, currentTime}` |
| `video_pause` | Pause video | `{roomId, currentTime}` |
| `video_seek` | Seek to time | `{roomId, currentTime}` |
| `control` | Unified media control | `{roomId, type, toTime?}` |
| `leader_state` | Leader broadcasts state | `{roomId, mediaTime, isPlaying}` |

### 📥 **Server → Client Events**

| Event | Description | Payload |
|-------|-------------|---------|
| `room_created` | Room created successfully | `{roomId, isLeader}` |
| `room_joined` | Successfully joined room | `{room, participants}` |
| `approval_request` | New participant needs approval | `{participant}` |
| `participant_approved` | Participant was approved | `{participant}` |
| `participant_rejected` | Participant was rejected | `{reason}` |
| `participant_kicked_notification` | Participant was kicked | `{message}` |
| `share_token_created` | Share link generated | `{shareUrl}` |
| `video_sync` | Video state synchronization | `{action, currentTime}` |
| `control_update` | Unified media control updates | `{type, isPlaying, toTime?}` |
| `sync_state` | Media state synchronization | `{leaderMediaTime, leaderServerTs, isPlaying}` |

## 📁 Project Structure

```
app/ (Monorepo with shared dependencies)
├── 🚀 start.sh                     # One-command startup script (Unix/macOS)
├── 🚀 start.bat                    # One-command startup script (Windows)  
├── 📚 README.md                    # This file
├── 📝 instruction.md               # Detailed development docs
├── 📋 syncstream_no_db_spec.md     # Original specification
├── 📦 package.json                 # Shared dependencies for both apps
├── 📦 package-lock.json           # Shared lockfile
├── 🗂️ node_modules/               # Shared dependencies (saves storage!)
├── 🙈 .gitignore                  # Git ignore rules
├── 
├── 🎨 syncstream-web/              # Frontend Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── SyncStreamApp.tsx   # Main app component
│   │   │   ├── YouTubePlayer.tsx   # YouTube player wrapper
│   │   │   └── AudioPlayer.tsx     # MP3/Audio player wrapper
│   │   ├── lib/
│   │   │   ├── store.ts            # Zustand state management
│   │   │   └── syncEngine.ts       # Advanced synchronization engine
│   │   └── pages/
│   │       └── index.tsx           # Application entry point
│   ├── package.json                # Frontend config (no dependencies)
│   └── next.config.js              # Next.js configuration
│
└── 🔧 syncstream-server/           # Backend Application
    ├── server.js                   # Express + Socket.IO server
    ├── state.js                    # Room state management
    └── package.json                # Backend config (no dependencies)
```

### 💾 **Storage Benefits**
- **Shared Dependencies**: Both frontend and backend use the same `node_modules` directory
- **Space Savings**: Eliminates duplicate packages (saves ~200-300MB)
- **Consistent Versions**: Ensures both apps use identical dependency versions
- **Faster Installs**: Single `npm install` installs everything needed

## 🔧 Development

### 🛠️ **Available Scripts**

```bash
# Start everything (recommended)
./start.sh

# Backend only
cd syncstream-server && npm start

# Frontend only  
cd syncstream-web && npm run dev

# Install dependencies
npm install # (run in each directory)

# Kill processes on ports (if needed)
lsof -ti :3000 | xargs kill -9  # Frontend
lsof -ti :3001 | xargs kill -9  # Backend
```

### 🎯 **Development Workflow**

1. **Make changes** to frontend (`syncstream-web/`) or backend (`syncstream-server/`)
2. **Hot reload** is enabled - changes appear instantly
3. **Test features** across multiple browser windows/tabs
4. **Debug** using browser dev tools and server logs

### 🧪 **Testing Media Synchronization**

1. Create room as leader
2. Load different media types:
   - **YouTube**: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - **Audio**: `https://www.soundjay.com/misc/sounds/bell-ringing-05.wav`
3. Have participant join via share link
4. Test synchronization:
   - Play/pause should sync instantly
   - Seeking should update all participants  
   - Time should stay within ±150ms accuracy
   - Test on different devices for cross-platform sync

### 🧪 **Testing Share Links**

1. Create room as leader
2. Generate share link
3. Open incognito/private window
4. Click share link
5. Enter name and join directly
6. Verify synchronization works

## 🛡️ Security & Privacy

- **🎫 Expiring Tokens**: Share links expire after 24 hours
- **👑 Leader Authorization**: Only leaders can control rooms
- **🔒 No Data Persistence**: No personal data stored permanently
- **🌐 Local Network**: Runs on your local machine
- **🔒 CORS Protection**: Configured for secure cross-origin requests

## 🚨 Troubleshooting

### ❌ **Common Issues**

| Problem | Solution |
|---------|----------|
| Port already in use | `lsof -ti :3000 \| xargs kill -9` |
| Dependencies missing | Run `npm install` in both directories |
| Socket connection failed | Check backend server is running on port 3001 |
| Theme not persisting | Clear browser localStorage |
| YouTube video not loading | Check internet connection and video URL |
| Audio file not loading | Verify audio URL is direct link and accessible |
| Sync drift issues | Check browser console for drift correction logs |
| Media auto-detection failing | Ensure URL format is correct for YouTube or direct audio |

### 🔍 **Debug Commands**

```bash
# Check running processes
ps aux | grep node

# Check port usage
lsof -i :3000
lsof -i :3001

# View server logs
cd syncstream-server && node server.js

# Test media URL accessibility
curl -I https://www.soundjay.com/misc/sounds/bell-ringing-05.wav

# Test YouTube URL extraction
node -e "
const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
console.log('Video ID:', match ? match[1] : 'Not found');
"

# Clear browser storage
# In browser: F12 → Application → Storage → Clear
```

## 🎯 Performance Tips

- **🚀 Fast Loading**: Next.js with Turbopack for instant dev server
- **⚡ Efficient Sync**: 100ms intervals for smooth synchronization with ±150ms accuracy
- **🎯 Drift Correction**: Advanced algorithms prevent sync drift across devices
- **🧹 Memory Management**: Automatic cleanup of intervals and connections
- **📱 Responsive**: Optimized for all screen sizes
- **🎨 Smooth Themes**: CSS transitions for theme switching
- **🔍 Smart Detection**: Automatic media type detection for seamless experience

## 🔮 Future Roadmap

### 🌟 **Coming Soon**
- [ ] **💬 Chat System**: Text chat alongside media watching
- [ ] **🎵 Multi-Platform**: Netflix, Twitch, Vimeo support  
- [ ] **📱 Mobile App**: React Native mobile application
- [ ] **👤 User Accounts**: Registration and authentication
- [ ] **📁 File Upload**: Local file synchronization support

### 🚀 **Future Ideas**
- [ ] **📚 Playlist Support**: Queue multiple videos and audio files
- [ ] **🎥 Screen Sharing**: Share any content
- [ ] **🔊 Audio Sync**: Volume and subtitle synchronization
- [ ] **📊 Analytics**: Room usage statistics
- [ ] **🌍 Multi-Language**: Internationalization support
- [ ] **🎙️ Voice Chat**: Audio communication alongside media sync

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 💬 Support

Having issues? Here's how to get help:

1. **📖 Check Documentation**: Review this README and `instruction.md`
2. **🔍 Search Issues**: Look for similar problems in the issues
3. **🐛 Report Bugs**: Create a detailed issue with steps to reproduce
4. **💡 Feature Requests**: Open an issue with your idea

---

<div align="center">

**Built with ❤️ using Next.js, Node.js, and Socket.IO**

🌟 **Star this repo if you found it helpful!** �

</div>
