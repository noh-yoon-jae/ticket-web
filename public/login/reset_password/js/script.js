const submitButton = document.querySelector("button[type='submit']");

submitButton.addEventListener("click", (e) => {
  e.preventDefault();
  const password = document.getElementById("password").value;
  const recheckPassword = document.getElementById("recheck-password").value;
  const token = window.location.href.split("token=")[1];
  if (password !== recheckPassword) {
    alert("비밀번호가 일치하지 않습니다.");
  } else {
    fetch("/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: password,
        recheckPassword: recheckPassword,
        token: token,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status) {
          location.href = "/";
        } else {
          alert(data.reason);
        }
      });
  }
});