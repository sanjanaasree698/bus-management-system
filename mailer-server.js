const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'sanjanaasree49@gmail.com',
    pass: 'kahdrgywxtupwnyb'
  }
});

app.post('/send-otp', async (req, res) => {
  const { to_email, otp } = req.body;
  if (!to_email || !otp) {
    return res.status(400).send({ error: 'Email and OTP required' });
  }

  try {
    const info = await transporter.sendMail({
      from: '"Crowd Sense Hub" <sanjanaasree49@gmail.com>',
      to: to_email,
      subject: 'Your Verification OTP',
      text: `Your OTP is: ${otp}. Please enter this in the app to complete your sign up.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #6366F1;">Crowd Sense Hub</h2>
          <p>Your one-time password for account verification is:</p>
          <h1 style="background: #EEF2FF; padding: 10px; letter-spacing: 5px; color: #4F46E5; display: inline-block; border-radius: 8px;">${otp}</h1>
          <p style="color: #64748B; font-size: 12px; margin-top: 20px;">If you did not request this, please ignore this email.</p>
        </div>
      `
    });
    console.log('OTP sent to: ' + to_email);
    res.send({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send({ error: error.toString() });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Mailer server running on port 3000');
});
