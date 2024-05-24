const mysql = require("mysql2");
const argon2 = require("argon2");
const moment = require("moment");
const crypto = require("crypto");

const DB_conf = {
  host: process.env.DB_host,
  user: process.env.DB_user,
  password: process.env.DB_password,
  port: process.env.DB_port,
  database: process.env.DB_database,
  enableKeepAlive: true,
};

let connection;
try {
  connection = mysql.createConnection(DB_conf);
} catch (error) {
  console.log(error);
}

function reconnect() {
  try {
    connection.destroy();
    connection = mysql.createConnection(DB_conf);
    console.log("Mysql-reconnect\n");
  } catch (error) {
    console.log(error);
  }
}
const interval = 10 * 60 * 1000;
setInterval(reconnect, interval);

const userDB = Object.freeze({
  reconnect() {
    try {
      connection.destroy();
      connection = mysql.createConnection(DB_conf);
      console.log("Mysql-reconnect\n");
    } catch (error) {
      console.log(error);
    }
  },
  getUser(data, queryRange) {
    return new Promise((resolve, reject) => {
      if (!data || !queryRange) {
        reject({
          status: false,
          reason: "데이터가 부족합니다.",
        });
        return;
      }
      const keys = Object.keys(data);
      const values = Object.values(data);
      const addQuery = keys.map((key) => `${key} = ?`).join(" AND ");
      const query = `SELECT * FROM users WHERE ${addQuery}`;
      connection.query(query, values, async (err, results) => {
        if (err) {
          reject({
            status: false,
            reason: "서버 오류입니다. 잠시 후 다시 시도해주세요.",
          });
          reconnect();
          console.error("서버 오류:", err);
          return;
        }
        if (!results[0]) {
          reject({
            status: false,
            reason: "해당 사용자를 찾을 수 없습니다.",
          });
          return;
        }
        const user = results[0];
        const userQueryRangeArray = {};
        for (let i = 0; i < queryRange.length; i++) {
          userQueryRangeArray[queryRange[i]] = user[queryRange[i]];
        }
        resolve({
          status: true,
          data: userQueryRangeArray,
        });
        return;
      });
    });
  },
  updateUser(userId, targetData, allowableRange) {
    return new Promise((resolve, reject) => {
      if (!targetData || !allowableRange) {
        reject({
          status: false,
          reason: "데이터가 부족합니다.",
        });
        return;
      }
      
      const updateFields = [];
      const updateValues = [];

      Object.entries(targetData).forEach(([key, value]) => {
        if (allowableRange.includes(key)) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      });

      connection.query(
        "UPDATE users SET " + updateFields.join(", ") + " WHERE id = ?",
        [...updateValues, userId],
        (err, results) => {
          if (err) {
            console.error("Error updating user: " + err.stack);
            reject({
              status: false,
              reason: "서버 오류입니다. 잠시 후 다시 시도해주세요.",
            });
            return;
          }
          resolve({
            status: true,
          });
          return;
        },
      );
    });
  },
  signin(email, password) {
    return new Promise((resolve, reject) => {
      if(!email || !password) {
        reject({
          status: false,
          reason: "데이터가 부족합니다.",
        });
        return;
      }
      const emailRegex = new RegExp(
        "([!#-'*+/-9=?A-Z^-~-]+(.[!#-'*+/-9=?A-Z^-~-]+)*|\"([]!#-[^-~ \t]|(\\[\t -~]))+\")@([!#-'*+/-9=?A-Z^-~-]+(.[!#-'*+/-9=?A-Z^-~-]+)*|[[\t -Z^-~]*])",
      );
      if (!emailRegex.test(email)) {
        reject({
          status: false,
          location: "email",
          reason: "유효하지 않은 이메일 주소입니다.",
        });
        return;
      }

      const passwordRegex = /^[a-zA-Z0-9#$%&@]+$/;
      if (!passwordRegex.test(password)) {
        reject({
          status: false,
          location: "password",
          reason: "비밀번호는 영문자와 숫자만 포함해야 합니다.",
        });
        return;
      }

      // 사용자 정보 조회 쿼리 실행
      const query = `SELECT * FROM users WHERE email = ?`;
      connection.query(query, [email], async (err, results) => {
        if (err) throw err;

        // 사용자가 존재하면 비밀번호 검증
        if (results.length > 0) {
          const user = results[0];

          try {
            if (await argon2.verify(user.password, password)) {
              resolve({
                status: true,
                user_data: user,
                reason: "로그인 성공!",
              });
              return;
            } else {
              reject({
                status: false,
                location: "password",
                reason: "이메일 또는 비밀번호가 잘못되었습니다.",
              });
              return;
            }
          } catch (error) {
            console.error("비밀번호 검증 오류:", error);
            reject({
              status: false,
              reason: "로그인 중 오류가 발생했습니다.",
            });
            reconnect();
            return;
          }
        } else {
          reject({
            status: false,
            location: "password",
            reason: "이메일 또는 비밀번호가 잘못되었습니다.",
          });
          return;
        }
      });
    });
  },
  signup(userName, userEmail, userPassword, password_recheck) {
    return new Promise((resolve, reject) => {
      if(!userName || !userEmail || !userPassword || !password_recheck) {
        reject ({
          status: false,
          reason: "데이터가 부족합니다.",
        });
        return;
      }
      
      if (userName.length < 2) {
        reject({
          status: false,
          location: "text",
          reason: "사용자 이름은 최소 2자 이상이어야 합니다.",
        });
        return;
      }

      if (userName.length > 20) {
        reject({
          status: false,
          location: "text",
          reason: "사용자 이름은 최대 20자 이하여야 합니다.",
        });
        return;
      }

      const nameRegex = /^[a-zA-Z0-9]+$/;
      if (!nameRegex.test(userName)) {
        reject({
          status: false,
          location: "text",
          reason: "허용되지 않은 특수문자가 포함되어 있습니다.",
        });
        return;
      }

      let emailRegex = new RegExp(
        "([!#-'*+/-9=?A-Z^-~-]+(.[!#-'*+/-9=?A-Z^-~-]+)*|\"([]!#-[^-~ \t]|(\\[\t -~]))+\")@([!#-'*+/-9=?A-Z^-~-]+(.[!#-'*+/-9=?A-Z^-~-]+)*|[[\t -Z^-~]*])",
      );
      if (!emailRegex.test(userEmail)) {
        reject({
          status: false,
          location: "email",
          reason: "유효하지 않은 이메일 주소입니다.",
        });
        return;
      }

      if (userPassword.length < 8) {
        reject({
          status: false,
          location: "password",
          reason: "비밀번호는 최소 8자 이상이어야 합니다.",
        });
        return;
      }

      const passwordRegex = /^[a-zA-Z0-9#$%&@]+$/;
      if (!passwordRegex.test(userPassword)) {
        reject({
          status: false,
          location: "password",
          reason: "비밀번호는 영문자와 숫자만 포함해야 합니다.",
        });
        return;
      }

      if (userPassword !== password_recheck) {
        reject({
          status: false,
          location: "recheck-password",
          reason: "비밀번호가 같지 않습니다.",
        });
        return;
      }

      const duplicateCheckQuery =
        "SELECT COUNT(*) AS count FROM users WHERE name = ? OR email = ?";
      connection.query(
        duplicateCheckQuery,
        [userName, userEmail],
        async (err, results) => {
          if (err) {
            reject({
              status: false,
              reason: "서버 오류입니다. 잠시 후 다시 시도해주세요.",
            });
            reconnect();
            console.error("중복 체크 오류:", err);
            return;
          }
          if (results[0].count > 0) {
            reject({
              status: false,
              reason: "이미 사용 중인 사용자 이름 또는 이메일입니다.",
            });
            return;
          }

          try {
            const hashedPassword = await argon2.hash(userPassword);
            const signupQuery =
              "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
            connection.query(
              signupQuery,
              [userName, userEmail, hashedPassword],
              (err, results) => {
                if (err) {
                  reject({
                    status: false,
                    reason: "서버 오류입니다. 잠시 후 다시 시도해주세요.",
                  });
                  reconnect();
                  console.error("회원가입 오류:", err);
                  return;
                } else {
                  resolve({
                    status: true,
                    reason: "회원가입이 완료되었습니다.",
                  });
                  return;
                }
              },
            );
          } catch (error) {
            reject({
              status: false,
              reason: "서버 오류입니다. 잠시 후 다시 시도해주세요.",
            });
            console.error("패스워드 암호화 오류:", error);
            return;
          }
        },
      );
    });
  },
  savePasswordResetToken(userId) {
    return new Promise((resolve, reject) => {
      const token = crypto.randomBytes(20).toString('hex');
      const koreaTime = moment().tz("Asia/Seoul");
      const expiryDate = koreaTime.add(1, "days").toDate();
      const query = "INSERT INTO password_reset_tokens (token, user_id, expiration_date) VALUES (?, ?, ?)";
      connection.query(query, [token, userId, expiryDate], (err, results) => {
        if (err) {
          console.error("Error saving password reset token:", err);
          reject({ status: false, reason: "Failed to save password reset token." });
          return;
        }
        resolve({
          status: true,
          token: token,
        });
      });
    });
  },
  getPasswordResetTokenInfo(data, queryRange) {
    return new Promise((resolve, reject) => {
      try {
        if (!data || !queryRange) {
          reject({
            status: false,
            reason: "데이터가 부족합니다.",
          });
          return;
        }
        const keys = Object.keys(data);
        const values = Object.values(data);
        const addQuery = keys.map((key) => `${key} = ?`).join(" AND ");
        const query = `SELECT * FROM password_reset_tokens WHERE ${addQuery}`;
        
        connection.query(query, values, async (err, results) => {
          if (err) {
            reject({
              status: false,
              reason: "서버 오류입니다. 잠시 후 다시 시도해주세요.",
            });
            reconnect();
            console.error("서버 오류:", err);
            return;
          }
          if (!results[0]) {
            resolve({
              status: false,
              reason: "해당 토큰을 찾을 수 없습니다.",
            });
            return;
          }
          const token = results[0];
          const tokenQueryRangeArray = {};
          for (let i = 0; i < queryRange.length; i++) {
            tokenQueryRangeArray[queryRange[i]] = token[queryRange[i]];
          }
          resolve({
            status: true,
            data: tokenQueryRangeArray,
          });
          return;
        });
      } catch (error) {
        reject({
          status: false,
          reason: error,
        });
      }
    });
  },
  updatePasswordResetToken(changesData, targetData) {
    return new Promise((resolve, reject) => {
      if (!changesData || !targetData) {
        reject({
          status: false,
          reason: "데이터가 부족합니다.",
        });
        return;
      }
      const cKeys = Object.keys(changesData);
      const cValues = Object.values(changesData);
      const tKey = Object.keys(targetData)[0];
      const tValue = targetData[tKey];

      const changesQuery = cKeys.map((key) => `${key} = ?`).join(" , ");
      
      const query = `UPDATE password_reset_tokens SET ${changesQuery} WHERE ${tKey} = ?`;
      connection.query(query, [...cValues, tValue], (err, results) => {
        if (err) {
          console.error("Error updating password reset token:", err);
          reject({ status: false, reason: "Failed to update password reset token." });
          return;
        }
        resolve({ status: true });
      });
    });
  },
  deletePasswordResetToken(data) {
    return new Promise((resolve, reject) => {
      if (!data) {
        reject({
          status: false,
          reason: "데이터가 부족합니다.",
        });
        return;
      }
      const key = Object.keys(data)[0];
      const value = Object.values(data)[0];
      
      const query = `DELETE FROM password_reset_tokens WHERE ${key} = ?`;
      connection.query(query, [value], (err, results) => {
        if (err) {
          console.error("Error deleting token:", err);
          reject({ status: false, reason: "Failed to delete token." });
          return;
        }
        resolve({ status: true });
      });
    });
  },
});

module.exports = userDB;