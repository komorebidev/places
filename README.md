# 穴場
世の中の穴場

## Features

* 🗂️ **Category filtering**

  * Filter places by categories such as:

    * Sightseeing
    * Shopping
    * Restaurants
    * Nightlife
    * Experiences
    * Hobbies
    * Meetups

* 📍 **Automatic location information**

  * Addresses and latitude/longitude coordinates are retrieved automatically.
  * Places only need a name, ID, and categories in `places.json`.
  * No need to manually enter coordinates or addresses.

* 🗺️ **Interactive map**

  * Displays recommended places using map markers.
  * Automatically adjusts the map to the relevant locations.
  * Users can select a place to focus on its map location.

* 📝 **Automatic descriptions**

  * Place descriptions are retrieved from Wikipedia.
  * A fallback placeholder is displayed when no description is available.

* 🖼️ **Automatic preview images**

  * Searches Wikimedia Commons for relevant images.
  * Images are automatically displayed on place cards.
  * If no suitable image is found, the image area remains blank.

* 🔗 **External links**

  * Normal websites are displayed as **“Visit Website”**.
  * Meetup links are automatically detected and displayed as **“View Meetup”**.
  * Meetup detection is based on the URL, so places do not need a separate Meetup category.

* 📋 **Copy address**

  * Users can copy a place's automatically retrieved address with one click.

* ⚡ **Background loading**

  * API information is loaded after the initial page renders.
  * Previously retrieved information is cached during the session to avoid unnecessary API requests.

## APIs

### OpenStreetMap Nominatim

Used to automatically find:

* Address
* Latitude
* Longitude
* Country

The maintainer only provides the place name in `places.json`.

### Wikipedia

Used to retrieve:

* Place descriptions
* Basic information about locations

### Wikimedia Commons

Used to retrieve:

* Preview images for place cards

The application searches Wikimedia Commons automatically using the place name, so image URLs do not need to be stored in `places.json`.

### ipapi.co

Used to detect the visitor's country based on their IP address when no country is explicitly selected.

## Data Structure

Places are intentionally kept simple in `places.json`:

```json
{
    "id": "tokyo-tower",
    "name": "Tokyo Tower",
    "categories": ["sightseeing"]
}
```

For places with an external website or Meetup page:

```json
{
    "id": "tokyo-international-parties",
    "name": "Tokyo International Parties",
    "categories": ["nightlife"],
    "url": "https://www.meetup.com/tokyointernationalparties/"
}
```

The application automatically obtains the remaining information from the APIs.

## Technologies

* HTML
* CSS
* JavaScript
* Leaflet
* OpenStreetMap
* Nominatim
* Wikipedia API
* Wikimedia Commons API
* ipapi.co
