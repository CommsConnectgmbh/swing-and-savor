import { Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import CupScreen from './screens/CupScreen'
import MatchesScreen from './screens/MatchesScreen'
import MatchDetailScreen from './screens/MatchDetailScreen'
import TeamsScreen from './screens/TeamsScreen'
import BoardScreen from './screens/BoardScreen'

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-white">
      <main className="pb-safe">
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/cup" element={<CupScreen />} />
          <Route path="/matches" element={<MatchesScreen />} />
          <Route path="/matches/:matchId" element={<MatchDetailScreen />} />
          <Route path="/teams" element={<TeamsScreen />} />
          <Route path="/board" element={<BoardScreen />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
