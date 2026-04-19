# Admin Goedkeuringssysteem voor Gebruikersregistratie

Dit document beschrijft de implementatie van een admin goedkeuringssysteem voor nieuwe gebruikersregistraties in de Koi Sensei applicatie.

## Overzicht

Het systeem zorgt ervoor dat:
1. Nieuwe gebruikers een "pending" status krijgen bij registratie
2. Admins nieuwe gebruikers kunnen goedkeuren of afwijzen
3. Goedgekeurde gebruikers een email notificatie ontvangen
4. Afgewezen gebruikers een email met reden ontvangen
5. Admins een notificatie krijgen bij nieuwe registraties

## Database Wijzigingen

### 1. Database Update Script Uitvoeren

Voer het volgende SQL script uit in je Supabase SQL Editor:

```sql
-- Voer het bestand add-user-approval-system.sql uit
```

Dit script voegt toe:
- `approval_status` kolom aan de `users` tabel
- `approved_at`, `approved_by`, `rejection_reason` kolommen
- `user_approvals` tabel voor audit trail
- Database functies voor goedkeuren/afwijzen
- RLS policies voor beveiliging

### 2. Database Functies

Het script voegt de volgende functies toe:
- `approve_user()` - Goedkeurt een gebruiker
- `reject_user()` - Wijst een gebruiker af
- `handle_new_user()` - Aangepast voor approval workflow

## Frontend Wijzigingen

### 1. AuthContext Updates

De `AuthContext` is aangepast om:
- Approval status te controleren bij login
- Nieuwe gebruikers op "pending" status te zetten
- Admin notificaties te versturen bij nieuwe registraties

### 2. AuthModal Updates

De registratie modal toont nu een bericht dat goedkeuring nodig is na succesvolle registratie.

### 3. Admin Panel Updates

Het admin panel is uitgebreid met:
- Approval status kolom in de gebruikers tabel
- Approve/Reject knoppen voor pending gebruikers
- Filter op approval status
- Statistieken voor pending approvals
- Email notificaties bij goedkeuring/afwijzing

## Email Notificatie Systeem

### 1. EmailService Class

Een nieuwe `EmailService` class is toegevoegd in `src/lib/email-service.ts` met:
- Approval email templates
- Rejection email templates
- Admin notification templates
- Simulatie van email verzending (voor development)

### 2. Email Templates

Het systeem ondersteunt:
- **Approval Email**: Welkom bericht voor goedgekeurde gebruikers
- **Rejection Email**: Afwijzing bericht met reden
- **Admin Notification**: Notificatie voor admins bij nieuwe registraties

## Implementatie Stappen

### Stap 1: Database Setup
1. Voer `add-user-approval-system.sql` uit in Supabase
2. Controleer of alle kolommen en functies correct zijn toegevoegd

### Stap 2: Frontend Deployment
1. Deploy de aangepaste frontend code
2. Test de registratie flow
3. Test de admin approval flow

### Stap 3: Email Service Configuratie (Productie)

Voor productie gebruik moet je een echte email service integreren:

#### Optie 1: SendGrid
```typescript
// In src/lib/email-service.ts
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

// Vervang de simulatie met echte email verzending
await sgMail.send({
  to: userEmail,
  from: 'noreply@koisensei.nl',
  subject: template.subject,
  html: template.html,
  text: template.text
})
```

#### Optie 2: Resend
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'noreply@koisensei.nl',
  to: userEmail,
  subject: template.subject,
  html: template.html,
})
```

#### Optie 3: AWS SES
```typescript
import AWS from 'aws-sdk'

const ses = new AWS.SES({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

await ses.sendEmail({
  Source: 'noreply@koisensei.nl',
  Destination: { ToAddresses: [userEmail] },
  Message: {
    Subject: { Data: template.subject },
    Body: {
      Html: { Data: template.html },
      Text: { Data: template.text }
    }
  }
}).promise()
```

## Gebruikersworkflow

### Voor Nieuwe Gebruikers:
1. Registreren via de website
2. Ontvangen bericht dat goedkeuring nodig is
3. Wachten op admin goedkeuring
4. Ontvangen email wanneer goedgekeurd
5. Kunnen inloggen en de applicatie gebruiken

### Voor Admins:
1. Ontvangen notificatie bij nieuwe registratie
2. Inloggen in admin panel
3. Bekijken pending gebruikers
4. Goedkeuren of afwijzen met reden
5. Gebruiker ontvangt automatisch email

## Beveiliging

### RLS Policies
- Alleen admins kunnen approval status wijzigen
- Gebruikers kunnen alleen hun eigen profiel bekijken
- Audit trail wordt bijgehouden voor alle acties

### Database Functies
- `approve_user()` en `reject_user()` functies zijn beveiligd
- Alleen admins kunnen deze functies aanroepen
- Alle acties worden gelogd in `user_approvals` tabel

## Monitoring en Logging

### Admin Audit Log
Alle admin acties worden gelogd in de `admin_audit_log` tabel:
- User approvals
- User rejections
- Role changes
- User deletions

### User Approvals Log
Specifieke approval acties worden gelogd in de `user_approvals` tabel:
- Wie heeft de actie uitgevoerd
- Wanneer is de actie uitgevoerd
- Reden voor de actie

## Troubleshooting

### Veelvoorkomende Problemen

1. **Gebruiker kan niet inloggen na registratie**
   - Controleer approval status in database
   - Zorg dat gebruiker is goedgekeurd

2. **Email notificaties worden niet verzonden**
   - Controleer email service configuratie
   - Controleer console voor errors
   - Test email service in development

3. **Admin kan geen gebruikers zien**
   - Controleer RLS policies
   - Zorg dat admin role correct is ingesteld

### Database Queries voor Debugging

```sql
-- Bekijk alle pending gebruikers
SELECT * FROM public.users WHERE approval_status = 'pending';

-- Bekijk approval geschiedenis
SELECT * FROM public.user_approvals ORDER BY created_at DESC;

-- Bekijk admin audit log
SELECT * FROM public.admin_audit_log ORDER BY created_at DESC;
```

## Toekomstige Verbeteringen

1. **Bulk Approval**: Meerdere gebruikers tegelijk goedkeuren
2. **Email Templates**: Aanpasbare email templates
3. **Auto-approval**: Automatische goedkeuring voor bepaalde domeinen
4. **Approval Workflow**: Multi-step approval proces
5. **Notification Settings**: Admin voorkeuren voor notificaties

## Support

Voor vragen of problemen met het approval systeem:
1. Controleer de console logs
2. Bekijk de database logs
3. Test de email service configuratie
4. Controleer RLS policies

Het systeem is ontworpen om robuust en veilig te zijn, met volledige audit trails en beveiliging op alle niveaus.



