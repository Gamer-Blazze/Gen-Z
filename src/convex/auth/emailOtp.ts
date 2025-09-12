import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { alphabet, generateRandomString } from "oslo/crypto";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  generateVerificationToken() {
    return generateRandomString(6, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    try {
      // Add: use env-configured From name and email, with sensible defaults
      const fromName =
        process.env.VLY_EMAIL_FROM_NAME ||
        process.env.VLY_APP_NAME ||
        "Gen-Z";
      const fromEmail =
        process.env.VLY_EMAIL_FROM_EMAIL ||
        "no-reply@vly.ai";

      await axios.post(
        "https://email.vly.ai/send_otp",
        {
          to: email,
          otp: token,
          appName: process.env.VLY_APP_NAME || "a vly.ai application",
          // Add: explicit sender identity for better display in Gmail/clients
          fromName,
          fromEmail,
        },
        {
          headers: {
            "x-api-key": "vlytothemoon2025",
          },
        },
      );
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});