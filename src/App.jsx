import { Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import Home from './pages/Home'
import CreateTournament from './pages/CreateTournament'
import TournamentDetail from './pages/TournamentDetail'
import MatchScoring from './pages/MatchScoring'
import Leaderboard from './pages/Leaderboard'

export default function App() {
  return (
    <div className="min-h-screen text-ink">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateTournament />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/t/:id" element={<TournamentDetail />} />
        <Route path="/t/:tournamentId/m/:matchId" element={<MatchScoring />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
