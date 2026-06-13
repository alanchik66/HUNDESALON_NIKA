#!/usr/bin/env node
const url = process.env.RESEND_CHECK_URL || 'https://hundesalon-nika.com/sendmail';
const origin = process.env.RESEND_CHECK_ORIGIN || 'https://hundesalon-nika.com';

const payload = {
  name: 'HUNDESALON NIKA Resend Check',
  email: process.env.RESEND_CHECK_REPLY_TO || 'resend-check@example.com',
  message: `Resend production check ${new Date().toISOString()}. Please ignore if delivered.`,
  lang: 'ru',
  form_type: 'contact',
};

const response = await fetch(url, {
  method: 'POST',
  headers: {
    Origin: origin,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'hundesalon-nika-resend-check/1.0',
  },
  body: JSON.stringify(payload),
});

const text = await response.text();
let data = {};
try {
  data = text ? JSON.parse(text) : {};
} catch {
  data = { message: text };
}

console.log(`POST ${url}`);
console.log(`status=${response.status}`);
console.log(`message=${data.message || 'none'}`);

if (!response.ok || data.success !== true) {
  if (response.status === 503) {
    console.error('RESEND_API_KEY is missing in Cloudflare Pages runtime, or the fallback channel is not configured.');
  } else if (response.status === 502) {
    console.error('Resend rejected the request. Check the API key, verified domain, and from address.');
  }
  process.exitCode = 1;
} else {
  console.log('Resend production send path is working.');
}
