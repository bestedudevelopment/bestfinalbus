import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    auth
} from "./core/firebase.js";

import {
    getUserProfile
} from "./core/auth.js";


/* =========================================
   ELEMENTS
========================================= */

const loginForm =
    document.getElementById("loginForm");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const togglePassword =
    document.getElementById("togglePassword");

const loginButton =
    document.getElementById("loginButton");

const buttonText =
    document.getElementById("buttonText");

const buttonSpinner =
    document.getElementById("buttonSpinner");

const errorMessage =
    document.getElementById("errorMessage");


/* =========================================
   PASSWORD VISIBILITY
========================================= */

togglePassword.addEventListener(
    "click",
    () => {

        const isPassword =
            passwordInput.type === "password";


        passwordInput.type =
            isPassword
                ? "text"
                : "password";


        togglePassword.setAttribute(
            "aria-label",
            isPassword
                ? "Hide password"
                : "Show password"
        );

    }
);


/* =========================================
   LOGIN
========================================= */

loginForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        clearError();


        const email =
            emailInput.value.trim();

        const password =
            passwordInput.value;


        if (!email) {

            showError(
                "Please enter your email."
            );

            emailInput.focus();

            return;
        }


        if (!password) {

            showError(
                "Please enter your password."
            );

            passwordInput.focus();

            return;
        }


        setLoading(true);


        try {

            console.log(
                "BEST Bus: signing in..."
            );


            const credential =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            const user =
                credential.user;


            console.log(
                "Authentication successful:",
                user.uid
            );


            const profile =
                await getUserProfile(
                    user.uid
                );


            if (!profile) {

                throw new Error(
                    "Your account profile was not found."
                );
            }


            console.log(
                "Profile:",
                profile
            );


            /* =============================
               ADMIN
            ============================= */

            if (
                profile.role === "admin"
            ) {

                window.location.replace(
                    "./admin/"
                );

                return;
            }


            /* =============================
               DRIVER
            ============================= */

            if (
                profile.role === "driver"
            ) {

                if (
                    profile.active === false
                ) {

                    throw new Error(
                        "Your driver account is inactive."
                    );
                }


                if (
                    !profile.assignedBusId
                ) {

                    throw new Error(
                        "No bus is assigned to your account."
                    );
                }


                window.location.replace(
                    "./driver/"
                );

                return;
            }


            throw new Error(
                "Your account role is not configured correctly."
            );


        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );


            showError(
                getErrorMessage(error)
            );


            setLoading(false);

        }

    }
);


/* =========================================
   LOADING
========================================= */

function setLoading(
    loading
) {

    loginButton.disabled =
        loading;

    emailInput.disabled =
        loading;

    passwordInput.disabled =
        loading;


    buttonText.classList.toggle(
        "hidden",
        loading
    );


    buttonSpinner.classList.toggle(
        "hidden",
        !loading
    );

}


/* =========================================
   ERROR
========================================= */

function showError(
    message
) {

    errorMessage.textContent =
        message;

    errorMessage.classList.add(
        "show"
    );

}


function clearError() {

    errorMessage.textContent =
        "";

    errorMessage.classList.remove(
        "show"
    );

}


/* =========================================
   FIREBASE ERROR
========================================= */

function getErrorMessage(
    error
) {

    switch (error.code) {

        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/user-not-found":
            return "No account was found with this email.";

        case "auth/wrong-password":
            return "The email or password is incorrect.";

        case "auth/invalid-credential":
            return "The email or password is incorrect.";

        case "auth/user-disabled":
            return "This account has been disabled.";

        case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";

        case "auth/network-request-failed":
            return "Network error. Check your internet connection.";

        default:
            return (
                error.message ||
                "Unable to sign in. Please try again."
            );
    }

}
