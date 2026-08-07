import { useEffect, useRef } from 'react'
import { renderLoop } from '@renderer/core/render-loop'
import { WINDOW } from '@shared/constants'

export default function PetCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      renderLoop.init(canvasRef.current)
    }
    return () => {
      renderLoop.destroy()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: WINDOW.WIDTH,
        height: WINDOW.HEIGHT,
        display: 'block',
        cursor: 'default',
      }}
    />
  )
}
