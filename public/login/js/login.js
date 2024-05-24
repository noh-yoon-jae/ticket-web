const _orp = fetch("/protection", {method: "POST", headers: {"Content-Type": "application/json", 'Authorization': localStorage.getItem('token')}})
.then(res => res.json())
.then((data) => { if(data.status) location.href = "/" })

jQuery(document).ready(function ($) {
  var $form_modal = $(".user-modal"),
    $form_login = $form_modal.find("#login"),
    $form_signup = $form_modal.find("#signup"),
    $form_forgot_password = $form_modal.find("#reset-password"),
    $form_modal_tab = $(".switcher"),
    $tab_login = $form_modal_tab.children("li").eq(0).children("a"),
    $tab_signup = $form_modal_tab.children("li").eq(1).children("a"),
    $forgot_password_link = $form_login.find(".form-bottom-message a"),
    $back_to_login_link = $form_forgot_password.find(".form-bottom-message a"),
    $main_nav = $(".main-nav");

  $main_nav.on("click", function (event) {
    if ($(event.target).is($main_nav)) {
      $(this).children("ul").toggleClass("is-visible");
    } else {
      $main_nav.children("ul").removeClass("is-visible");
      $form_modal.addClass("is-visible");
      $(event.target).is(".signup") ? signup_selected() : login_selected();
    }
  });

  $(".user-modal").on("click", function (event) {
    if ($(event.target).is($form_modal) || $(event.target).is(".close-form")) {
      $form_modal.removeClass("is-visible");
    }
  });
  $(document).keyup(function (event) {
    if (event.which == "27") {
      $form_modal.removeClass("is-visible");
    }
  });


  $form_modal_tab.on("click", function (event) {
    event.preventDefault();
    $(event.target).is($tab_login) ? login_selected() : signup_selected();
  });

  $(".hide-password").on("click", function () {
    var $this = $(this),
      $password_field = $this.closest(".fieldset").find("input");

    "password" == $password_field.attr("type")
      ? $password_field.attr("type", "text")
      : $password_field.attr("type", "password");
    "Show" == $this.text() ? $this.text("Hide") : $this.text("Show");
    $password_field.putCursorAtEnd();
  });

  $(".hide-recheck-password").on("click", function () {
    var $this = $(this),
      $password_field = $this.closest(".fieldset").find("input");

    "password" == $password_field.attr("type")
      ? $password_field.attr("type", "text")
      : $password_field.attr("type", "password");
    "Show" == $this.text() ? $this.text("Hide") : $this.text("Show");
    $password_field.putCursorAtEnd();
  });

  $forgot_password_link.on("click", function (event) {
    event.preventDefault();
    forgot_password_selected();
  });

  $back_to_login_link.on("click", function (event) {
    event.preventDefault();
    login_selected();
  });

  function login_selected() {
    $form_login.addClass("is-selected");
    $form_signup.removeClass("is-selected");
    $form_forgot_password.removeClass("is-selected");
    $tab_login.addClass("selected");
    $tab_signup.removeClass("selected");
  }

  function signup_selected() {
    $form_login.removeClass("is-selected");
    $form_signup.addClass("is-selected");
    $form_forgot_password.removeClass("is-selected");
    $tab_login.removeClass("selected");
    $tab_signup.addClass("selected");
  }

  function forgot_password_selected() {
    $form_login.removeClass("is-selected");
    $form_signup.removeClass("is-selected");
    $form_forgot_password.addClass("is-selected");
  }

  $form_forgot_password
    .find('input[type="submit"]')
    .on("click", function (event) {
      event.preventDefault();
      const email = document.getElementById("reset-email").value;

      fetch("/send-reset-password-mail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status) {
            alert("전송이 완료되었습니다.");
            location.href = "/";
          } else {
            alert(data.reason);
          }
        });
    });

  $form_login.find('input[type="submit"]').on("click", function (event) {
    event.preventDefault();
    const email = document.getElementById("signin-email").value;
    const password = document.getElementById("signin-password").value;
    const remember = document.getElementById("remember-me").checked;

    fetch("/sign-in", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, remember }),
    })
      .then((response) => response.json())
      .then((data) => {
        $form_login
          .find("input")
          .removeClass("has-error")
          .next("span")
          .text("")
          .removeClass("is-visible");

        if (data.status) {
          //$form_login.find('input').removeClass('has-error').next('span').removeClass('is-visible');
          localStorage.setItem('token', data.token);
          location.href = "/";
        } else {
          if (data.location) {
            $form_login
              .find(`input[type="${data.location}"]`)
              .toggleClass("has-error")
              .next("span")
              .text(data.reason)
              .toggleClass("is-visible");
          } else {
            alert(data.reason);
          }
        }
      });
  });

  $form_signup.find('input[type="submit"]').on("click", function (event) {
    event.preventDefault();
    const username = document.getElementById("signup-username").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const password_recheck = document.getElementById(
      "signup-recheck-password",
    ).value;

    fetch("/sign-up", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, email, password, password_recheck }),
    })
      .then((response) => response.json())
      .then((data) => {
        $form_signup
          .find("input")
          .removeClass("has-error")
          .next("span")
          .text("")
          .removeClass("is-visible");
        if (data.status) {
          alert("회원 가입이 완료되었습니다.")
          location.reload()
          //$form_signup.find('input').removeClass('has-error').next('span').removeClass('is-visible');
        } else {
          if (data.location) {
            $form_signup
              .find(`input[id="signup-${data.location}"]`)
              .toggleClass("has-error")
              .next("span")
              .text(data.reason)
              .toggleClass("is-visible");
          } else {
            alert(data.reason);
          }
        }
      });
  });

  if (!Modernizr.input.placeholder) {
    $("[placeholder]")
      .focus(function () {
        var input = $(this);
        if (input.val() == input.attr("placeholder")) {
          input.val("");
        }
      })
      .blur(function () {
        var input = $(this);
        if (input.val() == "" || input.val() == input.attr("placeholder")) {
          input.val(input.attr("placeholder"));
        }
      })
      .blur();
    $("[placeholder]")
      .parents("form")
      .submit(function () {
        $(this)
          .find("[placeholder]")
          .each(function () {
            var input = $(this);
            if (input.val() == input.attr("placeholder")) {
              input.val("");
            }
          });
      });
  }
});

jQuery.fn.putCursorAtEnd = function () {
  return this.each(function () {
    if (this.setSelectionRange) {
      var len = $(this).val().length * 2;
      this.setSelectionRange(len, len);
    } else {
      $(this).val($(this).val());
    }
  });
};
