import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CupRow from './CupRow'

function renderRow(cup) {
  return render(
    <MemoryRouter>
      <CupRow cup={cup} />
    </MemoryRouter>,
  )
}

describe('CupRow', () => {
  const base = {
    id: 1,
    name: 'Spring Cup',
    date: '2026-04-12',
    invite_code: 'ABC123',
    location_name: 'St Andrews',
    status: 'active',
  }

  it('renders the cup name, formatted date and location', () => {
    renderRow(base)
    expect(screen.getByText('Spring Cup')).toBeInTheDocument()
    // de-DE 2-digit day / short month / numeric year, joined to the location.
    const expectedDate = new Date(base.date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    // getByText collapses the double-spaces around the separator.
    expect(
      screen.getByText(`St Andrews · ${expectedDate}`),
    ).toBeInTheDocument()
  })

  it('links a live cup to its invite page and shows the Live tag', () => {
    renderRow(base)
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/i/ABC123')
  })

  it('links a finished cup to its recap page and shows the Recap tag', () => {
    renderRow({ ...base, status: 'finished' })
    expect(screen.getByText('Recap')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/recap/ABC123')
  })

  it('shows the champion line only when a champion is set', () => {
    const { rerender } = renderRow(base)
    expect(screen.queryByText(/Champion:/)).not.toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <CupRow cup={{ ...base, champion: 'Ada' }} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Champion: Ada')).toBeInTheDocument()
  })

  it('omits the separator when the location is missing', () => {
    renderRow({ ...base, location_name: null })
    const expectedDate = new Date(base.date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    expect(screen.getByText(expectedDate)).toBeInTheDocument()
  })
})
