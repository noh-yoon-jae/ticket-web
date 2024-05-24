const _orp = fetch("/protection", {method: "POST", headers: {"Content-Type": "application/json", 'Authorization': localStorage.getItem('token')}})
.then(res => res.json())
.then((data) => { if(!data.status) location.href = "/" })


async function getUserData() {
  const response = await fetch('/token_user_info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': localStorage.getItem('token'),
    },
  })
  return await response.json();
}

async function main() {
  const userInfo = await getUserData();
  if(!userInfo.status) {
    return;
  }
  if(!userInfo.data) {
    return;
  }
  const { id, username, email } = userInfo.data;
}

main();