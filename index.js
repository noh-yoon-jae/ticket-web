// npm modules
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const moment = require("moment-timezone");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const multer = require("multer");
const argon2 = require("argon2");
const helmet = require('helmet');
const mysql = require("mysql2");
const path = require("path");
const http = require("http");
const hbs = require("hbs");
const fs = require("fs");
//--

// custom modules
const mymailer = require("./modules/mymailer");
const userDB = require("./modules/user_db");
//--

const server_port = 3000;

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser(process.env["session_key"]));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/public", express.static(__dirname + "/public"));

const JWTsecretKey = process.env["session_key"];

app.set("view engine", "hbs");
app.set("views", __dirname + "/monopoly");

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (token) {
    jwt.verify(token, JWTsecretKey, (err, decoded) => {
      if (err) {
        req.tokenData = {status: false, reason: 'server error'};
        next();
      } else {
        const currentTime = moment().tz("Asia/Seoul").unix();
        if(decoded.expiresIn < currentTime) {
          req.tokenData = {status: false, reason: 'token expired'};
          next();
        } else {
          req.tokenData = {status: true, data: decoded};
          next();
        }
      }
    });
  } else {
    req.tokenData = {status: false, reason: 'token not found'};
    next();
  }
}

app.post('/protection', verifyToken, (req, res) => {
  if(!req.tokenData) return res.json({status: false});
  if(!req.tokenData.status) return res.json(req.tokenData);
  return res.json({status: true});
});

app.get("/", verifyToken, async (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home", "html", "home.html"));
});

app.post("/send-reset-password-mail", async (req, res) => {
  try {
    const email = req.body.email;
    if (email) {
      const user = await userDB.getUser({ email: email }, ["id"]);
      if (!user.status) {
        return res.json({
          status: false,
          reason: "User not found.",
        });
      }
      const userId = user.data.id;
      const tokenInfo = await userDB.getPasswordResetTokenInfo({ user_id: userId }, ["id"],);
      let saveResult;
      if (!tokenInfo) {
        return res.json({ status: false, reason: "Token not found." });
      }
      if (tokenInfo.status) {
        const token = crypto.randomBytes(20).toString("hex");
        const koreaTime = moment().tz("Asia/Seoul");
        const expiration_date = koreaTime.add(1, "days").toDate();
        saveResult = await userDB.updatePasswordResetToken({ token, expiration_date },{ user_id: userId },);
        saveResult.token = token;
      } else {
        saveResult = await userDB.savePasswordResetToken(userId);
      }
      if (saveResult.status) {
        mymailer.send(email,"passwordReset",{ token: saveResult.token }, function (result) {
          return res.json(result);
        });
      } else {
        return res.json({
          status: false,
          reason: "server error",
        });
      }
    } else {
      return res.json({
        status: false,
        reason: "email is required",
      });
    }
  } catch (error) {
    console.log("send-reset-password-mail error: " + JSON.stringify(error));
    res.json(error);
  }
});

app.post("/reset-password", async (req, res) => {
  const password = req.body.password;
  const recheckPassword = req.body.recheckPassword;
  const token = req.body.token;
  if (!password || !recheckPassword || !token) {
    return res.json({
      status: false,
      reason: "password, recheckPassword, token is required.",
    });
  }
  const tokenInfo = await userDB.getPasswordResetTokenInfo({ token }, ["id", "token", "user_id", "expiration_date", "used",]);
  if (!tokenInfo) {
    return res.json({ status: false, reason: "Token not found." });
  }
  if (!tokenInfo.status) {
    return res.json({
      status: false,
      reason: "token is invalid",
    });
  }
  const tokenUserId = tokenInfo.data.user_id;
  const tokenExpiryDate = tokenInfo.data.expiration_date;
  if (tokenInfo.data.used === 1) {
    return res.json({
      status: false,
      reason: "token is invalid",
    });
  }
  if (tokenExpiryDate < moment().tz("Asia/Seoul").toDate()) {
    return res.json({
      status: false,
      reason: "token is expired",
    });
  }
  if (password === recheckPassword) {
    userDB
      .getUser({ id: tokenUserId }, ["id"])
      .then(async (user) => {
        if (user) {
          const tokenUpdate = await userDB.updatePasswordResetToken({ used: 1 },{ id: tokenInfo.data.id },);
          if (!tokenUpdate.status) {
            return res.json({
              status: false,
              reason: "server error",
            });
          }
          argon2.hash(password).then((hashedPassword) => {
            userDB
              .updateUser(user.data.id, { password: hashedPassword }, ["password",])
              .then((result) => {
                res.json(result);
              })
              .catch((error) => {
                console.error(error);
                return res.json({
                  status: false,
                  reason: "서버 오류입니다. 잠시 후 다시 시도해주세요.",
                });
              });
          });
        } else {
          console.error(error);
          return res.json({
            status: false,
            reason: "서버 오류입니다. 잠시 후 다시 시도해주세요.",
          });
        }
      })
      .catch((error) => {
        console.log(error);
      });
  } else {
    return res.json({
      status: false,
      reason: "password is not matched",
    });
  }
});

app.get("/reset/token=:token", async (req, res) => {
  const token = req.params.token;
  const DBtoken = await userDB.getPasswordResetTokenInfo({ token }, ["id"]);

  if (!DBtoken.status) {
    const data = errcase(403);
    res.render("error_page/error", data);
  } else {
    res.sendFile(path.join(__dirname, "/public/login/reset_password/html/index.html"));
  }
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/login/html/login.html"));
});

app.post("/sign-in", async (req, res) => {
  try {
    const { email, password, remember } = req.body;

    const signinData = await userDB.signin(email, password);
    if (!signinData) {
      return res.json({
        status: false,
        reason: "email or password is wrong.",
      });
    }

    const userInfo = await userDB.getUser({ email }, ["id"]);
    const tokenExpiration = remember ? 30 : 1;
    const expiryDate = moment().add(tokenExpiration, "days").tz("Asia/Seoul").unix();

    if (userInfo.status) {
      const token = jwt.sign(
        { userId: userInfo.data.id, },
        JWTsecretKey,
        { expiresIn: expiryDate, },
      );
      return res.json({ status: true, token });
    } else {
      return res.json(userInfo);
    }
  } catch (error) {
    console.error(error);
    res.json(error);
  }
});

app.post("/sign-up", async (req, res) => {
  const name = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  const password_recheck = req.body.password_recheck;
  userDB
    .signup(name, email, password, password_recheck)
    .then((result) => {
      return res.json(result);
    })
    .catch((error) => {
      console.error(error);
      return res.json(error);
    });
});

app.get("/mypage", async (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "/public/user/html/mypage.html"));
  } catch (error) {
    console.error(error);
    return res.json({
      status: false,
      reason: "서버 오류",
    });
  }
});

app.post("/token_user_info", verifyToken, async (req, res) => {
  try {
    const token = req.tokenData;
    if (!token.status) return res.json({ status: false });
    const user = await userDB.getUser({ id: token.data.userId }, ["id","username","email"]);
    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.json({
      status: false,
      reason: "서버 오류",
    });
  }
});

function errcase(errCode) {
  switch (errCode) {
    case 400:
      return {
        title: `${errCode} Error`,
        h: `${errCode} Bad Request`,
        p: "요청이 유효하지 않거나 부적절합니다.",
      };
    case 401:
      return {
        title: `${errCode} Error`,
        h: `${errCode} Unauthorized`,
        p: "클라이언트 요청이 완료되지 않았습니다.",
      };
    case 403:
      return {
        title: `${errCode} Error`,
        h: `${errCode} Access denied`,
        p: "요청이 거부되었습니다.",
      };
    case 404:
      return {
        title: `${errCode} Error`,
        h: `${errCode} Not Found`,
        p: "요청한 페이지를 찾을 수 없습니다.",
      };
    case 500:
      return {
        title: `${errCode} Error`,
        h: `${errCode} Internal Server Error`,
        p: "서버에서 오류가 발생하였습니다.",
      };
    case 503:
      return {
        title: `${errCode} Error`,
        h: `${errCode} Maintenance`,
        p: "현재 이 페이지는 점검 중입니다.",
      };
    default:
      return {
        title: "Error",
        h: `${errCode} Unexpected`,
        p: "예상치 못한 오류입니다.",
      };
  }
}

app.get("*", function (req, res) {
  const data = errcase(404);
  res.render("error_page/error", data);
});

server.listen(server_port, () => {
  console.log("Server is running on port 3000");
});