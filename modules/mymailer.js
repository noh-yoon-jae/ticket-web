const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env["email"],
    pass: process.env["email_password"],
  },
});

function generateHtml(templatePath, data) {
  let template = fs.readFileSync(templatePath, 'utf8');
  Object.keys(data).forEach(key => {
    template = template.replace('{{{' + key + '}}}', data[key]);
  });
  return template;
}

const mymailer = Object.freeze({
  send(recipient, type, data, callback) {
    const emailRegex = new RegExp(
      "([!#-'*+/-9=?A-Z^-~-]+(.[!#-'*+/-9=?A-Z^-~-]+)*|\"([]!#-[^-~ \t]|(\\[\t -~]))+\")@([!#-'*+/-9=?A-Z^-~-]+(.[!#-'*+/-9=?A-Z^-~-]+)*|[[\t -Z^-~]*])",
    );
    if (!emailRegex.test(recipient)) {
      callback({
        status: false,
        reason: "유효하지 않은 이메일 주소입니다.",
      });
      return;
    }
    let templatePath = path.join(__dirname, "..", "monopoly", "mail_form");
    let attachments = [];
    switch (type) {
      case "passwordReset":
        templatePath += "/reset_password/rp.html";
        attachments = [{
          filename: 'image-1.png',
          path: path.join(__dirname, "..", "monopoly", "mail_form", "reset_password", "images", "image-1.png"),
          cid: 'image1'
        },
        {
          filename: 'image-2.jpg',
          path: path.join(__dirname, "..", "monopoly", "mail_form", "reset_password", "images", "image-2.jpeg"),
          cid: 'image2'
        }]
        break;
      case "authenticationCode":
        templatePath += "/authentication_code/ac.html";
        break;
      default:
        break;
    }

    const mailOptions = {
      from: "uibot.authenticator@gmail.com",
      to: recipient,
      subject: "인증 메일입니다",
      html: generateHtml(templatePath, data),
      attachments: attachments,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        callback({
          status: false,
          reason: "메일 전송 실패",
        });
        return;
      } else {
        callback({
          status: true,
        });
        return;
      }
    });
  },
});


module.exports = mymailer;