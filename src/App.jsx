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
const InvitationalScreen = lazy(() => import('./screens/InvitationalScreen'))
const RecapScreen        = lazy(() => import('./screens/RecapScreen'))
const HallOfFameScreen   = lazy(() => import('./screens/HallOfFameScreen'))
const AdminScreen        = lazy(() => import('./screens/AdminScreen'))
const CrewScreen         = lazy(() => import('./screens/CrewScreen'))
const SeasonScreen       = lazy(() => import('./screens/SeasonScreen'))
const SavorScreen        = lazy(() => import('./screens/SavorScreen'))
const SavorCategoryScreen= lazy(() => import('./screens/SavorCategoryScreen'))
const SavorOfferScreen   = lazy(() => import('./screens/SavorOfferScreen'))
const CasualScreen       = lazy(() => import('./screens/CasualScreen'))

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
    '/casual':      t('nav.casual', 'Casual'),
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
  const isPublicCup = pathname.startsWith('/c/') || pathname.startsWith('/i/') || pathname.startsWith('/recap/') || pathname.startsWith('/hall/') || pathname.startsWith('/crew/') || pathname.startsWith('/season/')

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
      <div
        className="min-h-screen bg-bg text-ink"
        style={{
          // Header-less full-screen routes: ohne diese Insets klebt der Inhalt
          // unter Notch/Dynamic Island und der Home-Indicator deckt das Ende ab.
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <Suspense fallback={<ScreenFallback />}>
          <Routes>
            <Route path="/c/:inviteCode"     element={<PublicCupScreen />} />
            <Route path="/i/:inviteCode"     element={<InvitationalScreen />} />
            <Route path="/recap/:inviteCode" element={<RecapScreen />} />
            <Route path="/hall/:handle"      element={<HallOfFameScreen />} />
            <Route path="/crew/:slug"        element={<CrewScreen />} />
            <Route path="/season/:slug"      element={<SeasonScreen />} />
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
            <Route path="/admin"             element={<AdminScreen />} />
            <Route path="/savor"             element={<SavorScreen />} />
            <Route path="/savor/c/:category"  element={<SavorCategoryScreen />} />
            <Route path="/savor/o/:slug"      element={<SavorOfferScreen />} />
            <Route path="/casual"             element={<CasualScreen />} />
            <Route path="/casual/:roundId"    element={<CasualScreen />} />
            <Route path="*"                  element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  )
}
