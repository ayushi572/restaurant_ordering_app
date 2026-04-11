const crypto = require('crypto');

// Mock SMS service - replace with Twilio/Firebase in production
class OTPService {
  constructor() {
    this.otps = new Map(); // In production, use Redis or database
  }

  // Generate 6-digit OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Hash OTP for storage
  hashOTP(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  // Send OTP via SMS (mock implementation)
  async sendOTP(phone, otp) {
    console.log(`📱 MOCK SMS: OTP for ${phone} is: ${otp}`);
    console.log(`🔥 For testing, use OTP: ${otp}`);

    // In production, replace with real SMS service:
    // const twilio = require('twilio')(accountSid, authToken);
    // await twilio.messages.create({
    //   body: `Your OTP is: ${otp}`,
    //   from: '+1234567890',
    //   to: phone
    // });

    // Store OTP with expiry (5 minutes)
    const hashedOTP = this.hashOTP(otp);
    this.otps.set(phone, {
      otp: hashedOTP,
      expiry: Date.now() + 5 * 60 * 1000
    });

    return true;
  }

  // Verify OTP
  verifyOTP(phone, otp) {
    const stored = this.otps.get(phone);
    if (!stored) return false;

    if (Date.now() > stored.expiry) {
      this.otps.delete(phone);
      return false;
    }

    const hashedInput = this.hashOTP(otp);
    const isValid = hashedInput === stored.otp;

    if (isValid) {
      this.otps.delete(phone); // One-time use
    }

    return isValid;
  }

  // Rate limiting check (basic implementation)
  canSendOTP(phone) {
    // In production, implement proper rate limiting with Redis
    return true;
  }
}

module.exports = new OTPService();