// ============================================================
// SITE COUNTRY
// ============================================================

const SITE_COUNTRY = "JP";
const SITE_COUNTRY_NAME = "Japan";
const SITE_COUNTRY_FLAG = "🇯🇵";


// ============================================================
// SETTINGS
// ============================================================

const DESCRIPTION_PLACEHOLDER = "Description unavailable.";
const ADDRESS_PLACEHOLDER = "Address unavailable.";

const YAHOO_APP_ID =
    window.APP_CONFIG?.yahooAppId || "";

let yahooRequestQueue =
    Promise.resolve();

const placeCache = {};

let places = [];
let currentCountry = SITE_COUNTRY;
let currentCategory = "all";
let countryLoadGeneration = 0;


// ============================================================
// DOM
// ============================================================

const countryNameElement =
    document.getElementById("countryName");

const countryFlagElement =
    document.getElementById("countryFlag");

const placesContainer =
    document.getElementById("placesContainer");

const resultCount =
    document.getElementById("resultCount");


// ============================================================
// CATEGORIES
// ============================================================

const categories = [
    "all",
    "sightseeing",
    "restaurants",
    "nightlife",
    "shopping",
    "experiences",
    "hobbies",
    "meetups"
];


// ============================================================
// API EXCLUSION RULES
// ============================================================

/*
 * These categories do not use Wikipedia:
 *
 * - restaurants
 * - nightlife
 * - hobbies
 * - meetups
 */
function shouldSkipDescription(place) {

    if (!place) {
        return false;
    }

    if (
        Array.isArray(place.categories) &&
        (
            place.categories.includes("restaurants") ||
            place.categories.includes("nightlife") ||
            place.categories.includes("hobbies")
        )
    ) {
        return true;
    }

    if (isMeetup(place)) {
        return true;
    }

    return false;
}


/*
 * These categories do not use Wikimedia:
 *
 * - restaurants
 * - nightlife
 * - hobbies
 * - meetups
 *
 * There is NO fallback image.
 */
function shouldSkipImage(place) {

    if (!place) {
        return false;
    }

    if (
        Array.isArray(place.categories) &&
        (
            place.categories.includes("restaurants") ||
            place.categories.includes("nightlife") ||
            place.categories.includes("hobbies")
        )
    ) {
        return true;
    }

    if (isMeetup(place)) {
        return true;
    }

    return false;
}


// ============================================================
// LOAD PLACES
// ============================================================

async function loadPlaces() {

    try {

        const response =
            await fetch("places.json");

        if (!response.ok) {
            throw new Error(
                "Could not load places.json"
            );
        }

        places =
            await response.json();

        initializeApplication();

    } catch (error) {

        console.error(error);

        placesContainer.innerHTML = `
            <div class="empty-state">

                <h3>
                    Unable to load places
                </h3>

                <p>
                    Please check that places.json is available.
                </p>

            </div>
        `;
    }
}


// ============================================================
// INITIALIZE
// ============================================================

function initializeApplication() {

    setupCategoryButtons();

    const urlCategory =
        getCategoryFromURL();

    if (
        urlCategory &&
        categories.includes(urlCategory)
    ) {

        currentCategory =
            urlCategory;
    }

    /*
     * The site is permanently Japan-only.
     *
     * There is intentionally NO:
     *
     * - IP detection
     * - visitor country detection
     * - country selector
     * - region selector
     */
    currentCountry =
        SITE_COUNTRY;

    updateCountryDisplay();

    updateCategoryButtons();

    render();

    loadVisiblePlaceData();
}


// ============================================================
// CATEGORY BUTTONS
// ============================================================

function setupCategoryButtons() {

    const buttons =
        document.querySelectorAll(
            ".category-button"
        );

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                currentCategory =
                    button.dataset.category;

                updateCategoryButtons();

                updateURL();

                render();

                loadVisiblePlaceData();
            }
        );
    });
}


function updateCategoryButtons() {

    const buttons =
        document.querySelectorAll(
            ".category-button"
        );

    buttons.forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.category ===
            currentCategory
        );
    });
}


// ============================================================
// COUNTRY DISPLAY
// ============================================================

function updateCountryDisplay() {

    if (countryNameElement) {

        countryNameElement.textContent =
            SITE_COUNTRY_NAME;
    }

    if (countryFlagElement) {

        countryFlagElement.textContent =
            SITE_COUNTRY_FLAG;
    }
}


// ============================================================
// COUNTRY HELPERS
// ============================================================

/*
 * The site is Japan-only.
 *
 * This function remains because other API functions use the
 * country name when constructing search queries.
 */
function getCountryName() {

    return SITE_COUNTRY_NAME;
}


// ============================================================
// FILTER PLACES
// ============================================================

function getCandidatePlaces() {

    if (
        currentCategory ===
        "meetups"
    ) {

        return places.filter(
            place =>
                isMeetup(place)
        );
    }

    if (
        currentCategory ===
        "all"
    ) {

        return places;
    }

    return places.filter(
        place => {

            return (
                Array.isArray(
                    place.categories
                ) &&
                place.categories.includes(
                    currentCategory
                )
            );
        }
    );
}


// ============================================================
// RENDER
// ============================================================

function render() {

    renderCards();
}


// ============================================================
// LOAD API DATA
// ============================================================

async function loadVisiblePlaceData() {

    const countryForRequest =
        SITE_COUNTRY;

    const requestGeneration =
        countryLoadGeneration;

    const candidates =
        getCandidatePlaces();

    const placesToLoad =
        candidates.filter(
            place => {

                return !(
                    placeCache[place.id] &&
                    placeCache[place.id]
                        .countryCode ===
                        countryForRequest &&
                    placeCache[place.id]
                        .generation ===
                        requestGeneration &&
                    (
                        placeCache[place.id]
                            .loaded ||

                        placeCache[place.id]
                            .loading
                    )
                );
            }
        );

    await Promise.all(
        placesToLoad.map(
            place =>
                loadPlaceData(
                    place,
                    countryForRequest,
                    requestGeneration
                )
        )
    );

    if (
        currentCountry === countryForRequest &&
        countryLoadGeneration === requestGeneration
    ) {

        renderCards();
    }
}


// ============================================================
// LOAD ONE PLACE
// ============================================================

async function loadPlaceData(
    place,
    countryForRequest = SITE_COUNTRY,
    requestGeneration = countryLoadGeneration
) {

    if (!placeCache[place.id]) {

        placeCache[place.id] = {

            loading: false,

            loaded: false,

            location: null,

            description: null,

            image: null,

            countryCode: null,

            generation: null
        };
    }

    const cache =
        placeCache[place.id];

    if (
        cache.countryCode === countryForRequest &&
        cache.generation === requestGeneration &&
        (
            cache.loading ||
            cache.loaded
        )
    ) {
        return;
    }

    cache.loading =
        true;

    cache.loaded =
        false;

    cache.countryCode =
        countryForRequest;

    cache.generation =
        requestGeneration;

    const skipDescription =
        shouldSkipDescription(
            place
        );

    const skipImage =
        shouldSkipImage(
            place
        );

    try {

        /*
         * Address is ALWAYS fetched.
         */
        const locationPromise =
            getPlaceLocation(
                place,
                SITE_COUNTRY
            );

        /*
         * Wikipedia is skipped for:
         *
         * restaurants
         * nightlife
         * hobbies
         * meetups
         */
        const descriptionPromise =
            skipDescription
                ? Promise.resolve("")
                : getWikipediaDescription(
                    place,
                    SITE_COUNTRY
                );

        /*
         * Wikimedia is skipped for:
         *
         * restaurants
         * nightlife
         * hobbies
         * meetups
         */
        const imagePromise =
            skipImage
                ? Promise.resolve(null)
                : getWikimediaImage(
                    place,
                    SITE_COUNTRY
                );

        const [
            location,
            description,
            image
        ] = await Promise.all([
            locationPromise,
            descriptionPromise,
            imagePromise
        ]);

        /*
         * Ignore stale request.
         */
        if (
            currentCountry !== countryForRequest ||
            countryLoadGeneration !== requestGeneration ||
            cache.generation !== requestGeneration
        ) {
            return;
        }

        cache.location =
            location;

        cache.description =
            skipDescription
                ? ""
                : description;

        cache.image =
            skipImage
                ? null
                : image;

        cache.countryCode =
            countryForRequest;

        cache.loaded =
            true;

        cache.loading =
            false;

    } catch (error) {

        console.error(
            `Error loading ${place.name}:`,
            error
        );

        if (
            currentCountry !== countryForRequest ||
            countryLoadGeneration !== requestGeneration ||
            cache.generation !== requestGeneration
        ) {
            return;
        }

        cache.loading =
            false;

        cache.location = {
            address:
                ADDRESS_PLACEHOLDER,
            lat: null,
            lng: null,
            country: null
        };

        cache.description =
            skipDescription
                ? ""
                : DESCRIPTION_PLACEHOLDER;

        cache.image =
            null;

        cache.countryCode =
            countryForRequest;

        cache.loaded =
            true;
    }
}


// ============================================================
// JAPAN-ONLY LOCATION LOOKUP
// ============================================================

async function getPlaceLocation(
    place,
    countryCode = SITE_COUNTRY
) {

    /*
     * The site is Japan-only.
     *
     * Yahoo Japan is the first choice because it has strong
     * Japanese POI/address coverage.
     */
    const yahooLocation =
        await getYahooJapanLocation(
            place
        );

    if (yahooLocation) {

        /*
         * Never trust an external result blindly.
         * Yahoo results must confirm Japan.
         */
        if (
            yahooLocation.country ===
            SITE_COUNTRY
        ) {
            return yahooLocation;
        }

        console.warn(
            `Rejected non-Japan Yahoo result for "${place.name}".`
        );
    }


    // --------------------------------------------------------
    // NOMINATIM
    // --------------------------------------------------------

    const searchText =
        `${place.name}, ${SITE_COUNTRY_NAME}`;

    const url =
        "https://nominatim.openstreetmap.org/search" +
        "?q=" +
        encodeURIComponent(
            searchText
        ) +
        "&format=jsonv2" +
        "&limit=1" +
        "&addressdetails=1" +
        "&countrycodes=jp";

    try {

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                `Nominatim HTTP ${response.status}`
            );
        }

        const results =
            await response.json();

        /*
         * Nominatim found nothing.
         * Try Open-Meteo, but only accept Japan.
         */
        if (
            !Array.isArray(results) ||
            results.length === 0
        ) {

            console.warn(
                `Nominatim found no result for "${place.name}". Trying Open-Meteo.`
            );

            const fallback =
                await getCountryFromOpenMeteo(
                    place.name,
                    SITE_COUNTRY
                );

            if (
                !fallback ||
                fallback.countryCode !==
                    SITE_COUNTRY
            ) {

                return {
                    address:
                        ADDRESS_PLACEHOLDER,
                    lat: null,
                    lng: null,
                    country: null
                };
            }

            return {

                address:
                    ADDRESS_PLACEHOLDER,

                lat:
                    fallback.latitude ??
                    null,

                lng:
                    fallback.longitude ??
                    null,

                country:
                    SITE_COUNTRY
            };
        }

        const result =
            results[0];

        const address =
            result.address || {};

        /*
         * Nominatim must explicitly identify
         * the result as Japan.
         */
        const detectedCountry =
            address.country_code
                ? String(
                    address.country_code
                )
                    .trim()
                    .toUpperCase()
                : null;

        /*
         * HARD JAPAN-ONLY CHECK.
         *
         * If Nominatim gives us anything other than JP,
         * reject the result completely.
         */
        if (
            detectedCountry !==
            SITE_COUNTRY
        ) {

            console.warn(
                `Rejected non-Japan Nominatim result for "${place.name}".`,
                result
            );

            return {
                address:
                    ADDRESS_PLACEHOLDER,
                lat: null,
                lng: null,
                country: detectedCountry
            };
        }

        const latitude =
            result.lat
                ? parseFloat(
                    result.lat
                )
                : null;

        const longitude =
            result.lon
                ? parseFloat(
                    result.lon
                )
                : null;

        return {

            address:
                result.display_name ||
                ADDRESS_PLACEHOLDER,

            lat:
                latitude,

            lng:
                longitude,

            country:
                SITE_COUNTRY
        };

    } catch (error) {

        console.error(
            `Nominatim error for ${place.name}:`,
            error
        );

        /*
         * Nominatim completely failed.
         *
         * Open-Meteo is only allowed to return JP.
         */
        const fallback =
            await getCountryFromOpenMeteo(
                place.name,
                SITE_COUNTRY
            );

        if (
            !fallback ||
            fallback.countryCode !==
                SITE_COUNTRY
        ) {

            return {
                address:
                    ADDRESS_PLACEHOLDER,
                lat: null,
                lng: null,
                country: null
            };
        }

        return {

            address:
                ADDRESS_PLACEHOLDER,

            lat:
                fallback.latitude ??
                null,

            lng:
                fallback.longitude ??
                null,

            country:
                SITE_COUNTRY
        };
    }
}


// ============================================================
// YAHOO JAPAN LOCAL SEARCH
// ============================================================

async function getYahooJapanLocation(
    place
) {

    if (!YAHOO_APP_ID) {
        return null;
    }

    /*
     * Avoid a burst of simultaneous browser requests.
     */
    const previousRequest =
        yahooRequestQueue;

    let releaseQueue;

    yahooRequestQueue =
        new Promise(resolve => {

            releaseQueue =
                resolve;
        });

    await previousRequest;

    const callbackName =
        `anabaYahooSearch${Date.now()}${Math.random()
            .toString(36)
            .slice(2)}`;

    const requestURL =
        "https://map.yahooapis.jp/search/local/V1/localSearch" +
        "?appid=" +
        encodeURIComponent(YAHOO_APP_ID) +
        "&query=" +
        encodeURIComponent(
            place.searchNameJa ||
            place.name
        ) +
        "&ac=JP" +
        "&output=json" +
        "&results=1" +
        "&callback=" +
        encodeURIComponent(callbackName);

    try {

        return await new Promise(resolve => {

            const script =
                document.createElement("script");

            let settled =
                false;

            const finish =
                location => {

                    if (settled) {
                        return;
                    }

                    settled =
                        true;

                    clearTimeout(timeout);

                    delete window[callbackName];

                    script.remove();

                    resolve(location);
                };

            const timeout =
                setTimeout(
                    () => finish(null),
                    8000
                );

            window[callbackName] =
                data => {

                    const feature =
                        Array.isArray(
                            data?.Feature
                        )
                            ? data.Feature[0]
                            : null;

                    const coordinates =
                        String(
                            feature?.Geometry?.Coordinates || ""
                        )
                            .split(",")
                            .map(Number);

                    const longitude =
                        coordinates[0];

                    const latitude =
                        coordinates[1];

                    const address =
                        feature?.Property?.Address ||
                        "";

                    if (
                        !address ||
                        !Number.isFinite(latitude) ||
                        !Number.isFinite(longitude)
                    ) {
                        finish(null);
                        return;
                    }

                    const location = {

                        address,

                        lat:
                            latitude,

                        lng:
                            longitude,

                        country:
                            SITE_COUNTRY
                    };

                    finish(location);
                };

            script.onerror =
                () => finish(null);

            script.src =
                requestURL;

            document.head.appendChild(script);
        });

    } finally {

        setTimeout(
            releaseQueue,
            300
        );
    }
}


// ============================================================
// OPEN-METEO SECOND GEOCODER
// ============================================================

async function getCountryFromOpenMeteo(
    placeName,
    countryCode = SITE_COUNTRY
) {

    try {

        const url =
            "https://geocoding-api.open-meteo.com/v1/search" +
            "?name=" +
            encodeURIComponent(
                placeName
            ) +
            "&count=10" +
            "&language=en" +
            "&format=json";

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                `Open-Meteo HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        if (
            !data.results ||
            !Array.isArray(
                data.results
            ) ||
            data.results.length === 0
        ) {

            return null;
        }

        /*
         * Only accept a result whose country code
         * explicitly matches Japan.
         */
        const matchingResult =
            data.results.find(
                result => {

                    return (
                        result.country_code &&
                        String(
                            result.country_code
                        ).toUpperCase() ===
                        SITE_COUNTRY
                    );
                }
            );

        if (!matchingResult) {

            /*
             * Do NOT blindly accept the first result.
             */
            console.warn(
                `Open-Meteo found no Japan result for "${placeName}".`
            );

            return null;
        }

        return {

            countryCode:
                SITE_COUNTRY,

            latitude:
                matchingResult.latitude ??
                null,

            longitude:
                matchingResult.longitude ??
                null
        };

    } catch (error) {

        console.error(
            `Open-Meteo error for "${placeName}":`,
            error
        );

        return null;
    }
}


// ============================================================
// WIKIPEDIA
// ============================================================

async function getWikipediaDescription(
    place,
    countryCode = SITE_COUNTRY
) {

    try {

        const searchText =
            `${place.name} ${SITE_COUNTRY_NAME}`;

        const searchURL =
            "https://en.wikipedia.org/w/rest.php/v1/search/page" +
            "?q=" +
            encodeURIComponent(
                searchText
            ) +
            "&limit=5";

        const searchResponse =
            await fetch(searchURL);

        if (!searchResponse.ok) {

            throw new Error(
                `Wikipedia HTTP ${searchResponse.status}`
            );
        }

        const searchData =
            await searchResponse.json();

        if (
            !searchData.pages ||
            searchData.pages.length === 0
        ) {

            return DESCRIPTION_PLACEHOLDER;
        }

        const placeName =
            place.name.toLowerCase();

        let matchingPage =
            searchData.pages.find(
                page =>
                    page.title
                        .toLowerCase()
                        .includes(
                            placeName
                        )
            );

        if (!matchingPage) {

            matchingPage =
                searchData.pages[0];
        }

        const summaryURL =
            "https://en.wikipedia.org/api/rest_v1/page/summary/" +
            encodeURIComponent(
                matchingPage.key
            );

        const summaryResponse =
            await fetch(summaryURL);

        if (!summaryResponse.ok) {

            throw new Error(
                `Wikipedia summary HTTP ${summaryResponse.status}`
            );
        }

        const summary =
            await summaryResponse.json();

        const description =
            summary.extract ||
            summary.description ||
            "";

        if (
            typeof description !==
                "string" ||
            !description.trim()
        ) {

            return DESCRIPTION_PLACEHOLDER;
        }

        return description;

    } catch (error) {

        console.error(
            `Wikipedia error for ${place.name}:`,
            error
        );

        return DESCRIPTION_PLACEHOLDER;
    }
}


// ============================================================
// WIKIMEDIA COMMONS
// ============================================================

async function getWikimediaImage(
    place,
    countryCode = SITE_COUNTRY
) {

    try {

        const searchText =
            `${place.name} ${SITE_COUNTRY_NAME}`;

        const url =
            "https://commons.wikimedia.org/w/api.php" +
            "?action=query" +
            "&generator=search" +
            "&gsrsearch=" +
            encodeURIComponent(
                searchText
            ) +
            "&gsrnamespace=6" +
            "&gsrlimit=10" +
            "&prop=imageinfo" +
            "&iiprop=url" +
            "&iiurlwidth=800" +
            "&format=json" +
            "&origin=*";

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                `Wikimedia HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        if (
            !data.query ||
            !data.query.pages
        ) {

            return null;
        }

        const pages =
            Object.values(
                data.query.pages
            );

        if (!pages.length) {
            return null;
        }

        const normalizedName =
            place.name
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    " "
                )
                .trim();

        let bestPage =
            null;

        let bestScore =
            -Infinity;

        for (const page of pages) {

            const title =
                String(
                    page.title || ""
                )
                    .replace(
                        /^File:/i,
                        ""
                    )
                    .toLowerCase();

            let score =
                0;

            if (
                title.includes(
                    normalizedName
                )
            ) {

                score += 10;
            }

            const words =
                normalizedName
                    .split(" ")
                    .filter(Boolean);

            words.forEach(
                word => {

                    if (
                        title.includes(
                            word
                        )
                    ) {

                        score += 1;
                    }
                }
            );

            if (
                score >
                bestScore
            ) {

                bestScore =
                    score;

                bestPage =
                    page;
            }
        }

        if (!bestPage) {
            return null;
        }

        if (
            !bestPage.imageinfo ||
            !bestPage.imageinfo[0]
        ) {

            return null;
        }

        const imageInfo =
            bestPage.imageinfo[0];

        return (
            imageInfo.thumburl ||
            imageInfo.url ||
            null
        );

    } catch (error) {

        console.error(
            `Wikimedia error for ${place.name}:`,
            error
        );

        /*
         * IMPORTANT:
         *
         * No fallback image.
         */
        return null;
    }
}


// ============================================================
// MEETUP DETECTION
// ============================================================

function isMeetup(place) {

    if (!place.url) {
        return false;
    }

    try {

        const hostname =
            new URL(place.url)
                .hostname
                .toLowerCase();

        return (
            hostname ===
                "meetup.com" ||
            hostname.endsWith(
                ".meetup.com"
            )
        );

    } catch {

        return false;
    }
}


// ============================================================
// EXTERNAL LINK
// ============================================================

function getExternalLinkHTML(
    place
) {

    if (!place.url) {
        return "";
    }

    if (isMeetup(place)) {

        return `
            <a
                href="${escapeHTML(place.url)}"
                target="_blank"
                rel="noopener noreferrer"
                class="place-link meetup-link"
            >
                View Meetup →
            </a>
        `;
    }

    return `
        <a
            href="${escapeHTML(place.url)}"
            target="_blank"
            rel="noopener noreferrer"
            class="place-link"
        >
            Visit Website →
        </a>
    `;
}


// ============================================================
// VIEW ON MAP
// ============================================================

function getMapButtonHTML(
    place,
    location
) {

    if (!location) {
        return "";
    }

    /*
     * Prefer coordinates when available.
     */
    if (
        location.lat !== null &&
        location.lng !== null &&
        !isNaN(location.lat) &&
        !isNaN(location.lng)
    ) {

        const coordinates =
            `${location.lat},${location.lng}`;

        const googleMapsURL =
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                coordinates
            )}`;

        return `
            <a
                href="${escapeHTML(googleMapsURL)}"
                target="_blank"
                rel="noopener noreferrer"
                class="map-button"
            >
                View on Map ↗
            </a>
        `;
    }

    /*
     * If coordinates aren't available,
     * use the address.
     */
    if (
        location.address &&
        location.address !==
            ADDRESS_PLACEHOLDER
    ) {

        const googleMapsURL =
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                location.address
            )}`;

        return `
            <a
                href="${escapeHTML(googleMapsURL)}"
                target="_blank"
                rel="noopener noreferrer"
                class="map-button"
            >
                View on Map ↗
            </a>
        `;
    }

    return "";
}


// ============================================================
// SKELETON HELPERS
// ============================================================

function getSkeletonCardHTML(
    place
) {

    const categoriesHTML =
        Array.isArray(
            place.categories
        )
            ? place.categories
                .map(
                    category => `
                        <span class="place-category">
                            ${escapeHTML(
                                formatCategory(
                                    category
                                )
                            )}
                        </span>
                    `
                )
                .join("")
            : "";

    const meetupTag =
        isMeetup(place)
            ? `
                <span
                    class="place-category meetup-tag"
                >
                    Meetup
                </span>
            `
            : "";

    return `
        <article class="place-card">

            <div
                class="place-image-skeleton skeleton"
            >
            </div>

            <div
                class="place-card-content"
            >

                <div
                    class="skeleton skeleton-title"
                >
                </div>

                <div class="place-categories">

                    ${categoriesHTML}

                    ${meetupTag}

                </div>

                <div
                    class="skeleton skeleton-description"
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </div>

                <div
                    class="skeleton skeleton-address"
                >
                </div>

                <div class="place-actions">

                    <div
                        class="skeleton skeleton-button"
                    >
                    </div>

                    <div
                        class="skeleton skeleton-button"
                    >
                    </div>

                </div>

            </div>

        </article>
    `;
}


// ============================================================
// RENDER CARDS
// ============================================================

function renderCards() {

    if (!placesContainer) {
        return;
    }

    const candidates =
        getCandidatePlaces();

    /*
     * HARD JAPAN-ONLY FILTER.
     *
     * A recommendation is displayed only when:
     *
     * 1. places.json explicitly declares JP, OR
     * 2. the API lookup has completed and confirmed JP.
     *
     * Unknown countries are NOT displayed once loading completes.
     */
    const visiblePlaces =
        candidates.filter(
            place => {

                /*
                 * Online-only recommendations such as meetups
                 * may already declare their country in places.json.
                 */
                if (place.country) {

                    return (
                        String(
                            place.country
                        ).toUpperCase() ===
                        SITE_COUNTRY
                    );
                }

                const cache =
                    placeCache[place.id];

                /*
                 * Still loading:
                 * temporarily show the skeleton.
                 */
                if (
                    !cache ||
                    !cache.loaded ||
                    cache.countryCode !== SITE_COUNTRY ||
                    cache.generation !== countryLoadGeneration
                ) {

                    return true;
                }

                /*
                 * Completed lookup must explicitly
                 * confirm Japan.
                 */
                if (
                    cache.location &&
                    cache.location.country ===
                        SITE_COUNTRY
                ) {

                    return true;
                }

                /*
                 * Anything that cannot be confirmed
                 * as Japan is rejected.
                 */
                return false;
            }
        );

    /*
     * Sort cards alphabetically by name.
     */
    visiblePlaces.sort(
        (a, b) =>
            a.name.localeCompare(
                b.name,
                undefined,
                {
                    sensitivity: "base"
                }
            )
    );

    if (resultCount) {

        resultCount.textContent =
            `${visiblePlaces.length} recommendation${
                visiblePlaces.length === 1
                    ? ""
                    : "s"
            }`;
    }

    placesContainer.innerHTML =
        "";

    if (!visiblePlaces.length) {

        placesContainer.innerHTML = `
            <div class="empty-state">

                <h3>
                    No recommendations
                </h3>

                <p>
                    There are currently no places
                    matching this selection.
                </p>

            </div>
        `;

        return;
    }

    visiblePlaces.forEach(
        place => {

            const cache =
                placeCache[place.id];

            /*
             * Still loading:
             * show skeleton.
             */
            if (
                !cache ||
                !cache.loaded ||
                cache.countryCode !== SITE_COUNTRY ||
                cache.generation !== countryLoadGeneration
            ) {

                placesContainer
                    .insertAdjacentHTML(
                        "beforeend",
                        getSkeletonCardHTML(
                            place
                        )
                    );

                return;
            }

            const location =
                cache.location || {

                    address:
                        ADDRESS_PLACEHOLDER,

                    lat: null,

                    lng: null,

                    country: null
                };


            // ------------------------------------------------
            // DESCRIPTION
            // ------------------------------------------------

            const description =
                shouldSkipDescription(
                    place
                )
                    ? ""
                    : (
                        cache.description ||
                        DESCRIPTION_PLACEHOLDER
                    );

            let descriptionHTML =
                "";

            if (description) {

                descriptionHTML = `
                    <p class="place-description">
                        ${escapeHTML(
                            description
                        )}
                    </p>
                `;
            }


            // ------------------------------------------------
            // IMAGE
            // ------------------------------------------------

            const image =
                shouldSkipImage(
                    place
                )
                    ? null
                    : cache.image;

            let imageHTML =
                "";

            if (image) {

                imageHTML = `
                    <div class="place-image">

                        <img
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(place.name)}"
                            loading="lazy"
                            referrerpolicy="no-referrer"
                            onerror="this.parentElement.remove();"
                        >

                    </div>
                `;
            }


            // ------------------------------------------------
            // CATEGORIES
            // ------------------------------------------------

            const categoriesHTML =
                Array.isArray(
                    place.categories
                )
                    ? place.categories
                        .map(
                            category => `
                                <span class="place-category">
                                    ${escapeHTML(
                                        formatCategory(
                                            category
                                        )
                                    )}
                                </span>
                            `
                        )
                        .join("")
                    : "";

            const meetupTag =
                isMeetup(place)
                    ? `
                        <span
                            class="place-category meetup-tag"
                        >
                            Meetup
                        </span>
                    `
                    : "";


            // ------------------------------------------------
            // LINKS
            // ------------------------------------------------

            const externalLinkHTML =
                getExternalLinkHTML(
                    place
                );

            const mapButtonHTML =
                getMapButtonHTML(
                    place,
                    location
                );


            // ------------------------------------------------
            // CARD
            // ------------------------------------------------

            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "place-card";

            card.innerHTML = `

                ${imageHTML}

                <div
                    class="place-card-content"
                >

                    <h3 class="place-name">
                        ${escapeHTML(
                            place.name
                        )}
                    </h3>

                    <div class="place-categories">

                        ${categoriesHTML}

                        ${meetupTag}

                    </div>

                    ${descriptionHTML}

                    <div class="place-address">

                        <span
                            class="address-icon"
                        >
                            📍
                        </span>

                        <span>
                            ${escapeHTML(
                                location.address ||
                                ADDRESS_PLACEHOLDER
                            )}
                        </span>

                    </div>

                    <div class="place-actions">

                        ${mapButtonHTML}

                        ${externalLinkHTML}

                        <button
                            type="button"
                            class="copy-button"
                        >
                            Copy address
                        </button>

                    </div>

                </div>
            `;


            // ------------------------------------------------
            // COPY BUTTON
            // ------------------------------------------------

            const copyButton =
                card.querySelector(
                    ".copy-button"
                );

            if (copyButton) {

                copyButton.addEventListener(
                    "click",
                    () => {

                        copyAddress(
                            location.address ||
                            ADDRESS_PLACEHOLDER,
                            copyButton
                        );
                    }
                );
            }

            placesContainer
                .appendChild(card);
        }
    );
}


// ============================================================
// COPY ADDRESS
// ============================================================

async function copyAddress(
    address,
    button
) {

    try {

        await navigator.clipboard
            .writeText(address);

        const originalText =
            button.textContent;

        button.textContent =
            "✓ Copied";

        button.classList.add(
            "copied"
        );

        setTimeout(
            () => {

                button.textContent =
                    originalText;

                button.classList.remove(
                    "copied"
                );

            },
            1500
        );

    } catch {

        window.prompt(
            "Copy this address:",
            address
        );
    }
}


// ============================================================
// URL PARAMETERS
// ============================================================

function getCategoryFromURL() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return (
        params.get("category") ||
        ""
    ).toLowerCase();
}


function updateURL() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    /*
     * Country is no longer a URL parameter.
     */
    params.delete("country");

    if (
        currentCategory &&
        currentCategory !== "all"
    ) {

        params.set(
            "category",
            currentCategory
        );

    } else {

        params.delete(
            "category"
        );
    }

    const query =
        params.toString();

    const newURL =
        query
            ? `${window.location.pathname}?${query}`
            : window.location.pathname;

    window.history.replaceState(
        {},
        "",
        newURL
    );
}


// ============================================================
// FORMATTING
// ============================================================

function formatCategory(
    category
) {

    return String(category)
        .replace(
            /-/g,
            " "
        )
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );
}


// ============================================================
// HTML ESCAPING
// ============================================================

function escapeHTML(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";
    }

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


// ============================================================
// START APPLICATION
// ============================================================

loadPlaces();