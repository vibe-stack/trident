import React, { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '../../lib/utils'

interface DragInputProps {
  value?: number
  onChange: (value: number) => void
  onValueCommit?: (value: number) => void
  step?: number
  precision?: number
  min?: number
  id?: string
  max?: number
  className?: string
  label?: string
  suffix?: string
  disabled?: boolean
  compact?: boolean
}

export function DragInput({
  value,
  onChange,
  onValueCommit,
  step = 0.01,
  precision = 1,
  min,
  max,
  id,
  className,
  label,
  suffix,
  disabled = false,
  compact = false
}: DragInputProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [hasDragged, setHasDragged] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(value?.toFixed(precision) ?? '')
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartValue, setDragStartValue] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const displayRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef<number | undefined>(value)

  useEffect(() => {
    // Don't update input value while actively dragging
    // This prevents external value changes from breaking the drag state
    if (!isEditing && !isDragging && value !== undefined) {
      setInputValue(value.toFixed(precision))
    }
  }, [value, precision, isEditing, isDragging])

  // Handle cursor style and iframe blocking
  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'ew-resize'
      // Disable pointer events on all iframes during drag
      const iframes = document.querySelectorAll('iframe')
      iframes.forEach(iframe => {
        iframe.style.pointerEvents = 'none'
      })
      
      return () => {
        document.body.style.cursor = 'default'
        // Re-enable pointer events on iframes
        iframes.forEach(iframe => {
          iframe.style.pointerEvents = 'auto'
        })
      }
    }
  }, [isDragging])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing || disabled) return
    
    setIsDragging(true)
    setHasDragged(false)
    setDragStartX(e.clientX)
    setDragStartValue(value ?? 0)
    lastValueRef.current = value ?? 0
    
    e.preventDefault()
  }, [isEditing, disabled, value])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragStartX
    
    // Mark that we've actually dragged if moved more than 2 pixels
    if (Math.abs(deltaX) > 2) {
      setHasDragged(true)
    }
    
    const deltaValue = deltaX * step
    let newValue = dragStartValue + deltaValue

    if (min !== undefined) newValue = Math.max(min, newValue)
    if (max !== undefined) newValue = Math.min(max, newValue)

  lastValueRef.current = newValue
  onChange(newValue)
  }, [isDragging, step, min, max, onChange, dragStartX, dragStartValue])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    // Reset accumulated delta after a short delay to allow click detection
    setTimeout(() => {
      setHasDragged(false)
    }, 0)
    if (onValueCommit) {
      const v = lastValueRef.current ?? value ?? dragStartValue
      onValueCommit(v)
    }
  }, [onValueCommit, value, dragStartValue])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const toggleEditing = () => {
    if (disabled) return
    
    if (isEditing) {
      handleInputBlur()
    } else {
      setIsEditing(true)
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
  }

  const handleClick = () => {
    // Only allow editing if we didn't actually drag
    if (!hasDragged && !disabled) {
      toggleEditing()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    
    if (e.key === 'Enter') {
      e.preventDefault()
      toggleEditing()
    } else if (e.key === ' ') {
      e.preventDefault()
      toggleEditing()
    } else if (/^[0-9]$/.test(e.key)) {
      // Start editing and replace the current value with the typed digit
      e.preventDefault()
      setIsEditing(true)
      setInputValue(e.key)
      setTimeout(() => {
        inputRef.current?.focus()
        // Position cursor at the end
        inputRef.current?.setSelectionRange(1, 1)
      }, 0)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    const numValue = parseFloat(inputValue)
    if (!isNaN(numValue)) {
      let finalValue = numValue
      if (min !== undefined) finalValue = Math.max(min, finalValue)
      if (max !== undefined) finalValue = Math.min(max, finalValue)
      onChange(finalValue)
  if (onValueCommit) onValueCommit(finalValue)
    }
    setIsEditing(false)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInputBlur()
    } else if (e.key === 'Escape') {
      setInputValue(value?.toFixed(precision) ?? '')
      setIsEditing(false)
    }
  }

  return (
    <div className={cn("flex items-center gap-1 w-full min-w-0 overflow-hidden", className)}>
      {label && (
        <span className={cn("text-xs text-zinc-400 flex-shrink-0", compact ? "min-w-0" : "min-w-[40px]")}>{label}</span>
      )}
      {isEditing ? (
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          className={`flex-1 h-6 px-2 text-xs border rounded focus:outline-none min-w-0 w-24 ${
            disabled 
              ? 'bg-zinc-800/50 border-zinc-700/30 text-zinc-500 cursor-not-allowed'
              : 'bg-gray-500/10 border-gray-500/30 text-gray-300 focus:border-gray-500'
          }`}
        />
      ) : (
        <div
          ref={displayRef}
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "flex-1 h-6 px-2 text-xs border rounded w-24 flex items-center justify-between transition-colors select-none min-w-0",
            disabled 
              ? "bg-zinc-800/50 border-zinc-700/30 text-zinc-500 cursor-not-allowed"
              : "bg-black/20 border-zinc-700/50 text-zinc-300 cursor-ew-resize hover:border-gray-500/30 focus:border-gray-500/50 focus:outline-none",
            isDragging && !disabled && "bg-gray-500/10 border-gray-500/30"
          )}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          <span className="truncate">{value?.toFixed(precision) ?? ''}</span>
          {suffix && <span className="text-zinc-500 flex-shrink-0 ml-1">{suffix}</span>}
        </div>
      )}
    </div>
  )
} 