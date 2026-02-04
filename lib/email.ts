import { Resend } from 'resend';
import { LoanEmailData, ReminderEmailData } from '@/types/services';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@wanpaus.com.pg';

/**
 * Generic email sending function
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<void> {
  try {
    await resend.emails.send({
      from: options.from || `WanPaus <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Send loan approved notification
 */
export async function sendLoanApproved(data: LoanEmailData): Promise<void> {
  try {
    await resend.emails.send({
      from: `WanPaus <${FROM_EMAIL}>`,
      to: data.customerName, // Should be email address
      subject: `Loan ${data.reference} Approved!`,
      html: `
        <h2>Great News!</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your loan application <strong>${data.reference}</strong> has been approved!</p>
        <p><strong>Loan Details:</strong></p>
        <ul>
          <li>Amount: K${data.amount}</li>
          <li>Term: ${data.termDays} days</li>
          <li>Total Repayable: K${data.totalRepayable}</li>
          <li>Due Date: ${data.dueDate}</li>
        </ul>
        <p>Funds will be transferred to your account within 24 hours.</p>
        <p>Best regards,<br/>WanPaus Team</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send loan approved email:', error);
  }
}

/**
 * Send loan disbursed notification
 */
export async function sendLoanDisbursed(email: string, reference: string, amount: number): Promise<void> {
  try {
    await resend.emails.send({
      from: `WanPaus <${FROM_EMAIL}>`,
      to: email,
      subject: `Loan ${reference} Disbursed`,
      html: `
        <h2>Funds Transferred!</h2>
        <p>Your loan <strong>${reference}</strong> of K${amount} has been disbursed to your account.</p>
        <p>Please ensure timely repayment to maintain your credit tier.</p>
        <p>Best regards,<br/>WanPaus Team</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send loan disbursed email:', error);
  }
}

/**
 * Send loan rejected notification
 */
export async function sendLoanRejected(email: string, reference: string, reason: string): Promise<void> {
  try {
    await resend.emails.send({
      from: `WanPaus <${FROM_EMAIL}>`,
      to: email,
      subject: `Loan ${reference} Update`,
      html: `
        <h2>Loan Application Update</h2>
        <p>Unfortunately, your loan application <strong>${reference}</strong> could not be approved at this time.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Please contact us if you have any questions.</p>
        <p>Best regards,<br/>WanPaus Team</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send loan rejected email:', error);
  }
}

/**
 * Send payment received notification
 */
export async function sendPaymentReceived(
  email: string,
  reference: string,
  amount: number,
  remainingBalance: number
): Promise<void> {
  try {
    await resend.emails.send({
      from: `WanPaus <${FROM_EMAIL}>`,
      to: email,
      subject: `Payment Received - ${reference}`,
      html: `
        <h2>Payment Confirmed!</h2>
        <p>We have received your payment of K${amount} for loan <strong>${reference}</strong>.</p>
        <p><strong>Remaining Balance:</strong> K${remainingBalance.toFixed(2)}</p>
        ${remainingBalance === 0 ? '<p>🎉 Congratulations! Your loan is now fully repaid!</p>' : ''}
        <p>Thank you for your payment!</p>
        <p>Best regards,<br/>WanPaus Team</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send payment received email:', error);
  }
}

/**
 * Send overdue reminder
 */
export async function sendOverdueReminder(data: ReminderEmailData): Promise<void> {
  try {
    await resend.emails.send({
      from: `WanPaus <${FROM_EMAIL}>`,
      to: data.customerName, // Should be email
      subject: `Payment Reminder - ${data.reference} (${data.daysOverdue} days overdue)`,
      html: `
        <h2>Payment Reminder</h2>
        <p>Dear Customer,</p>
        <p>This is a reminder that your loan <strong>${data.reference}</strong> is now <strong>${data.daysOverdue} days overdue</strong>.</p>
        <p><strong>Loan Details:</strong></p>
        <ul>
          <li>Original Due Date: ${data.dueDate}</li>
          <li>Amount Overdue: K${data.overdueAmount.toFixed(2)}</li>
        </ul>
        <p><strong>Important:</strong> Loans overdue by 14+ days will result in account downgrade to K50 limit and loss of trustworthy status.</p>
        <p>Please make your payment as soon as possible to avoid penalties.</p>
        <p>Best regards,<br/>WanPaus Team</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send overdue reminder email:', error);
  }
}

/**
 * Send tier upgraded notification
 */
export async function sendTierUpgraded(email: string, name: string, oldLimit: number, newLimit: number): Promise<void> {
  try {
    await resend.emails.send({
      from: `WanPaus <${FROM_EMAIL}>`,
      to: email,
      subject: `🎉 Congratulations! Tier Upgraded to K${newLimit}`,
      html: `
        <h2>🎉 Tier Upgrade!</h2>
        <p>Dear ${name},</p>
        <p>Congratulations on your excellent repayment history!</p>
        <p>Your loan limit has been upgraded from <strong>K${oldLimit}</strong> to <strong>K${newLimit}</strong>!</p>
        <p>You can now apply for loans up to K${newLimit}.</p>
        <p>Keep up the great work!</p>
        <p>Best regards,<br/>WanPaus Team</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send tier upgraded email:', error);
  }
}

/**
 * Send default notice
 */
export async function sendDefaultNotice(email: string, reference: string, daysOverdue: number): Promise<void> {
  try {
    await resend.emails.send({
      from: `WanPaus <${FROM_EMAIL}>`,
      to: email,
      subject: `URGENT: Loan ${reference} Defaulted`,
      html: `
        <h2>Loan Default Notice</h2>
        <p>Your loan <strong>${reference}</strong> has been marked as defaulted after ${daysOverdue} days overdue.</p>
        <p><strong>Consequences:</strong></p>
        <ul>
          <li>Loan limit reset to K50</li>
          <li>Trustworthy status removed</li>
          <li>Requires rebuilding credit history</li>
        </ul>
        <p>Please contact us immediately to arrange payment and avoid further action.</p>
        <p>Best regards,<br/>WanPaus Team</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send default notice email:', error);
  }
}

/**
 * Send admin notification
 */
export async function sendAdminNotification(action: string, details: string): Promise<void> {
  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL || 'admin@wanpaus.com.pg';

  try {
    await resend.emails.send({
      from: `WanPaus System <${FROM_EMAIL}>`,
      to: adminEmail,
      subject: `Admin Alert: ${action}`,
      html: `
        <h2>WanPaus Admin Notification</h2>
        <p><strong>Action:</strong> ${action}</p>
        <p><strong>Details:</strong> ${details}</p>
        <p>Please review in the admin dashboard.</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send admin notification:', error);
  }
}
