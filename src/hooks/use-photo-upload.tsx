import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

interface PhotoUploadResult {
  url: string
  path: string
  isLocal?: boolean
}

export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const uploadPhoto = async (
    file: File, 
    folder: 'koi-photos' | 'water-tests' | 'profile-photos',
    fileName?: string
  ): Promise<PhotoUploadResult | null> => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to upload photos.",
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
            title: "Storage Not Configured",
            description: "Photo storage is not set up. Please contact support.",
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
              title: "Upload Failed",
              description: `Failed to upload photo: ${retryError.message}`,
              variant: "destructive",
            })
            return null
          }
          
          // Get public URL for retry
          const { data: urlData } = supabase.storage
            .from('photos')
            .getPublicUrl(filePath)

          toast({
            title: "Photo Uploaded",
            description: "Photo has been uploaded successfully.",
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
          title: "Upload Failed - Using Local Storage",
          description: "Photo saved locally. Will retry upload later.",
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
        title: "Photo Uploaded",
        description: "Photo has been uploaded successfully.",
      })

      return {
        url: urlData.publicUrl,
        path: filePath
      }

    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload Failed",
        description: "An unexpected error occurred while uploading.",
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
          title: "Delete Failed",
          description: "Failed to delete photo.",
          variant: "destructive",
        })
        return false
      }

      toast({
        title: "Photo Deleted",
        description: "Photo has been deleted successfully.",
      })

      return true
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: "Delete Failed",
        description: "An unexpected error occurred while deleting.",
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
