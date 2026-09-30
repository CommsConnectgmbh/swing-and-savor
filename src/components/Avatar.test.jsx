import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Avatar from './Avatar'

// Pins the behaviour the four public share screens (Recap, Crew, Invitational,
// Hall of Fame) previously relied on from their inlined copies.
describe('Avatar', () => {
  it('renders the image (and no monogram) when a src is given', () => {
    render(<Avatar src="https://example.test/a.jpg" name="Ada Lovelace" size={48} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.test/a.jpg')
    expect(img).toHaveAttribute('alt', 'Ada Lovelace')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img.className).toContain('object-cover')
    expect(screen.queryByText('AL')).toBeNull()
  })

  it('falls back to name initials when no src is given', () => {
    render(<Avatar name="Ada Lovelace" size={48} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('uses an empty alt when no name is provided', () => {
    render(<Avatar src="https://example.test/a.jpg" size={32} />)
    expect(screen.getByRole('img')).toHaveAttribute('alt', '')
  })

  it('applies the size to the container box', () => {
    const { container } = render(<Avatar name="Ada Lovelace" size={28} />)
    const box = container.firstChild
    expect(box.style.width).toBe('28px')
    expect(box.style.height).toBe('28px')
  })

  it('treats a numeric initialsFontSize as a fixed px size (Recap/Invitational)', () => {
    render(<Avatar name="Ada Lovelace" size={48} initialsFontSize={10} />)
    expect(screen.getByText('AL').style.fontSize).toBe('10px')
  })

  it('derives the font size from `size` when initialsFontSize is a function (Crew)', () => {
    render(<Avatar name="Ada Lovelace" size={56} initialsFontSize={(s) => s / 3.4} />)
    expect(screen.getByText('AL').style.fontSize).toBe(`${56 / 3.4}px`)
  })

  it('defaults the monogram sizing to size / 3.2 (Hall of Fame)', () => {
    render(<Avatar name="Ada Lovelace" size={88} />)
    expect(screen.getByText('AL').style.fontSize).toBe(`${88 / 3.2}px`)
  })
})
