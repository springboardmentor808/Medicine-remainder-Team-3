"""
PillSync OpenStreetMap Pharmacy Service.

Queries the free OpenStreetMap Overpass API (no API key required)
to discover nearby pharmacies based on the user's GPS coordinates.
Includes Haversine formula distance calculation and sorting.
"""

import math
from typing import Optional

import httpx

from app.schemas.pharmacy_schema import PharmacyResponse


OVERPASS_API_URL = "https://overpass-api.de/api/interpreter"


def haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate the great-circle distance between two points
    on Earth using the Haversine formula.

    Returns:
        Distance in kilometers (rounded to 2 decimal places).
    """
    R = 6371.0  # Earth's radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c

    return round(distance, 2)


async def find_nearby_pharmacies(
    latitude: float,
    longitude: float,
    radius_km: float = 5.0,
    limit: int = 10,
) -> list[PharmacyResponse]:
    """
    Query OpenStreetMap's Overpass API for nearby pharmacies.

    Args:
        latitude: User's GPS latitude.
        longitude: User's GPS longitude.
        radius_km: Search radius in kilometers (default: 5km).
        limit: Max pharmacies to return (default: 10).

    Returns:
        List of PharmacyResponse objects sorted by nearest distance.
    """
    radius_meters = int(radius_km * 1000)

    # Overpass QL query for amenity=pharmacy within radius
    overpass_query = f"""
    [out:json][timeout:10];
    (
      node["amenity"="pharmacy"](around:{radius_meters},{latitude},{longitude});
      way["amenity"="pharmacy"](around:{radius_meters},{latitude},{longitude});
    );
    out center body;
    """

    pharmacies: list[PharmacyResponse] = []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                OVERPASS_API_URL,
                data={"data": overpass_query},
            )
            if response.status_code != 200:
                print(f"[OSM Pharmacy] Overpass API returned {response.status_code}")
                return _get_fallback_pharmacies(latitude, longitude)

            data = response.json()
            elements = data.get("elements", [])

            for elem in elements:
                # Extract coordinates (node uses lat/lon, way uses center.lat/lon)
                elem_lat = elem.get("lat") or elem.get("center", {}).get("lat")
                elem_lon = elem.get("lon") or elem.get("center", {}).get("lon")

                if not elem_lat or not elem_lon:
                    continue

                tags = elem.get("tags", {})
                name = (
                    tags.get("name")
                    or tags.get("name:en")
                    or tags.get("brand")
                    or "Local Pharmacy"
                )

                # Format address from OSM tags
                address_parts = [
                    tags.get("addr:housenumber"),
                    tags.get("addr:street"),
                    tags.get("addr:suburb"),
                    tags.get("addr:city"),
                ]
                address = ", ".join([p for p in address_parts if p]) or tags.get("address")

                dist = haversine_distance(latitude, longitude, elem_lat, elem_lon)

                pharmacies.append(
                    PharmacyResponse(
                        name=name,
                        distance_km=dist,
                        address=address,
                        latitude=elem_lat,
                        longitude=elem_lon,
                        phone=tags.get("phone") or tags.get("contact:phone"),
                        opening_hours=tags.get("opening_hours"),
                    )
                )

            # Sort by distance
            pharmacies.sort(key=lambda p: p.distance_km)
            return pharmacies[:limit]

    except Exception as e:
        print(f"[OSM Pharmacy Exception]: {e}")
        return _get_fallback_pharmacies(latitude, longitude)


def _get_fallback_pharmacies(
    lat: float, lon: float
) -> list[PharmacyResponse]:
    """Fallback sample pharmacies if OpenStreetMap service is unreachable."""
    return [
        PharmacyResponse(
            name="Apollo Pharmacy (Sample Nearby)",
            distance_km=0.5,
            address="Near City Center",
            latitude=lat + 0.003,
            longitude=lon + 0.003,
            phone="+91-1800-200-2020",
            opening_hours="24/7",
        ),
        PharmacyResponse(
            name="MedPlus Pharmacy (Sample Nearby)",
            distance_km=1.2,
            address="Market Complex",
            latitude=lat - 0.005,
            longitude=lon + 0.004,
            phone="+91-1800-000-1122",
            opening_hours="08:00-22:00",
        ),
    ]
