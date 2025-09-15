import React, { useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface LightboxProps {
  isOpen: boolean
  onClose: () => void
  images: string[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onDelete?: (index: number) => void
  title?: string
}

export function Lightbox({ 
  isOpen, 
  onClose, 
  images, 
  currentIndex, 
  onIndexChange, 
  onDelete,
  title 
}: LightboxProps) {
  const [zoom, setZoom] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)
  const { toast } = useToast()

  const currentImage = images[currentIndex]

  // Reset zoom and rotation when image changes
  useEffect(() => {
    setZoom(1)
    setRotation(0)
  }, [currentIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          e.preventDefault()
          goToPrevious()
          break
        case 'ArrowRight':
          e.preventDefault()
          goToNext()
          break
        case '+':
        case '=':
          e.preventDefault()
          setZoom(prev => Math.min(prev + 0.25, 3))
          break
        case '-':
          e.preventDefault()
          setZoom(prev => Math.max(prev - 0.25, 0.5))
          break
        case 'r':
        case 'R':
          e.preventDefault()
          setRotation(prev => (prev + 90) % 360)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentIndex, images.length])

  const goToPrevious = () => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1)
    } else {
      onIndexChange(images.length - 1) // Loop to last image
    }
  }

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      onIndexChange(currentIndex + 1)
    } else {
      onIndexChange(0) // Loop to first image
    }
  }

  const handleDownload = () => {
    if (!currentImage) return
    
    try {
      const link = document.createElement('a')
      link.href = currentImage
      link.download = `water-test-${currentIndex + 1}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({
        title: "Download Started",
        description: "Photo is being downloaded.",
      })
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download the photo.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete(currentIndex)
    }
  }

  const resetView = () => {
    setZoom(1)
    setRotation(0)
  }

  if (!isOpen || !currentImage) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 bg-black/50 text-white">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <h3 className="text-sm sm:text-lg font-semibold truncate">
                {title || `Photo ${currentIndex + 1} of ${images.length}`}
              </h3>
              <div className="text-xs sm:text-sm text-gray-300 flex-shrink-0">
                {Math.round(zoom * 100)}% • {rotation}°
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-white hover:bg-white/20 p-2"
              >
                <Download className="h-4 w-4" />
              </Button>
              
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-white hover:bg-red-500/20 hover:text-red-400 p-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/20 p-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Image Container */}
          <div className="flex-1 relative overflow-hidden">
            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            {/* Image */}
            <div className="w-full h-full flex items-center justify-center p-8">
              <img
                src={currentImage}
                alt={`Photo ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  cursor: zoom > 1 ? 'grab' : 'default'
                }}
                draggable={false}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 p-3 sm:p-4 bg-black/50 text-white">
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                disabled={zoom <= 0.5}
                className="text-white hover:bg-white/20 p-2"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              
              <span className="text-xs sm:text-sm min-w-[50px] sm:min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
                disabled={zoom >= 3}
                className="text-white hover:bg-white/20 p-2"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRotation(prev => (prev + 90) % 360)}
              className="text-white hover:bg-white/20 p-2"
            >
              <RotateCw className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetView}
              className="text-white hover:bg-white/20 p-2 text-xs sm:text-sm"
            >
              Reset
            </Button>
          </div>

          {/* Thumbnail Navigation */}
          {images.length > 1 && (
            <div className="flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-4 bg-black/50 overflow-x-auto">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => onIndexChange(index)}
                  className={`flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentIndex 
                      ? 'border-white' 
                      : 'border-transparent hover:border-white/50'
                  }`}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
