import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BottomNav from './components/BottomNav'
import BrandHeader from './components/BrandHeader'
import LoadingSpinner from './components/LoadingSpinner'
import Toaster from './components/Toaster'
import { useAuth } from './lib/auth'
import { captureReferralFromUrl } from './lib/referral'
import { startLiveEvents } from './lib/liveEvents'

// Sign-in + Onboarding are eager: they appear before any other screen on first load.
import SignInScreen from './screens/SignInScreen'
import OnboardingScreen from './screens/OnboardingScreen'

// Everything else: lazy-load so the initial bundle stays small.
const HomeScreen         = lazy(() => import('./screens/HomeScreen'))
const BoardScreen        = lazy(() => import('./screens/BoardScreen'))
const DiscoverScreen     = lazy(() => import('./screens/DiscoverScreen'))
const MessagesScreen     = lazy(() => import('./screens/MessagesScreen'))
const ConversationScreen = lazy(() => import('./screens/ConversationScreen'))
const LeaderboardScreen  = lazy(() => import('./screens/LeaderboardScreen'))
const TourScreen         = lazy(() => import('./screens/TourScreen'))
const ChallengesScreen   = lazy(() => import('./screens/ChallengesScreen'))
const MatchesScreen      = lazy(() => import('./screens/MatchesScreen'))
const MatchDetailScreen  = lazy(() => import('./screens/MatchDetailScreen'))
const FriendsScreen      = lazy(() => import('./screens/FriendsScreen'))
const TeamsScreen        = lazy(() => import('./screens/TeamsScreen'))
const CupScreen          = lazy(() => import('./screens/CupScreen'))
const ProfileScreen      = lazy(() => import('./screens/ProfileScreen'))
const PublicCupScreen    = lazy(() => import('./screens/PublicCupScreen'))

captureReferralFromUrl()

function HeaderForRoute() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const titles = {
    '/home':        t('nav.home', 'Home'),
    '/board':       t('nav.board'),
    '/discover':    t('nav.discover'),
    '/challenges':  t('nav.challenges'),
    '/matches':     t('nav.matches'),
    '/friends':     t('nav.friends'),
    '/teams':       t('nav.teams'),
    '/cup':         t('nav.cups'),
    '/messages':    t('nav.messages',    'Nachrichten'),
    '/leaderboard': t('nav.leaderboard', 'Rangliste'),
    '/tour':        t('nav.tour',        'Tour'),
    '/me':          t('nav.profile'),
    '/u/':          t('nav.profile'),
  }
  const match = Object.keys(titles).find((p) => pathname.startsWith(p))
  return <BrandHeader title={match ? titles[match] : null} />
}

function ScreenFallback() {
  return <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
}

export default function App() {
  const { user, profile, loading } = useAuth()
  const { pathname } = useLocation()
  const isPublicCup = pathname.startsWith('/c/')

  // Globale Realtime-Bridge für Toasts (DM, Like, Comment, Match-Status)
  useEffect(() => {
    if (!user?.id) return
    const stop = startLiveEvents(user)
    return () => { if (typeof stop === 'function') stop() }
  }, [user?.id])

  if (loading) {
    return <div className="min-h-screen bg-bg flex items-center justify-center"><LoadingSpinner /></div>
  }

  if (isPublicCup) {
    return (
      <div className="min-h-screen bg-bg text-ink">
        <Suspense fallback={<ScreenFallback />}>
          <Routes>
            <Route path="/c/:inviteCode" element={<PublicCupScreen />} />
          </Routes>
        </Suspense>
      </div>
    )
  }

  if (!user) return <SignInScreen />
  if (!profile) return <OnboardingScreen />

  return (
    <div className="min-h-screen bg-bg text-ink">
      <HeaderForRoute />
      <Toaster />
      <main className="pb-safe">
        <Suspense fallback={<ScreenFallback />}>
          <Routes>
            <Route path="/"                  element={<Navigate to="/home" replace />} />
            <Route path="/home"              element={<HomeScreen />} />
            <Route path="/board"             element={<BoardScreen />} />
            <Route path="/discover"          element={<DiscoverScreen />} />
            <Route path="/challenges"        element={<ChallengesScreen />} />
            <Route path="/matches"           element={<MatchesScreen />} />
            <Route path="/matches/:matchId"  element={<MatchDetailScreen />} />
            <Route path="/friends"           element={<FriendsScreen />} />
            <Route path="/teams"             element={<TeamsScreen />} />
            <Route path="/cup"               element={<CupScreen />} />
            <Route path="/messages"          element={<MessagesScreen />} />
            <Route path="/messages/:conversationId" element={<ConversationScreen />} />
            <Route path="/leaderboard"       element={<LeaderboardScreen />} />
            <Route path="/tour"              element={<TourScreen />} />
            <Route path="/me"                element={<ProfileScreen />} />
            <Route path="/u/:handle"         element={<ProfileScreen />} />
            <Route path="*"                  element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  )
}
