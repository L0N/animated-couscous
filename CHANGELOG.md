# Changelog

All notable changes to WanPaus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-12-29

### 🚀 Added

#### Daily Interest System
- **Daily interest accrual** with configurable annual rates (2 decimal precision)
- **Interest-first payment allocation** (accrued interest → then principal)
- **Interest caps** to prevent predatory lending (max = annual rate × principal)
- **Minimum interest charges** ensuring full loan term profitability
- **Interest freeze** at 14+ days overdue (DEFAULTED status)
- **PNG timezone-aware calculations** for consistent daily boundaries

#### Enhanced Credit System
- **Dual trustworthy paths**:
  - Path 1 (Tier-Based): 2 consecutive on-time payments at current tier
  - Path 2 (Experience-Based): 10 total consecutive on-time payments across all loans
- **Credit rebuilding** with REBUILDING user status after default
- **Enhanced tier progression**: Bronze (K50) → Silver (K100) → Gold (K200) → Platinum (K500) → Diamond (K1000)
- **Diamond tier requirement**: Trustworthy status mandatory for K1000 limit

#### Portfolio Management
- **Historical analysis** with configurable date ranges (30 days to 2 years, 6 months default)
- **Forward projection simulations** with default rate assumptions
- **Break-even analysis** for profitability assessment
- **Stress testing** with predefined scenarios (5%, 10%, 15%, 20% default rates) and custom rates
- **Portfolio health scoring** and risk level assessment

#### Automation & Monitoring
- **Daily interest calculation cron job** at midnight PNG time (UTC+10)
- **Automatic migration** from v1.0.0 to v2.0.0 on deployment
- **Complete audit trail system** for regulatory compliance
- **Rate limiting** for simulation endpoints (10/min historical, 5/min stress testing)
- **Retry logic** with admin notifications for failed operations

#### API Enhancements
- **Simulation endpoints** for admin dashboard
- **Enhanced auto-approval** with v2.0.0 compatibility
- **Version-aware processing** supporting both v1.0.0 and v2.0.0 loans
- **Real-time interest calculations** for customer and admin interfaces

### 💔 Breaking Changes

#### Interest Calculation
- **Changed from fixed rates to daily accrual**: New loans use `interest = principal × (annualRate/365) × days`
- **Payment allocation reversed**: Interest paid first, then principal (was principal-first)
- **Loan versioning introduced**: V1/V2 designation for backward compatibility

#### User Status System
- **Enhanced user status tracking**: ACTIVE, REBUILDING, NEW status enum
- **Trustworthy path tracking**: Tier-based vs experience-based achievement
- **Consecutive payment counters**: Separate tracking for tier progression and trustworthy status

#### Database Schema
- **Loan model**: +8 fields (loanVersion, outstandingPrincipal, accruedInterest, lastInterestCalcDate, totalInterestCharged, annualInterestRate, hasPartialPayments, extendedDueDate, interestFrozenAt)
- **User model**: +5 fields (status, consecutiveOnTimePayments, totalConsecutiveOnTimePayments, trustworthyPath, lastTierUpgrade)
- **Payment model**: +7 fields (interestPortion, principalPortion, interestCalculatedToDate, outstandingPrincipalBefore, outstandingPrincipalAfter, accruedInterestBefore, accruedInterestAfter)

#### API Contract Changes
- **Loan application responses** include real-time interest calculations
- **Payment processing** returns detailed allocation breakdown
- **Auto-approval logic** enhanced with v2.0.0 compatibility checks

### 🔧 Changed

#### Tier Progression
- **Dual trustworthy paths** replace single tier-based progression
- **Credit rebuilding** allows normal tier advancement after default
- **Diamond tier protection** requires trustworthy status

#### Auto-Approval Logic
- **Enhanced eligibility checks** for v2.0.0 loans
- **Outstanding balance verification** with real-time interest calculation
- **Cash reserve requirements** with configurable reserve ratios
- **Recent default history** consideration (90-day lookback)

#### Email Notifications
- **Updated templates** for new loan statuses (ACTIVE, LATE, DEFAULTED)
- **Tier upgrade notifications** include trustworthy path information
- **Interest calculation summaries** in payment confirmations

### 📊 Database Schema Changes

#### New Models
- **InterestCalculation**: Complete audit trail with 17 fields
  - Tracks every calculation with timestamps, triggers, and mathematical validation
  - Enables regulatory review and deterministic verification
  - Supports calculation integrity checks and rollback capabilities

#### Enhanced Indexes
- **Version-aware queries**: Optimized for dual v1.0.0/v2.0.0 processing
- **Interest calculation lookups**: Efficient daily calculation retrieval
- **Payment history tracking**: Enhanced allocation and balance queries

### 🔄 Migration

#### Automatic Migration
- **Preserves existing loan contracts**: v1.0.0 loans maintain original terms
- **Backward compatibility**: Existing loans continue with fixed interest rates
- **Seamless transition**: New loans automatically use v2.0.0 daily accrual
- **Data integrity**: Complete validation and rollback capabilities

#### Migration Process
1. **User records**: Add v2.0.0 status and payment tracking fields
2. **Loan records**: Add version designation and interest calculation fields
3. **Payment records**: Add allocation breakdown and balance snapshots
4. **Audit trail**: Create initial calculation records for v2.0.0 loans
5. **Validation**: Verify mathematical consistency and data integrity

### 🛡️ Security

#### Rate Limiting
- **Simulation endpoints**: Protected against computational abuse
- **Admin bypass**: Administrators exempt from rate limits
- **Graceful degradation**: Informative error responses with retry timing

#### Audit Trail
- **Complete calculation history**: Every interest calculation recorded
- **Deterministic verification**: Same inputs always produce same outputs
- **Regulatory compliance**: Transparent mathematical operations
- **Tamper detection**: Validation checks prevent calculation manipulation

#### Error Handling
- **Retry logic**: Automatic retry with exponential backoff
- **Admin notifications**: Immediate alerts for critical failures
- **Comprehensive logging**: Detailed error tracking for debugging
- **Graceful fallbacks**: System continues operating during partial failures

### 🎯 Business Impact

#### Regulatory Compliance
- **Complete audit trail** for regulatory review and verification
- **Deterministic calculations** enabling mathematical proof of accuracy
- **Interest cap protection** preventing predatory lending practices
- **Transparent financial mathematics** with detailed calculation breakdowns

#### Operational Efficiency
- **Real-time interest calculations** eliminating manual calculation errors
- **Automated payment allocation** reducing administrative overhead
- **Partial payment support** improving customer flexibility
- **Credit rebuilding pathways** enabling customer recovery

#### Portfolio Management
- **Historical analysis capabilities** for performance review
- **Forward projection tools** for business planning
- **Risk assessment features** for portfolio health monitoring
- **Stress testing capabilities** for scenario planning

### 📈 Performance Optimizations

#### Database Queries
- **Optimized indexes** for version-aware operations
- **Batch processing** for daily interest calculations
- **Efficient aggregations** for portfolio analysis
- **Connection pooling** for high-concurrency operations

#### Calculation Engine
- **Deterministic algorithms** ensuring consistent results
- **Mathematical precision** with proper rounding and tolerance
- **Timezone consistency** preventing date boundary issues
- **Interest cap enforcement** with real-time validation

### 🔧 Configuration

#### Environment Variables (25+ new variables)
```env
# Interest System
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

# Cron Jobs
CRON_SECRET=your_secure_secret
CRON_MAX_RETRIES=3
CRON_BATCH_SIZE=50
```

#### Cron Jobs
- **Daily interest calculation**: Midnight PNG time (UTC+10)
- **Retry mechanism**: Up to 3 attempts with admin notification
- **Batch processing**: Configurable batch sizes for large portfolios
- **Health monitoring**: Status endpoints for operational visibility

### 🧪 Testing

#### Unit Tests
- **Interest calculation accuracy**: 90%+ test coverage
- **Payment allocation logic**: Comprehensive edge case testing
- **Tier progression rules**: Dual path validation
- **Migration integrity**: Data consistency verification

#### Integration Tests
- **End-to-end loan processing**: Complete v2.0.0 lifecycle testing
- **Dual-version compatibility**: Mixed portfolio processing
- **API endpoint validation**: Rate limiting and error handling
- **Cron job execution**: Daily calculation workflow testing

#### Test Fixtures
- **Realistic loan portfolios**: Representative data across all tiers
- **Edge case scenarios**: Boundary conditions and error states
- **Calculation verification**: Mathematical accuracy validation
- **Performance benchmarks**: Load testing for large portfolios

---

## [1.0.0] - 2024-12-25

### 🚀 Added
- **Initial WanPaus microfinance system** with core loan processing
- **Fixed interest rate calculations** based on loan terms
- **Basic tier system**: Bronze (K50) → Silver (K100) → Gold (K200) → Platinum (K500) → Diamond (K1000)
- **Simple trustworthy status logic** based on consecutive on-time payments
- **Admin loan approval and disbursement** workflow
- **Customer loan application and payment upload** interface
- **Email notifications** for loan events and status changes
- **Basic financial tracking** and reporting capabilities
- **Auto-approval system** with 4-condition validation
- **KYC document upload** and verification system
- **Payment verification** and allocation tracking
- **System settings** for cash management and configuration

### 🔧 Technical Foundation
- **Next.js 14** with App Router architecture
- **TypeScript** for type safety and development efficiency
- **MongoDB Atlas** with Mongoose ODM
- **NextAuth.js** for authentication and session management
- **Tailwind CSS** for responsive UI design
- **Resend** for email notifications
- **Vercel Blob** for file storage
- **Zod** for input validation and schema enforcement

### 📊 Core Models
- **User model**: Basic profile, tier limits, and KYC information
- **Loan model**: Fixed interest calculations and status tracking
- **Payment model**: Simple allocation and verification workflow
- **System Settings**: Cash management and operational configuration
- **Audit Log**: Basic activity tracking and compliance

### 🎯 Business Logic
- **Tier progression**: 2 consecutive on-time payments for upgrade
- **Interest calculation**: Fixed rates by term (30%, 60%, 75%, 100%)
- **Trustworthy discounts**: Percentage-based rate reductions
- **Auto-approval**: 4-condition validation system
- **Default handling**: Tier reset and trustworthy status revocation

---

## Migration Guide

### Upgrading from v1.0.0 to v2.0.0

#### Automatic Migration
The system automatically migrates existing data on deployment:

1. **Backup your database** before upgrading
2. **Deploy v2.0.0** - migration runs automatically
3. **Verify migration** using the validation endpoints
4. **Monitor daily calculations** for the first week

#### Manual Verification Steps
```bash
# Check migration status
curl -X GET "/api/admin/migration/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Validate calculation integrity
curl -X POST "/api/admin/migration/validate" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Monitor cron job health
curl -X GET "/api/cron/calculate-interest?secret=$CRON_SECRET"
```

#### Environment Variables
Add the following to your environment configuration:
```env
# Required for v2.0.0
ANNUAL_INTEREST_RATE=4.00
PNG_TIMEZONE=Pacific/Port_Moresby
CRON_SECRET=your_secure_secret

# Optional (with defaults)
MIN_INTEREST_DAYS=14
INTEREST_CAP_ENABLED=true
TRUSTWORTHY_CONSECUTIVE_REQUIRED=2
TRUSTWORTHY_TOTAL_ALTERNATIVE=10
```

#### Breaking Changes Checklist
- [ ] **Interest calculations**: Verify new daily accrual logic
- [ ] **Payment allocation**: Confirm interest-first processing
- [ ] **User status**: Check ACTIVE/REBUILDING/NEW status handling
- [ ] **API responses**: Update frontend for new response formats
- [ ] **Cron jobs**: Configure midnight PNG time execution
- [ ] **Rate limiting**: Implement frontend retry logic

#### Rollback Procedure
If issues arise, rollback is possible:
```bash
# Emergency rollback (removes v2.0.0 fields)
curl -X POST "/api/admin/migration/rollback" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**⚠️ Warning**: Rollback will lose v2.0.0 calculation history and audit trails.

---

## Support

For technical support or questions about this release:
- **Documentation**: See README.md and TECHNICAL_DOCS.md
- **Issues**: Create GitHub issues for bug reports
- **Migration Help**: Contact system administrator

---

**WanPaus v2.0.0** represents a major evolution in microfinance technology, providing sophisticated daily interest calculations, comprehensive portfolio management, and regulatory-compliant audit trails while maintaining complete backward compatibility with existing loan contracts.

