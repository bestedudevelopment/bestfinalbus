import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    auth,
    db
} from "../core/firebase.js";


/* =========================================
   ELEMENTS
========================================= */

const adminName =
    document.getElementById("adminName");

const totalBuses =
    document.getElementById("totalBuses");

const activeBuses =
    document.getElementById("activeBuses");

const totalDrivers =
    document.getElementById("totalDrivers");

const fuelAlerts =
    document.getElementById("fuelAlerts");

const busGrid =
    document.getElementById("busGrid");

const busCountLabel =
    document.getElementById("busCountLabel");

const loadingState =
    document.getElementById("loadingState");

const emptyState =
    document.getElementById("emptyState");

const todayText =
    document.getElementById("todayText");

const refreshButton =
    document.getElementById("refreshButton");

const logoutButton =
    document.getElementById("logoutButton");


/* =========================================
   DATA
========================================= */

let buses = [];
let drivers = [];
let readings = [];
let dieselRecords = [];


/* =========================================
   TODAY
========================================= */

const todayKey =
    getTodayKey();


todayText.textContent =
    formatToday();


/* =========================================
   AUTH CHECK
========================================= */

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.replace("../");

            return;

        }


        try {

            /*
             * Load the authenticated user's
             * Firestore profile.
             */

            const usersSnapshot =
                await getDocs(
                    collection(
                        db,
                        "users"
                    )
                );


            const currentProfile =
                usersSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    .find(
                        profile =>
                            profile.id === user.uid
                    );


            if (
                !currentProfile ||
                currentProfile.role !== "admin"
            ) {

                window.location.replace("../");

                return;

            }


            adminName.textContent =
                currentProfile.name ||
                "Admin";


            await loadDashboard();


        } catch (error) {

            console.error(
                "ADMIN AUTH ERROR:",
                error
            );

            showLoadingError(
                error.message
            );

        }

    }
);


/* =========================================
   LOAD DASHBOARD
========================================= */

async function loadDashboard() {

    setLoading(true);


    try {

        /*
         * Load buses
         */

        const busesSnapshot =
            await getDocs(
                collection(
                    db,
                    "buses"
                )
            );


        buses =
            busesSnapshot.docs.map(
                document => ({

                    id:
                        document.id,

                    ...document.data()

                })
            );


        /*
         * Load users
         *
         * We use one read here and separate
         * drivers/admins in JavaScript.
         */

        const usersSnapshot =
            await getDocs(
                collection(
                    db,
                    "users"
                )
            );


        const allUsers =
            usersSnapshot.docs.map(
                document => ({

                    id:
                        document.id,

                    ...document.data()

                })
            );


        drivers =
            allUsers.filter(
                user =>
                    user.role === "driver"
            );


        /*
         * Load all readings.
         *
         * We intentionally don't use complex
         * Firestore queries here yet.
         *
         * This keeps Step 1 simple and avoids
         * needing composite indexes.
         */

        const readingsSnapshot =
            await getDocs(
                collection(
                    db,
                    "readings"
                )
            );


        readings =
            readingsSnapshot.docs.map(
                document => ({

                    id:
                        document.id,

                    ...document.data()

                })
            );


        /*
         * Load diesel records.
         */

        const dieselSnapshot =
            await getDocs(
                collection(
                    db,
                    "diesel"
                )
            );


        dieselRecords =
            dieselSnapshot.docs.map(
                document => ({

                    id:
                        document.id,

                    ...document.data()

                })
            );


        updateSummary();


        renderBuses();


    } catch (error) {

        console.error(
            "DASHBOARD LOAD ERROR:",
            error
        );


        showLoadingError(
            error.message
        );


    } finally {

        setLoading(false);

    }

}


/* =========================================
   SUMMARY
========================================= */

function updateSummary() {

    const active =
        buses.filter(
            bus =>
                bus.active !== false
        );


    totalBuses.textContent =
        buses.length;


    activeBuses.textContent =
        active.length;


    totalDrivers.textContent =
        drivers.length;


    /*
     * Fuel alerts are only counted when
     * we have enough data to calculate
     * something meaningful.
     *
     * Full average logic will be built
     * in avg/ later.
     */

    const alerts =
        calculateFuelAlerts();


    fuelAlerts.textContent =
        alerts;

}


/* =========================================
   FUEL ALERTS
========================================= */

function calculateFuelAlerts() {

    let alertCount = 0;


    buses.forEach(
        bus => {

            const busDiesel =
                dieselRecords
                    .filter(
                        record =>
                            record.busId ===
                            bus.id
                    )
                    .sort(
                        sortByOdometer
                    );


            /*
             * Need at least two diesel entries
             * for a meaningful KM/L calculation.
             */

            if (
                busDiesel.length < 2
            ) {

                return;

            }


            const previous =
                busDiesel[
                    busDiesel.length - 2
                ];


            const current =
                busDiesel[
                    busDiesel.length - 1
                ];


            const km =
                Number(
                    current.odometer
                ) -
                Number(
                    previous.odometer
                );


            const litres =
                Number(
                    current.litres
                );


            if (
                km <= 0 ||
                litres <= 0
            ) {

                return;

            }


            const average =
                km / litres;


            /*
             * Expected average can later be
             * stored on the bus itself.
             *
             * For now we don't create a
             * false red flag without an
             * expected value.
             */

            const expected =
                Number(
                    bus.expectedAverage
                );


            if (
                expected > 0 &&
                Math.abs(
                    average - expected
                ) >= 1
            ) {

                alertCount++;

            }

        }
    );


    return alertCount;

}


/* =========================================
   RENDER BUSES
========================================= */

function renderBuses() {

    busGrid.innerHTML =
        "";


    busCountLabel.textContent =
        `${buses.length} ${
            buses.length === 1
                ? "bus"
                : "buses"
        }`;


    if (
        buses.length === 0
    ) {

        emptyState.classList.remove(
            "hidden"
        );

        return;

    }


    emptyState.classList.add(
        "hidden"
    );


    /*
     * Sort by bus number/name.
     */

    const sortedBuses =
        [...buses].sort(
            (a, b) =>
                String(
                    a.busNumber ||
                    a.name ||
                    ""
                ).localeCompare(
                    String(
                        b.busNumber ||
                        b.name ||
                        ""
                    )
                )
        );


    sortedBuses.forEach(
        bus => {

            const card =
                createBusCard(
                    bus
                );


            busGrid.appendChild(
                card
            );

        }
    );

}


/* =========================================
   CREATE BUS CARD
========================================= */

function createBusCard(
    bus
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "bus-card";


    /*
     * Bus information
     */

    const busNumber =
        bus.busNumber ||
        bus.name ||
        "Unnamed Bus";


    const registration =
        bus.registrationNumber ||
        bus.registrationNo ||
        "No registration";


    /*
     * Driver
     */

    const driver =
        drivers.find(
            item =>
                item.assignedBusId ===
                bus.id
        );


    const driverName =
        driver?.name ||
        "No driver assigned";


    /*
     * Today's readings
     */

    const busReadings =
        readings.filter(
            record =>
                record.busId === bus.id &&
                (
                    record.dateKey === todayKey ||
                    record.date === todayKey
                )
        );


    const morningReading =
        findReading(
            busReadings,
            "morning"
        );


    const eveningReading =
        findReading(
            busReadings,
            "evening"
        );


    /*
     * Today's diesel
     */

    const busDiesel =
        dieselRecords.filter(
            record =>
                record.busId === bus.id &&
                (
                    record.dateKey === todayKey ||
                    record.date === todayKey
                )
        );


    const totalLitres =
        busDiesel.reduce(
            (total, record) =>
                total +
                Number(
                    record.litres || 0
                ),
            0
        );


    const totalAmount =
        busDiesel.reduce(
            (total, record) =>
                total +
                Number(
                    record.amount || 0
                ),
            0
        );


    /*
     * Distance
     */

    let distance =
        null;


    if (
        morningReading &&
        eveningReading
    ) {

        distance =
            Number(
                eveningReading.odometer
            ) -
            Number(
                morningReading.odometer
            );

    }


    /*
     * Status
     */

    const active =
        bus.active !== false;


    const readingComplete =
        Boolean(
            morningReading &&
            eveningReading
        );


    /*
     * HTML
     */

    card.innerHTML = `

        <div class="bus-top">

            <div>

                <div class="bus-name">
                    ${escapeHTML(busNumber)}
                </div>

                <div class="bus-registration">
                    ${escapeHTML(registration)}
                </div>

            </div>

            <span
                class="bus-status ${
                    active
                        ? ""
                        : "inactive"
                }"
            >
                ${
                    active
                        ? "ACTIVE"
                        : "INACTIVE"
                }
            </span>

        </div>


        <div class="bus-driver">

            <div class="driver-avatar">
                ${getInitial(
                    driverName
                )}
            </div>

            <div class="driver-info">

                <span>
                    ASSIGNED DRIVER
                </span>

                <strong>
                    ${escapeHTML(driverName)}
                </strong>

            </div>

        </div>


        <div class="daily-grid">

            <div class="daily-item">

                <span>
                    MORNING
                </span>

                <strong>
                    ${
                        morningReading
                            ? formatNumber(
                                morningReading.odometer
                              )
                            : "—"
                    }
                </strong>

            </div>


            <div class="daily-item">

                <span>
                    EVENING
                </span>

                <strong>
                    ${
                        eveningReading
                            ? formatNumber(
                                eveningReading.odometer
                              )
                            : "—"
                    }
                </strong>

            </div>


            <div class="daily-item">

                <span>
                    TODAY KM
                </span>

                <strong>
                    ${
                        distance !== null
                            ? formatNumber(
                                distance
                              )
                            : "—"
                    }
                </strong>

            </div>


            <div class="daily-item">

                <span>
                    DIESEL
                </span>

                <strong>
                    ${
                        totalLitres > 0
                            ? totalLitres.toFixed(1) + " L"
                            : "—"
                    }
                </strong>

            </div>

        </div>


        <div class="reading-line">

            <div class="
                reading-status
                ${
                    readingComplete
                        ? "complete"
                        : "missing"
                "
            >

                <span class="dot"></span>

                ${
                    readingComplete
                        ? "Morning + evening recorded"
                        : "Reading incomplete"
                }

            </div>


            <span class="view-text">
                VIEW BUS →
            </span>

        </div>

    `;


    /*
     * Clicking the card opens Bus Details.
     */

    card.addEventListener(
        "click",
        () => {

            window.location.href =
                `../busdetails/?id=${encodeURIComponent(
                    bus.id
                )}`;

        }
    );


    /*
     * Store useful data on the card.
     * This will help us later if we
     * add quick actions.
     */

    card.dataset.busId =
        bus.id;


    card.dataset.dieselAmount =
        totalAmount;


    return card;

}


/* =========================================
   FIND READING
========================================= */

function findReading(
    busReadings,
    type
) {

    /*
     * New structure:
     *
     * type: "morning"
     * type: "evening"
     *
     * We take the latest entry for that
     * type in case a driver accidentally
     * submits more than once.
     */

    const matches =
        busReadings
            .filter(
                record =>
                    record.type === type
            )
            .sort(
                sortByCreatedAt
            );


    return matches.length
        ? matches[
            matches.length - 1
        ]
        : null;

}


/* =========================================
   SORT ODOMETER
========================================= */

function sortByOdometer(
    a,
    b
) {

    return (
        Number(
            a.odometer || 0
        ) -
        Number(
            b.odometer || 0
        )
    );

}


/* =========================================
   SORT CREATED AT
========================================= */

function sortByCreatedAt(
    a,
    b
) {

    const aTime =
        getTimestamp(
            a.createdAt
        );


    const bTime =
        getTimestamp(
            b.createdAt
        );


    return aTime - bTime;

}


/* =========================================
   TIMESTAMP
========================================= */

function getTimestamp(
    value
) {

    if (!value) {

        return 0;

    }


    if (
        typeof value.toMillis ===
        "function"
    ) {

        return value.toMillis();

    }


    if (
        value.seconds
    ) {

        return (
            value.seconds * 1000
        );

    }


    const parsed =
        new Date(value);


    return isNaN(
        parsed.getTime()
    )
        ? 0
        : parsed.getTime();

}


/* =========================================
   TODAY KEY
========================================= */

function getTodayKey() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


/* =========================================
   TODAY DISPLAY
========================================= */

function formatToday() {

    const now =
        new Date();


    return now.toLocaleDateString(
        "en-IN",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


/* =========================================
   FORMAT NUMBER
========================================= */

function formatNumber(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return "—";

    }


    return number.toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 1
        }
    );

}


/* =========================================
   INITIAL
========================================= */

function getInitial(
    name
) {

    if (
        !name ||
        name === "No driver assigned"
    ) {

        return "—";

    }


    return name
        .trim()
        .charAt(0)
        .toUpperCase();

}


/* =========================================
   ESCAPE HTML
========================================= */

function escapeHTML(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================
   LOADING
========================================= */

function setLoading(
    loading
) {

    if (loading) {

        loadingState.classList.remove(
            "hidden"
        );

        busGrid.classList.add(
            "hidden"
        );

        emptyState.classList.add(
            "hidden"
        );

    } else {

        loadingState.classList.add(
            "hidden"
        );

        busGrid.classList.remove(
            "hidden"
        );

    }

}


/* =========================================
   LOADING ERROR
========================================= */

function showLoadingError(
    message
) {

    loadingState.innerHTML = `

        <div style="
            color:#d92828;
            font-size:11px;
            text-align:center;
        ">

            Unable to load dashboard.

            <br><br>

            ${escapeHTML(message)}

        </div>

    `;

}


/* =========================================
   REFRESH
========================================= */

refreshButton.addEventListener(
    "click",
    async () => {

        await loadDashboard();

    }
);


/* =========================================
   LOGOUT
========================================= */

logoutButton.addEventListener(
    "click",
    async () => {

        try {

            await signOut(
                auth
            );


            window.location.replace(
                "../"
            );


        } catch (error) {

            console.error(
                "LOGOUT ERROR:",
                error
            );

        }

    }
);


/* =========================================
   NAVIGATION
========================================= */

const navItems =
    document.querySelectorAll(
        ".nav-item"
    );


const sections = {

    dashboard:
        document.getElementById(
            "dashboardSection"
        ),

    buses:
        document.getElementById(
            "busesSection"
        ),

    drivers:
        document.getElementById(
            "driversSection"
        ),

    monitoring:
        document.getElementById(
            "monitoringSection"
        ),

    reports:
        document.getElementById(
            "reportsSection"
        )

};


navItems.forEach(
    item => {

        item.addEventListener(
            "click",
            () => {

                const target =
                    item.dataset.section;


                navItems.forEach(
                    nav =>
                        nav.classList.remove(
                            "active"
                        )
                );


                item.classList.add(
                    "active"
                );


                Object.values(
                    sections
                ).forEach(
                    section =>
                        section.classList.add(
                            "hidden"
                        )
                );


                if (
                    sections[target]
                ) {

                    sections[target]
                        .classList.remove(
                            "hidden"
                        );

                }

            }
        );

    }
);
