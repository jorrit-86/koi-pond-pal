import { supabase } from './supabase'

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export class EmailService {
  private static getApprovalEmailTemplate(userName: string): EmailTemplate {
    return {
      subject: 'Your Koi Sensei Account Has Been Approved!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Koi Sensei!</h2>
          <p>Dear ${userName || 'User'},</p>
          <p>Great news! Your account has been approved by our administrators. You can now access all features of the Koi Sensei platform.</p>
          <p>You can log in to your account using your registered email and password.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">What's Next?</h3>
            <ul>
              <li>Complete your profile setup</li>
              <li>Add your koi fish to the system</li>
              <li>Set up your pond parameters</li>
              <li>Configure your sensors (if applicable)</li>
            </ul>
          </div>
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>The Koi Sensei Team</p>
        </div>
      `,
      text: `
        Welcome to Koi Sensei!
        
        Dear ${userName || 'User'},
        
        Great news! Your account has been approved by our administrators. You can now access all features of the Koi Sensei platform.
        
        You can log in to your account using your registered email and password.
        
        What's Next?
        - Complete your profile setup
        - Add your koi fish to the system
        - Set up your pond parameters
        - Configure your sensors (if applicable)
        
        If you have any questions, please don't hesitate to contact our support team.
        
        Best regards,
        The Koi Sensei Team
      `
    }
  }

  private static getRejectionEmailTemplate(userName: string, reason: string): EmailTemplate {
    return {
      subject: 'Your Koi Sensei Account Registration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Account Registration Update</h2>
          <p>Dear ${userName || 'User'},</p>
          <p>Thank you for your interest in Koi Sensei. Unfortunately, we are unable to approve your account registration at this time.</p>
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #dc2626;">Reason:</h3>
            <p>${reason}</p>
          </div>
          <p>If you believe this decision was made in error, or if you have additional information that might change this outcome, please contact our support team.</p>
          <p>We appreciate your understanding.</p>
          <p>Best regards,<br>The Koi Sensei Team</p>
        </div>
      `,
      text: `
        Account Registration Update
        
        Dear ${userName || 'User'},
        
        Thank you for your interest in Koi Sensei. Unfortunately, we are unable to approve your account registration at this time.
        
        Reason: ${reason}
        
        If you believe this decision was made in error, or if you have additional information that might change this outcome, please contact our support team.
        
        We appreciate your understanding.
        
        Best regards,
        The Koi Sensei Team
      `
    }
  }

  static async sendApprovalEmail(userEmail: string, userName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const template = this.getApprovalEmailTemplate(userName || '')
      
      // In a real implementation, you would integrate with an email service like:
      // - SendGrid
      // - Mailgun
      // - AWS SES
      // - Resend
      // For now, we'll simulate the email sending
      
      console.log('Sending approval email to:', userEmail)
      console.log('Email template:', template)
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // In production, replace this with actual email service call:
      // const emailService = new EmailProvider()
      // await emailService.send({
      //   to: userEmail,
      //   subject: template.subject,
      //   html: template.html,
      //   text: template.text
      // })
      
      return { success: true }
    } catch (error) {
      console.error('Error sending approval email:', error)
      return { success: false, error: 'Failed to send approval email' }
    }
  }

  static async sendRejectionEmail(userEmail: string, userName?: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      const template = this.getRejectionEmailTemplate(userName || '', reason)
      
      console.log('Sending rejection email to:', userEmail)
      console.log('Email template:', template)
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // In production, replace this with actual email service call:
      // const emailService = new EmailProvider()
      // await emailService.send({
      //   to: userEmail,
      //   subject: template.subject,
      //   html: template.html,
      //   text: template.text
      // })
      
      return { success: true }
    } catch (error) {
      console.error('Error sending rejection email:', error)
      return { success: false, error: 'Failed to send rejection email' }
    }
  }

  static async sendNewUserNotificationToAdmins(userEmail: string, userName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get all admin users
      const { data: admins, error } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('role', 'admin')
        .eq('approval_status', 'approved')

      if (error) {
        throw error
      }

      if (!admins || admins.length === 0) {
        console.log('No admin users found to notify')
        return { success: true }
      }

      const template = {
        subject: 'New User Registration - Approval Required',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New User Registration</h2>
            <p>A new user has registered and requires approval:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${userName || 'Not provided'}</p>
              <p><strong>Email:</strong> ${userEmail}</p>
              <p><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            <p>Please log in to the admin panel to review and approve this user.</p>
            <p>Best regards,<br>Koi Sensei System</p>
          </div>
        `,
        text: `
          New User Registration
          
          A new user has registered and requires approval:
          
          Name: ${userName || 'Not provided'}
          Email: ${userEmail}
          Registration Date: ${new Date().toLocaleDateString()}
          
          Please log in to the admin panel to review and approve this user.
          
          Best regards,
          Koi Sensei System
        `
      }

      // Send notification to all admins
      for (const admin of admins) {
        console.log('Sending new user notification to admin:', admin.email)
        // In production, send actual email here
      }

      return { success: true }
    } catch (error) {
      console.error('Error sending admin notification:', error)
      return { success: false, error: 'Failed to send admin notification' }
    }
  }
}



