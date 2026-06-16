const fs = require("fs");
const path = require("path");

const dir = "src/environments";
const file = "environment.ts";

const content = `export const environment = {
  production: true,
  emailjs: {
    serviceID: '${process.env.EMAILJS_SERVICE_ID || ""}',
    templateID: '${process.env.EMAILJS_TEMPLATE_ID || ""}',
    publicKey: '${process.env.EMAILJS_PUBLIC_KEY || ""}',
    toEmail: '${process.env.EMAILJS_TO_EMAIL || ""}'
  }
};
`;

try {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), content);
  console.log("Environment variables successfully generated.");
} catch (error) {
  console.error(error);
  process.exit(1);
}
