import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CupRow from './CupRow'

// CupRow is shared by CrewScreen, HallOfFameScreen and SeasonScreen. These
// assertions pin the behaviour those three screens previously duplicated inline,
// so a change to the shared row can't silently regress any of them.
function renderRow(cup) {
  return render(<MemoryRouter><CupRow cup={cup} /></MemoryRouter>)
}

describe('CupRow', () => {
  const base = {
    id: '1',
    name: 'Spring Cup',
    invite_code: 'ABC',
    location_name: 'Wien',
    date: '2026-06-14',
  }

  it('links a live cup to the invitational view', () => {
    renderRow({ ...base, status: 'live' })
    expect(screen.getByRole('link')).toHaveAttribute('href', '/i/ABC')
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('links a finished cup to the recap view', () => {
    renderRow({ ...base, status: 'finished' })
    expect(screen.getByRole('link')).toHaveAttribute('href', '/recap/ABC')
    expect(screen.getByText('Recap')).toBeInTheDocument()
  })

  it('renders the localised de-DE date joined with the location', () => {
    renderRow({ ...base, status: 'live' })
    expect(screen.getByText(/Wien/)).toHaveTextContent('14. Juni 2026')
  })

  it('shows the champion only when present', () => {
    const { rerender } = renderRow({ ...base, status: 'finished', champion: 'Alex' })
    expect(screen.getByText(/Champion:/)).toHaveTextContent('Champion: Alex')

    rerender(<MemoryRouter><CupRow cup={{ ...base, status: 'finished' }} /></MemoryRouter>)
    expect(screen.queryByText(/Champion:/)).not.toBeInTheDocument()
  })

  it('omits the location separator when there is no location', () => {
    renderRow({ ...base, status: 'live', location_name: null })
    expect(screen.getByText('14. Juni 2026')).toBeInTheDocument()
  })
})
