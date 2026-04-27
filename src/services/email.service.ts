import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import twilio from "twilio";
import sgMail from "@sendgrid/mail";

if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || "smtp.gmail.com",
  port: Number(env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});

export const sendOtpEmail = async (email: string, otp: string) => {
  try {
    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 400px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #c9922a; text-align: center;">LinguaStar</h2>
          <p>Hello,</p>
          <p>Use the code below to verify your email address and complete your registration:</p>
          <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="font-size: 12px; color: #888;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      `;

    if (env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL) {
      await sgMail.send({
        to: email,
        from: {
          name: "LinguaStar",
          email: env.SENDGRID_FROM_EMAIL
        },
        subject: "Your Verification Code — LinguaStar",
        html: htmlContent
      });
      console.log(`[EMAIL SUCCESS] OTP email sent successfully to ${email} via SendGrid.`);
    } else {
      let currentTransporter = transporter;
      if (!env.SMTP_USER || !env.SMTP_PASS) {
        const testAccount = await nodemailer.createTestAccount();
        currentTransporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
        console.log(`Using Ethereal email fallback since SMTP credentials/SendGrid API Key not provided.`);
      }

      const info = await currentTransporter.sendMail({
        from: `"LinguaStar" <${env.SMTP_USER || "fallback@example.com"}>`,
        to: email,
        subject: "Your Verification Code — LinguaStar",
        html: htmlContent
      });
      
      if (!env.SMTP_USER || !env.SMTP_PASS) {
        console.log(`[EMAIL PREVIEW URL] OTP for ${email}: ${nodemailer.getTestMessageUrl(info)}`);
      } else {
        console.log(`Email sent successfully to ${email}`);
      }
    }
    
    // Also try to send SMS if Twilio credentials exist
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
       try {
         const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
         
         // For testing purposes: We send to TWILIO_DESTINATION_NUMBER if it exists.
         // (Since the signup form currently only asks for an email, not a phone number)
         const toPhone = env.TWILIO_DESTINATION_NUMBER || "+919353387957"; 
         const fromPhone = env.TWILIO_PHONE_NUMBER; // Must be your active Twilio sender number
         
         await client.messages.create({
           body: `Your LinguaStar verification code is: ${otp}`,
           from: fromPhone,
           to: toPhone
         });
         console.log(`[SMS SUCCESS] Twilio SMS sent to ${toPhone}`);
       } catch(e) {
         console.error("[SMS ERROR] Twilio SMS failed:", e.message);
       }
    }
    
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};
