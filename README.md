# WanPaus v2.0.0 - Advanced Microfinance Platform

A sophisticated microfinance payday loan management system built for Papua New Guinea. WanPaus v2.0.0 features daily-accruing interest calculations, dual trustworthy paths, comprehensive portfolio management, and regulatory-compliant audit trails.

## 🚀 What's New in v2.0.0

### 💰 **Daily Interest System**
- **Configurable annual rates** with 2-decimal precision (e.g., 4.25%)
- **Daily accrual calculation**: `interest = principal × (annualRate/365) × days`
- **Interest-first payment allocation** for optimal customer outcomes
- **Interest caps** preventing predatory lending
- **PNG timezone-aware calculations** for consistent daily boundaries

### 👥 **Enhanced Credit System**
- **Dual trustworthy paths**:
  - **Tier-based**: 2 consecutive on-time payments at current tier
  - **Experience-based**: 10 total consecutive payments across all loans
- **Credit rebuilding** with REBUILDING status after default
- **Diamond tier protection** requiring trustworthy status for K1000 limit

### 📊 **Portfolio Management**
- **Historical analysis** with configurable date ranges (30 days to 2 years)
- **Forward projection simulations** with default rate assumptions
- **Stress testing** with predefined scenarios (5%, 10%, 15%, 20% + custom)
- **Break-even analysis** for profitability assessment
- **Real-time portfolio health monitoring**

### 🤖 **Automation & Compliance**
- **Daily interest calculation** cron job at midnight PNG time
- **Automatic migration** from v1.0.0 to v2.0.0
- **Complete audit trail** for regulatory compliance
- **Rate limiting** for simulation endpoints
- **Retry logic** with admin notifications

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Mongoose
- **Database**: MongoDB Atlas with enhanced indexes
- **Authentication**: NextAuth.js with JWT
- **Email**: Resend with enhanced templates
- **File Storage**: Vercel Blob
- **Validation**: Zod with comprehensive schemas
- **Automation**: Vercel Cron Jobs with retry logic
- **Rate Limiting**: Custom implementation with admin bypass

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

# v2.0.0 Interest System
ANNUAL_INTEREST_RATE=4.00
PNG_TIMEZONE=Pacific/Port_Moresby
MIN_INTEREST_DAYS=14
INTEREST_CAP_ENABLED=true

# Loan Terms
MAX_LOAN_TERM_STANDARD=90
MAX_LOAN_TERM_WITH_PARTIAL=100

# Credit System
TRUSTWORTHY_CONSECUTIVE_REQUIRED=2
TRUSTWORTHY_TOTAL_ALTERNATIVE=10

# Simulation System
SIMULATION_MIN_DAYS=30
SIMULATION_MAX_DAYS=730
SIMULATION_DEFAULT_DAYS=180

# Rate Limiting
RATE_LIMIT_HISTORICAL=10
RATE_LIMIT_STRESS_TEST=5
RATE_LIMIT_SIMULATION=8

# Cron Jobs
CRON_SECRET=your_strong_random_cron_secret_here
CRON_MAX_RETRIES=3
CRON_BATCH_SIZE=50

# System Configuration
SYSTEM_ADMIN_EMAIL=admin@wanpaus.com.pg
SYSTEM_ADMIN_PASSWORD=ChangeThisStrongPassword123!
INITIAL_CASH_BALANCE=10000

# Migration Settings
AUTO_MIGRATE_ON_DEPLOY=true
PRESERVE_V1_CONTRACTS=true
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
- Run automatic migration if needed

### 6. Start the development server

```bash
npm run dev
```

Visit http://localhost:3000

## 📊 Business Logic v2.0.0

### Enhanced Tier System

| Tier | Limit | Progression Rule | Trustworthy Requirement |
|------|-------|------------------|-------------------------|
| Bronze | K50 | Starting tier | No |
| Silver | K100 | 2 consecutive on-time payments | No |
| Gold | K200 | 2 consecutive on-time payments | No |
| Platinum | K500 | 2 consecutive on-time payments | No |
| Diamond | K1000 | 2 consecutive on-time payments | **Yes** |

### Daily Interest Calculation

**Formula**: `interest = principal × (annualRate/365) × daysElapsed`

**Example** (K100 loan, 4% annual, 90 days):
- Daily rate: 4.00 / 365 = 0.01096%
- Interest after 90 days: K100 × 0.0001096 × 90 = **K0.99**
- Total due: **K100.99**

### Dual Trustworthy Paths

#### Path 1: Tier-Based (Fast Track)
- **Requirement**: 2 consecutive on-time payments at current tier
- **Benefit**: Unlocks Diamond tier access
- **Reset**: On any late payment

#### Path 2: Experience-Based (Alternative)
- **Requirement**: 10 total consecutive on-time payments across all loans
- **Benefit**: Unlocks Diamond tier access
- **Advantage**: Survives tier resets from defaults

### Enhanced Auto-Approval Rules

Loans are auto-approved when ALL conditions are met:
1. Amount ≤ user's current limit
2. User has trustworthy status (if required)
3. System has sufficient cash (with reserve)
4. User has no overdue or active loans
5. User account is ACTIVE (not REBUILDING)
6. KYC verification is complete
7. No recent defaults (90-day lookback)

### Interest-First Payment Allocation

**v2.0.0 Allocation** (Optimal for customers):
1. **Accrued interest first** - Pay accumulated interest
2. **Principal second** - Reduce outstanding balance
3. **Future interest recalculates** on new principal amount

**Example**: K30 payment on K100 loan with K0.16 accrued interest
- K0.16 → interest
- K29.84 → principal
- New outstanding: K70.16 (future interest calculated on this amount)

### Credit Rebuilding System

After default (14+ days overdue):
- **Status**: REBUILDING
- **Tier**: Reset to Bronze (K50)
- **Trustworthy**: Revoked
- **Recovery**: Normal tier progression through on-time payments
- **Restoration**: Status changes to ACTIVE after 2 consecutive payments

## 🔐 Default Admin Credentials

After seeding, login with:
- **Email**: admin@wanpaus.com.pg
- **Password**: ChangeThisStrongPassword123!

⚠️ **Change these credentials immediately in production!**

## 📁 Enhanced Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/                    # Authentication endpoints
│   │   ├── customer/                # Customer API routes
│   │   ├── admin/
│   │   │   ├── simulation/          # Portfolio analysis endpoints
│   │   │   │   ├── historical/      # Historical analysis
│   │   │   │   ├── stress-test/     # Stress testing
│   │   │   │   ├── forward/         # Forward projections
│   │   │   │   └── breakeven/       # Break-even analysis
│   │   │   └── migration/           # Migration management
│   │   └── cron/
│   │       └── calculate-interest/  # Daily interest calculation
│   ├── customer/                    # Customer portal pages
│   ├── admin/                       # Admin dashboard pages
│   └── page.tsx                     # Landing/login page
├── components/
│   └── ui/                          # Reusable UI components
├── lib/
│   ├── mongodb.ts                   # Database connection
│   ├── auth.ts                      # NextAuth configuration
│   ├── email.ts                     # Email service
│   ├── blob.ts                      # File upload
│   ├── timezone.ts                  # PNG timezone utilities
│   ├── rateLimiting.ts              # Rate limiting implementation
│   └── validation.ts                # Input validation
├── models/                          # Mongoose models
│   ├── User.ts                      # Enhanced with v2.0.0 fields
│   ├── Loan.ts                      # Enhanced with v2.0.0 fields
│   ├── Payment.ts                   # Enhanced with v2.0.0 fields
│   ├── InterestCalculation.ts       # New audit trail model
│   ├── SystemSettings.ts
│   └── AuditLog.ts
├── services/                        # Business logic
│   ├── tierService.ts               # Enhanced dual paths
│   ├── loanService.ts               # Enhanced daily interest
│   ├── paymentService.ts            # Enhanced allocation
│   ├── autoApprovalService.ts       # Enhanced v2.0.0 logic
│   ├── interestService.ts           # New daily calculation engine
│   ├── simulationService.ts         # New portfolio analysis
│   ├── migrationService.ts          # New v1→v2 migration
│   └── financeService.ts
├── middleware/
│   └── auth.ts                      # Auth middleware
├── types/                           # TypeScript types
│   ├── models.ts                    # Enhanced with v2.0.0 types
│   ├── services.ts
│   └── api.ts
├── scripts/
│   └── seedSystem.ts                # Database seeding
├── tests/                           # Comprehensive test suite
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   └── fixtures/                    # Test data
├── CHANGELOG.md                     # Version history
├── TECHNICAL_DOCS.md                # Technical documentation
└── vercel.json                      # Enhanced cron configuration
```

## 🚀 Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add all environment variables (25+ for v2.0.0)
4. Deploy
5. Migration runs automatically on first deployment
6. Verify migration status:
   ```bash
   curl -X GET "https://your-app.vercel.app/api/admin/migration/status" \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

### Enhanced Cron Jobs

Cron jobs are automatically configured in `vercel.json`:
- **Reminders**: Daily at 6 PM PNG time (18:00 UTC+10)
- **Default Check**: Daily at 1 AM PNG time (01:00 UTC+10)
- **Interest Calculation**: Daily at midnight PNG time (00:00 UTC+10)

All cron endpoints are secured with `CRON_SECRET` header.

## 📧 Enhanced Email Configuration

### Email Templates v2.0.0

The system sends emails for:
- Loan approved/rejected/disbursed
- Payment received with allocation breakdown
- Overdue reminders with accrued interest
- Tier upgrades with trustworthy path info
- Default notices with rebuilding guidance
- Interest calculation summaries
- Admin notifications for system events

## 📝 API Documentation v2.0.0

### New Simulation APIs

#### GET `/api/admin/simulation/historical`
Historical portfolio analysis

**Query Parameters**:
- `startDate`: ISO date (optional, defaults to 6 months ago)
- `endDate`: ISO date (optional, defaults to now)
- `includeBreakdown`: boolean (default: true)
- `includeTrends`: boolean (default: true)

**Response**:
```json
{
  "success": true,
  "data": {
    "dateRange": {
      "startDate": "2024-06-29T00:00:00.000Z",
      "endDate": "2024-12-29T00:00:00.000Z",
      "totalDays": 183
    },
    "portfolio": {
      "totalLoans": 150,
      "v1Loans": 45,
      "v2Loans": 105,
      "totalDisbursed": 75000,
      "totalRepaid": 68500,
      "totalInterestEarned": 3200,
      "averageLoanSize": 500
    },
    "performance": {
      "defaultRate": 0.08,
      "onTimeRate": 0.87,
      "averageRepaymentDays": 28,
      "profitMargin": 4.27,
      "roi": 12.5
    }
  }
}
```

#### POST `/api/admin/simulation/stress-test`
Portfolio stress testing

**Body**:
```json
{
  "scenario": "MODERATE",
  "includeRecovery": true,
  "includeRecommendations": true
}
```

**Custom Scenario**:
```json
{
  "scenario": "custom",
  "customDefaultRate": 0.12,
  "includeRecovery": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "scenario": {
      "name": "Moderate Stress",
      "defaultRate": 0.10,
      "description": "10% default rate"
    },
    "impact": {
      "affectedLoans": 15,
      "additionalDefaults": 8,
      "lossAmount": 4000,
      "profitReduction": 5.3,
      "newProfitMargin": -1.03
    },
    "portfolioHealth": {
      "healthScore": 65,
      "riskLevel": "medium",
      "recommendations": [
        "Implement stricter credit scoring",
        "Increase interest rates to compensate for higher risk"
      ]
    },
    "recovery": {
      "timeToRecover": 120,
      "requiredActions": [
        "Implement immediate cost reduction measures"
      ]
    }
  }
}
```

### Enhanced Customer APIs

#### POST `/api/customer/loans/apply`
Apply for a new loan (v2.0.0 enhanced)

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
  "loanVersion": "V2",
  "calculation": {
    "principal": 100,
    "annualInterestRate": 4.00,
    "dailyInterestRate": 0.01096,
    "estimatedInterest": 0.33,
    "interestCap": 4.00,
    "totalRepayable": 100.33,
    "dueDate": "2025-01-29T00:00:00.000Z"
  },
  "autoApprovalReasons": [
    "Amount K100 within K200 limit",
    "Trustworthy status verified",
    "Sufficient funds available"
  ]
}
```

#### GET `/api/customer/loans`
Get customer's loans with real-time interest

**Response**:
```json
{
  "success": true,
  "loans": [
    {
      "id": "...",
      "reference": "WP-202412-00001",
      "amount": 100,
      "status": "ACTIVE",
      "loanVersion": "V2",
      "realTimeBalance": {
        "outstandingPrincipal": 100,
        "accruedInterest": 0.22,
        "totalDue": 100.22,
        "daysElapsed": 20,
        "daysUntilDue": 10
      }
    }
  ]
}
```

## 🧪 Testing v2.0.0

### Comprehensive Test Suite

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Key Test Scenarios

1. **Interest Calculation Accuracy**
   - Daily rate calculations
   - Interest cap enforcement
   - Minimum interest charges
   - Interest freeze at default

2. **Payment Allocation Logic**
   - Interest-first allocation
   - Principal reduction
   - Balance recalculation
   - Partial payment handling

3. **Tier Progression**
   - Dual trustworthy path validation
   - Credit rebuilding scenarios
   - Diamond tier protection

4. **Migration Integrity**
   - v1.0.0 to v2.0.0 data migration
   - Backward compatibility
   - Calculation consistency

5. **Portfolio Simulation**
   - Historical analysis accuracy
   - Stress scenario execution
   - Break-even calculations

## 🔒 Enhanced Security v2.0.0

- **Rate Limiting**: Simulation endpoints protected against abuse
- **Admin Bypass**: Administrators exempt from rate limits
- **Audit Trail**: Complete calculation history for compliance
- **Deterministic Calculations**: Same inputs always produce same outputs
- **Interest Caps**: Protection against predatory lending
- **Timezone Consistency**: Prevents date boundary manipulation
- **Migration Validation**: Ensures data integrity during upgrades

## 📈 Success Metrics v2.0.0

The system is considered successful when:
- ✅ Daily interest calculations execute automatically at midnight PNG time
- ✅ Interest-first payment allocation optimizes customer outcomes
- ✅ Dual trustworthy paths provide flexible credit building
- ✅ Portfolio simulation provides accurate risk assessment
- ✅ Migration preserves all existing loan contracts
- ✅ Audit trail enables regulatory compliance verification
- ✅ Rate limiting prevents simulation endpoint abuse
- ✅ Credit rebuilding allows customer recovery after default

## 🐛 Troubleshooting v2.0.0

### Migration Issues
- Check migration status: `GET /api/admin/migration/status`
- Validate data integrity: `POST /api/admin/migration/validate`
- Emergency rollback: `POST /api/admin/migration/rollback`

### Interest Calculation Issues
- Verify cron job execution: `GET /api/cron/calculate-interest?secret=$CRON_SECRET`
- Check PNG timezone configuration: `PNG_TIMEZONE=Pacific/Port_Moresby`
- Review calculation audit trail in InterestCalculation collection

### Rate Limiting Issues
- Check rate limit headers in API responses
- Verify admin bypass for administrative users
- Adjust limits via environment variables

### Simulation Performance
- Monitor database query performance for large portfolios
- Use date range limits to prevent excessive computation
- Check rate limiting for concurrent simulation requests

## 📞 Support

For issues or questions:
- **Technical Support**: Create GitHub issues
- **Migration Help**: Contact system administrator
- **Business Logic**: Review TECHNICAL_DOCS.md
- **API Documentation**: See enhanced API examples above

## 📄 License

This project is proprietary software for WanPaus operations.

## 🙏 Acknowledgments

WanPaus v2.0.0 represents a major evolution in microfinance technology, providing sophisticated daily interest calculations, comprehensive portfolio management, and regulatory-compliant audit trails while maintaining complete backward compatibility with existing loan contracts.

Built for microfinance operations in Papua New Guinea to provide accessible short-term loans with transparent, fair, and mathematically precise interest calculations.

---

**Version**: 2.0.0  
**Last Updated**: December 2024  
**Migration**: Automatic from v1.0.0  
**Compatibility**: Backward compatible with existing loans

