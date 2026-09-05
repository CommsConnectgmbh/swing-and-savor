import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import LockIcon from './LockIcon'

describe('LockIcon', () => {
  it('renders an svg carrying the shared padlock path', () => {
    const { container } = render(<LockIcon />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(container.querySelector('path')).toHaveAttribute('d', 'M7 11V7a5 5 0 0110 0v4')
    expect(container.querySelector('rect')).toBeTruthy()
  })

  it('defaults to an 18px currentColor glyph at strokeWidth 2', () => {
    const { container } = render(<LockIcon />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '18')
    expect(svg).toHaveAttribute('height', '18')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveAttribute('stroke-width', '2')
  })

  it('honours size, stroke and strokeWidth overrides', () => {
    const { container } = render(<LockIcon size={11} stroke="#f5b94a" strokeWidth={2.5} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '11')
    expect(svg).toHaveAttribute('height', '11')
    expect(svg).toHaveAttribute('stroke', '#f5b94a')
    expect(svg).toHaveAttribute('stroke-width', '2.5')
  })

  it('forwards extra props such as className to the svg', () => {
    const { container } = render(<LockIcon className="text-lock" />)
    expect(container.querySelector('svg')).toHaveClass('text-lock')
  })
})
