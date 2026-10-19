// Kaufoberflaechen: Kauf nur mit beiden Pflicht-Haken (sofortige Ausfuehrung + volljaehrig),
// und der Request an die Checkout-Funktion traegt adult_confirmed: true.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../lib/i18n'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt-test' } } })) } },
}))
vi.mock('../lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' }, refreshProfile: vi.fn() }) }))
vi.mock('../lib/proAccess', () => ({ useProAccess: () => false }))
vi.mock('../lib/launchMonitor', () => ({
  launchMonitorPlatformSupported: () => true,
  probeLaunchMonitor: async () => ({ supported: true }),
  openLaunchMonitor: vi.fn(),
}))

const ADULT = 'Ich bin volljährig (mindestens 18 Jahre alt).'
let fetchMock

beforeEach(async () => {
  await i18n.changeLanguage('de')
  fetchMock = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'test_stop' }) }))
  vi.stubGlobal('fetch', fetchMock)
})

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body)

describe('BoostSheet', { timeout: 30000 }, () => {
  it('Kauf erst mit beiden Haken, Request mit adult_confirmed', async () => {
    const { default: BoostSheet } = await import('./BoostSheet')
    render(<BoostSheet cup={{ id: 't1', name: 'Cup' }} onClose={() => {}} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    expect(screen.getByText(ADULT)).toBeInTheDocument()
    const buy = screen.getAllByRole('button').at(-1)
    expect(buy).toBeDisabled()
    fireEvent.click(boxes[0])
    expect(buy).toBeDisabled()                 // nur Sofort-Ausfuehrung reicht nicht
    fireEvent.click(boxes[1])
    expect(buy).toBeEnabled()
    fireEvent.click(buy)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toContain('/functions/v1/create-boost-checkout')
    expect(sentBody()).toMatchObject({ tournament_id: 't1', instant_execution_consent: true, adult_confirmed: true })
  })

  it('Serverfehler adult_confirmation_required wird verstaendlich angezeigt', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'adult_confirmation_required' }) })
    const { default: BoostSheet } = await import('./BoostSheet')
    render(<BoostSheet cup={{ id: 't1', name: 'Cup' }} onClose={() => {}} />)
    const boxes = screen.getAllByRole('checkbox')
    fireEvent.click(boxes[0]); fireEvent.click(boxes[1])
    fireEvent.click(screen.getAllByRole('button').at(-1))
    expect(await screen.findByText(/Käufe sind nur für Volljährige möglich/)).toBeInTheDocument()
  })
})

describe('PremiumConsentModal (CupScreen)', { timeout: 30000 }, () => {
  it('Bestaetigen erst mit beiden Haken', async () => {
    const { PremiumConsentModal } = await import('../screens/CupScreen')
    const onConfirm = vi.fn()
    render(<PremiumConsentModal cup={{ id: 't1', name: 'Cup' }} onCancel={() => {}} onConfirm={onConfirm} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    expect(screen.getByText(ADULT)).toBeInTheDocument()
    const buy = screen.getAllByRole('button').at(-1)
    fireEvent.click(boxes[0])
    expect(buy).toBeDisabled()
    fireEvent.click(boxes[1])
    expect(buy).toBeEnabled()
    fireEvent.click(buy)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})

describe('RangeScreen (Launch Monitor Pro)', { timeout: 30000 }, () => {
  it('Kauf erst mit beiden Haken, Request mit adult_confirmed', async () => {
    const { default: RangeScreen } = await import('../screens/RangeScreen')
    render(<MemoryRouter><RangeScreen /></MemoryRouter>)
    await screen.findByText(ADULT)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    const buy = screen.getAllByRole('button').at(-1)
    expect(buy).toBeDisabled()
    fireEvent.click(boxes[0])
    expect(buy).toBeDisabled()
    fireEvent.click(boxes[1])
    expect(buy).toBeEnabled()
    fireEvent.click(buy)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toContain('/functions/v1/create-pro-checkout')
    expect(sentBody()).toMatchObject({ plan_key: 'launch_monitor_lifetime', instant_execution_consent: true, adult_confirmed: true })
  })
})
