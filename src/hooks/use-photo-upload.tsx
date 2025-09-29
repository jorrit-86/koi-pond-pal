import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from 'react-i18next'

interface PhotoUploadResult {
  url: string
  path: string
  isLocal?: boolean
}

export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const { t } = useTranslation()

  const uploadPhoto = async (
    file: File, 
    folder: 'koi-photos' | 'water-tests' | 'profile-photos',
    fileName?: string
  ): Promise<PhotoUploadResult | null> => {
    if (!user) {
      toast({
        title: t('photoUpload.authRequired'),
        description: t('photoUpload.authRequiredDesc'),
        variant: "destructive",
      })
      return null
    }

    try {
      setUploading(true)

      // Generate unique filename if not provided
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const finalFileName = fileName || `${timestamp}.${fileExtension}`
      const filePath = `${user.id}/${folder}/${finalFileName}`

      console.log('Attempting to upload photo:', { filePath, fileSize: file.size, fileType: file.type })

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Upload error:', error)
        
        // Check if bucket doesn't exist
        if (error.message.includes('Bucket not found') || error.message.includes('bucket not found')) {
          console.error('Photos bucket not found. Please run the create-photos-bucket.sql script in your Supabase database.')
          toast({
            title: t('photoUpload.storageNotConfigured'),
            description: t('photoUpload.storageNotConfiguredDesc'),
            variant: "destructive",
          })
          return null
        }
        
        // Try with upsert: true if the file already exists
        if (error.message.includes('already exists')) {
          console.log('File exists, trying with upsert')
          const { data: retryData, error: retryError } = await supabase.storage
            .from('photos')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true
            })
          
          if (retryError) {
            console.error('Retry upload error:', retryError)
            toast({
              title: t('photoUpload.uploadFailed'),
              description: t('photoUpload.uploadFailedDesc', { error: retryError.message }),
              variant: "destructive",
            })
            return null
          }
          
          // Get public URL for retry
          const { data: urlData } = supabase.storage
            .from('photos')
            .getPublicUrl(filePath)

          toast({
            title: t('photoUpload.photoUploaded'),
            description: t('photoUpload.photoUploadedDesc'),
          })

          return {
            url: urlData.publicUrl,
            path: filePath
          }
        }
        
        // If upload fails, try to save locally as fallback
        console.log('Upload failed, trying local fallback')
        const localUrl = URL.createObjectURL(file)
        const localPath = `local/${user.id}/${folder}/${finalFileName}`
        
        toast({
          title: t('photoUpload.uploadFailedLocal'),
          description: t('photoUpload.uploadFailedLocalDesc'),
          variant: "default",
        })
        
        return {
          url: localUrl,
          path: localPath,
          isLocal: true
        }
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath)

      console.log('Upload successful:', { url: urlData.publicUrl, path: filePath })

      toast({
        title: t('photoUpload.photoUploaded'),
        description: t('photoUpload.photoUploadedDesc'),
      })

      return {
        url: urlData.publicUrl,
        path: filePath
      }

    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: t('photoUpload.uploadFailed'),
        description: t('photoUpload.uploadFailedUnexpected'),
        variant: "destructive",
      })
      return null
    } finally {
      setUploading(false)
    }
  }

  const deletePhoto = async (filePath: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from('photos')
        .remove([filePath])

      if (error) {
        console.error('Delete error:', error)
        toast({
          title: t('photoUpload.deleteFailed'),
          description: t('photoUpload.deleteFailedDesc'),
          variant: "destructive",
        })
        return false
      }

      toast({
        title: t('photoUpload.photoDeleted'),
        description: t('photoUpload.photoDeletedDesc'),
      })

      return true
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: t('photoUpload.deleteFailed'),
        description: t('photoUpload.deleteFailedUnexpected'),
        variant: "destructive",
      })
      return false
    }
  }

  return {
    uploadPhoto,
    deletePhoto,
    uploading
  }
}
