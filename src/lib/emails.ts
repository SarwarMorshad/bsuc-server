/** Email templates. Kept plain and inline-styled so they survive mail clients. */

const CREAM = "#f5f3ec";
const GREEN = "#006a4e";
const INK = "#1b1b1a";

function layout(heading: string, body: string, cta?: { url: string; label: string }) {
  return `
  <div style="margin:0;padding:32px 16px;background:${CREAM};font-family:Helvetica,Arial,sans-serif;color:${INK}">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e0d6;border-radius:12px;padding:32px">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${GREEN}">BSUC</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${heading}</h1>
      <div style="font-size:15px;line-height:1.6;color:#444">${body}</div>
      ${
        cta
          ? `<p style="margin:28px 0 0">
               <a href="${cta.url}" style="display:inline-block;background:${GREEN};color:${CREAM};text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:600">${cta.label}</a>
             </p>
             <p style="margin:20px 0 0;font-size:12px;color:#777;word-break:break-all">
               If the button does not work, copy this link into your browser:<br>${cta.url}
             </p>`
          : ""
      }
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px">
      <p style="margin:0;font-size:12px;color:#888">
        Bangladesh Student Union Chemnitz
      </p>
    </div>
  </div>`;
}

export function verificationEmail(name: string, url: string) {
  return {
    subject: "Confirm your email — Bangladesh Student Union Chemnitz",
    html: layout(
      `Welcome, ${name}!`,
      `<p style="margin:0">Please confirm this email address to activate your BSUC account.
       This link expires in 24 hours.</p>
       <p style="margin:12px 0 0">If you did not create an account, you can ignore this message.</p>`,
      { url, label: "Confirm my email" },
    ),
    text:
      `Welcome, ${name}!\n\n` +
      `Confirm your email address to activate your BSUC account:\n${url}\n\n` +
      `This link expires in 24 hours. If you did not create an account, ignore this message.`,
  };
}
