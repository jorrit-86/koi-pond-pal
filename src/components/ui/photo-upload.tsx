import React, { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, X, Image as ImageIcon, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from 'react-i18next'

interface PhotoUploadProps {
  onPhotoSelected: (photoUrl: string, photoFile: File) => void
  onClose: () => void
  title?: string
  description?: string
}

export function PhotoUpload({ 
  onPhotoSelected, 
  onClose,
  title = "Select Photo",
  description = "Choose a photo from your device"
}: PhotoUploadProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()

  const compressImage = useCallback((file: File, maxSizeMB: number = 1): Promise<File> => {
    return new Promise((resolve, reject) => {
      try {
        // Check if file is already small enough
        if (file.size <= maxSizeMB * 1024 * 1024) {
          resolve(file)
          return
        }

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          console.warn('Canvas context not available, using original file')
          resolve(file)
          return
        }

        const img = new Image()
        
        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.warn('Image loading timeout, using original file')
          resolve(file)
        }, 10000) // 10 second timeout
        
        img.onload = () => {
          clearTimeout(timeout)
          try {
            // Calculate new dimensions (max 1920px width/height)
            let { width, height } = img
            const maxDimension = 1920
            
            if (width > height && width > maxDimension) {
              height = Math.round((height * maxDimension) / width)
              width = maxDimension
            } else if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height)
              height = maxDimension
            }

            // Ensure dimensions are valid
            if (width <= 0 || height <= 0) {
              console.warn('Invalid dimensions after resize, using original file')
              resolve(file)
              return
            }

            canvas.width = width
            canvas.height = height

            // Draw image with error handling
            try {
              ctx.drawImage(img, 0, 0, width, height)
            } catch (drawError) {
              console.warn('Error drawing image to canvas:', drawError)
              resolve(file)
              return
            }
            
            // Try different quality levels to get under target size
            const tryCompress = (quality: number): void => {
              try {
                canvas.toBlob((blob) => {
                  if (!blob) {
                    console.warn('Failed to create blob, using original file')
                    resolve(file)
                    return
                  }

                  const sizeMB = blob.size / (1024 * 1024)
                  
                  if (sizeMB <= maxSizeMB || quality <= 0.1) {
                    // Create new file with compressed data
                    const compressedFile = new File([blob], file.name, {
                      type: 'image/jpeg',
                      lastModified: Date.now()
                    })
                    resolve(compressedFile)
                  } else {
                    // Try with lower quality (minimum 0.1)
                    const nextQuality = Math.max(0.1, quality - 0.1)
                    tryCompress(nextQuality)
                  }
                }, 'image/jpeg', quality)
              } catch (blobError) {
                console.warn('Error creating blob:', blobError)
                resolve(file)
              }
            }

            // Start with 0.8 quality
            tryCompress(0.8)
          } catch (error) {
            console.warn('Error in image processing:', error)
            resolve(file)
          }
        }

        img.onerror = (error) => {
          clearTimeout(timeout)
          console.warn('Error loading image:', error)
          resolve(file) // Fallback to original
        }

        // Set crossOrigin to handle CORS issues
        img.crossOrigin = 'anonymous'
        img.src = URL.createObjectURL(file)
      } catch (error) {
        console.warn('Error in compressImage:', error)
        resolve(file)
      }
    })
  }, [])

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select a valid image file (JPG, PNG, WebP, GIF).",
        variant: "destructive",
      })
      return
    }

    // Check file size (max 50MB for processing)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 50MB.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsProcessing(true)
      
      // Show loading state
      toast({
        title: "Processing Photo",
        description: "Compressing image for optimal upload...",
      })

      // Compress the image to max 1MB
      const compressedFile = await compressImage(file, 1)
      
      if (!compressedFile) {
        throw new Error('Compression failed')
      }

      const photoUrl = URL.createObjectURL(compressedFile)
      setSelectedPhoto(photoUrl)
      setSelectedFile(compressedFile)

      // Show compression info
      const originalSize = (file.size / (1024 * 1024)).toFixed(1)
      const compressedSize = (compressedFile.size / (1024 * 1024)).toFixed(1)
      
      if (compressedFile.size < file.size) {
        toast({
          title: "Photo Compressed",
          description: `Reduced from ${originalSize}MB to ${compressedSize}MB`,
        })
      } else {
        toast({
          title: "Photo Ready",
          description: `Photo size: ${compressedSize}MB`,
        })
      }
    } catch (error) {
      console.error('Error processing image:', error)
      
      // Try to use original file as fallback
      try {
        const photoUrl = URL.createObjectURL(file)
        setSelectedPhoto(photoUrl)
        setSelectedFile(file)
        
        toast({
          title: "Using Original Photo",
          description: "Could not compress image, using original file.",
          variant: "default",
        })
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
        toast({
          title: "Processing Error",
          description: "Could not process the image. Please try another photo.",
          variant: "destructive",
        })
      }
    } finally {
      setIsProcessing(false)
    }
  }, [toast, compressImage])

  const handleConfirm = useCallback(() => {
    if (selectedPhoto && selectedFile) {
      onPhotoSelected(selectedPhoto, selectedFile)
      onClose()
    }
  }, [selectedPhoto, selectedFile, onPhotoSelected, onClose])

  const handleCancel = useCallback(() => {
    setSelectedPhoto(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  if (selectedPhoto) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t('photoUpload.previewPhoto')}</h3>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative">
                <img 
                  src={selectedPhoto} 
                  alt={t('photoUpload.selectedPhoto')} 
                  className="w-full rounded-lg"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  className="flex-1"
                >
                  {t('photoUpload.selectDifferentPhoto')}
                </Button>
                <Button 
                  onClick={handleConfirm}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('photoUpload.useThisPhoto')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{title}</h3>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-gray-400" />
              </div>
              
              <div>
                <h4 className="font-medium mb-2">{description}</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('photoUpload.supportedFormats')}<br/>
                  {t('photoUpload.compressionInfo')}<br/>
                  <span className="text-xs text-muted-foreground/70">
                    {t('photoUpload.compressionFallback')}
                  </span>
                </p>
              </div>

              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('photoUpload.processing')}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t('photoUpload.choosePhoto')}
                  </>
                )}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
