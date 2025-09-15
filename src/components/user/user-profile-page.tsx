import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { User, Mail, Lock, Save, ArrowLeft, Camera, Upload, X, Shield } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { TwoFactorSetup } from "@/components/auth/TwoFactorSetup"
import { useTranslation } from "react-i18next"

interface UserProfilePageProps {
  onNavigate: (tab: string) => void
}

export function UserProfilePage({ onNavigate }: UserProfilePageProps) {
  const { t } = useTranslation()
  const { user, updateProfile } = useAuth()
  const { toast } = useToast()
  
  // User profile state
  const [profileData, setProfileData] = useState({
    full_name: "",
    email: "",
    street: "",
    house_number: "",
    postal_code: "",
    city: "",
    country: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    profile_photo_url: ""
  })
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || "",
        email: user.email || "",
        street: user.street || "",
        house_number: user.house_number || "",
        postal_code: user.postal_code || "",
        city: user.city || "",
        country: user.country || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        profile_photo_url: user.profile_photo_url || ""
      })
    }
  }, [user])

  // Update profile function
  const handleUpdateProfile = async () => {
    if (!user) return
    
    setIsUpdatingProfile(true)
    try {
      const { error } = await updateProfile({
        full_name: profileData.full_name,
        email: profileData.email,
        street: profileData.street,
        house_number: profileData.house_number,
        postal_code: profileData.postal_code,
        city: profileData.city,
        country: profileData.country
      })
      
      if (error) {
        toast({
          title: t("settings.profileUpdated"),
          description: error.message || "Failed to update profile",
          variant: "destructive",
        })
      } else {
        toast({
          title: t("settings.profileUpdated"),
          description: t("settings.profileUpdateSuccess"),
        })
      }
    } catch (error) {
      toast({
        title: "Update Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // Update password function
  const handleUpdatePassword = async () => {
    if (!user) return
    
    if (profileData.newPassword !== profileData.confirmPassword) {
      toast({
        title: t("settings.passwordMismatch"),
        description: t("settings.passwordMismatchDesc"),
        variant: "destructive",
      })
      return
    }
    
    if (profileData.newPassword.length < 6) {
      toast({
        title: t("settings.passwordTooShort"),
        description: t("settings.passwordTooShortDesc"),
        variant: "destructive",
      })
      return
    }
    
    setIsUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: profileData.newPassword
      })
      
      if (error) {
        toast({
          title: t("settings.passwordUpdated"),
          description: error.message || "Failed to update password",
          variant: "destructive",
        })
      } else {
        toast({
          title: t("settings.passwordUpdated"),
          description: t("settings.passwordUpdateSuccess"),
        })
        setProfileData(prev => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        }))
      }
    } catch (error) {
      toast({
        title: "Password Update Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: t("settings.invalidFileType"),
          description: t("settings.invalidFileTypeDesc"),
          variant: "destructive",
        })
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: t("settings.fileTooLarge"),
          description: t("settings.fileTooLargeDesc"),
          variant: "destructive",
        })
        return
      }

      // Create preview URL
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  // Upload profile photo
  const handleUploadPhoto = async () => {
    if (!user || !fileInputRef.current?.files?.[0]) return

    const file = fileInputRef.current.files[0]
    setIsUploadingPhoto(true)

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = fileName

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath)

      // Update user profile with new photo URL
      const { error: updateError } = await updateProfile({
        profile_photo_url: data.publicUrl
      })

      if (updateError) {
        throw updateError
      }

      // Update local state
      setProfileData(prev => ({
        ...prev,
        profile_photo_url: data.publicUrl
      }))

      // Clear preview and file input
      setPreviewUrl(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      toast({
        title: t("settings.photoUpdated"),
        description: t("settings.photoUpdateSuccess"),
      })

    } catch (error: any) {
      console.error('Error uploading photo:', error)
      toast({
        title: t("settings.uploadError"),
        description: error.message || "Failed to upload photo",
        variant: "destructive",
      })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Remove profile photo
  const handleRemovePhoto = async () => {
    if (!user) return

    setIsUploadingPhoto(true)
    try {
      // Update user profile to remove photo URL
      const { error } = await updateProfile({
        profile_photo_url: null
      })

      if (error) {
        throw error
      }

      // Update local state
      setProfileData(prev => ({
        ...prev,
        profile_photo_url: ""
      }))

      // Clear preview
      setPreviewUrl(null)

      toast({
        title: t("settings.photoRemoved"),
        description: t("settings.photoRemoveSuccess"),
      })

    } catch (error: any) {
      console.error('Error removing photo:', error)
      toast({
        title: t("settings.removeError"),
        description: error.message || "Failed to remove photo",
        variant: "destructive",
      })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (user?.full_name) {
      return user.full_name
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return user?.email?.[0]?.toUpperCase() || 'U'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => onNavigate("dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("settings.profileManagement")}</h1>
          <p className="text-muted-foreground">{t("settings.profileDescription")}</p>
        </div>
      </div>

      {/* User Profile Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {t("settings.basicInformation")}
          </CardTitle>
          <CardDescription>{t("settings.profileDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Photo Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-6">
              {/* Avatar Display */}
              <Avatar className="h-20 w-20">
                <AvatarImage 
                  src={previewUrl || profileData.profile_photo_url || undefined} 
                  alt="Profile photo" 
                />
                <AvatarFallback className="text-lg">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>

              {/* Upload Controls */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {previewUrl ? t("settings.changePhoto") : t("settings.uploadPhoto")}
                  </Button>
                </div>

                {previewUrl && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUploadPhoto}
                      disabled={isUploadingPhoto}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isUploadingPhoto ? t("settings.uploading") : t("settings.savePhoto")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPreviewUrl(null)
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      {t("settings.cancel")}
                    </Button>
                  </div>
                )}

                {profileData.profile_photo_url && !previewUrl && (
                  <Button
                    variant="outline"
                    onClick={handleRemovePhoto}
                    disabled={isUploadingPhoto}
                    size="sm"
                    className="flex items-center gap-2 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                    {t("settings.removePhoto")}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator />
          {/* Basic Profile Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t("settings.basicInformation")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">{t("settings.fullName")}</Label>
                <Input
                  id="full_name"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder={t("settings.enterFullName")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("settings.emailAddress")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder={t("settings.enterEmail")}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Address Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t("settings.addressInformation")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="street">{t("settings.street")}</Label>
                <Input
                  id="street"
                  value={profileData.street}
                  onChange={(e) => setProfileData(prev => ({ ...prev, street: e.target.value }))}
                  placeholder={t("settings.enterStreet")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="house_number">{t("settings.houseNumber")}</Label>
                <Input
                  id="house_number"
                  value={profileData.house_number}
                  onChange={(e) => setProfileData(prev => ({ ...prev, house_number: e.target.value }))}
                  placeholder={t("settings.enterHouseNumber")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_code">{t("settings.postalCode")}</Label>
                <Input
                  id="postal_code"
                  value={profileData.postal_code}
                  onChange={(e) => setProfileData(prev => ({ ...prev, postal_code: e.target.value }))}
                  placeholder={t("settings.enterPostalCode")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t("settings.city")}</Label>
                <Input
                  id="city"
                  value={profileData.city}
                  onChange={(e) => setProfileData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder={t("settings.enterCity")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">{t("settings.country")}</Label>
                <Input
                  id="country"
                  value={profileData.country}
                  onChange={(e) => setProfileData(prev => ({ ...prev, country: e.target.value }))}
                  placeholder={t("settings.enterCountry")}
                />
              </div>
            </div>
            <Button
              onClick={handleUpdateProfile}
              disabled={isUpdatingProfile}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isUpdatingProfile ? t("settings.updating") : t("settings.updateProfile")}
            </Button>
          </div>

          <Separator />

          {/* Password Change */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t("settings.changePassword")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t("settings.currentPassword")}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={profileData.currentPassword}
                  onChange={(e) => setProfileData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder={t("settings.enterCurrentPassword")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("settings.newPassword")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={profileData.newPassword}
                  onChange={(e) => setProfileData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder={t("settings.enterNewPassword")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("settings.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={profileData.confirmPassword}
                  onChange={(e) => setProfileData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder={t("settings.confirmNewPassword")}
                />
              </div>
            </div>
            <Button 
              onClick={handleUpdatePassword} 
              disabled={isUpdatingPassword}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Lock className="h-4 w-4" />
              {isUpdatingPassword ? t("settings.updating") : t("settings.updatePassword")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t("settings.twoFactorAuth")}
          </CardTitle>
          <CardDescription>{t("settings.twoFactorAuthDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSetup />
        </CardContent>
      </Card>

      {/* User Info Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Account Information
          </CardTitle>
          <CardDescription>Your current account details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">User ID</Label>
              <p className="text-sm font-mono bg-muted p-2 rounded">{user?.id}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Account Created</Label>
              <p className="text-sm">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
              <p className="text-sm">
                {user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Role</Label>
              <p className="text-sm">
                {user?.role === 'admin' ? 'Administrator' : 'User'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
