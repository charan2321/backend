import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

async function testSendGrid() {
    try {
        await sgMail.send({
            to: "techwithme1001@gmail.com",
            from: {
                name: "LinguaStar",
                email: process.env.SENDGRID_FROM_EMAIL as string
            },
            subject: "Test SendGrid Configuration",
            html: "<p>This is a test email.</p>"
        });
        console.log("SendGrid email sent successfully!");
    } catch (error: any) {
        console.error("SendGrid Error Response:", error.response?.body || error.message);
    }
}

testSendGrid();
