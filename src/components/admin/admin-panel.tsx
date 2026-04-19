import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Users, UserCheck, UserX, Shield, Trash2, Search, Filter, RefreshCw } from "lucide-react"
import { EmailService } from "@/lib/email-service"

interface User {
  id: string
  email: string
  full_name?: string
  street?: string
  house_number?: string
  postal_code?: string
  city?: string
  country?: string
  role: 'admin' | 'user'
  approval_status?: 'pending' | 'approved' | 'rejected'
  approved_at?: string
  approved_by?: string
  rejection_reason?: string
  created_at: string
  last_sign_in_at?: string
  koi_count?: number
  water_measurements_count?: number
}

interface AdminStats {
  total_users: number
  active_users: number
  admin_users: number
  new_users_today: number
  pending_approvals: number
}

export function AdminPanel() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0,
    active_users: 0,
    admin_users: 0,
    new_users_today: 0,
    pending_approvals: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [approvalFilter, setApprovalFilter] = useState<string>("all")

  // Load users and stats
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers()
      loadStats()
    }
  }, [currentUser])

  const loadUsers = async () => {
    try {
      setLoading(true)
      
      // Get users with additional data
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          street,
          house_number,
          postal_code,
          city,
          country,
          role,
          approval_status,
          approved_at,
          approved_by,
          rejection_reason,
          two_factor_enabled,
          last_login_at,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (usersError) {
        console.error('Error loading users:', usersError)
        return
      }

      // Get koi counts for each user
      const { data: koiData, error: koiError } = await supabase
        .from('koi')
        .select('user_id')
      
      if (koiError) {
        console.error('Error loading koi data:', koiError)
      }

      // Get water measurements counts for each user
      const { data: waterData, error: waterError } = await supabase
        .from('water_parameters')
        .select('user_id')
      
      if (waterError) {
        console.error('Error loading water data:', waterError)
      }

      // Combine data
      const usersWithCounts = usersData?.map(user => {
        const koiCount = koiData?.filter(koi => koi.user_id === user.id).length || 0
        const waterCount = waterData?.filter(water => water.user_id === user.id).length || 0
        
        return {
          ...user,
          koi_count: koiCount,
          water_measurements_count: waterCount,
          last_sign_in_at: user.last_login_at
        }
      }) || []

      setUsers(usersWithCounts)
    } catch (error) {
      console.error('Error in loadUsers:', error)
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('users')
        .select('role, created_at, approval_status')

      if (error) {
        console.error('Error loading stats:', error)
        return
      }

      const today = new Date().toISOString().split('T')[0]
      
      const stats = {
        total_users: usersData?.length || 0,
        active_users: usersData?.filter(user => user.created_at).length || 0,
        admin_users: usersData?.filter(user => user.role === 'admin').length || 0,
        new_users_today: usersData?.filter(user => user.created_at.startsWith(today)).length || 0,
        pending_approvals: usersData?.filter(user => user.approval_status === 'pending').length || 0
      }

      setStats(stats)
    } catch (error) {
      console.error('Error in loadStats:', error)
    }
  }

  const logAdminAction = async (actionType: string, targetUserId?: string, details?: any) => {
    try {
      await supabase
        .from('admin_audit_log')
        .insert({
          admin_user_id: currentUser?.id,
          action_type: actionType,
          target_user_id: targetUserId,
          details: details,
          ip_address: null, // Will be filled by client-side if needed
          user_agent: navigator.userAgent
        })
    } catch (error) {
      console.error('Error logging admin action:', error)
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) {
        throw error
      }

      await logAdminAction('role_change', userId, { new_role: newRole })
      
      toast({
        title: "Success",
        description: t("settings.roleChanged", { role: newRole }),
      })

      loadUsers()
    } catch (error) {
      console.error('Error changing role:', error)
      toast({
        title: "Error",
        description: "Failed to change user role",
        variant: "destructive",
      })
    }
  }

  const handlePasswordReset = async (userId: string, userEmail: string) => {
    try {
      const { error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: userEmail,
      })

      if (error) {
        throw error
      }

      await logAdminAction('password_reset', userId, { email: userEmail })
      
      toast({
        title: "Success",
        description: t("settings.passwordResetSent"),
      })
    } catch (error) {
      console.error('Error resetting password:', error)
      toast({
        title: "Error",
        description: "Failed to send password reset email",
        variant: "destructive",
      })
    }
  }

  const handleApproveUser = async (userId: string, userEmail: string, userName?: string) => {
    try {
      const { error } = await supabase.rpc('approve_user', {
        target_user_id: userId,
        admin_user_id: currentUser?.id,
        approval_reason: 'Approved by administrator'
      })

      if (error) {
        throw error
      }

      // Send approval email
      const emailResult = await EmailService.sendApprovalEmail(userEmail, userName)
      if (!emailResult.success) {
        console.warn('Failed to send approval email:', emailResult.error)
      }

      await logAdminAction('user_approve', userId, { email: userEmail })
      
      toast({
        title: "Success",
        description: "User approved successfully and notification email sent",
      })

      loadUsers()
      loadStats()
    } catch (error) {
      console.error('Error approving user:', error)
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      })
    }
  }

  const handleRejectUser = async (userId: string, userEmail: string, reason: string, userName?: string) => {
    try {
      const { error } = await supabase.rpc('reject_user', {
        target_user_id: userId,
        admin_user_id: currentUser?.id,
        rejection_reason: reason
      })

      if (error) {
        throw error
      }

      // Send rejection email
      const emailResult = await EmailService.sendRejectionEmail(userEmail, userName, reason)
      if (!emailResult.success) {
        console.warn('Failed to send rejection email:', emailResult.error)
      }

      await logAdminAction('user_reject', userId, { email: userEmail, reason })
      
      toast({
        title: "Success",
        description: "User rejected successfully and notification email sent",
      })

      loadUsers()
      loadStats()
    } catch (error) {
      console.error('Error rejecting user:', error)
      toast({
        title: "Error",
        description: "Failed to reject user",
        variant: "destructive",
      })
    }
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    try {
      // Delete user data first
      await supabase.from('koi').delete().eq('user_id', userId)
      await supabase.from('water_parameters').delete().eq('user_id', userId)
      await supabase.from('users').delete().eq('id', userId)

      // Delete auth user
      const { error } = await supabase.auth.admin.deleteUser(userId)

      if (error) {
        throw error
      }

      await logAdminAction('user_delete', userId, { email: userEmail })
      
      toast({
        title: "Success",
        description: t("settings.userDeleted"),
      })

      loadUsers()
      loadStats()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      })
    }
  }

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === "" || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.street?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.city?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && user.last_sign_in_at) ||
      (statusFilter === "inactive" && !user.last_sign_in_at)
    
    const matchesApproval = approvalFilter === "all" || 
      (approvalFilter === "pending" && user.approval_status === "pending") ||
      (approvalFilter === "approved" && user.approval_status === "approved") ||
      (approvalFilter === "rejected" && user.approval_status === "rejected")

    return matchesSearch && matchesRole && matchesStatus && matchesApproval
  })

  if (currentUser?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("settings.accessDenied")}</h1>
          <p className="text-muted-foreground">{t("settings.noPermission")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("settings.adminPanel")}</h1>
        <p className="text-muted-foreground">{t("settings.manageUsers")}</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("settings.totalUsers")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_users}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("settings.activeUsers")}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_users}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("settings.adminUsers")}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admin_users}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("settings.newToday")}</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new_users_today}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_approvals}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.userManagement")}</CardTitle>
          <CardDescription>{t("settings.manageUsers")}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("settings.searchUsers")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("settings.filterByRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("settings.allRoles")}</SelectItem>
                <SelectItem value="admin">{t("settings.admin")}</SelectItem>
                <SelectItem value="user">{t("settings.user")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("settings.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("settings.allStatus")}</SelectItem>
                <SelectItem value="active">{t("settings.active")}</SelectItem>
                <SelectItem value="inactive">{t("settings.inactive")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={approvalFilter} onValueChange={setApprovalFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Approval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Approvals</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadUsers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t("settings.refresh")}
            </Button>
          </div>

          {/* Users Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("settings.fullName")}</TableHead>
                  <TableHead>{t("settings.userRole")}</TableHead>
                  <TableHead>Approval Status</TableHead>
                  <TableHead>{t("settings.location")}</TableHead>
                  <TableHead>{t("settings.data")}</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead>{t("settings.lastLogin")}</TableHead>
                  <TableHead>{t("settings.accountCreated")}</TableHead>
                  <TableHead>{t("settings.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        {t("settings.loadingUsers")}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {t("settings.noUsersFound")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name || t("settings.noName")}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          user.approval_status === 'approved' ? 'default' :
                          user.approval_status === 'pending' ? 'secondary' :
                          'destructive'
                        }>
                          {user.approval_status || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.street && user.house_number && (
                            <div>{user.street} {user.house_number}</div>
                          )}
                          {user.postal_code && user.city && (
                            <div>{user.postal_code} {user.city}</div>
                          )}
                          {user.country && <div>{user.country}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>Koi: {user.koi_count || 0}</div>
                          <div>Measurements: {user.water_measurements_count || 0}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.two_factor_enabled ? "default" : "secondary"}>
                          {user.two_factor_enabled ? t("settings.2FAEnabled") : t("settings.2FADisabled")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.last_sign_in_at 
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : t("settings.never")
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.approval_status === 'pending' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApproveUser(user.id, user.email, user.full_name)}
                              >
                                Approve
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    Reject
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Reject User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Please provide a reason for rejecting this user registration.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <div className="py-4">
                                    <Input
                                      placeholder="Rejection reason..."
                                      id="rejection-reason"
                                    />
                                  </div>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => {
                                        const reason = (document.getElementById('rejection-reason') as HTMLInputElement)?.value || 'No reason provided'
                                        handleRejectUser(user.id, user.email, reason, user.full_name)
                                      }}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Reject User
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          
                          {user.approval_status === 'approved' && (
                            <>
                              <Select
                                value={user.role}
                                onValueChange={(value: 'admin' | 'user') => handleRoleChange(user.id, value)}
                              >
                                <SelectTrigger className="w-[100px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePasswordReset(user.id, user.email)}
                              >
                                {t("settings.resetPassword")}
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t("settings.deleteUser")}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t("settings.deleteUserConfirm", { email: user.email })}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t("settings.cancel")}</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(user.id, user.email)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {t("settings.delete")}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
