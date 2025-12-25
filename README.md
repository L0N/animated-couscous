# WanPaus - Microfinance Payday Loan System

A comprehensive microfinance payday loan management system built for Papua New Guinea. WanPaus enables customer self-service loan applications, automated tier progression, admin oversight, and real-time financial tracking.

## 🚀 Features

### Customer Features
- **Self-Service Loan Applications** with instant calculations
- **Automated Tier Progression** (K50 → K100 → K200 → K500 → K1000)
- **Auto-Approval** for trustworthy customers
- **Payment Proof Upload** with status tracking
- **Real-Time Loan Dashboard** with repayment progress

### Admin Features
- **One-Click Loan Approval & Disbursement**
- **Payment Verification** with automatic allocation
- **Customer Management** with tier controls
- **Financial Dashboard** with real-time metrics
- **KYC Document Review**
- **Audit Trail** for all critical actions

### System Features
- **Automated Reminders** (3, 7, 10 days overdue)
- **Default Detection** (14+ days → account downgrade)
- **Interest Rate Discounts** for trustworthy customers
- **Partial Payment Support** (principal-first allocation)
- **Email Notifications** for all key events
- **Secure File Storage** via Vercel Blob

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Mongoose
- **Database**: MongoDB Atlas
- **Authentication**: NextAuth.js with JWT
- **Email**: Resend
- **File Storage**: Vercel Blob
- **Validation**: Zod
- **Automation**: Vercel Cron Jobs

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- MongoDB Atlas account
- Vercel account (for deployment)
- Resend API key (for emails)

## 🔧 Installation

### 1. Clone the repository

```bash
git clone https://github.com/L0N/animated-couscous.git
cd animated-couscous
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory:

```env
# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/wanpaus?retryWrites=true&w=majority

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Resend Email API
RESEND_API_KEY=re_your_resend_api_key_here
FROM_EMAIL=noreply@wanpaus.com.pg

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_your_token_here

# Cron Job Security
CRON_SECRET=your_strong_random_cron_secret_here

# System Configuration
SYSTEM_ADMIN_EMAIL=admin@wanpaus.com.pg
SYSTEM_ADMIN_PASSWORD=ChangeThisStrongPassword123!
INITIAL_CASH_BALANCE=10000
```

### 4. Generate NextAuth Secret

```bash
openssl rand -base64 32
```

### 5. Seed the database

```bash
npm run seed
```

This will:
- Create the SystemSettings document with initial cash balance
- Create the admin user account

### 6. Start the development server

```bash
npm run dev
```

Visit http://localhost:3000

## 📊 Business Logic

### Tier System

| Tier | Limit | Progression Rule |
|------|-------|------------------|
| Bronze | K50 | Starting tier |
| Silver | K100 | 2 on-time payments |
| Gold | K200 | 2 on-time payments |
| Platinum | K500 | 2 on-time payments |
| Diamond | K1000 | 2 on-time payments + trustworthy |

### Interest Rates

| Term | Base Rate | Trustworthy Discount |
|------|-----------|---------------------|
| 14 days | 30% | 5% discount → 25% |
| 30 days | 60% | 10% discount → 50% |
| 60 days | 75% | 10% discount → 65% |
| 90 days | 100% | 15% discount → 85% |

**Discount Formula**: `floor((baseRate * 100 / 6) / 5) * 5` percentage points

### Auto-Approval Rules

Loans are auto-approved when ALL conditions are met:
1. Amount ≤ user's current limit
2. User has trustworthy status
3. System has sufficient cash on hand
4. User has no overdue or active loans

### Payment Allocation

Partial payments are allocated as follows:
1. **Principal first** - Pay down loan amount
2. **Interest second** - Pay accrued interest

### Default Handling

- **Days 1-13**: Send reminders at days 3, 7, 10
- **Day 14+**: Mark as defaulted
  - Reset tier to K50
  - Remove trustworthy status
  - Requires rebuilding credit history

## 🔐 Default Admin Credentials

After seeding, login with:
- **Email**: admin@wanpaus.com.pg
- **Password**: ChangeThisStrongPassword123!

⚠️ **Change these credentials immediately in production!**

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/          # Authentication endpoints
│   │   ├── customer/      # Customer API routes
│   │   ├── admin/         # Admin API routes
│   │   └── cron/          # Automated jobs
│   ├── customer/          # Customer portal pages
│   ├── admin/             # Admin dashboard pages
│   └── page.tsx           # Landing/login page
├── components/
│   └── ui/                # Reusable UI components
├── lib/
│   ├── mongodb.ts         # Database connection
│   ├── auth.ts            # NextAuth configuration
│   ├── email.ts           # Email service
│   ├── blob.ts            # File upload
│   └── validation.ts      # Input validation
├── models/                # Mongoose models
│   ├── User.ts
│   ├── Loan.ts
│   ├── Payment.ts
│   ├── SystemSettings.ts
│   └── AuditLog.ts
├── services/              # Business logic
│   ├── tierService.ts
│   ├── loanService.ts
│   ├── paymentService.ts
│   ├── autoApprovalService.ts
│   └── financeService.ts
├── middleware/
│   └── auth.ts            # Auth middleware
├── types/                 # TypeScript types
├── scripts/
│   └── seedSystem.ts      # Database seeding
└── vercel.json            # Cron configuration
```

## 🚀 Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy
5. Run seed script via Vercel CLI:
   ```bash
   vercel env pull .env.local
   npm run seed
   ```

### Cron Jobs

Cron jobs are automatically configured in `vercel.json`:
- **Reminders**: Daily at 6 PM (18:00)
- **Default Check**: Daily at 1 AM (01:00)

Cron endpoints are secured with `CRON_SECRET` header.

## 📧 Email Configuration

### Resend Setup

1. Sign up at [resend.com](https://resend.com)
2. Get API key
3. Verify sending domain
4. Add API key to environment variables

### Email Templates

The system sends emails for:
- Loan approved
- Loan disbursed
- Loan rejected
- Payment received
- Overdue reminders
- Tier upgrades
- Default notices
- Admin notifications

## 📝 API Documentation

### Authentication

#### POST `/api/auth/register`
Register new customer account

**Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+675 7000 0001",
  "password": "SecurePass123"
}
```

#### POST `/api/auth/login`
Login (via NextAuth credentials provider)

### Customer APIs

#### POST `/api/customer/loans/apply`
Apply for a new loan

**Body**:
```json
{
  "amount": 100,
  "termDays": 30
}
```

**Response**:
```json
{
  "success": true,
  "reference": "WP-202412-00001",
  "isAutoApproved": true,
  "totalRepayable": 160,
  "dueDate": "2025-01-25T00:00:00.000Z"
}
```

#### GET `/api/customer/loans?status=disbursed`
Get customer's loans

#### POST `/api/customer/payments/upload`
Upload payment proof (multipart/form-data)

**FormData**:
- `loanId`: Loan ID
- `amount`: Payment amount
- `file`: Payment proof image/PDF

### Admin APIs

#### POST `/api/admin/loans/:id/approve`
Approve a loan application

#### POST `/api/admin/loans/:id/disburse`
Disburse approved loan funds

#### POST `/api/admin/payments/:id/verify`
Verify payment proof

**Body**:
```json
{
  "approved": true,
  "rejectionReason": "Optional if rejected"
}
```

#### PUT `/api/admin/customers/:id/trustworthy`
Set customer trustworthy status

**Body**:
```json
{
  "isTrustworthy": true
}
```

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Test Scenarios

1. **Tier Progression**: Apply for 2 loans, repay on time, verify tier upgrade
2. **Auto-Approval**: Set user as trustworthy, apply within limit, verify instant approval
3. **Discount Calculation**: Verify trustworthy customers get correct discount
4. **Partial Payments**: Make partial payment, verify principal-first allocation
5. **Default Handling**: Wait 14+ days, verify downgrade to K50

## 🔒 Security

- **Authentication**: JWT-based sessions with httpOnly cookies
- **Authorization**: Role-based access control (customer/admin)
- **Input Validation**: Zod schema validation on all inputs
- **Password Hashing**: bcrypt with 12 salt rounds
- **File Upload**: Type and size validation
- **API Protection**: Authentication middleware on all protected routes
- **Cron Security**: Secret token verification

## 📈 Success Metrics

The system is considered successful when:
- ✅ Customers can apply for loans within their tier limits
- ✅ Admin can approve/disburse/verify within 3 clicks
- ✅ Auto-approval triggers correctly for eligible customers
- ✅ Tier upgrades after 2 consecutive on-time payments
- ✅ Defaults trigger account downgrade at 14+ days
- ✅ Partial payments allocate to principal first
- ✅ Financial metrics update in real-time
- ✅ Daily reminders send automatically
- ✅ All KYC documents uploadable and viewable

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Verify MONGODB_URI is correct
- Check IP whitelist in MongoDB Atlas
- Ensure database user has read/write permissions

### Email Not Sending
- Verify RESEND_API_KEY is valid
- Check sending domain is verified
- Review Resend dashboard for errors

### Cron Jobs Not Running
- Verify vercel.json is deployed
- Check CRON_SECRET is set correctly
- Review Vercel deployment logs

## 📞 Support

For issues or questions:
- Email: support@wanpaus.com.pg
- System admin: admin@wanpaus.com.pg

## 📄 License

This project is proprietary software for WanPaus operations.

## 🙏 Acknowledgments

Built for microfinance operations in Papua New Guinea to provide accessible short-term loans with automated tier progression and transparent interest calculations.

---

**Version**: 1.0.0  
**Last Updated**: December 2024

