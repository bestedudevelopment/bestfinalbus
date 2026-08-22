import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


/* =========================================
   GET CURRENT USER PROFILE
========================================= */

async function getUserProfile(uid) {

    if (!uid) {
        return null;
    }

    const userRef =
        doc(
            db,
            "users",
            uid
        );

    const snapshot =
        await getDoc(
            userRef
        );

    if (!snapshot.exists()) {
        return null;
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}


/* =========================================
   GET CURRENT USER
========================================= */

function getCurrentUser() {

    return auth.currentUser;

}


/* =========================================
   WATCH LOGIN STATE
========================================= */

function watchAuth(callback) {

    return onAuthStateChanged(
        auth,
        callback
    );

}


/* =========================================
   LOGOUT
========================================= */

async function logout() {

    await signOut(auth);

    window.location.href =
        "../login/";

}


/* =========================================
   REQUIRE LOGIN
========================================= */

function requireLogin(
    callback
) {

    return onAuthStateChanged(
        auth,
        async (user) => {

            if (!user) {

                window.location.href =
                    "../login/";

                return;

            }

            await callback(user);

        }
    );

}


/* =========================================
   REQUIRE ROLE
========================================= */

function requireRole(
    role,
    callback
) {

    return onAuthStateChanged(
        auth,
        async (user) => {

            if (!user) {

                window.location.href =
                    "../login/";

                return;

            }


            try {

                const profile =
                    await getUserProfile(
                        user.uid
                    );


                if (
                    !profile ||
                    profile.role !== role
                ) {

                    window.location.href =
                        "../login/";

                    return;

                }


                await callback(
                    user,
                    profile
                );


            } catch (error) {

                console.error(
                    "ROLE CHECK ERROR:",
                    error
                );

                window.location.href =
                    "../login/";

            }

        }
    );

}


/* =========================================
   EXPORT
========================================= */

export {
    getUserProfile,
    getCurrentUser,
    watchAuth,
    logout,
    requireLogin,
    requireRole
};
