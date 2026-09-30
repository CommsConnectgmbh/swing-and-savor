import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Avatar from './Avatar'

describe('Avatar', () => {
  it('renders the image when a src is provided', () => {
    const { container } = render(<Avatar src="https://x/a.png" name="Ada Lovelace" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('https://x/a.png')
    expect(img.getAttribute('alt')).toBe('Ada Lovelace')
    expect(container.querySelector('span')).toBeNull()
  })

  it('falls back to initials when there is no src', () => {
    const { container } = render(<Avatar name="Ada Lovelace" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('span').textContent).toBe('AL')
  })

  it('sizes the circle from the size prop', () => {
    const { container } = render(<Avatar name="Ada" size={56} />)
    const box = container.firstChild
    expect(box.style.width).toBe('56px')
    expect(box.style.height).toBe('56px')
  })

  it('defaults the initials font size to size / 3.2', () => {
    const { container } = render(<Avatar name="Ada" size={80} />)
    expect(container.querySelector('span').style.fontSize).toBe('25px')
  })

  it('honours an explicit fontSize override', () => {
    const { container } = render(<Avatar name="Ada" size={28} fontSize={10} />)
    expect(container.querySelector('span').style.fontSize).toBe('10px')
  })

  it('uses an empty alt when no name is given', () => {
    const { container } = render(<Avatar src="https://x/a.png" />)
    expect(container.querySelector('img').getAttribute('alt')).toBe('')
  })
})
